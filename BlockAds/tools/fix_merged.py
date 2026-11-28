#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""修复合并后 BlockAds.plugin 的审计问题：
1. [Rule] 基座内部 93 处完全重复行 → 去重
2. [Rule] 删除 DOMAIN, afdconf.baidu.com, REJECT（硬拒改为 jq 改写，避免 SDK 回退默认配置）
3. [Rule] 追加 afdconf QUIC 禁用规则
4. [Rewrite] 删除 toblog.ctobsnssdk.com 永不生效的 reject(200)（[Rule] 已 REJECT 拦截）
5. [Rewrite] 补百度网盘开屏两条关键 jq 改写：buy/ad/conf（mode/mode_v2/tag/tag_v2 置 0）、afdconf（nad_* 置 0）
6. [MITM] hostname 粘连拆行 + 全部合并成单行 + 去重 + 补 afdconf.baidu.com
"""
import re

P = '/workspace/BlockAds/BlockAds.plugin'
with open(P, encoding='utf-8') as f:
    lines = f.read().splitlines()

# 找 section 边界
sec = {}
cur = None
for i, ln in enumerate(lines):
    m = re.match(r'^\[(.+?)\]', ln.strip())
    if m:
        cur = m.group(1)
        sec.setdefault(cur, {'start': i, 'end': i})
        continue
    if cur and sec[cur]['end'] == sec[cur]['start']:
        sec[cur]['end'] = i
# 修正各段 end 为下一段 start
starts = sorted(set(v['start'] for v in sec.values()))
for name, v in sec.items():
    nxt = [s for s in starts if s > v['start']]
    v['end'] = nxt[0] if nxt else len(lines)

# ---------- 1. [Rule] 去重 + afdconf 处理 ----------
rs, re_ = sec['Rule']['start'], sec['Rule']['end']
new_rule = []
seen = set()
removed_dup = removed_afdconf = 0
for ln in lines[rs:re_]:
    s = ln.strip()
    if s and not s.startswith('#'):
        if re.match(r'^DOMAIN\s*,\s*afdconf\.baidu\.com\s*,\s*REJECT', s):
            removed_afdconf += 1
            continue
        key = re.sub(r'\s+', '', s.lower())
        if key in seen:
            removed_dup += 1
            continue
        seen.add(key)
    new_rule.append(ln)
new_rule.append('')
new_rule.append('# ===== 合并补充：afdconf 走 jq 改写，禁用 QUIC 防止绕过 MITM =====')
new_rule.append('AND,((DOMAIN-SUFFIX,afdconf.baidu.com),(PROTOCOL,QUIC)),REJECT')
lines[rs:re_] = new_rule

# 重算偏移
delta = len(new_rule) - (re_ - rs)
for name, v in sec.items():
    if v['start'] > re_:
        v['start'] += delta
        v['end'] += delta
re_ += delta

# ---------- 2. [Rewrite] 处理 ----------
rw_s, rw_e = sec['Rewrite']['start'], sec['Rewrite']['end']
new_rw = []
removed_toblog = 0
inserted_jq = 0
for ln in lines[rw_s:rw_e]:
    s = ln.strip()
    if s.startswith('request if ${url} ~= /^https?:\\/\\/toblog\\.ctobsnssdk\\.com/i then reject(200)'):
        removed_toblog += 1
        continue
    new_rw.append(ln)
    # 在百度网盘 staticsns 素材规则后插入开屏配置改写
    if s.startswith('request if ${url} ~= /^https?:\\/\\/staticsns\\.cdn\\.bcebos\\.com\\/amis\\/.+\\/banner.png/i then reject(404)'):
        new_rw.append('# ===== 合并补充：百度网盘冷启动开屏配置接口（HAR 实证）=====')
        new_rw.append('response if ${url} ~= /^https:\\/\\/pan\\.baidu\\.com\\/buy\\/ad\\/conf\\?/i then response.json.jq(`. as $o | try (if .data then (.data |= (.mode=0 | .mode_v2=0 | .tag=0 | .tag_v2=0)) else . end) catch $o`)')
        new_rw.append('# ===== 合并补充：NAD SDK 配置 nad_* 开关全部置 0（预加载/开屏查询/数据回调）=====')
        new_rw.append('response if ${url} ~= /^https:\\/\\/afdconf\\.baidu\\.com\\/afd\\/platform\\?/i then response.json.jq(`. as $o | try (if .data.global then (.data.global |= with_entries(if .key|test("^nad_") then .value="0" else . end)) else . end) catch $o`)')
        inserted_jq += 4
lines[rw_s:rw_e] = new_rw
delta = len(new_rw) - (rw_e - rw_s)
for name, v in sec.items():
    if v['start'] > rw_e:
        v['start'] += delta
        v['end'] += delta

# ---------- 3. [MITM] hostname 重建单行 ----------
mi_s, mi_e = sec['MITM']['start'], sec['MITM']['end']
hosts = []
seen_hosts = set()
for ln in lines[mi_s:mi_e]:
    if re.match(r'\s*hostname\s*=', ln):
        # 拆粘连段
        for seg in re.split(r'hostname\s*=', ln):
            for h in seg.split(','):
                h = h.strip()
                if h and h.lower() not in seen_hosts:
                    seen_hosts.add(h.lower())
                    hosts.append(h)
for extra in ('afdconf.baidu.com',):
    if extra not in seen_hosts:
        hosts.append(extra)
new_mitm = ['[MITM]', 'hostname = ' + ', '.join(hosts), '']
lines[mi_s:mi_e] = new_mitm

with open(P, 'w', encoding='utf-8') as f:
    f.write('\n'.join(lines).rstrip('\n') + '\n')

print(f'[Rule] 去重 {removed_dup} 行, 移除 afdconf REJECT {removed_afdconf} 行, 追加 QUIC 规则 1 条')
print(f'[Rewrite] 删除 toblog 冗余改写 {removed_toblog} 行, 插入百度网盘开屏 jq {inserted_jq} 行')
print(f'[MITM] 重建单行, hostname 共 {len(hosts)} 个（含 afdconf.baidu.com）')
print(f'总行数: {len(lines)}')
