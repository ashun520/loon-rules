# 飞猪去广告 · 接口档案

> 用途：记录每一次抓包确认过的广告链路与正常业务接口。
> 飞猪会不定期更换路径前缀或接口版本号，出问题时先对照本文件，再抓包补充。
> 最近更新：2026-11-25（新增 xj-csr 开屏路径）

## 一、开屏广告的完整链路

```
mtop 配置接口（走 ACCS 长连接，抓包常看不到）
      ↓ 下发开屏类型：原生图片 / H5 营销页
开屏容器 page://cache_splashScreen
      ↓ 加载 H5
outfliggys.m.taobao.com/{任意前缀}/page/pcraft/pcraft/channel/{活动名}
      ↓ 页面再拉素材
g.alicdn.com / gw.alicdn.com / tbexpand.alicdn.com
```

判断某请求是否属于开屏：**看 Referer 是否为 `page://cache_splashScreen`**。
这是比 URL 更可靠的判据，插件的熔断脚本就是靠它，避免误伤正常活动页。

## 二、已确认的广告接口（插件已覆盖）

| 接口 / 域 | 作用 | 实证日期 |
|---|---|---|
| `acs/guide-acs.m.taobao.com/gw/mtop.fliggy.crm.*` | 开屏配置下发 | 2026-11-14 |
| `.../mtop.fliggy.{screen,splash,ad,advert,brand,allresource,predict,emergencyshutdown}*` | 开屏/品牌广告配置 | 2026-11-14 |
| `outfliggys.m.taobao.com/xj/page/pcraft/pcraft/...` | 开屏 H5（现仅 302 跳转） | 2026-11-14 |
| `outfliggys.m.taobao.com/xj-csr/page/pcraft/pcraft/...` | **开屏 H5 真实返回体**，Referer=cache_splashScreen | 2026-11-25 |
| `market.m.taobao.com/app/trip/h5-crm-poplayer/...` | 弹层广告页 | 2026-11-14 |
| `acs.m.taobao.com/gw/mtop.trip.serverless.api.gateway/2.0` | 弹层页面列表（过滤 poplayer） | 2026-11-14 |
| `dorangesource.alicdn.com/*` | 3AD SDK 开屏/插屏/激励视频配置 | 2026-11-14 |
| `tbexpand.alicdn.com/*.mp4` | 开屏视频素材（约 154KB） | 2026-11-14 |
| `acs.m.taobao.com/gw/mtop.trip.train.homepage/1.0` | 首页节日营销模块 | 2026-11-14 |

## 三、已确认的广告监测 / 归因域（REJECT）

- `ad.fliggy.com`、`ad-track.fliggy.com`
- `amdc.m.taobao.com`、`amdc-sibling.alipay.com.cn`
- `adashx.ut.fliggy.com`、`h-adashx.ut.fliggy.com`
- `tanx.com`、`atanx.alicdn.com`、`alimama.com`、`mobaders.com`、`mmstat.com`
- **裸 IP 监测**：`http://{IP}/amdc/mobileDispatch`（不走域名，必须用 URL-REGEX 拦）

## 四、正常业务接口（不要误伤）

| 接口 / 域 | 用途 |
|---|---|
| `acs.m.taobao.com/gw/mtop.common.getTimestamp/*` | 时间戳校准 |
| `trip-hisv.alibtrip.com/havana/idpLoginCallback.do` | 登录预检 |
| `outfliggys.m.taobao.com/app/trip/rx-*` | 首页各楼层预加载（酒店/会员/AI/签证等） |
| `g.alicdn.com/trip/...` | 前端 JS/CSS 包（rx-trip-ai 单文件可达 7MB） |
| `cdn.fliggy.com/flu/ftrain/...` | 火车票离线库（约 1.7MB） |
| `gw.alicdn.com/imgextra/...` | 通用图片 CDN，含正常启动图 |

注意：`/app/trip/rx-*` 这些正常页面的 Referer **也可能**是 `cache_splashScreen`，
所以不能按 Referer 一刀切，必须限定在 `/page/pcraft/pcraft/` 路径内。

## 五、排障流程

1. 广告复现 → 先确认是不是「每天第一次冷启动」那次（开屏配置每天只拉一次）
2. Loon 开抓包 → 杀飞猪 → 冷启动 → 广告停留 3–5 秒 → 导出 HAR
3. 在 HAR 里找 Referer 含 `cache_splashScreen` 且返回 200 的请求
4. 若是新的 pcraft 前缀：现规则为泛匹配，理论上已覆盖，需检查插件是否更新
5. 若是全新域名或原生图片开屏：把素材 URL 补充到本文件并加规则

## 六、原生开屏（2026-11-27 重装后首启抓包实证）

飞猪有**两套开屏**，不要只查 H5 那条：

| 类型 | 特征 | 链路 | 处理 |
|---|---|---|---|
| H5 开屏 | 网页活动页 | `outfliggys.../page/pcraft/pcraft/` | `feizhu_splash_page_block.js` 按 Referer + 路径泛匹配熔断 |
| **原生开屏** | 右上「跳过广告」倒计时 + 底部「点击跳转详情页面」 | 独立素材 CDN 下载全屏图，客户端原生渲染 | 域名层 REJECT |

原生开屏素材实测：

```
http://cdn.ynuf.aliapp.org/b57i/pf0q/pbl3/uCkJ/18974_r52eOf079A_20260202195912.jpg
UA: 飞猪旅行/10.0.11.104（URL 编码） · 无 Referer · HTTP 明文 · 解压后约 168KB
```

- 路径每次活动随机，**按域名 `ynuf.aliapp.org` 整体拦截**，不要写死路径
- 该域不承载酒店/机票等业务图片，业务图仍走 `gw.alicdn.com/imgextra/`
- 重装 App 后首启必重新下载素材，是抓这条链路的唯一可靠时机
- 本地已缓存的素材不会发请求，抓包里看不到 ≠ 没有开屏
