/**
 * 百度网盘响应净化（本地内置）
 * 来源参考：chxm1023/Rewrite bdcloud.js（2026-05-31）
 * 仅处理明确的广告/推广响应，不伪造会员身份、购买记录、容量或账号权益。
 */
const url = ($request && $request.url) || "";
const raw = ($response && $response.body) || "";

function finish(body) {
  $done({ body: body });
}

let data;
try {
  data = JSON.parse(raw || "{}");
} catch (e) {
  // 非 JSON 响应保持原样，避免破坏网页或其他业务内容。
  $done({});
}

if (!url.includes("pan.baidu.com")) {
  $done({});
}

// 与广告/推广位直接对应的接口。
// 与参考脚本采用相同的空对象净化策略；不同版本客户端的响应结构可能变化，需实测。
if (/\/(?:act\/[^?]+\/(?:activityentry|bchannel|cardwelfare)|feed\/cardinfos|buy\/ad\/conf|rest\/[^?]+\/pcs\/adv)(?:\?|$)/i.test(url)) {
  finish("{}");
}

// 会员引导接口只关闭引导/激励视频展示，不修改 VIP/SVIP 身份字段及权益数据。
if (/\/membership\/proxy\/guide(?:\?|$)/i.test(url)) {
  if (data && typeof data === "object" && data.data && typeof data.data === "object") {
    data.data.need_show = false;
    data.data.force_show = 0;
    data.data.show_incentive_video = false;
    finish(JSON.stringify(data));
  }
}

$done({});
