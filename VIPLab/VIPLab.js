/*
 * VIP Lab for Loon
 * Checks user-configured public platform URLs for HTTP reachability and response time.
 * It does NOT authenticate VIP accounts, access paid streams, or bypass DRM/paywalls.
 */

(function () {
  var args = $argument || {};
  var timeout = Number(args.timeoutMs || 5000);
  if (!timeout || timeout < 1000) timeout = 5000;
  if (timeout > 15000) timeout = 15000;

  var targets = [
    { name: "爱奇艺", url: String(args.iqiyiUrl || "") },
    { name: "腾讯视频", url: String(args.tencentUrl || "") },
    { name: "优酷", url: String(args.youkuUrl || "") },
    { name: "美图官网", url: String(args.meituUrl || "") }
  ];

  function cleanHost(url) {
    var m = url.match(/^https?:\/\/([^\/?#]+)/i);
    return m ? m[1] : url;
  }

  function checkTarget(target, callback) {
    var url = target.url.replace(/^\s+|\s+$/g, "");
    if (!/^https?:\/\//i.test(url)) {
      callback(target.name + "：地址无效（需以 http:// 或 https:// 开头）");
      return;
    }

    var started = Date.now();
    $httpClient.get({
      url: url,
      timeout: timeout,
      "auto-redirect": true,
      headers: { "User-Agent": "VIP-Lab-Loon/1.0" }
    }, function (error, response) {
      var elapsed = Date.now() - started;
      if (error) {
        callback(target.name + "：" + cleanHost(url) + "｜请求失败｜" + elapsed + " ms");
        return;
      }

      var status = response && response.status ? Number(response.status) : 0;
      var label;
      if (status >= 200 && status < 400) {
        label = "HTTP " + status + "｜可连接";
      } else if (status >= 400 && status < 500) {
        label = "HTTP " + status + "｜服务器拒绝/需要额外条件";
      } else if (status >= 500) {
        label = "HTTP " + status + "｜服务器异常";
      } else {
        label = "未取得有效状态码";
      }
      callback(target.name + "：" + cleanHost(url) + "｜" + label + "｜" + elapsed + " ms");
    });
  }

  var validTargets = targets.filter(function (t) {
    return t.url && t.url.replace(/^\s+|\s+$/g, "").length > 0;
  });

  if (validTargets.length === 0) {
    $notification.post("VIP Lab", "没有检测地址", "请先在插件参数中填写至少一个 HTTP/HTTPS 地址。");
    $done();
    return;
  }

  var results = [];
  var index = 0;

  function next() {
    if (index >= validTargets.length) {
      var report = results.join("\n");
      console.log("VIP Lab 检测结果：\n" + report);
      try {
        $persistentStore.write(JSON.stringify({
          checkedAt: new Date().toISOString(),
          results: results
        }), "VIPLab_last_report");
      } catch (e) {
        console.log("保存检测记录失败：" + e);
      }
      $notification.post(
        "VIP Lab 检测完成",
        "平台网络连通性（不代表 VIP 播放/会员状态）",
        report
      );
      $done();
      return;
    }

    var target = validTargets[index++];
    checkTarget(target, function (line) {
      results.push(line);
      next();
    });
  }

  next();
})();
