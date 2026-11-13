/**
 * 懂车帝广告清洗（命名空间级兜底版 v2）
 *
 * 设计目标：接口路径改名后仍然生效。
 *  1. 按路径里的语义关键词判定（ad/splash/screen/startup/launch/brand/widget），
 *     不再依赖某个固定接口名
 *  2. 广告类接口一律把 data 清成空对象，保留 code/message 协议字段
 *  3. 响应无法解析时，广告类接口返回最小合法结构，避免 App 回退到备用广告源
 *
 * 本脚本只做本地 JSON 处理，不发起任何网络请求。
 */

(function () {
  var url = ($request && $request.url) || "";
  var body = $response && $response.body;
  var path = url.replace(/^https?:\/\/[^/]+/, "");

  function isObj(v) {
    return v !== null && typeof v === "object";
  }

  // 语义判定：路径中出现广告/开屏/启动相关词即视为广告接口
  var AD_PATH = /(^|\/)(ad|ads|advert|adverts|advertise|splash|splashad|screen|screens|startup|launch|brand|brandad|opening)(\/|\?|$)/i;
  var isAdApi = AD_PATH.test(path) || /\/dlive\/api\/get_feed_widget(\/|\?|$)/.test(path);

  if (!isAdApi) {
    $done({});
    return;
  }

  if (!body) {
    $done({});
    return;
  }

  var obj;
  try {
    obj = JSON.parse(body);
  } catch (e) {
    // 广告接口解析失败：返回最小合法结构，避免 App 认为接口异常而回退备用广告源
    console.log("懂车帝清洗: " + path + " 非 JSON，返回空结构");
    $done({ body: JSON.stringify({ code: 0, message: "success", data: {} }) });
    return;
  }

  if (!isObj(obj)) {
    $done({});
    return;
  }

  if (isObj(obj.data)) {
    obj.data = {};
  } else if (Array.isArray(obj.data)) {
    obj.data = [];
  }

  console.log("懂车帝清洗: " + path + " 已清空");
  $done({ body: JSON.stringify(obj) });
})();
