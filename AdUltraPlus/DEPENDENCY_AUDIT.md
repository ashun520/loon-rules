# AdUltraPlus 远程脚本初步审计记录

审计对象：原始插件 `https://yfamilys.com/plugin/adultraplus.plugin` 中已定位的脚本引用。  
审计性质：静态初筛；不是完整安全认证，也没有在 Loon 运行时执行。

## 已确认的脚本依赖样本

| 来源 | 脚本 | 用途线索 | 初筛观察 |
|---|---|---|---|
| ddgksf2013/Scripts | weibo_json.js | 微博响应 JSON 调整 | 含按函数名分派的 `eval(method)`；当前看到的脚本样本中未发现显式 fetch、HTTP 客户端或 WebSocket 调用。需继续审计函数映射和完整数据流 |
| fmz200/wool_scripts | cnftp.js | 爱奇艺、芒果 TV、优酷等响应处理 | 解析响应 JSON 并按请求 URL 分支修改；样本未发现显式网络请求或动态执行 |
| ddgksf2013/Scripts | amap.js | 高德地图响应处理 | 脚本高度混淆（出现 jsjiami 标记）；不能仅凭未命中网络 API 断定安全，需解混淆或逐段审查 |
| fmz200/wool_scripts | Smzdm.js | 什么值得买响应处理 | 样本主要递归过滤 JSON 内容；未发现显式网络请求或动态执行 |
| zirawell/R-Store | ddxq.js | 叮咚买菜响应处理 | 样本按接口 URL 修改 JSON；未发现显式网络请求或动态执行 |
| app2smile/rules | tieba-json.js | 百度贴吧响应处理 | 样本按请求路径调整响应 JSON；未发现显式网络请求或动态执行 |

## 需要特别处理的外部依赖

- 小红书相关多条响应规则指向 `royal-block-f6b1.q00.workers.dev/scripts/redbook.ads.js`。这是独立于 GitHub Raw 的远程脚本托管/Worker 地址，必须取得并审计脚本本体，才可判断数据流和远程控制风险。
- 知乎规则引用 blackmatrix7 的 Gist 脚本。
- 插件还引用多个 GitHub 用户仓库的 JS；即使把主插件复制到本仓库，这些依赖也不会自动消失。

## 初步安全判断

1. 目前没有证据证明上述样本会窃取账号凭据或上传用户数据；同样，样本审计不足以证明它们绝对安全。
2. `weibo_json.js` 中存在 `eval(method)`。当前代码上下文显示它用于按内部方法名选择本地函数，但仍需完整核实 `getModifyMethod` 的返回值是否严格来自固定白名单，不能把它直接等同于远程代码执行，也不能忽略。
3. `amap.js` 的混淆降低了可审计性。独立版本应优先重写可确认的功能，而不是盲目沿用混淆脚本。
4. 插件没有一个统一的“作者 API”可以直接替换。大部分脚本是 Loon 本地响应处理器；另有少数托管在 Worker/Gist/GitHub 的 JS。是否需要自建 API，应由具体脚本是否存在动态服务端逻辑决定。

## 尚未完成

- 尚未逐一提取 2758 行中的全部脚本 URL。
- 尚未取得并审计 Worker 与 Gist 脚本全部内容。
- 尚未核实每个第三方仓库的 LICENSE/再发布许可。
- 尚未完成规则的 APP 版本兼容性和误伤测试。
- 尚未生成可安装的独立版插件。

本记录只代表已检查的样本，不可外推为整个插件的安全结论。
