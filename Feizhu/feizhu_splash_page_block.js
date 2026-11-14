// 飞猪开屏页熔断（2026-11-14 抓包实证）
// 开屏容器 page://cache_splashScreen 会加载 outfliggys 的 pcraft 营销页（如 collect-energy-daily，
// HTML 275–341KB，连带前端包约 2MB），换成原生开屏后这条 H5 就是"反复出现的那条广告"。
// 只在 Referer 来自开屏容器时返回空页；用户从首页正常点活动入口进入时 Referer 不同，不受影响。
(function () {
  var headers = $request.headers || {};
  var referer = "";
  for (var key in headers) {
    if (key.toLowerCase() === "referer") {
      referer = headers[key] || "";
      break;
    }
  }

  if (referer.indexOf("page://cache_splashScreen") === 0) {
    $done({
      status: "HTTP/1.1 200 OK",
      headers: { "Content-Type": "text/html; charset=utf-8" },
      body: "<!DOCTYPE html><html><head><meta charset=\"utf-8\"></head><body></body></html>"
    });
  } else {
    $done({});
  }
})();
