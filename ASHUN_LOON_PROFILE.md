# ashun520 的 Loon 配置约定（自动恢复用）

> 此文件是公开仓库的一部分，无隐私信息。每次新会话的 AI 助手应先读此文件再工作。
> AI 助手若未加载 skill，也可通过此文件重建全部配置认知。

## 仓库
- URL: https://github.com/ashun520/loon-rules
- 分支: main
- 所有插件/规则/脚本 push 到此仓库

## 去广告方法论（强制，所有新插件必须按此执行）
> 2026-11-13 飞猪实测验证：这套方法去开屏广告最有效，用户明确要求以后所有去广告插件都用它。

1. **独立广告域**（`ad.*`、`openad.*`、`amdc.*` 等只承载广告的域名）→ 用 `DOMAIN-SUFFIX,...,REJECT` 直接拦。
2. **业务接口里的广告配置**（MTOP/JSON 配置接口）→ **禁止直接 REJECT**。
   REJECT 会让 App 判定接口失败并回退到备用广告源，这就是「接口拦了但开屏广告还在」的根因。
   正确做法：用 `http-response` 脚本返回**结构合法的空数据**，并从响应体**深度清空广告字段**。
3. 脚本清洗原则：
   - 非 JSON / 解析失败 → `$done({})` 原样放行，绝不白屏
   - 开屏列表类字段（`seat`、`strategyMessages`、`adList`）→ 置空数组
   - 开屏对象类字段（`splash`、`brandAd`、`adInfo`、`promotion`）→ 置空对象
   - 保留 `api` / `ret` / `v` 等协议字段，返回 `SUCCESS::调用成功`
   - 熔断类接口 → 强制 `needShutDown = true`
4. 请求头处理：开屏接口先去掉 `Accept-Encoding` 里的 `zstd`，否则脚本拿不到可解析的 JSON。
5. **每个插件必须带 `#!icon`**，图标用 App Store 官方应用图标
   （通过 `https://itunes.apple.com/search?term=<App名>&country=cn&entity=software` 取 `artworkUrl512`），
   不要用来源不明的第三方图标（容易 404）。
6. 参考实现：`Feizhu/feizhu_splash_cleaner.js`（空结构清洗）、`Momo/momo_cleaner.js`（深度清洗）。
7. **配置类接口严禁写死文件名/哈希**：如 `dorangesource.alicdn.com/ns531d19b....json`。
   服务端换哈希后重写会静默失效，表现为「偶发开屏广告」（10 次出 2 次）。
   正确做法：正则匹配整域 `^https?://dorangesource\.alicdn\.com/[^\s]*$`，
   在 jq 里按内容特征判断（`.content | type == "object"`），删除所有 `test("splash";"i")` 的键。
8. MITM 只加必要域名；脚本只做本地 JSON 处理，**不得发起任何外发网络请求**、不得上传用户数据。
9. **MITM 只写精确主机，禁止通配**：App 内 WebView/自定义内核不信任 Loon CA，
   通配解密会把 H5 页面一起拦死。
   - 懂车帝实测（2026-11-13）：`*.dcarapi.com` 通配 → 「发现」页白屏 + 弹「当前网页证书不可信」；
     改成 `api.dcarapi.com` 后页面正常、弹窗消失，**开屏广告和弹窗同时解决**（v5 已验证）
   - 埋点域（如 `datasail-cn-beijing.dcarapi.com`）用 `DOMAIN-SUFFIX,...,REJECT` 在 TLS 前拦掉
   - 结论：页面域名和接口域名混在同一后缀体系时，**只 MITM 接口所在的精确主机**
10. **插件分发规范（用户日常只点「更新」，不重加）**：
    - 插件地址一律用 main 分支链接：`https://raw.githubusercontent.com/ashun520/loon-rules/main/<路径>`
    - 每次改动插件，**同时把 `#!name` 里的版本号 +1**（如 `懂车帝去广告 v5` → `v6`），
      用户看插件列表的名字即可确认是否更新成功
    - 用户操作永远是：Loon → 配置 → 插件 → 点「更新」。**不要让用户删掉重加**
    - 固定 commit 链接只用于排查 CDN 缓存顽固（raw 约 5 分钟缓存），不能作为长期地址，
      否则点「更新」永远拿到同一个旧版本（2026-11-13 用户反复「白屏+弹窗」就是踩了这个坑）
    - 换手机/刷机后：只需重新添加一次 main 链接，之后同样只点「更新」

## Loon 策略组与规则顺序（固定，不要改）

### 策略组名
- AI 分流策略组: `AI策略组`（Ai.list、AI 相关规则统一走此策略组，常用节点 SG-HY2）
- Final 兜底: `落地`（海外节点，用户不定期更换，不要硬编码节点名）

### 规则集顺序（从上到下）
```
① Ai.list                 → AI策略组    ← 必须排最顶，不能被 Apple.list 吃掉 apple-relay
② adrules                 → REJECT
③ LAN                     → DIRECT
④ Apple.list              → DIRECT     ← 含 DOMAIN-SUFFIX,apple.com,DIRECT
⑤ China.list              → DIRECT
⑥ GEOIP,CN 本地规则        → DIRECT     ← 开关必须关闭（灰色），放在 China.list 之后、Final 之前
⑦ 海外媒体 / TikTok
⑧ Final                    → 落地
```

## App Store 下载问题（已解决，留教训）
### 【真正根因（2026-11-12 已修复）】bag.itunes.apple.com 被 Ai.list 误加
- `bag.itunes.apple.com` 是 App Store 下载/登录流程的**第一步**（bag 配置 API），**不是 AI 域名**
- 它曾被误加进 Ai.list → 精确匹配 → 走 SG-HY2 → Cloudflare 数据中心 IP 被苹果风控在第一步直接拒绝
- 后续 appleid 登录和 mzstatic 下载 CDN 规则根本没机会执行
- 用户实测：禁用整个 Ai.list → 任何节点都能下载；Ai 策略组换移动电信节点 → 能下载；只开 Ai.list 用 SG-HY2 → 失败
- 修复：Ai.list 删除 bag 规则。**AppStore.list 也已删除**——因为国行 iPhone + 国内 SIM，
  苹果的 App Store/Apple ID/下载 CDN 在国内有边缘节点，自动走 Apple.list → DIRECT 直连最快最稳，
  不需要单独规则集。
- **教训**：Ai.list 里**绝对不能出现任何 itunes / mzstatic / appleid / icloud-content 域名**，
  App Store 相关域名一律让 Apple.list 的 apple.com 后缀去兜底直连。

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
| 懂车帝 | `Dongchedi/Dongchedi.plugin` | 内联 jq | api.dcarapi.com（禁止通配） |
| 陌陌 | `Momo/Momo.plugin` | `Momo/momo_cleaner.js` | api.immomo.com |
| 飞猪（强效） | `Feizhu/Feizhu.plugin` | `Feizhu/feizhu_splash_cleaner.js` + `Feizhu/fliggy_strip_zstd.js` | acs.m.taobao.com, guide-acs.m.taobao.com, market.m.taobao.com, dorangesource.alicdn.com |
| TRAE 每日签到 | `Trae/Trae.plugin` | `Trae/trae_token_capture.js` + `Trae/trae_checkin.js` | api.trae.cn |

### 插件订阅地址（main 分支，日常只点「更新」）
```
闲鱼   https://raw.githubusercontent.com/ashun520/loon-rules/main/Xianyu/Xianyu.plugin
懂车帝 https://raw.githubusercontent.com/ashun520/loon-rules/main/Dongchedi/Dongchedi.plugin
陌陌   https://raw.githubusercontent.com/ashun520/loon-rules/main/Momo/Momo.plugin
飞猪   https://raw.githubusercontent.com/ashun520/loon-rules/main/Feizhu/Feizhu.plugin
优酷   https://raw.githubusercontent.com/ashun520/loon-rules/main/Youku/Youku.plugin
TRAE   https://raw.githubusercontent.com/ashun520/loon-rules/main/Trae/Trae.plugin
```

## Apple AI 分流域名（Ai.list 第一部分；App Store 域名不单独建规则集，交给 Apple.list 直连）
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
DOMAIN-KEYWORD,siri,Ai
```
⚠️ **严禁加入** bag.itunes.apple.com / itunes.apple.com / mzstatic.com / appleid.apple.com / icloud-content.com —— 这些是 App Store 域名，让 Apple.list 的 apple.com 后缀自动兜底直连。

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
