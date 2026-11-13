/**
 * 飞猪开屏广告清洗（容错增强版）
 *
 * 关键改动：即使响应体无法解析（zstd 压缩、结构变更、空响应），
 * 也不再原样放行，而是返回结构合法的空开屏数据。
 * 这样即使飞猪更换接口返回格式或启用新压缩算法，也不会漏掉开屏广告。
 *
 * 覆盖接口：acs.m.taobao.com / guide-acs.m.taobao.com 下
 *          mtop.fliggy.crm.(screen|splash|ad|advert).*
 *
 * 本脚本只做本地 JSON 处理，不发起任何网络请求。
 */

(function () {
  var url = ($request && $request.url) || "";
  var body = $response && $response.body;

  var m = url.match(/mtop\.fliggy\.[A-Za-z0-9_.]+/);
  var api = m ? m[0] : "";

  function isObj(v) {
    return v !== null && typeof v === "object";
  }

  // 兜底：结构合法的空开屏数据（协议字段齐全，App 不会判定接口失败）
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

  // 非开屏营销接口：原样放行，仅记录疑似广告请求方便排查
  if (!/crm\.(screen|splash|ad|advert)|crm\.[a-z]*splash/i.test(api)) {
    if (/splash|advert|screen|poplayer/i.test(url)) {
      console.log("飞猪开屏: 疑似广告接口（未清洗）| " + url);
    }
    $done({});
    return;
  }

  // 开屏熔断：强制标记需要关闭（即使响应体不可解析也能生效）
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
        if (isObj(so.data)) {
          if (isObj(so.data.data)) so.data.data.needShutDown = true;
          so.data.success = true;
          shut = so;
        }
      } catch (e) {}
    }
    console.log("飞猪开屏: 熔断已开启");
    $done({ body: JSON.stringify(shut) });
    return;
  }

  // 老开屏资源 / 开屏预测：直接返回空结构，不依赖响应体
  if (api.indexOf("allresource") >= 0 || api.indexOf("predict") >= 0) {
    console.log("飞猪开屏: " + api + " 返回空结构");
    $done({ body: emptySplash() });
    return;
  }

  var obj;
  try {
    obj = JSON.parse(body);
  } catch (e) {
    console.log("飞猪开屏: 响应无法解析（可能 zstd/结构变更），返回空结构 | " + api);
    $done({ body: emptySplash() });
    return;
  }

  if (!isObj(obj)) {
    console.log("飞猪开屏: 响应非对象，返回空结构 | " + api);
    $done({ body: emptySplash() });
    return;
  }

  // 深度清洗开屏字段：
  // 列表/策略类清成空数组，对象类清成空对象，标量清成 null，
  // 既让 App 认为「没有广告」，又不会因字段缺失导致解析异常。
  var AD_KEY = /^(seat|strategyMessages|strategy_messages|splash|splashAd|splash_ad|splashad|splashInfo|splash_info|splashList|splash_list|brand|brandAd|brand_ad|brandad|brandInfo|brand_info|ad|ads|adList|ad_list|adInfo|ad_info|adData|ad_data|adItem|ad_item|adCard|ad_card|promotion|promotions|promo|promoInfo|promo_info|poplayer|popLayer|popLayers|poplayers|startupAd|startup_ad|launchAd|launch_ad|openAd|open_ad|openingAd|opening_ad|advert|advertise|advertisement)$/i;

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
