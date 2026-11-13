/**
 * 优酷广告清洗（空结构清洗法）
 * 原则：播放页广告脚本 / 广告位预加载 / 弹层广告接口返回结构合法的空数据。
 * 非 JSON / 解析失败 → 原样放行，避免播放页白屏。
 * 本脚本只做本地 JSON 处理，不发起任何网络请求。
 */

(function () {
  var url = ($request && $request.url) || "";
  var body = $response && $response.body;

  var m = url.match(/mtop\.youku\.[A-Za-z0-9_.]+/);
  var api = m ? m[0] : "";

  if (!body) {
    $done({});
    return;
  }

  var obj;
  try {
    obj = JSON.parse(body);
  } catch (e) {
    console.log("优酷清洗: 响应非 JSON，原样放行 | " + url);
    $done({});
    return;
  }

  var EMPTY_API = /mtop\.youku\.(pisp\.scripts\.get|xspace\.play\.position\.preload\.query|xspace\.poplayer\.position\.query)$/;

  if (EMPTY_API.test(api)) {
    var out = {
      api: obj.api || api,
      data: {},
      ret: ["SUCCESS::调用成功"],
      v: obj.v || "2.0"
    };
    console.log("优酷清洗: " + api + " 返回空结构");
    $done({ body: JSON.stringify(out) });
    return;
  }

  $done({});
})();
