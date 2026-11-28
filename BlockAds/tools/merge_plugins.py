#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
合并三个 Loon 去广告插件：
  1. /tmp/src_BlockAds.plugin        奶思 fmz200 广告拦截&净化合集（基座，8544 行）
  2. /tmp/src_BlockAdvertisers.plugin 可莉 广告平台拦截器
  3. /tmp/src_RemoveAds.plugin        可莉 广告过滤器
去重规则，同一 URL 冲突时按优先级保留更强规则。
"""
import re, sys

BASE = '/tmp'
OUT = '/workspace/BlockAds/BlockAds.plugin'

def read(p):
    return open(p, encoding='utf-8').read().splitlines()

blk = read(f'{BASE}/src_BlockAds.plugin')
adv = read(f'{BASE}/src_BlockAdvertisers.plugin')
rmv = read(f'{BASE}/src_RemoveAds.plugin')

def parse(lines):
    header, cur = [], 'header'
    secs = {}
    for ln in lines:
        m = re.match(r'^\[(.+?)\]\s*$', ln)
        if m:
            name = m.group(1).strip()
            if name.lower() == 'mitm':
                name = 'MITM'
            cur = name
            secs.setdefault(name, [])
            continue
        if cur == 'header':
            header.append(ln)
        else:
            secs.setdefault(cur, []).append(ln)
    return header, secs

h_blk, s_blk = parse(blk)
h_adv, s_adv = parse(adv)
h_rmv, s_rmv = parse(rmv)

print('=== sections ===')
for name, s in (('BlockAds', s_blk), ('BlockAdvertisers', s_adv), ('RemoveAds', s_rmv)):
    print(name, {k: len(v) for k, v in s.items()})

# ---------------- Rule 合并 ----------------
def split_inline_comment(ln):
    m = re.match(r'^(.*?)\s*//\s*(.*)$', ln)
    if m and not m.group(1).startswith(('http://', 'https://')):
        return m.group(1).strip(), m.group(2).strip()
    return ln.strip(), None

def norm_rule(ln):
    ln = re.sub(r'\s*//.*$', '', ln.strip())
    ln = re.sub(r'\s*,\s*', ',', ln)
    return ln.lower()

rule_seen = {}
rule_conflicts = []

rules_out = []
for ln in s_blk.get('Rule', []):
    s = ln.strip()
    if not s or s.startswith('#'):
        rules_out.append(ln)
        continue
    body, cmt = split_inline_comment(s)
    rule_seen[norm_rule(body)] = body
    rules_out.append(body)

def add_rules(lines, source):
    added = 0
    rules_out.append('')
    rules_out.append(f'# ==================== 合并自 {source} ====================')
    for ln in lines:
        s = ln.strip()
        if not s or s.startswith('#'):
            continue
        body, cmt = split_inline_comment(s)
        key = norm_rule(body)
        if key in rule_seen:
            if rule_seen[key].lower() != key:
                rule_conflicts.append((key, rule_seen[key], body, source))
            continue
        rule_seen[key] = body
        if cmt:
            rules_out.append(f'# {cmt}')
        rules_out.append(body)
        added += 1
    return added

a1 = add_rules(s_adv.get('Rule', []), '可莉 BlockAdvertisers')
a2 = add_rules(s_rmv.get('Rule', []), '可莉 Remove_ads_by_keli')
print(f'\n=== Rule === BlockAds 原有 {len([l for l in s_blk.get("Rule",[]) if l.strip() and not l.strip().startswith("#")])} 条')
print(f'可莉 BlockAdvertisers 新增 {a1} 条, RemoveAds 新增 {a2} 条, 冲突 {len(rule_conflicts)} 条')
print('--- Rule 冲突明细 ---')
for c in rule_conflicts[:60]:
    print(f'  保留[{c[2][:60]}] <- 丢弃[{c[1][:60]}] 来源[{c[3]}]')

# ---------------- Rewrite 合并 ----------------
REW_RE = re.compile(r'^(request|response)\s+if\s+\$\{url\}\s+(~=|!~)\s+/(.*)/([a-z]*)$')

def parse_rewrite(s):
    parts = re.split(r'\sthen\s', s, 1)
    if len(parts) < 2:
        return None
    left, action = parts
    m = REW_RE.match(left)
    if not m:
        return None
    return (m.group(1), m.group(2), m.group(3), m.group(4)), action.strip()

def action_priority(action):
    a = action.lower()
    if 'json-jq' in a or ('jq' in a and 'response' in a):
        return 10
    if 'reject_dict' in a or 'reject-array' in a:
        return 8
    if 'reject(200)' in a:
        return 7
    if 'reject(404)' in a or ('reject' in a and 'script' not in a):
        return 6
    if 'script(' in a:
        return 4
    if 'response-body' in a:
        return 9
    return 0

rew_seen = {}   # key -> (action, out_index, source)
rew_out = []
rew_conflicts = []

def add_rewrite_line(s, source):
    parsed = parse_rewrite(s)
    if parsed is None:
        rew_out.append(s)
        return
    (typ, op, pat, flags), action = parsed
    key = (typ, op, pat.lower(), flags.lower())
    if key in rew_seen:
        old_action, old_idx, old_src = rew_seen[key]
        if action_priority(action) > action_priority(old_action):
            rew_seen[key] = (action, len(rew_out), source)
            rew_out[old_idx] = s
            rew_conflicts.append((key, old_action, old_src, action, source, 'UPGRADE'))
        elif action_priority(action) == action_priority(old_action) and action != old_action:
            rew_conflicts.append((key, old_action, old_src, action, source, 'TIE-skip'))
        else:
            rew_conflicts.append((key, old_action, old_src, action, source, 'skip'))
        return
    rew_seen[key] = (action, len(rew_out), source)
    rew_out.append(s)

nonmatch = []
for ln in s_blk.get('Rewrite', []):
    s = ln.strip()
    if not s:
        rew_out.append('')
        continue
    if s.startswith('#'):
        rew_out.append(ln)
        continue
    if parse_rewrite(s) is None:
        nonmatch.append(('BlockAds', s))
        rew_out.append(s)
        continue
    add_rewrite_line(s, '奶思 BlockAds')

def add_rewrites(lines, source):
    rew_out.append('')
    rew_out.append(f'# ==================== 合并自 {source} ====================')
    for ln in lines:
        s = ln.strip()
        if not s or s.startswith('#'):
            continue
        if parse_rewrite(s) is None:
            nonmatch.append((source, s))
            rew_out.append(s)
            continue
        add_rewrite_line(s, source)

add_rewrites(s_adv.get('Rewrite', []), '可莉 BlockAdvertisers')
add_rewrites(s_rmv.get('Rewrite', []), '可莉 Remove_ads_by_keli')
print(f'\n=== Rewrite === 合并后共 {len([l for l in rew_out if l.strip() and not l.strip().startswith("#")])} 条有效规则, 冲突 {len(rew_conflicts)} 处')
print('--- 未识别格式（原样保留）---')
for src, s in nonmatch:
    print(f'  [{src}] {s[:120]}')
print('--- 冲突明细 ---')
for c in rew_conflicts[:50]:
    print(f'  {c}')

# ---------------- hostname 提取（供 MITM 补充） ----------------
def extract_host(p):
    # URL 正则里 host 在 "\/\/" 之后、第一个 "\/"（路径）之前
    m = re.search(r'\\/\\/(.*?)(?:\\/|$)', p)
    if not m:
        return None
    h = m.group(1)
    if not h or ':' in h:
        return None
    h = h.replace('\\.', '.').replace('\\-', '-')
    h = re.sub(r'\\[dws]\+?', '*', h)          # \d+ \w+ \s+
    h = re.sub(r'\.\*(\?)?', '*', h)           # .* .+ .*? .+?
    h = re.sub(r'\.\+(\?)?', '*', h)
    h = re.sub(r'\[\^?[^\]]*\]', '*', h)       # [abc] [^x]
    h = re.sub(r'\(\?[^)]*\)', '*', h)         # (?...) 分组
    if re.fullmatch(r'[A-Za-z0-9*?._-]+', h) and h not in ('http', 'https'):
        return h
    return None

mitm_existing = {}
mitm_lines = []
for ln in s_blk.get('MITM', []):
    if 'hostname' in ln.lower():
        hosts = [x.strip() for x in re.split(r'=', ln, 1)[1].split(',') if x.strip()]
        for x in hosts:
            mitm_existing.setdefault(x.lower(), x)
        mitm_lines.append(ln)
# 可莉两个插件的 MITM hostname 记录新增项
mitm_extra = {}
for s_src in (s_adv, s_rmv):
    for ln in s_src.get('MITM', []):
        if 'hostname' in ln.lower():
            hosts = [x.strip() for x in re.split(r'=', ln, 1)[1].split(',') if x.strip()]
            for x in hosts:
                if x.lower() not in mitm_existing:
                    mitm_extra.setdefault(x.lower(), x)
print(f'\n=== MITM === BlockAds 原有 {len(mitm_existing)} 个, 可莉补充 {len(mitm_extra)} 个')

new_hosts = {}
def collect_hosts(lines, source):
    for ln in lines:
        s = ln.strip()
        if not s or s.startswith('#'):
            continue
        s2 = re.sub(r'\s*//.*$', '', s).strip()
        # [Rule] 里的 URL-REGEX（带引号）
        if s2.upper().startswith('URL-REGEX'):
            m = re.search(r'"([^"]+)"', s2)
            if m:
                h = extract_host(m.group(1))
            else:
                h = None
        else:
            h = None
        # [Rewrite] 新语法
        parsed = parse_rewrite(s2)
        if parsed:
            h = extract_host(parsed[0][2])
        if h and h.lower() not in mitm_existing:
            new_hosts.setdefault(h.lower(), h)

collect_hosts(s_adv.get('Rule', []), 'adv-rule')
collect_hosts(s_adv.get('Rewrite', []), 'adv-rewrite')
collect_hosts(s_rmv.get('Rule', []), 'rmv-rule')
collect_hosts(s_rmv.get('Rewrite', []), 'rmv-rewrite')
print(f'需补充 hostname {len(new_hosts)} 个: {", ".join(sorted(new_hosts.values()))}')

# ---------------- 输出 ----------------
header = [
    '#!name=广告拦截&净化合集·综合版',
    '#!desc=合并自奶思 fmz200「广告拦截&净化合集」(支持约730款APP) + 可莉「广告平台拦截器」+ 可莉「广告过滤器」，已去重并保留更强规则。部分APP需清除缓存或重装后生效。',
    '#!author=奶思 fmz200 + 可莉 Moli-X（合并维护：ashun520）',
    '#!icon=https://raw.githubusercontent.com/fmz200/wool_scripts/main/icons/apps/AdblockPlus.png',
    '#!homepage=https://github.com/ashun520/loon-rules',
    '#!raw-url=https://github.com/ashun520/loon-rules/raw/main/BlockAds/BlockAds.plugin',
    '#!tag=去广告, 综合, 奶思, 可莉',
    '#!system=iOS, iPadOS',
    '#!system_version = ',
    '#!loon_version = 3.5.1 (998)',
    '#!date=2026-11-28',
]
# 复用 BlockAds 的说明注释块
doc_comments = [ln for ln in h_blk if ln.startswith('#') and not ln.startswith('#!')]

out = []
out += header
out += doc_comments
out.append('')
out.append('[Argument]')
out += s_blk.get('Argument', [])
out.append('')
out.append('[Rule]')
out += rules_out
out.append('')
out.append('[Rewrite]')
out += rew_out
out.append('')
out.append('[Script]')
out += s_blk.get('Script', [])
out.append('')
out.append('[MITM]')
out += mitm_lines
extra = {}
for k, v in mitm_extra.items():
    extra.setdefault(k, v)
for k, v in new_hosts.items():
    extra.setdefault(k, v)
if extra:
    out.append('hostname = ' + ', '.join(sorted(extra.values())))
out.append('')

text = '\n'.join(out).rstrip() + '\n'
import os
os.makedirs(os.path.dirname(OUT), exist_ok=True)
open(OUT, 'w', encoding='utf-8').write(text)
print(f'\n=== 输出 === {OUT} 共 {len(out)} 行, {len(text.encode("utf-8"))} 字节')
