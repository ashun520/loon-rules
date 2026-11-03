# AdUltraPlus 远程脚本审计补充（2026-11-03）

本轮重新从原始插件入口提取了脚本引用（集中在原文件约第 2255–2692 行），并补查了若干脚本源文件。以下是新增的可复核发现。

## 已定位的远程脚本类别

原插件引用的脚本来源至少包括：
- `fmz200/wool_scripts`：cnftp、微信小程序、彩云、蓝莓/微博之外的多个 APP 脚本、小红书、知乎、百度地图、滴滴、喜马拉雅等。
- `ddgksf2013/Scripts`：微博、彩云、Bing、知乎广告、酷安、高德、喜马拉雅等。
- `zirawell/R-Store`：微信小程序、马蜂窝、叮咚买菜、民生/交行等银行、航司等脚本。
- `app2smile/rules`：贴吧、起点、VGTime 等。
- `blackmatrix7` Gist：知乎脚本。
- 其他来源：NobyDa 脚本、Cloudflare Worker 等。

同一个接口有时被配置了两个不同作者的脚本（例如酷安、京东、SMZDM 某些接口），说明原插件是融合规则，不代表所有规则经过统一兼容性验证。

## 新增脚本样本初筛

| 脚本 | 大小 | 观察 |
|---|---:|---|
| fmz200 小红书脚本 | 27,135 字符 | 含通用 Env 封装，使用 Loon/Surge/QuanX 持久化存储接口；存在 HTTP 客户端封装及 BoxJS `/v1/scripting/evaluate` 执行辅助函数。当前静态检索未证明该辅助函数被实际调用，需追踪调用点。 |
| fmz200 知乎脚本 | 7,054 字符 | 初筛未命中显式网络请求、动态执行、Cookie/Authorization 字样；不能据此证明全脚本安全。 |
| ddgksf2013 彩云脚本 | 2,135 字符 | 初筛未命中显式网络请求或动态执行。 |
| ddgksf2013 Bing 脚本 | 669 字符 | 简单响应处理脚本样本，初筛未命中网络请求或动态执行。 |
| fmz200 百度地图脚本 | 80,146 字符 | 大型混淆/打包代码，出现 fetch、XMLHttpRequest、eval 关键字；需要区分 protobuf 等库代码与业务逻辑，不能仅凭关键字判定恶意。 |
| fmz200 滴滴脚本 | 2,641 字符 | 样本顶部注释提到需额外 IP 分流拦截；初筛未命中显式网络请求。 |

## 安全边界与后续处理

- 小红书脚本的 Env 封装中包含读取/写入持久化数据的能力、HTTP 请求能力以及 BoxJS 脚本执行接口。它们可能是通用兼容层，不足以单独证明数据外传或远程执行已发生；必须追踪所有调用点和具体参数。
- 这类响应脚本运行在代理客户端上下文，权限与浏览器网页 JS 不同。尤其持久化键值、HTTP 请求、通知、BoxJS 等接口应作为重点审计面。
- 远程 Worker 的代码尚未从原站成功取得，本轮不将其判为安全或恶意，也不复制进自有仓库。
- 对没有明确 LICENSE 的第三方脚本，不能未经许可直接镜像并公开再发布。本项目优先采取独立重写：依据接口响应结构和可观察行为实现等价过滤，而不是把原脚本换个 Raw 地址。
- 当前尚未完成完整的 2758 行规则归类、所有脚本调用点追踪、LICENSE 核实、图标核实、Loon 语法验证和真实 APP 实测。因此暂不提供安装链接。

## 可复核源文件

- 原插件：`https://yfamilys.com/plugin/adultraplus.plugin`
- 小红书脚本：`https://raw.githubusercontent.com/fmz200/wool_scripts/main/Scripts/xiaohongshu/xiaohongshu.js`
- 知乎脚本：`https://raw.githubusercontent.com/fmz200/wool_scripts/main/Scripts/zhihu/zhihu.js`
- 百度地图脚本：`https://raw.githubusercontent.com/fmz200/wool_scripts/main/Scripts/baidumap.js`
- 滴滴脚本：`https://raw.githubusercontent.com/fmz200/wool_scripts/main/Scripts/didi/didiAds.js`
- 彩云脚本：`https://raw.githubusercontent.com/ddgksf2013/Scripts/refs/heads/master/caiyun_json.js`
- Bing 脚本：`https://raw.githubusercontent.com/ddgksf2013/Scripts/refs/heads/master/bing.js`


## 第三轮样本初筛补充（2026-11-03）

新增检查了以下脚本源文件：

| 脚本 | 大小 | 静态初筛结果 |
|---|---:|---|
| fmz200 菜鸟 | 4,449 字符 | 未命中显式网络请求、持久化、动态执行关键字 |
| fmz200 Soul | 14,875 字符 | 命中通用 Env HTTP 客户端封装、持久化接口等关键字；当前命中集中在 Env 兼容层，尚未证明业务逻辑调用这些能力，需进一步追踪调用点 |
| fmz200 酷我 | 4,632 字符 | 未命中显式网络请求、持久化、动态执行关键字 |
| fmz200 酷安 | 2,393 字符 | 未命中显式网络请求、持久化、动态执行关键字 |
| zirawell 建行生活 | 2,885 字符 | 未命中显式网络请求、持久化、动态执行关键字 |
| zirawell 盒马 | 1,976 字符 | 未命中显式网络请求、持久化、动态执行关键字 |
| app2smile 起点 | 5,281 字符 | 未命中显式网络请求、持久化、动态执行关键字 |
| app2smile VGTime | 274 字符 | 极短响应处理脚本，未命中上述高风险关键字 |
| ddgksf2013 知乎开屏 | 809 字符 | 未命中上述高风险关键字 |
| ddgksf2013 12306 | 966 字符 | 未命中上述高风险关键字 |

说明：以上仅是关键词级静态初筛，无法证明脚本不存在隐藏行为；未命中也不等于安全认证。Soul、小红书等通用 Env 封装中出现的网络和持久化接口需要结合真实调用链进一步判断。