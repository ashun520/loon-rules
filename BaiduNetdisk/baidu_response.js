/**
 * 百度网盘响应净化 + 本地虚假 SVIP 展示伪装
 * 说明：仅改写经过 Loon MITM 的客户端响应，不会创建真实会员、购买记录或服务端权限。
 * SVIP 字段名/响应结构随客户端版本可能变化；未取得当前版本真实响应样本，标记为实验性。
 */
const url = ($request && $request.url) || "";
const raw = ($response && $response.body) || "";

function finish(body) { $done({ body }); }
function isObj(v) { return v && typeof v === "object"; }

let data;
try {
  data = JSON.parse(raw || "{}");
} catch (e) {
  $done({});
}

if (!url.includes("pan.baidu.com")) $done({});

// 广告/推广接口响应净化
if (/\/(?:act\/[^?]+\/(?:activityentry|bchannel|cardwelfare)|feed\/cardinfos|buy\/ad\/conf|rest\/[^?]+\/pcs\/adv)(?:\?|$)/i.test(url)) {
  finish("{}");
}

// 会员引导接口：关闭客户端引导/激励展示
if (/\/membership\/proxy\/guide(?:\?|$)/i.test(url)) {
  if (isObj(data) && isObj(data.data)) {
    data.data.need_show = false;
    data.data.force_show = 0;
    data.data.show_incentive_video = false;
    finish(JSON.stringify(data));
  }
}

// 虚假 SVIP 展示伪装：仅针对用户信息、会员信息、容量/登录状态响应。
// 不改写文件列表、下载链路、登录凭据、BDUSS、支付/订单接口。
if (/\/(?:api\/(?:quota|loginstatus)|membership\/user|user\/getinfo|wap\/vip)(?:\?|$)/i.test(url)) {
  const expiry = 4102444800; // 2100-01-01 UTC，客户端展示用
  const seen = new Set();
  function spoof(node, depth) {
    if (!isObj(node) || depth > 12 || seen.has(node)) return;
    seen.add(node);
    if (Array.isArray(node)) {
      for (const item of node) spoof(item, depth + 1);
      return;
    }
    // 仅在响应对象已有相应字段时覆写，避免凭空构造未知结构。
    for (const k of Object.keys(node)) {
      const key = k.toLowerCase();
      if (["is_vip", "is_svip", "vip", "svip", "is_super_vip"].includes(key)) {
        if (typeof node[k] === "boolean") node[k] = true;
        else if (typeof node[k] === "number") node[k] = 1;
        else if (typeof node[k] === "string") node[k] = "1";
      } else if (["vip_level", "svip_level", "vip_identity", "v10_id"].includes(key)) {
        node[k] = (key === "vip_identity") ? "svip" : 10;
      } else if (["show_vip_ad", "need_show_vip_ad", "show_svip_ad"].includes(key)) {
        node[k] = (typeof node[k] === "number") ? 0 : false;
      } else if (/(vip|svip).*(expire|end|deadline)|(expire|end|deadline).*(vip|svip)/.test(key)) {
        node[k] = (typeof node[k] === "string") ? "2099-12-31 23:59:59" : expiry;
      } else if (["total", "total_quota", "quota", "capacity", "total_capacity"].includes(key) &&
                 /quota|capacity/i.test(url)) {
        // 仅对容量接口中已有的容量字段赋展示值；不代表服务器真实扩容。
        node[k] = 30 * 1024 * 1024 * 1024 * 1024;
      }
      spoof(node[k], depth + 1);
    }
  }
  spoof(data, 0);
  finish(JSON.stringify(data));
}

$done({});
