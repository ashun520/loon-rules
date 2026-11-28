#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""审计合并后的 BlockAds.plugin：
1) 完整性：可莉两插件每条有效规则/改写是否都进入了输出
2) 基座内部重复：[Rule]/[Rewrite] 段内重复行
3) 跨段冲突：[Rule] 被 REJECT 的域名同时又出现在 [Rewrite]（改写永远不生效）
4) 语法异常：[Rewrite] 中不符合新语法的行
"""
import re, sys
from collections import defaultdict

OUT = '/workspace/BlockAds/BlockAds.plugin'

def load(p):
    with open(p, encoding='utf-8', errors='replace') as f:
        return f.read().splitlines()

def sections(lines):
    d = defaultdict(list)
    cur = None
    for ln in lines:
        m = re.match(r'^\[(.+?)\]', ln.strip())
        if m:
            cur = m.group(1)
        d[cur].append(ln)
    return d

def norm(s):
    return re.sub(r'\s+', '', s.lower())

def rule_key(ln):
    # 域名规则：类型+域名(小写去空格)+动作
    m = re.match(r'^(DOMAIN(?:-SUFFIX|-KEYWORD)?|IP-CIDR|IP-CIDR6|GEOIP|FINAL|PROCESS-NAME|USER-AGENT|URL-REGEX|AND|OR|NOT),(.+)$', ln.strip())
    if not m:
        return None
    return m.group(1), norm(m.group(2))

def rewrite_key(ln):
    # 新语法: request if ${url} ~= /RE/ then action
    m = re.match(r'^(request|response)\s+if\s+\$\{url\}\s*(==|~=)\s*(\S+?)(\s+as\s+\S+)?\s+then\s+(.+)$', ln.strip())
    if not m:
        return None
    return m.group(1), m.group(2), m.group(3), norm(m.group(5))

# ---------- 加载 ----------
src_adv = sections(load('/tmp/src_BlockAdvertisers.plugin'))
src_rmv = sections(load('/tmp/src_RemoveAds.plugin'))
out = load(OUT)
out_sec = sections(out)

print('='*70)
print('【1】完整性：可莉两个插件的规则是否全部进入输出')
print('='*70)

def collect_rules(secs):
    rules = {}
    for ln in secs.get('Rule', []):
        s = ln.strip()
        if not s or s.startswith('#'):
            continue
        k = rule_key(s)
        if k:
            rules[norm(s)] = s
    return rules

adv_rules = collect_rules(src_adv)
rmv_rules = collect_rules(src_rmv)
out_text = '\n'.join(out).lower()
out_norm = norm('\n'.join(out))

missing = []
for src, name in ((adv_rules, 'BlockAdvertisers'), (rmv_rules, 'RemoveAds')):
    for k, ln in src.items():
        if k not in out_norm:
            missing.append((name, ln))
print(f'可莉 BlockAdvertisers 有效规则: {len(adv_rules)} 条')
print(f'可莉 RemoveAds 有效规则:       {len(rmv_rules)} 条')
print(f'输出中缺失: {len(missing)} 条')
for name, ln in missing[:30]:
    print(f'  MISS [{name}] {ln[:100]}')

# ---------- 改写完整性 ----------
print()
print('='*70)
print('【2】可莉 RemoveAds 改写是否全部进入输出')
print('='*70)
rmv_rw = {}
for ln in src_rmv.get('Rewrite', []):
    s = ln.strip()
    if not s or s.startswith('#'):
        continue
    k = rewrite_key(s)
    if k:
        rmv_rw[norm(s)] = s
print(f'可莉 RemoveAds 有效改写: {len(rmv_rw)} 条')
miss_rw = [ln for k, ln in rmv_rw.items() if k not in out_norm]
print(f'输出中缺失: {len(miss_rw)} 条')
for ln in miss_rw[:30]:
    print(f'  MISS {ln[:110]}')

# ---------- 基座内部重复 ----------
print()
print('='*70)
print('【3】基座(奶思 blockAds)内部重复行')
print('='*70)
for sec in ('Rule', 'Rewrite', 'Script'):
    seen, dups = defaultdict(int), []
    for ln in out_sec.get(sec, []):
        s = ln.strip()
        if not s or s.startswith('#'):
            continue
        seen[s] += 1
        if seen[s] == 2:
            dups.append(s)
    print(f'[{sec}] 重复行 {len(dups)} 处')
    for d in dups[:12]:
        print(f'  DUP {d[:110]}')

# ---------- 跨段冲突：Rule REJECT 的域名又在 Rewrite ----------
print()
print('='*70)
print('【4】跨段冲突：[Rule] REJECT 的域名同时又出现在 [Rewrite]')
print('='*70)
rule_reject_domains = set()
for ln in out_sec.get('Rule', []):
    s = ln.strip()
    m = re.match(r'^DOMAIN(?:-SUFFIX)?,([^,]+),REJECT', s)
    if m:
        rule_reject_domains.add(m.group(1).strip().lower())
# 从改写里提取域名
conflicts = []
for ln in out_sec.get('Rewrite', []):
    s = ln.strip()
    if not s or s.startswith('#'):
        continue
    for dom in re.findall(r'\\/\\/([\w*.?-]+(?:\\.\w+)*)', s):
        d = dom.replace('\\.', '.').lower()
        if d in rule_reject_domains or ('*.' + d) in rule_reject_domains:
            conflicts.append((d, s))
# 也检查 [Rule] 里的 REJECT 是否误伤改写目标(带通配)
print(f'发现疑似冲突 {len(conflicts)} 处:')
for d, s in conflicts[:25]:
    print(f'  [{d}] <- {s[:100]}')

# ---------- 语法异常 ----------
print()
print('='*70)
print('【5】[Rewrite] 语法异常行（非注释且无法解析）')
print('='*70)
bad = []
for i, ln in enumerate(out_sec.get('Rewrite', [])):
    s = ln.strip()
    if not s or s.startswith('#'):
        continue
    if not rewrite_key(s):
        bad.append((i, s))
print(f'异常行 {len(bad)} 条:')
for i, s in bad[:20]:
    print(f'  L{i} {s[:120]}')
