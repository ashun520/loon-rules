/**
 * 陌陌去广告脚本（通用 JSON 清洗）
 * 作用：递归清理陌陌 API 响应中的广告字段与广告卡片
 * 适用：api.immomo.com / api-alpha.immomo.com 的启动、信息流、推荐、搜索、附近、动态接口
 * 设计原则：只删除带明确广告标记的节点，解析失败或结构不符时原样放行
 */

(function () {
  var url = ($request && $request.url) || "";
  var body = $response && $response.body;
  if (!body) {
    $done({});
    return;
  }

  var obj;
  try {
    obj = JSON.parse(body);
  } catch (e) {
    $done({});
    return;
  }

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
          // 启动/开屏接口里的广告字段直接清空；其它接口只在值像广告结构时清空
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
  var isSplash =
    lower.indexOf("startup") >= 0 ||
    lower.indexOf("launch") >= 0 ||
    lower.indexOf("splash") >= 0;

  var result = clean(obj, isSplash);

  try {
    $done({ body: JSON.stringify(result) });
  } catch (e) {
    $done({});
  }
})();
