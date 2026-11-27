/*
 * 飞猪开屏广告清洗（MTOP 响应层）
 * 思路：不改素材、不拦 CDN，而是把配置接口返回里的"广告节点"整段删掉，
 *       App 拿不到开屏配置，就不会下载、也不会缓存，换素材/换活动都无效。
 *
 * 相对豆包原版的三处修正：
 *   1) 接口关键词补上 screen —— 飞猪真实开屏接口是 mtop.fliggy.crm.screen.allresource，
 *      原版 splash|kaiping|welcome 都命中不了它；
 *   2) 素材字段补上 url / imageUrl / imgUrl / picUrl / cover / bannerImg / gifUrl，
 *      原版只有 img|image|pic|src|mediaurl，飞猪清单里大量用的是 url 和 imageUrl；
 *   3) 广告字段补上 screen / splash / kaiping / tms，并做大小写不敏感匹配。
 *
 * 匹配范围：只处理 mtop.trip.* / mtop.fliggy.* 下命名空间含
 *           splash|kaiping|welcome|startup|advert|tms|screen|adinfo|ad_list 的接口。
 */

const ENABLE_LOG = false;
const log = (...a) => { if (ENABLE_LOG && typeof console !== 'undefined') console.log('[飞猪开屏]', ...a); };

const AD_KEY = /(^|_)(splash|kaiping|open_?screen|launch_?ad|startup_?ad|welcome|pop_?up|screen|advert|adinfo|ad_info|aditem|ad_item|adlist|ad_list|tms)(_|$)/i;

const ASSET_KEY = /^(img|image|imageurl|imgurl|pic|picurl|src|url|mediaurl|videourl|video|gifurl|cover|bannerimg|banner_img|resourceurl|resource_url)$/i;

const JUMP_KEY = /^(jumpurl|jump_url|targeturl|target_url|clickurl|click_url|landingurl|landing_url|scheme|deeplink|actionurl|action_url)$/i;

const ASSET_VALUE = /\.(jpg|jpeg|png|webp|gif|mp4|m3u8|bmp)(\?|#|$)/i;

function hasAdKey(o) {
  for (const k in o) {
    if (AD_KEY.test(k)) return true;
  }
  return false;
}

function hasAsset(o) {
  for (const k in o) {
    if (ASSET_KEY.test(k) && typeof o[k] === 'string' && ASSET_VALUE.test(o[k])) return true;
  }
  return false;
}

function hasJump(o) {
  for (const k in o) {
    if (JUMP_KEY.test(k) && typeof o[k] === 'string' && o[k].length > 0) return true;
  }
  return false;
}

// 判定：带广告关键字的节点，或者同时具备"素材地址 + 跳转地址"的对象
function looksLikeAd(o) {
  if (hasAdKey(o)) return true;
  return hasAsset(o) && hasJump(o);
}

let removed = 0;

function clean(node, depth) {
  if (depth > 12 || node === null || typeof node !== 'object') return node;

  if (Array.isArray(node)) {
    const out = [];
    for (const item of node) {
      if (item && typeof item === 'object' && looksLikeAd(item)) {
        removed++;
        continue;
      }
      out.push(clean(item, depth + 1));
    }
    return out;
  }

  const out = {};
  for (const k in node) {
    const v = node[k];
    if (v && typeof v === 'object' && !Array.isArray(v) && looksLikeAd(v)) {
      removed++;
      // 保留同名的空壳，避免 App 因字段缺失走异常分支
      out[k] = Array.isArray(v) ? [] : {};
      continue;
    }
    out[k] = clean(v, depth + 1);
  }
  return out;
}

try {
  const body = $response.body;
  if (!body || body.length < 2) {
    $done({});
  } else {
    let json = null;
    try {
      json = JSON.parse(body);
    } catch (e) {
      // 不是 JSON（可能是密文或二进制），原样放行
      log('非 JSON，跳过');
    }
    if (json === null) {
      $done({});
    } else {
      const cleaned = clean(json, 0);
      if (removed > 0) {
        log('已移除广告节点', removed);
        $done({ body: JSON.stringify(cleaned) });
      } else {
        $done({});
      }
    }
  }
} catch (e) {
  log('异常', String(e));
  $done({});
}
