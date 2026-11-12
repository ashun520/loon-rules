# ashun520 的 Loon 配置约定（自动恢复用）

> 此文件是公开仓库的一部分，无隐私信息。每次新会话的 AI 助手应先读此文件再工作。
> AI 助手若未加载 skill，也可通过此文件重建全部配置认知。

## 仓库
- URL: https://github.com/ashun520/loon-rules
- 分支: main
- 所有插件/规则/脚本 push 到此仓库

## Loon 策略组与规则顺序（固定，不要改）

### 策略组名
- AI 分流策略组: `AI策略组`（AppleAI.list、Ai.list、AI 相关规则统一走此策略组）
- Final 兜底: `落地`（海外节点，用户不定期更换，不要硬编码节点名）

### 规则集顺序（从上到下）
```
① Ai.list / AppleAI.list  → AI策略组    ← 必须排最顶，不能被 Apple.list 吃掉 apple-relay
② adrules                 → REJECT
③ LAN                     → DIRECT
④ Apple.list              → DIRECT     ← 含 DOMAIN-SUFFIX,apple.com,DIRECT，所以 Ai 必须在它前面
⑤ China.list              → DIRECT
⑥ GEOIP,CN 本地规则        → DIRECT     ← 开关必须关闭（灰色），放在 China.list 之后、Final 之前
⑦ 海外媒体 / TikTok
⑧ Final                    → 落地
```

## GEOIP,CN 本地规则（关键约定）
- **开关：关闭（灰色）**
- 含义：域名请求也能被 GEOIP 兜底直连，同时 Ai.list 在最顶已截走 apple-relay.apple.com 不冲突
- 放错开关会导致：国内小众软件掉进 Final=落地被送海外；开着开关则国内小众软件打不开

## MITM（必须）
- 开启「**MITM over HTTP/2**」
- 证书已信任
- 每个插件在自己的 [Mitm] 段里写 hostname，不要全局乱开

## Final 兜底不要改成 DIRECT
- Apple AI 背后有动态备用中继域名不在 Ai.list 里
- Final=落地 可以兜底承接这些未知海外请求

## 开屏广告有本地缓存
- 插件装完必须杀进程重开 + 可能清 App 缓存
- 等 10–20 分钟缓存过期后再验证才准确

## 已完成插件清单（作参考）
| App | 路径 | JS | MITM |
|---|---|---|---|
| Apple AI 分流 | `AppleAI.list` | 无 | 无 |
| 闲鱼 | `Xianyu/Xianyu.plugin` | 内联 jq | mtop.taobao.com |
| 懂车帝 | `Dongchedi/Dongchedi.plugin` | 内联 jq | dcarapi.com |
| 陌陌 | `Momo/Momo.plugin` | `Momo/momo_cleaner.js` | api.immomo.com |

## Apple AI 分流域名（AppleAI.list 核心）
```
DOMAIN-SUFFIX,openai.com,AI策略组
DOMAIN-SUFFIX,chatgpt.com,AI策略组
DOMAIN-SUFFIX,oaiusercontent.com,AI策略组
DOMAIN-SUFFIX,oaistatic.com,AI策略组
DOMAIN-SUFFIX,openaiapi-site.azureedge.net,AI策略组
DOMAIN,production-openaicom-storage.azureedge.net,AI策略组
DOMAIN,openaicom-api-bdcpf8c6d2e9atf6.z01.azurefd.net,AI策略组
DOMAIN-SUFFIX,chatgpt.livekit.cloud,AI策略组
DOMAIN-SUFFIX,apple-relay.apple.com,AI策略组
DOMAIN-SUFFIX,apple-relay.cloudflare.com,AI策略组
DOMAIN-SUFFIX,apple-relay.fastly-edge.com,AI策略组
DOMAIN-SUFFIX,itunes.apple.com,AI策略组
DOMAIN-KEYWORD,siri,AI策略组
DOMAIN-SUFFIX,icloud-content.com,AI策略组
```

## AI 助手下次工作前的标准启动步骤
1. 读取 `https://raw.githubusercontent.com/ashun520/loon-rules/main/ASHUN_LOON_PROFILE.md`（本文件）
2. 按文件里的策略组名、规则顺序、开关状态执行
3. 仓库已有插件可以 `curl -sL raw.githubusercontent.com/ashun520/loon-rules/main/<path>` 读源码
4. 任何需要推送的内容 commit message 前加 `feat:`/`fix:`/`chore:` 前缀

## 触发词（用户说任何一句都应加载本文件）
- 「给 [App名] 做去广告插件」
- 「帮我更新 [App名] 插件」
- 「Apple AI 规则放最顶对吗」
- 「我的规则集顺序」
- 「China.list 还要加什么」
- 「我的 Loon 配置」
- 「换手机了帮我恢复 Loon」
