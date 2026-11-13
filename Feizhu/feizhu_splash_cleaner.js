/**
 * 飞猪广告清洗（命名空间级兜底版 v2）
 *
 * 设计目标：接口路径/字段改名后仍然生效。
 *  1. 不再只认 mtop.fliggy.crm.screen.* 这种精确名字，改为「只要落在 mtop.fliggy 的营销命名空间」就清洗
 *  2. 响应无法解析（zstd、结构变更、空包）时，开屏类接口直接返回结构合法的空数据
 *  3. 解析成功时做深度清洗：删除一切开屏/广告语义字段，并清空广告条目
 *
 * 本脚本只做本地 JSON 处理，不发起任何网络请求。
 */

(function () {
  var url = ($request && $request.url) || "";
  var body = $response && $response.body;

  var m = url.match(/mtop\.fliggy\.[A-Za-z0-9_.]+/);
  var api = m ? m[0] : "";
  var tail = url.replace(/^https?:\/\/[^/]+/, "");

  function isObj(v) {
    return v !== null && typeof v === "object";
  }

  // 开屏语义：接口名或 URL 里出现这些词就按开屏处理
  var SPLASH_HINT = /(splash|screen|brand|allresource|predict|startup|launch|advert|opening)/i;
  var isSplash = SPLASH_HINT.test(api) || SPLASH_HINT.test(tail);
  // 营销命名空间：crm 下的接口基本都是营销投放相关
  var isMarketing = /(^|\.)crm\./i.test(api);

  function emptySplash() {
    return JSON.stringify({
      api: api,
      data: {
        data: { seat: [] },
        ctx: { strategyMessages: [] },
        success: true
      },
      ret: ["SUCCESS::调用成功"],
      v: "2.0"
    });
  }

  // 与广告无关的接口：直接放行
  if (!isSplash && !isMarketing) {
    $done({});
    return;
  }

  // 开屏熔断：强制关闭
  if (api.indexOf("emergencyshutdown") >= 0) {
    var shut = {
      api: api,
      data: { data: { needShutDown: true }, success: true },
      ret: ["SUCCESS::调用成功"],
      v: "2.0"
    };
    if (body) {
      try {
        var so = JSON.parse(body);
        if (isObj(so) && isObj(so.data)) {
          if (isObj(so.data.data)) so.data.data.needShutDown = true;
          so.data.success = true;
          shut = so;
        }
      } catch (e) {}
    }
    console.log("飞猪: 开屏熔断已开启");
    $done({ body: JSON.stringify(shut) });
    return;
  }

  // 开屏资源 / 开屏预测：不依赖响应体，直接空结构
  if (api.indexOf("allresource") >= 0 || api.indexOf("predict") >= 0) {
    console.log("飞猪: " + api + " 返回空结构");
    $done({ body: emptySplash() });
    return;
  }

  var obj;
  try {
    obj = JSON.parse(body);
  } catch (e) {
    if (isSplash) {
      console.log("飞猪: " + api + " 响应不可解析，返回空结构");
      $done({ body: emptySplash() });
    } else {
      $done({});
    }
    return;
  }

  if (!isObj(obj)) {
    $done({});
    return;
  }

  // 广告语义字段：命中就把容器清空（数组→[]，对象→{}，标量→null）
  var AD_KEY = /^(seat|seats|strategyMessages|strategy_messages|splash|splashAd|splash_ad|splashad|splashInfo|splash_info|splashList|splash_list|splashConfig|splash_config|screen|screenAd|screen_ad|brand|brandAd|brand_ad|brandad|brandInfo|brand_info|ad|ads|adList|ad_list|adInfo|ad_info|adData|ad_data|adItem|ad_item|adCard|ad_card|adRule|ad_rules|adSwitch|ad_switch|adType|ad_type|promotion|promotions|promo|promoInfo|promo_info|poplayer|popLayer|popLayers|poplayers|startupAd|startup_ad|launchAd|launch_ad|openAd|open_ad|openingAd|opening_ad|advert|advertise|advertisement|materialList|material_list)$/i;

  var removed = 0;

  function clean(node) {
    if (Array.isArray(node)) {
      var out = [];
      for (var i = 0; i < node.length; i++) {
        var item = node[i];
        if (isObj(item) && (item.isAd === true || item.is_ad === true || item.ad === true)) {
          removed++;
          continue;
        }
        out.push(clean(item));
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
  console.log("飞猪: " + (api || url) + " 清理字段 " + removed + " 个");
  $done({ body: JSON.stringify(result) });
})();
