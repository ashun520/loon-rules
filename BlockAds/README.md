# BlockAds 综合去广告插件 —— 维护指南

> 本文件是这个插件的"记忆点"。任何一次新对话，只要读这个文件就能恢复全部上下文。
> **用户想更新时，只需说："更新 BlockAds 插件，先读 BlockAds/README.md"**，接手的 AI 读完本文件即可照做。

## 一、这是什么

一个合并了三个上游插件、经过去重和审计的 Loon 综合去广告插件：

| 上游来源 | 内容 | 上游地址 |
|---|---|---|
| 奶思 fmz200 blockAds | 基座：约 730 款 App 的规则/改写/脚本 | https://raw.githubusercontent.com/fmz200/wool_scripts/main/Loon/plugin/blockAds.plugin |
| 可莉 BlockAdvertisers | 广告平台域名拦截 | https://kelee.one/Tool/Loon/Lpx/BlockAdvertisers.lpx （GitHub 镜像：https://raw.githubusercontent.com/Moli-X/Tool/X/Loon/Plugin/Kelee/BlockAdvertisers.plugin ） |
| 可莉 Remove_ads_by_keli | 单 App 精细改写 | https://kelee.one/Tool/Loon/Lpx/Remove_ads_by_keli.lpx （GitHub 镜像：https://raw.githubusercontent.com/Moli-X/Tool/X/Loon/Plugin/Kelee/Remove_ads_by_keli.plugin ） |

- 合并产物：`BlockAds/BlockAds.plugin`（约 8700 行）
- 订阅地址（用户在 Loon 里用）：`https://raw.githubusercontent.com/ashun520/loon-rules/main/BlockAds/BlockAds.plugin`
- 要求 Loon ≥ 3.5.1(998)

## 二、工具脚本（都在本目录 tools/ 下）

| 脚本 | 用途 | 用法 |
|---|---|---|
| `tools/merge_plugins.py` | 下载三个上游→合并→去重→生成 BlockAds.plugin | `python3 tools/merge_plugins.py` |
| `tools/audit_merged.py` | 审计：完整性/重复/跨段冲突/语法异常 | `python3 tools/audit_merged.py` |
| `tools/fix_merged.py` | 修复已知问题（重复行、hostname 粘连、百度网盘 jq 补充） | `python3 tools/fix_merged.py` |

注意：
- `merge_plugins.py` 和 `fix_merged.py` 里硬编码了上游 URL 与路径，换上游时改这两个文件。
- `fix_merged.py` 幂等性有限：`merge_plugins.py` 会全量重建文件，`fix_merged.py` 是对重建结果打补丁。**更新流程 = merge → fix → audit 全绿 → 提交推送**。
- kelee.one 直连可能被 Cloudflare 拦，用 Moli-X GitHub 镜像下载。

## 三、更新流程（换接口/改域名/同步上游 都走这条）

### A. 同步上游（定期更新）
1. `python3 tools/merge_plugins.py` —— 拉三个上游最新版重新合并
2. `python3 tools/fix_merged.py` —— 打补丁（含百度网盘开屏 jq、hostname 粘连修复）
3. `python3 tools/audit_merged.py` —— 必须全绿（重复 0、冲突 0、异常仅 section 头假阳性）
4. git commit + push main

### B. 用户抓包新增规则（App 更新换接口后）
1. 用户提供 HAR（冷启动抓包：杀 App → 开抓包 → 重开 → 广告出现 → 停）
2. 从 HAR 提取真实响应体（注意：HAR 里 `content.encoding == "base64"` 要先 base64 解码）
3. 写规则到 `BlockAds.plugin` 对应 App 区块，jq 表达式**必须用 HAR 真实响应端到端验证**（`jq '. as $o | try (...) catch $o'` 跑一遍）
4. 跑 `tools/audit_merged.py` 确认无回归
5. git commit + push

### C. 回滚
git 历史里每一版都在，用户说"回退到上一版"就 `git revert` / `git reset` 后 push。

## 四、已沉淀的关键经验（踩坑记录，勿重犯）

详细版见仓库根目录 `PLAYBOOK.md`，这里只记最致命的几条：

1. **开屏配置接口绝不能 REJECT**：拒了 App 回退本地缓存广告照播。只能 jq 改写（`mode/mode_v2/tag/tag_v2 = 0`）。百度 `buy/ad/conf`、飞猪 pcraft 同理。
2. **Rewrite jq 表达式里的空格**：旧语法必须写 `\x20`，否则静默截断失效。
3. **URL-REGEX 不匹配 QUIC**：QUIC 要用 `AND,((DOMAIN-SUFFIX,x),(PROTOCOL,QUIC)),REJECT`（Loon 3.1.7+）。
4. **hostname 粘连**：上游奶思的 MITM hostname 三段挤在一行（`comhostname` 粘连），合并后必须拆开成单行逗号分隔。
5. **插件冲突 > 规则缺失**：用户 Loon 里同时挂多个单 App 去广告插件会互相打架，比漏规则更糟。最终配置：HTTPDNS 拦截器（顶）+ 本综合插件 + DNS防泄露，其余单 App 插件全关。
6. **jq 兜底范式**：`. as $o | try (if ... then ... else . end) catch $o`。

## 五、百度网盘开屏链路（HAR 实证，2026-11 版）

8 个环节全部覆盖（对应插件内 `# 合并补充` 注释）：

| # | 接口/域 | 处理 |
|---|---|---|
| 1 | `pan.baidu.com/buy/ad/conf` | jq：mode/mode_v2/tag/tag_v2 → 0（**合并时补的，奶思原来没有**） |
| 2 | `afdconf.baidu.com/afd/platform` | jq：`nad_*` 开关 → "0"（**原来只有 REJECT，已改 jq**） |
| 3 | `afdconf.baidu.com` QUIC | AND 规则 REJECT 防绕过 |
| 4 | `mime.baidu.com/v5/start_screen_ads/list` | reject_dict(200) |
| 5 | `pan.baidu.com/act/api/activityentry` | reject(404) |
| 6 | `pan.baidu.com/rest/2.0/pcs/ad*` | reject(404) |
| 7 | `issuecdn.baidupcs.com/issue/netdisk/guanggao` | reject |
| 8 | `staticsns.cdn.bcebos.com/amis/*`（除 banner.png） | reject(404) |

若用户再报百度网盘开屏：先让用户在 Loon 仪表搜 `buy/ad/conf` 看 mode 是否为 0；若为 0 仍播广告 = 有新链路，要新 HAR。

## 六、版本历史

| commit | 内容 |
|---|---|
| `4cd76e2` | 审计修复 6 项：补 buy/ad/conf jq、afdconf 改 jq、hostname 粘连修复、iqiyi 笔误、去重 158 行、删死规则 |
| `1cefda0` | 首次合并三插件生成 BlockAds.plugin |

## 七、用户环境备注

- 用户 Loon 插件：HTTPDNS 拦截器（置顶）、本综合插件、DNS 防泄露；另有 adrules.top/adrules.list 规则集（保持开启，与插件不冲突）
- 用户自建单 App 插件（百度网盘 v6、飞猪 v6、懂车帝、闲鱼、米家、爱思等）已全部关闭，勿再开启
- 用户对"反复失败"不耐烦，交付前必须本地验证（jq 跑真实 HAR 数据），回复简洁、给明确步骤
