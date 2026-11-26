# 爱思助手去广告 · 接口档案

> 实证来源：2026-11-27 HAR（175MB，与飞猪同一次抓包）。

## 一、开屏广告链路

```
冷启动 → list-app-m.i4.cn/getopfstadinfo.xhtml（base64 JSON 配置）
       → d.image.i4.cn/adInfo/image/original/.../*.jpg（素材图）
       → 展示全屏开屏，点击跳 AppDetail（应用详情）
       → list-app-m.i4.cn/adclickcb.xhtml（点击回传）
```

## 二、已确认广告接口

| 接口 / 域 | 作用 | 处理 |
|---|---|---|
| `list-app-m.i4.cn/getopfstadinfo.xhtml` | 开屏配置（素材地址、跳转目标、展示时长） | `reject-200`，按 `opfst` 前缀泛匹配 |
| `d.image.i4.cn/adInfo/...` | 开屏素材图 | URL-REGEX 拦 `/adInfo/` 前缀 |
| `list-app-m.i4.cn/adclickcb.xhtml` | 广告点击回传 | `reject-200` |

配置实测内容：

```json
{"contentinfo":"185954","min":"0","targetInfo":{"route":"AppDetail","description":"应用详情","value":"185954"},
 "showtime":0,"nw":"1,2","statusbar":2,"id":157,"position":1,"type":7,
 "content":"http://d.image.i4.cn/adInfo/image/original/2026/09/29/18/1790677596942_63.jpg","target":7,"third":""}
```

## 三、正常业务接口（不要误伤）

| 接口 / 域 | 用途 |
|---|---|
| `list-app-m.i4.cn/getAppList.xhtml` | 应用列表 |
| `search-app-m.i4.cn/updateAppQuery.xhtml` | 应用搜索 / 更新查询 |
| `pub-conf-m.i4.cn/getversioninfo.xhtml`、`checkclient.xhtml` | 版本与客户端校验 |
| `pub-conf-m.i4.cn/pub/info/putTokenInfo.go` | 推送 token 上报 |
| `cl-m.i4.cn/message_center.action` | 消息中心 |
| `dl.i4.cn` | 应用下载 |
| `d.image.i4.cn/image/icon/...` | 应用图标（正常） |

## 四、排障流程

1. 开屏复现 → 杀进程 → 开抓包 → 冷启动 → 广告停留 3–5 秒 → 导出 HAR
2. 找 `i4.cn` 域下返回 base64 且解码后含 `content` / `image` / `adInfo` 的接口
3. 新接口按「配置接口 reject-200 + 素材按路径前缀拦」两层补齐
