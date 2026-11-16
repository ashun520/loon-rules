# 抖音全类型（工整备份版）

来源：iCloud 分享链接 `https://www.icloud.com/shortcuts/6c5c92d073e5441987904f699fca45fa`
记录 ID：`6C5C92D0-73E5-4419-8790-4F699FCA45FA`
原作者：rcuts.com（版本 4，最后更新 2020-06-27）
备份时间：2026-11-16

| 文件 | 用途 |
| --- | --- |
| `douyin-all.shortcut` | Apple 签名版，双击/隔空投送即可导入，无需改设置 |
| `douyin-all-unsigned.plist` | 未签名原始 plist，可自行解包修改后重新导入（需开启"允许不受信任的快捷指令"） |
| `icon.png` | 图标，450×450 |

## 它到底是怎么做的

整个快捷指令共 57 个动作，本质是一个"外壳 + 远程接口"的客户端：**所有解析逻辑都不在快捷指令里，而在别人的服务器上**。

### 1. 入口
- 类型：分享菜单扩展（ActionExtension）+ 小组件（NCWidget）
- 无输入时自动读取剪贴板（`WFWorkflowNoInputBehavior = GetClipboard`）
- 所以用法是：抖音 → 分享 → 复制链接 → 运行本指令

### 2. 远程配置（动作 1–11）
- 本地先建一个字典 `Config`：`name=抖音全类型`、`author=`、`version=4`、`update=https://i.rcuts.com/update/249`
- 下载 `Config.update` → 按字典解析成 `rcuts`
- 取 `rcuts.version` 与本地 `version` 比较：不等就弹"新版已发布"，跳到 `rcuts.new` 页面并退出
- 也就是说，**版本号、更新地址、菜单文案、接口地址全部由该 JSON 下发**，改服务器就能改行为：

```json
{
  "version": "4",
  "new": "https://i.rcuts.com/get/249.html",
  "parse": "https://parse.rcuts.com:8443/v1/parse",
  "success_Menu": ["返回抖音", "打开相册"],
  "fail_Menu": ["返回抖音", "使用教程", "问题反馈"],
  "list": { "...": "失败/成功菜单里各项对应的跳转链接" }
}
```

### 3. 解析请求（动作 12）
`POST https://parse.rcuts.com:8443/v1/parse`，JSON body：

```json
{ "url": "<分享链接>", "sv": "1", "client": "ios-shortcut", "quality": "all" }
```

返回体用到这些字段：

- `code`：0 表示成功，非 0 走失败分支，`msg` 作为提示
- `data.author.name`：作者名（菜单标题里显示）
- `data.quality_hd`：是否有高清多分辨率
- `data.labels`：分辨率标签列表
- `data.medias[]`：`{ label, url }` 组成的媒体数组
- `data.urls`：普通清晰度直链数组
- `data.cover` / `data.music.url` / `data.music.cover` / `data.author.avatar`
- `data.d_headers.a…e`：下载媒体时要带的 5 组 `n`(名称)/`v`(值) 请求头，绕过防盗链

### 4. 选择要保存的内容（动作 15–40）
菜单四项：

- **视频·图集**：`quality_hd` 为真时从 `data.labels` 选分辨率，再遍历 `data.medias` 找同 `label` 的 `url` 存进变量 `durl`；否则 `durl = data.urls`
- **背景音乐**：`durl = data.music.url`
- **视频封面**：`durl = data.cover`
- **音乐封面**：`durl = data.music.cover`
- **作者头像**：`durl = data.author.avatar`

### 5. 下载与收尾（动作 41–57）
- 用 `data.d_headers` 里的 5 个请求头 GET `durl` → 保存到相册
- 成功菜单：提示 `🎉解析成功，已保存至相册☑️<title>`，可选"返回抖音"（`com.ss.iphone.ugc.Aweme`）或"打开相册"
- 失败菜单：显示 `msg`，可选返回抖音 / 教程 / 反馈 / 新浪微博等广告位链接（`rcuts.list`）

## 关于"不受作者限制"

克隆文件能解决的：

- 原分享链接被删除、作者下架，你本地仍有一份可导入
- 快捷指令本身不会自动被替换（更新只弹提示，不会强制覆盖）

克隆文件**解决不了**的：

- 解析这一步仍然调用 `parse.rcuts.com:8443`。对方服务器停掉、加验证或限流，这份克隆一样失效
- 配置 JSON 也在对方服务器上，`i.rcuts.com` 挂了会导致版本检查失败

想真正独立，有两条路：

1. **轻改**：导入后在快捷指令 App 里编辑，删掉动作 3–11（版本检查/更新提示），把动作 12 的 URL 换成自己的接口。接口只要返回上面同样的 JSON 结构，后面的逻辑可以原样复用。
2. **自建解析服务**：用 `douyin-all-unsigned.plist` 解包改 `parse` 地址，服务端自己实现"分享链接 → 直链"。抖音风控变化频繁，这条路的维护成本在服务端，不在快捷指令。

## 导入注意

- 签名版（`douyin-all.shortcut`）：直接导入即可。
- 未签名版（`douyin-all-unsigned.plist`）：需在 设置 → 快捷指令 里打开"允许不受信任的快捷指令"，并先手动运行过一次任意快捷指令。
- 修改未签名版：`plutil -convert xml1` 编辑后再转回二进制 `plutil -convert binary1`，改扩展名为 `.shortcut` 导入。
