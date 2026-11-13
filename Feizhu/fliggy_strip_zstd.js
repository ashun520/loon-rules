/**
 * 飞猪开屏接口请求头处理
 * 作用：移除 Accept-Encoding 中的 zstd，改为 gzip, deflate
 * 原因：Loon 的 response-body-json-jq 需要对明文 JSON 做 jq 处理，
 *       服务端返回 zstd 压缩体时无法直接解析，先让服务端返回 gzip/deflate。
 * 设计原则：只改 Accept-Encoding，其余请求头原样保留。
 */

(function () {
  var headers = ($request && $request.headers) || {};
  var out = {};

  for (var key in headers) {
    if (key.toLowerCase() === "accept-encoding") continue;
    out[key] = headers[key];
  }
  out["Accept-Encoding"] = "gzip, deflate";

  $done({ headers: out });
})();
