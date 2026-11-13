/**
 * 闲鱼广告清洗（空结构清洗法）
 * 原则：纯广告/推荐接口返回结构合法的空数据；业务接口只深度清广告字段。
 * 非 JSON / 解析失败 → 原样放行，避免白屏。
 * 本脚本只做本地 JSON 处理，不发起任何网络请求。
 */

(function () {
  var url = ($request && $request.url) || "";
  var body = $response && $response.body;

  var m = url.match(/mtop\.[A-Za-z0-9_.]+/);
  var api = m ? m[0] : "";

  if (!body) {
    $done({});
    return;
  }

  var obj;
  try {
    obj = JSON.parse(body);
  } catch (e) {
    console.log("闲鱼清洗: 响应非 JSON，原样放行 | " + url);
    $done({});
    return;
  }

  function isObj(v) {
    return v !== null && typeof v === "object";
  }

  function success(data) {
    return {
      api: obj.api || api,
      data: data,
      ret: ["SUCCESS::调用成功"],
      v: obj.v || "2.0"
    };
  }

  // 纯广告 / 推荐流接口：返回合法空结构，App 不再回退到广告源
  var EMPTY_API = /mtop\.(idle\.ad\.expose|taobao\.idle\.item\.recommend\.list|taobao\.idle\.local\.near\.by\.corner\.info|taobao\.idlemtopsearch\.search\.shade|taobao\.idle\.playboy\.recommend|taobao\.idle\.item\.buy\.feeds)$/;

  if (EMPTY_API.test(api)) {
    console.log("闲鱼清洗: " + api + " 返回空结构");
    $done({ body: JSON.stringify(success({})) });
    return;
  }

  // 其余接口（如我的页策略）：只深度清广告字段，保留业务数据
  var AD_KEY = /^(ad|ads|adInfo|ad_info|adData|ad_data|adItem|ad_item|adCard|ad_card|adList|ad_list|advert|advertise|advertisement|promotion|promotions|promo|promoInfo|promo_info|banner|banners|bannerInfo|splash|splashAd|splash_ad|splashInfo|splash_info|openAd|open_ad|startupAd|startup_ad|dspList|mamaAD|adExpose)$/i;
  var AD_MARK = /^(ad|ads|advert|advertisement|广告|推广|商业推广|赞助)$/i;

  function isAdItem(n) {
    if (!isObj(n)) return false;
    if (n.isAd === true || n.is_ad === true || n.ad === true) return true;
    if (n.adInfo || n.ad_info || n.adCard || n.ad_card) return true;
    if (n.adId || n.adid || n.ad_id) return true;

    var marks = [n.type, n.cardType, n.card_type, n.bizType, n.biz_type, n.label, n.tag, n.titleLabel];
    for (var i = 0; i < marks.length; i++) {
      if (typeof marks[i] === "string" && AD_MARK.test(marks[i].replace(/\s+/g, ""))) return true;
    }

    if (isObj(n.data) && isObj(n.data.clickParam) && isObj(n.data.clickParam.args)) {
      if (n.data.clickParam.args.bizType === "ad") return true;
    }
    return false;
  }

  var removed = 0;

  function clean(node) {
    if (Array.isArray(node)) {
      var out = [];
      for (var i = 0; i < node.length; i++) {
        if (isAdItem(node[i])) {
          removed++;
          continue;
        }
        out.push(clean(node[i]));
      }
      return out;
    }

    if (isObj(node)) {
      for (var k in node) {
        if (!Object.prototype.hasOwnProperty.call(node, k)) continue;
        var v = node[k];
        if (AD_KEY.test(k)) {
          if (Array.isArray(v)) node[k] = [];
          else if (isObj(v)) node[k] = {};
          else node[k] = null;
          removed++;
          continue;
        }
        node[k] = clean(v);
      }
      return node;
    }

    return node;
  }

  var result = clean(obj);
  console.log("闲鱼清洗: " + (api || url) + " 清理 " + removed + " 处");
  $done({ body: JSON.stringify(result) });
})();
