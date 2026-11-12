# ashun520 的 Loon 配置约定（自动恢复用）

> 此文件是公开仓库的一部分，无隐私信息。每次新会话的 AI 助手应先读此文件再工作。
> AI 助手若未加载 skill，也可通过此文件重建全部配置认知。

## 仓库
- URL: https://github.com/ashun520/loon-rules
- 分支: main
- 所有插件/规则/脚本 push 到此仓库

## Loon 策略组与规则顺序（固定，不要改）

### 策略组名
- AI 分流策略组: `AI策略组`（Ai.list、AI 相关规则统一走此策略组，常用节点 SG-HY2）
- App Store 策略组: `其他`（AppStore.list 走此策略组，必须手动选移动电信 vmess 节点）
- Final 兜底: `落地`（海外节点，用户不定期更换，不要硬编码节点名）

### 规则集顺序（从上到下）
```
① Ai.list                 → AI策略组    ← 必须排最顶，不能被 Apple.list 吃掉 apple-relay
② AppStore.list           → 其他        ← App Store 专用，必须走移动电信节点避开苹果风控
③ adrules                 → REJECT
④ LAN                     → DIRECT
⑤ Apple.list              → DIRECT     ← 含 DOMAIN-SUFFIX,apple.com,DIRECT，所以 Ai 必须在它前面
⑥ China.list              → DIRECT
⑦ GEOIP,CN 本地规则        → DIRECT     ← 开关必须关闭（灰色），放在 China.list 之后、Final 之前
⑧ 海外媒体 / TikTok
⑨ Final                    → 落地
```

## App Store 下载问题（AppStore.list 完整说明）
### 【问题根因】三重原因叠加：
1. SG-HY2 节点出口 IP 是 Cloudflare 数据中心段（104.x / 172.64.x / 198.41.x），苹果风控标记为风险段
2. Loon 的 DIRECT ≠ 真正绕开 VPN：iOS 有 VPN profile 时所有流量先到隧道，Loon DIRECT 的 DNS/QUIC 可能被异常处理
3. 移动电信 vmess 节点出口是住宅 IP 段（延迟 131-132ms 那些），苹果不拦截

### 【「其他」策略组创建步骤】
1. Loon → 配置 → 策略组 → 新建
2. **名称**：其他
3. **类型**：select（手动选择）或自动选择（按延迟）
4. **节点**：把所有「移动联通>电信」vmess 节点加进去
5. 用 App Store 时，在「其他」里选移动电信节点

### 【为什么 AppStore.list 必须走「其他」而不是 DIRECT？】
- 实测：关闭 Loon → 下载 ✅ → 走移动电信 vmess → 下载 ✅ → 走 DIRECT → 下载 ❌
- 结论：Loon 对 App Store 域名的 DIRECT 处理有问题，必须让它明确走一个干净的代理节点

### 【Ai.list 变动记录】
已从 Ai.list 删除两行（移到 AppStore.list）：
- `DOMAIN-SUFFIX,itunes.apple.com,Ai`
- `DOMAIN-SUFFIX,icloud-content.com,Ai`

Ai.list 保留 `DOMAIN,bag.itunes.apple.com,Ai` —— 这是精确匹配 Apple AI 内部元数据 API endpoint，和 App Store 下载无关。

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

## Apple AI 分流域名（Ai.list 第一部分，App Store 域名已剥离到 AppStore.list）
```
DOMAIN-SUFFIX,apple-relay.apple.com,Ai
DOMAIN-SUFFIX,apple-relay.cloudflare.com,Ai
DOMAIN-SUFFIX,apple-relay.fastly-edge.com,Ai
DOMAIN-SUFFIX,smp-device-content.apple.com,Ai
DOMAIN-SUFFIX,xp.apple.com,Ai
DOMAIN-SUFFIX,mesu.apple.com,Ai
DOMAIN,guzzoni.apple.com,Ai
DOMAIN-SUFFIX,smoot.apple.com,Ai
DOMAIN,gateway.icloud.com,Ai
DOMAIN,gs-loc-cn.apple.com,Ai
DOMAIN,gspe1-ssl.ls.apple.com,Ai
DOMAIN,p150-acsegateway.icloud.com,Ai
DOMAIN,setup.icloud.com,Ai
DOMAIN,bag.itunes.apple.com,Ai
DOMAIN-KEYWORD,siri,Ai
```
App Store 浏览/下载/登录域名（itunes.apple.com、icloud-content.com、mzstatic.com 等）统一走独立的 `AppStore.list` → `其他` 策略组（移动电信节点），避开苹果风控。

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
