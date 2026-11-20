// 米家开屏广告熔断（2026-11-20 抓包实证）
// 开屏接口：GET https://home.mi.com/cgi-op/api/v1/recommendation/openingBanner
// 正常返回 data.list 里 1 条 type=29 的广告（跳转 m.mi.com 商城，g_utm=Mijia.App.Banner.kaiping.*）
// 这里把 list 清空，保留其余字段结构，App 走无广告分支。
(function () {
  var body = $response.body || "";
  var obj;
  try {
    obj = JSON.parse(body);
  } catch (e) {
    $done({});
    return;
  }
  if (!obj || typeof obj !== "object") {
    $done({});
    return;
  }
  obj.code = 0;
  obj.result = "ok";
  if (!obj.data || typeof obj.data !== "object") {
    obj.data = {};
  }
  obj.data.list = [];
  $done({ body: JSON.stringify(obj) });
})();
