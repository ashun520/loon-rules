/**
 * 临时诊断脚本：记录 outfliggys 网关的完整 URL，不修改任何请求/响应。
 * 用途：定位飞猪开屏 H5/Weex 页面的真实路径。
 * 找到后即可删除本脚本、对应 Script 行与 MITM hostname。
 */

(function () {
  var url = ($request && $request.url) || "";
  console.log("飞猪网关探测: " + url);
  $done({});
})();
