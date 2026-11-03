# AdUltraPlus 规则结构与脚本映射清单

> 来源：原插件 `https://yfamilys.com/plugin/adultraplus.plugin`，当前可读取版本共 2758 行，文件头标注自动维护时间为 202608。此清单只记录可核对到的规则结构和远程脚本引用，不代表完整逐行转录或已验证运行效果。

## 结构

- 第 0–5 行：插件元数据。
- 第 6 行起：`[URL Rewrite]`。
- 第 2194 行：进入 `[Script]` 区段。
- 第 2195 行以后：大量 `http-response` 响应体改写规则，主要通过 `script-path` 引用远程 JavaScript。
- 原始文件共 2758 行；当前重点读取并归类的是约 2194–2575 行，尚需继续覆盖末尾余下规则并完整核对前段 URL Rewrite。

## 已核对到的远程 JS 引用来源（去重后按上游仓库归类）

| 来源 | 可确认的脚本/功能示例 | 审计处理 |
|---|---|---|
| fmz200/wool_scripts | cnftp.js（爱奇艺/芒果/优酷多接口）、小红书、滴滴、微博以外的多 APP 脚本、百度地图、知乎、什么值得买、Soul、菜鸟、Keep、酷安等 | 多数尚未逐个完整审计；不直接镜像无明确授权的代码 |
| ddgksf2013/Scripts | weibo_json.js、weibo_search_topic.json、weibo_search_info.json、caiyun_json.js、bing.js、smzdm_json.js、coolapk.js、qidian.js、keepStyle.js、12306.js、netease.adblock.js（Gist）、zhihu_openads.js 等 | 部分样本已做静态初筛；仍需逐个追踪接口、数据读写和调用链 |
| zirawell/R-Store | ddxq.js、wechatApplet.js、ccblife.js、mafengwo.js、dianping.js、51job.js、mdb.js、freshippo.js、alicdn.js、foliday.js 等 | 尚未逐个完整审计；不直接镜像无明确授权的代码 |
| app2smile/rules | qidian.js、vgtime.js、tieba-json.js 等 | 仓库根目录可见 LICENSE.md；发布前仍需读取许可条款并核对具体文件适用范围 |
| blackmatrix7 Gist | zheye.min.js（知乎多个接口） | Gist 元数据及文件许可未核实，暂不复制 |
| NobyDa/Script | BahamutAnimeAds.js | 文件许可与脚本行为待核实 |
| Keywos/rule | wyres.js（网易云音乐多个接口） | 文件许可与脚本行为待核实 |
| Sliverkiss/QuantumultX | xmApp.js（芒果 TV） | 文件许可与脚本行为待核实 |
| kokoryh/Script | 12306.js | 文件许可与脚本行为待核实 |
| zZPiglet/Task | UnblockURLinWeChat.js | 文件许可与脚本行为待核实 |
| q00.workers.dev | redbook.ads.js（小红书多个接口） | Worker 源码无法通过当前 GitHub 读取通道核实；属于未审计外部运行依赖，禁止作为已验证安全代码迁移 |

## 已确认的重复/冲突风险

- 相同 URL 匹配规则存在两个不同脚本来源，例如 SMZDM 首页、搜索、Keep、酷安、12306、知乎、网易云音乐等部分接口。
- 同一请求若同时命中多个响应改写规则，可能产生覆盖、顺序依赖或 JSON 字段互相影响。重建时需要明确保留一个经过审计的处理器，或将多个逻辑合并为单一处理器。
- 有些响应脚本作用于推荐、搜索、个人中心、视频信息、播放配置等业务接口，不全是广告专用接口。误删字段可能损坏内容加载、搜索、播放、账号页面。
- 原规则中的 `reject-dict`、`reject-200`、`reject-img` 和普通 `reject` 不能互换；响应格式及客户端行为需按接口区分。

## 当前重建决策

1. 第一阶段先重建可由 URL Rewrite 明确判定为广告专用的接口规则，避免直接搬运不透明 JS。
2. 第二阶段按 APP 独立编写响应处理脚本，采用最小字段删除/广告数组过滤；不重写整份业务响应，保留未知字段。
3. 对包含登录、播放、搜索、个人资料、支付、银行业务的接口，必须先确认被修改字段与广告展示的关系，否则暂缓纳入。
4. 所有脚本固定在本仓库的版本化路径，不再依赖原作者仓库或 Worker；脚本中不调用第三方动态脚本加载服务。
5. 对需要外部数据或服务端处理的场景，优先取消该依赖；只有明确证明客户端脚本无法实现时才考虑自建 API。

## 尚未完成

- 读取并归类 2758 行全部 URL Rewrite 与脚本规则。
- 完整提取所有脚本 URL，核实各仓库许可证及各脚本许可范围。
- 审计 Worker、Gist 和剩余脚本。
- 编写独立替代实现、图标托管、Loon 语法检查与真机验证。


## URL Rewrite 风险复核（首段可见规则，非完整清单）

原插件前段存在一些不能简单归类为“纯广告接口”的规则，重建时应列为高风险/需验证，而不是无条件保留：

| 原规则目标 | 原处理 | 风险判断 |
|---|---|---|
| `access.mypikpak.com/access_controller/v1/area_accessible` | `reject` | 名称指向区域可访问性/地区权限判断，不是明显广告接口；拦截可能影响 PikPak 登录后的服务可用性或区域判断，建议默认不迁移。 |
| `www.1314zhilv.com/.../getWeatherByCityName` | `reject-dict` | URL 同时匹配景区更新与天气查询接口；拦截天气接口可能造成天气信息缺失，建议拆分或排除天气路径。 |
| `zgrb.epicc.com.cn/.../queryHeadlines` | `reject` | 路径名称是头条查询，不能仅凭域名/路径认定广告；可能误伤内容列表。 |
| `www.onstar.com.cn/.../community/article/page` | `reject-dict` | 路径为社区文章分页，属于内容业务接口风险，不应直接作为广告拦截。 |
| `ucmp.sf-express.com/.../memberEquity/queryRecommendEquity` | `reject-dict` | 名称指向会员权益推荐，可能混有营销，但也可能承载会员权益展示；需按响应字段精确过滤。 |
| `ucmp.sf-express.com/.../goodsList` | `reject-dict` | 积分商城商品列表属于业务内容，整包拒绝可能影响积分商城。 |
| `ucmp.sf-express.com/.../fullGiveInfo` | `reject-dict` | 满赠活动信息，可能是营销模块，但不等同于广告素材；建议按页面功能决定是否拦截。 |

另有多处相同 URL 同时配置 `reject` 与 `reject-200`，例如部分启动页/广告配置接口。这类重复规则需在最终插件中去重并选定一种响应策略，避免重复匹配导致结果不确定。

**重建策略修正：** 不能只看路径中出现 `ad`、`recommend`、`activity`、`config` 就拦截；需要确认接口是否仅承载广告，或在响应体中仅删除广告字段。登录、地区权限、天气、内容列表、会员权益、积分商城等业务接口优先保留。
