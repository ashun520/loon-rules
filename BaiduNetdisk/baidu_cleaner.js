// 百度网盘广告清洗脚本
// 匹配接口：pan.baidu.com 的广告配置接口
//   - /buy/ad/conf        开屏广告配置 → mode 置 0（关闭开屏，App 不再拉素材）
//   - /rest/2.0/pcs/adv   广告场景配置 → scene_list 置空
// 设计原则：非 JSON / 解析失败 → 原样放行，绝不白屏
(function () {
  var url = ($request && $request.url) || "";
  var body = $response && $response.body;
  if (!body) { $done({}); return; }
  var obj;
  try { obj = JSON.parse(body); } catch (e) { $done({}); return; }

  // --- 开屏广告配置接口：mode=0 = 无开屏 ---
  // 2026-11-27 HAR 实证：buy/ad/conf 返回 {"errno":0,"data":{"mode":1,...}}
  // mode:1 时 App 会拉取 staticsns.cdn.bcebos.com/amis/.../倒计时*_iSpt_compressed.gif 素材
  if (url.indexOf("buy/ad/conf") >= 0) {
    if (obj && typeof obj === "object" && obj.data && typeof obj.data === "object") {
      obj.data.mode = 0;
      obj.data.mode_v2 = 0;
      if (obj.data.tag !== undefined) obj.data.tag = 0;
      if (obj.data.tag_v2 !== undefined) obj.data.tag_v2 = 0;
      if (obj.data.ecpm !== undefined) obj.data.ecpm = 0;
      if (obj.data.ecpm_v2 !== undefined) obj.data.ecpm_v2 = 0;
      if (obj.data.ecpm_v2_original !== undefined) obj.data.ecpm_v2_original = 0;
    }
    try { $done({ body: JSON.stringify(obj) }); } catch (e) { $done({}); }
    return;
  }

  // --- 通用广告字段名（命中即删除）---
  var AD_KEY = /^(ad|ads|ad_info|adinfo|advert|adverts|advertisement|ad_list|adlist|ad_card|adcard|ad_data|addata|ad_item|aditem|splash|splash_ad|startup_ad|launch_ad|open_screen|openscreen|open_ad|openad|promotion|promotions|promo|promo_info|brand_ad|brandad|brand_ads|brandAds|scene_list|sceneList|scenes|scene|ad_scene|adScene|ad_sdk|adsdk|ad_sdk_config|adSdkConfig|ad_sdk_setting|banner|banner_list|bannerList|pop_ad|popad|popup|pop_up|popup_ad|popupad|float_ad|floatad|guide_ad|guidead|guide_page|feed_ad|recommend_ad)$/i;

  // --- 广告卡片标记（命中即从列表剔除）---
  var AD_MARK = /^(ad|ads|advert|advertisement|广告|推广|商业推广|赞助|开屏|splash|splashad|openad|startup_ad)$/i;

  function isAdNode(node) {
    if (!node || typeof node !== "object" || Array.isArray(node)) return false;
    if (node.isAd === true || node.is_ad === true) return true;
    if (node.ad === true || node.isPromotion === true) return true;
    var marks = [node.type, node.cardType, node.style, node.feedType, node.itemType, node.label, node.tag, node.titleLabel, node.sourceType, node.source_type, node.module_type, node.moduleType];
    for (var i = 0; i < marks.length; i++) {
      var m = marks[i];
      if (typeof m === "string" && AD_MARK.test(m.replace(/\s+/g, ""))) return true;
    }
    if (node.adInfo && typeof node.adInfo === "object") return true;
    if (node.ad_info && typeof node.ad_info === "object") return true;
    if (node.adCard && typeof node.adCard === "object") return true;
    if (node.adId || node.adid || node.ad_id) return true;
    if (node.adver_id || node.adverId) return true;
    if (node.promotion && typeof node.promotion === "object") return true;
    return false;
  }

  function clean(node) {
    if (Array.isArray(node)) {
      var out = [];
      for (var i = 0; i < node.length; i++) {
        if (isAdNode(node[i])) continue;
        out.push(clean(node[i]));
      }
      return out;
    }
    if (node && typeof node === "object") {
      var keys = Object.keys(node);
      for (var j = 0; j < keys.length; j++) {
        var k = keys[j];
        if (AD_KEY.test(k)) {
          var v = node[k];
          // scene_list / scenes 这类列表 → 置空数组
          if (Array.isArray(v)) { node[k] = []; continue; }
          if (v === null || typeof v === "object" || typeof v === "string") {
            delete node[k];
            continue;
          }
        }
        node[k] = clean(node[k]);
      }
      return node;
    }
    return node;
  }

  var result = clean(obj);

  try { $done({ body: JSON.stringify(result) }); } catch (e) { $done({}); }
})();
