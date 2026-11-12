---
name: "loon-plugin-builder"
description: "Builds Loon ad-block plugins for Chinese apps and Apple Intelligence rules. Invoke when user asks to create/update any Loon plugin, ruleset, or AI split configuration."
---

# Loon 插件 & AI 规则构建器（ashun520 专属）

本 skill 记录用户 ashun520 的 Loon 完整配置、插件构建流程、已验证的模板与约定。
每次新会话中，只要涉及 Loon 插件、分流规则、去广告、Apple AI，直接按本 skill 执行，
不要重复询问任何参数。

---

## 一、用户 Loon 固定配置（写死，不要变更）

| 项 | 值 | 说明 |
|---|---|---|
| 规则仓库 | `https://github.com/ashun520/loon-rules`，分支 `main` | 所有规则/插件/脚本都 push 到此仓库 |
| Ai 策略组名 | `AI策略组` | AI 分流规则、AppleAI.list、Ai.list 统一走此策略组 |
| Final 兜底 | `落地` | 海外节点（用户不定期更换新加坡/日本等节点，不要硬编码节点名） |
| AppleAI.list 位置 | 所有规则集**最顶**（排在 Apple.list 之前） | 因为 Apple.list 有 `DOMAIN-SUFFIX,apple.com,DIRECT`，必须先命中 apple-relay |
| GEOIP,CN 本地规则 | **开关关闭（灰色）**，放在 China.list 之后、Final 之前 | 开关关闭 = 域名请求也能被 GEOIP 兜底直连；Ai 策略组在最顶已截走 apple-relay，不冲突 |
| MITM | 必须开启「**MITM over HTTP/2**」，证书已信任 | 所有需要 JS 改写响应体的插件都依赖此项 |

### 规则集标准顺序（从上到下）

```
① Ai.list / AppleAI.list → AI策略组
② adrules → REJECT
③ LAN → DIRECT
④ Apple.list → DIRECT
⑤ China.list → DIRECT
⑥ GEOIP,CN → DIRECT（开关关闭）
⑦ 海外媒体 / TikTok
⑧ Final → 落地
```

---

## 二、去广告插件构建流程（陌陌/B站/闲鱼/懂车帝模式，已验证 4 次）

### 步骤 1：识别 App 主业务域 vs 独立广告域

**方法 A — hackertarget.com/hostsearch：**
```
curl -sL "https://api.hackertarget.com/hostsearch/?q=<app-domain>" -o h.txt
cut -d, -f1 h.txt | sort -u | grep -E "^(ad|openad|game-ad|ad-admin|startup|launch)"
```

**方法 B — crt.sh 证书日志兜底：**
```
curl -sL "https://crt.sh/?q=%25.<app-domain>&output=json"
```

**分类规则：**
- `ad.*.xxx.com` / `openad.*.xxx.com` / `game-ad.*.xxx.com` / `ad-admin.*.xxx.com` → 独立广告域，纯规则层拦截
- `api.*.xxx.com`（主域）→ 同时承载业务与广告，需 MITM + JS 清洗

### 步骤 2：独立广告域 — 纯规则层拦截（无需 MITM）

```
DOMAIN-SUFFIX,ad.xxx.com,REJECT
DOMAIN-SUFFIX,openad.xxx.com,REJECT
AND,((DOMAIN-SUFFIX,ad.xxx.com),(PROTOCOL,QUIC)),REJECT
```

### 步骤 3：主接口内广告 — MITM + 远程 JS 清洗

#### 3.1 接口路径猜测套路（经验库）

| 功能 | 常见路径关键词 |
|---|---|
| 开屏/启动广告 | `startup` `launch` `splash` `ad/list` `brand/list` `event/list` |
| 信息流 | `feed` `recommend` `discover` `nextfresh` |
| 搜索结果 | `search` `SearchAll` |
| 附近/同城 | `nearby` `local/home` |
| 动态/社区 | `dynamic` `DynAll` `whale.modulet` |
| 我的页 | `mine` `user.strategy.list` |
| 视频详情推荐流 | `item.recommend.list` `feed.index.story` |

#### 3.2 JS 广告清洗模板（已验证可用，放在仓库 `AppName/app_cleaner.js`）

```javascript
(function () {
  var url = ($request && $request.url) || "";
  var body = $response && $response.body;
  if (!body) { $done({}); return; }
  var obj;
  try { obj = JSON.parse(body); } catch (e) { $done({}); return; }

  // 广告专用字段名（命中即删除）
  var AD_KEY = /^(ad|ads|ad_info|adinfo|advert|adverts|advertisement|advertisements|ad_list|adlist|ad_card|adcard|ad_data|addata|ad_item|aditem|splash|splash_ad|splashad|splash_info|splashinfo|splash_ad_info|splashadinfo|startup_ad|startupad|launch_ad|launchad|open_screen|openscreen|open_screen_ad|openscreenad|open_ad|openad|promotion|promotions|promo|promo_info|promoinfo|brand_ad|brandad)$/i;
  // 广告卡片标记（命中即从列表中剔除）
  var AD_MARK = /^(ad|ads|advert|advertisement|广告|推广|商业推广|赞助|开屏|splash|splashad|openad)$/i;

  function isAdNode(node) {
    if (!node || typeof node !== "object" || Array.isArray(node)) return false;
    if (node.isAd === true || node.is_ad === true || node.ad === true) return true;
    var marks = [node.type, node.cardType, node.style, node.feedType, node.itemType, node.label, node.tag, node.titleLabel];
    for (var i = 0; i < marks.length; i++) {
      var m = marks[i];
      if (typeof m === "string" && AD_MARK.test(m.replace(/\s+/g, ""))) return true;
    }
    if (node.adInfo && typeof node.adInfo === "object") return true;
    if (node.ad_info && typeof node.ad_info === "object") return true;
    if (node.adCard && typeof node.adCard === "object") return true;
    if (node.adId || node.adid || node.ad_id) return true;
    return false;
  }

  function clean(node, isSplash) {
    if (Array.isArray(node)) {
      var out = [];
      for (var i = 0; i < node.length; i++) {
        if (isAdNode(node[i])) continue;
        out.push(clean(node[i], isSplash));
      }
      return out;
    }
    if (node && typeof node === "object") {
      var keys = Object.keys(node);
      for (var j = 0; j < keys.length; j++) {
        var k = keys[j];
        if (AD_KEY.test(k)) {
          var v = node[k];
          if (isSplash || v === null || typeof v === "object" || typeof v === "string") {
            delete node[k];
            continue;
          }
        }
        node[k] = clean(node[k], isSplash);
      }
      return node;
    }
    return node;
  }

  var lower = url.toLowerCase();
  var isSplash = lower.indexOf("startup") >= 0 || lower.indexOf("launch") >= 0 || lower.indexOf("splash") >= 0;
  var result = clean(obj, isSplash);

  try { $done({ body: JSON.stringify(result) }); } catch (e) { $done({}); }
})();
```

#### 3.3 插件文件写法（`AppName/AppName.plugin`）

```
#!name = 陌陌去广告
#!desc = 陌陌 iOS 去广告：拦截自有广告域 + MITM 清洗启动/信息流/推荐/搜索/附近/动态接口的广告卡片
#!author = ashun520
#!homepage = https://github.com/ashun520/loon-rules
#!system = iOS,iPadOS
#!loon_version = 3.5.1
#!tag = 去广告,陌陌

[Rule]
DOMAIN-SUFFIX,ad.immomo.com,REJECT
AND,((DOMAIN-SUFFIX,ad.immomo.com),(PROTOCOL,QUIC)),REJECT
AND,((DOMAIN,api.immomo.com),(PROTOCOL,QUIC)),REJECT

[Script]
http-response ^https?:\/\/api(?:-alpha)?\.immomo\.com\/[^\s]*(?:[Ss]tartup|[Ll]aunch|[Ss]plash|[Ff]eed|[Rr]ecommend|[Ss]earch|[Nn]earby|[Dd]ynamic)[^\s]*$ requires-body=1,script-path=https://raw.githubusercontent.com/ashun520/loon-rules/main/Momo/momo_cleaner.js?v=YYYYMMDD, max-size=10485760, timeout=30, tag=陌陌广告清洗

[Mitm]
hostname = api.immomo.com, api-alpha.immomo.com
```

### 步骤 4：JS 本地验证（必须做）

```bash
node - <<'JS'
const fs=require('fs');
const code=fs.readFileSync('Momo/momo_cleaner.js','utf8');
function run(url, obj){
  global.$request={url}; global.$response={body:JSON.stringify(obj)};
  let out=null; global.$done=(r)=>{out=r;}; eval(code);
  return out && out.body ? JSON.parse(out.body) : obj;
}
// 测试：开屏广告字段被删
console.log('开屏:', JSON.stringify(run('https://api.xxx.com/startup',{data:{splashAd:{id:1},user:{uid:1}}})));
// 测试：信息流广告卡被过滤
console.log('信息流:', JSON.stringify(run('https://api.xxx.com/feed',{data:{feeds:[{type:'ad'},{type:'normal'}]}})));
JS
```

### 步骤 5：推送与验证

```bash
git add AppName/
git -c user.name="ashun520" -c user.email="ashun520@users.noreply.github.com" commit -m "feat: 新增 xxx 去广告插件"
git push origin HEAD:main
# 验证 raw 链接可访问
curl -sL -o /dev/null -w "%{http_code}\n" "https://raw.githubusercontent.com/ashun520/loon-rules/main/AppName/AppName.plugin"
```

---

## 三、已完成插件清单（可作参考）

| App | 插件 | JS | 验证 |
|---|---|---|---|
| 闲鱼 | `Xianyu/Xianyu.plugin` | 无（用 response-body-json-jq 内联） | ✅ |
| 懂车帝 | `Dongchedi/Dongchedi.plugin` | 无（用 response-body-json-jq 内联） | ✅ |
| 陌陌 | `Momo/Momo.plugin` | `Momo/momo_cleaner.js` | ✅ |
| B 站 | 用户用 ElyDemiurge 的 `bilibili_cleaner.lpx`（ElyDemiurge/Loon-Plugins 仓库） | 远程 JS（托管在 ElyDemiurge 仓库） | ✅ |

---

## 四、Apple AI 分流规则（已验证）

AppleAI.list 内容（必须排在规则集最顶）：

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

---

## 五、重要注意事项

1. **GEOIP,CN 开关必须关**：关掉后域名请求也能兜底直连，Ai.list 在最顶已截走 apple-relay 不冲突。开开关会导致国内小众软件掉进 Final=落地被送海外。

2. **Apple AI 开屏地区检查**：除了 IP，Apple 还检查 Siri 语言（必须英语）、设备地区、Apple ID 区域。分流只是前提。

3. **开屏广告有本地缓存**：插件装完必须杀进程重开 + 可能清 App 缓存，10-20 分钟后才验证。

4. **第三方 SDK 投放的广告**：穿山甲、优量汇、快手联盟的广告不走 App 主域，MITM 清洗抓不到。配合可莉 `BlockAdvertisers` 通用插件。

5. **MITM 域名尽量少**：每个域名的 HTTPS 解密都会多一次本地握手。优先独立广告域纯规则层拦截，MITM 只给主业务接口。

6. **Final 不要改成 DIRECT**：Apple AI 背后有动态备用中继域名不在 Ai.list 里，Final=落地可以兜底承接。

7. **jsDelivr 有 12 小时缓存**：用户用 raw.githubusercontent.com 最稳，不要用 jsDelivr。

8. **JS 解析失败原样放行**：清洗脚本的设计原则——JSON.parse 失败就 `$done({})` 返回原始响应，不能让 App 白屏。

---

## 六、下次新会话触发词示例

用户说以下任意一句，直接加载本 skill 执行：
-「给 [App名] 做去广告插件」
-「帮我更新 [App名] 插件，广告又出来了」
-「这个 AI 规则放在最顶对吗」
-「我的规则集顺序帮我检查一下」
-「China.list 还要加什么」
