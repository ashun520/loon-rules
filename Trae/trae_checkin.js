/*
 * TRAE 每日签到（Loon cron）
 *
 * 接口（国内版，与官方客户端一致）：
 *   POST https://api.trae.cn/trae/api/v2/ug/checkin_credits/status
 *   POST https://api.trae.cn/trae/api/v2/ug/checkin_credits/claim
 * 凭证来自 trae_token_capture.js 捕获的 Authorization + x-device-id。
 *
 * 返回码：0 = 成功；9004 = 缺 x-device-id；9095 = 本机今日已领取。
 * 签到按「每台设备每天一次」计数，换账号不重置当天名额。
 */

const TOKEN_KEY = "trae_cloud_ide_jwt";
const DEVICE_KEY = "trae_device_id";
const API = "https://api.trae.cn/trae/api/v2/ug/checkin_credits/";

function notify(subtitle, body) {
  $notification.post("TRAE 签到", subtitle, body || "");
}

function readStore(key) {
  const value = $persistentStore.read(key);
  return value ? String(value).trim() : "";
}

function parseJSON(text) {
  try {
    return JSON.parse(text);
  } catch (e) {
    return null;
  }
}

function snippet(text) {
  return String(text || "").slice(0, 120);
}

function statusCode(resp) {
  return resp ? resp.statusCode || resp.status : 0;
}

function post(path, headers, callback) {
  $httpClient.post(
    { url: API + path, headers: headers, body: "{}" },
    callback
  );
}

const token = readStore(TOKEN_KEY);
const device = readStore(DEVICE_KEY);

if (!token) {
  notify("缺少登录凭证", "请打开一次 TRAE App（走 Loon），让插件自动捕获凭证");
  $done();
} else if (!device) {
  notify("缺少设备 ID", "请打开一次 TRAE App（走 Loon），让插件自动捕获 x-device-id");
  $done();
} else {
  const headers = {
    "Authorization": "Cloud-IDE-JWT " + token,
    "Content-Type": "application/json",
    "Origin": "https://www.trae.cn",
    "Referer": "https://www.trae.cn/",
    "User-Agent": "Mozilla/5.0",
    "x-device-id": device,
  };

  post("status", headers, function (err, resp, data) {
    if (err) {
      notify("状态查询失败", String(err));
      return $done();
    }
    if (statusCode(resp) === 401) {
      notify("登录已过期", "请打开 TRAE App 重新登录，插件会更新凭证");
      return $done();
    }

    const status = parseJSON(data);
    if (!status) {
      notify("状态查询失败", "HTTP " + statusCode(resp) + " " + snippet(data));
      return $done();
    }

    if (status.checked_in === true || status.did_checked_in === true) {
      notify("今日已签到", "当前积分 " + (status.credits != null ? status.credits : "—"));
      return $done();
    }

    post("claim", headers, function (claimErr, claimResp, claimData) {
      if (claimErr) {
        notify("签到失败", String(claimErr));
        return $done();
      }

      const result = parseJSON(claimData);
      if (!result) {
        notify("签到失败", "HTTP " + statusCode(claimResp) + " " + snippet(claimData));
        return $done();
      }

      const code = Number(result.code != null ? result.code : 0);
      if (code === 9095) {
        notify("本机今日已签", "该设备今天已经领取过积分");
        return $done();
      }
      if (code !== 0) {
        notify("签到未成功", "code " + code + (result.message ? "：" + result.message : ""));
        return $done();
      }

      post("status", headers, function (e, r, d) {
        const latest = parseJSON(d);
        const balance = latest && latest.credits != null ? latest.credits : null;
        notify("签到成功", balance != null ? "当前积分 " + balance : (result.message || "已领取今日积分"));
        $done();
      });
    });
  });
}
