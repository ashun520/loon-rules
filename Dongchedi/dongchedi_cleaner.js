/**
 * 懂车帝广告清洗（空结构清洗法）
 * 原则：开屏/悬浮挂件等纯广告接口返回结构合法的空数据，保留 code/message 等协议字段。
 * 非 JSON / 解析失败 → 原样放行，避免白屏。
 * 本脚本只做本地 JSON 处理，不发起任何网络请求。
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
    console.log("懂车帝清洗: 响应非 JSON，原样放行 | " + url);
    $done({});
    return;
  }

  function isObj(v) {
    return v !== null && typeof v === "object";
  }

  // 开屏广告配置
  if (/\/motor\/ad(\/|\?|$)/.test(url)) {
    if (isObj(obj.data)) obj.data = {};
    console.log("懂车帝清洗: 开屏配置返回空结构");
    $done({ body: JSON.stringify(obj) });
    return;
  }

  // 右下角悬浮直播挂件
  if (/\/motor\/dlive\/api\/get_feed_widget(\/|\?|$)/.test(url)) {
    if (isObj(obj.data)) obj.data = {};
    console.log("懂车帝清洗: 悬浮挂件返回空结构");
    $done({ body: JSON.stringify(obj) });
    return;
  }

  $done({});
})();
