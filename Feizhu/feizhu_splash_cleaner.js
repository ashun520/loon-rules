/**
 * 飞猪开屏广告清洗
 * 参考 ElyDemiurge/Loon-Plugins 的 bilibili_cleaner 思路：
 * 不直接 REJECT 请求（App 拿不到响应会回退到备用广告源），
 * 而是返回结构合法的空数据，并从响应体中深度清掉广告字段。
 *
 * 覆盖接口：acs.m.taobao.com / guide-acs.m.taobao.com 下
 *          mtop.fliggy.crm.screen.* 与 mtop.fliggy.crm.splash.*
 */

(function () {
  var url = ($request && $request.url) || "";
  var body = $response && $response.body;

  var m = url.match(/mtop\.fliggy\.[A-Za-z0-9_.]+/);
  var api = m ? m[0] : "";

  if (!body) {
    $done({});
    return;
  }

  var obj;
  try {
    obj = JSON.parse(body);
  } catch (e) {
    console.log("飞猪开屏: 响应非 JSON，原样放行 | " + url);
    $done({});
    return;
  }

  function isObj(v) {
    return v !== null && typeof v === "object";
  }

  // 1. 开屏熔断接口：强制标记需要关闭
  if (api.indexOf("emergencyshutdown") >= 0) {
    if (isObj(obj.data)) {
      if (isObj(obj.data.data)) obj.data.data.needShutDown = true;
      obj.data.success = true;
    }
    console.log("飞猪开屏: 熔断已开启");
    $done({ body: JSON.stringify(obj) });
    return;
  }

  // 2. 老开屏资源接口 / 开屏预测接口：返回合法空结构
  if (api.indexOf("allresource") >= 0 || api.indexOf("predict") >= 0) {
    var empty = {
      api: obj.api || api,
      data: {},
      ret: ["SUCCESS::调用成功"],
      v: obj.v || "2.0"
    };
    console.log("飞猪开屏: " + api + " 返回空结构");
    $done({ body: JSON.stringify(empty) });
    return;
  }

  // 3. 通用清洗：深度清空开屏相关字段
  //    seat / strategyMessages 清成数组，其余对象清成对象、标量清成 null，
  //    既让 App 认为「没有广告」，又不会因字段缺失而解析崩溃。
  var AD_KEY = /^(seat|splash|splashAd|splash_ad|splashad|splashInfo|splash_info|splashList|splash_list|brand|brandAd|brand_ad|brandad|brandInfo|brand_info|ad|ads|adList|ad_list|adInfo|ad_info|adData|ad_data|adItem|ad_item|adCard|ad_card|promotion|promotions|promo|promoInfo|promo_info|poplayer|popLayer|popLayers|poplayers|strategyMessages|strategy_messages|startupAd|startup_ad|launchAd|launch_ad|openAd|open_ad|openingAd|opening_ad|advert|advertise|advertisement)$/i;

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
  console.log("飞猪开屏: " + (api || url) + " 清理字段 " + removed + " 个");
  $done({ body: JSON.stringify(result) });
})();
