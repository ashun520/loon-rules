/*
 * TikTok 无水印下载助手（Loon Generic Script）
 * 仅将用户主动填写的公开 TikTok 分享链接发送至 TikWM 解析。
 * 不读取 TikTok 登录态、Cookie、剪贴板或设备标识。
 * 仅供下载本人拥有或已获授权使用的内容。
 */
(function () {
  "use strict";

  var args = (typeof $argument === "object" && $argument) ? $argument : {};
  var raw = String(args.video_url || "").trim();
  var hd = args.hd !== false;

  function finish(title, message) {
    $notification.post("TikTok 无水印助手", title, message || "");
    $done();
  }

  if (!raw) {
    finish("缺少视频链接", "请在插件参数中粘贴 TikTok 视频分享链接后再运行。");
    return;
  }

  var match = raw.match(/https?:\/\/[^\s<>"']+/i);
  var videoUrl = match ? match[0].replace(/[),，。！？!?]+$/g, "") : raw;

  if (/^\d{15,25}$/.test(videoUrl)) {
    // TikWM 支持直接传入视频 ID。
  } else {
    var hostMatch = videoUrl.match(/^https?:\/\/([^\/?#]+)/i);
    if (!hostMatch) {
      finish("链接格式不正确", "请填写 TikTok 分享链接或视频 ID。");
      return;
    }
    var host = hostMatch[1].toLowerCase().replace(/:\d+$/, "");
    var allowedHosts = {
      "tiktok.com": true,
      "www.tiktok.com": true,
      "m.tiktok.com": true,
      "vm.tiktok.com": true,
      "vt.tiktok.com": true,
      "v.tiktok.com": true
    };
    if (!allowedHosts[host]) {
      finish("不支持的链接域名", "仅接受 TikTok 官方域名链接，不会把其他网址发送给解析服务。");
      return;
    }
  }

  var api = "https://www.tikwm.com/api/?url=" + encodeURIComponent(videoUrl) + "&hd=" + (hd ? "1" : "0");

  $httpClient.get({
    url: api,
    timeout: 20000,
    headers: {
      "Accept": "application/json",
      "User-Agent": "Mozilla/5.0"
    }
  }, function (error, response, body) {
    if (error) {
      finish("解析请求失败", "TikWM 服务或当前网络暂时不可用，请稍后重试。");
      return;
    }
    if (!response || response.status !== 200 || typeof body !== "string") {
      finish("解析服务异常", "HTTP 状态异常，请稍后重试。");
      return;
    }

    var result;
    try {
      result = JSON.parse(body);
    } catch (e) {
      finish("解析结果无法读取", "服务返回的内容不是有效 JSON，可能是接口已调整。");
      return;
    }

    if (!result || Number(result.code) !== 0 || !result.data) {
      var reason = result && result.msg ? String(result.msg) : "未取得视频信息";
      finish("暂时无法解析", reason.slice(0, 100));
      return;
    }

    var data = result.data;
    // TikWM 文档中 play 为无水印地址；hdplay 为可用时的高清地址。
    // 不使用 wmplay，避免误把带水印版本当作结果。
    var mediaUrl = (hd && data.hdplay) ? data.hdplay : data.play;
    if (typeof mediaUrl !== "string" || !/^https:\/\//i.test(mediaUrl)) {
      finish("没有可用的无水印地址", "该视频可能不可公开解析，或服务端字段已变化。");
      return;
    }

    var author = data.author && (data.author.nickname || data.author.unique_id) ? String(data.author.nickname || data.author.unique_id) : "TikTok 视频";
    var caption = data.title ? String(data.title).replace(/[\r\n]+/g, " ").slice(0, 90) : "无水印视频链接已生成";
    var quality = (hd && data.hdplay) ? "高清优先" : "标准无水印";
    $notification.post(
      "TikTok 无水印助手",
      author + " · " + quality,
      caption + "。点击通知打开视频；通知操作同时提供复制链接。",
      { openUrl: mediaUrl, clipboard: mediaUrl },
      0
    );
    $done();
  });
})();
