/*
 * AdUltraPlus - Zhihu launch-ad response cleaner
 * Independently implemented from the documented response fields.
 * Purpose: remove the launch-screen display duration and timeout only.
 * No remote code, API, storage, or account data is used.
 */
(() => {
  const response = $response;
  if (!response || typeof response.body !== "string") {
    $done({});
    return;
  }

  let body = response.body;
  // The API payload may contain escaped JSON fragments; preserve all other bytes.
  body = body
    .replace(/img_play_duration\\":\d+/g, 'img_play_duration\\":0')
    .replace(/launch_timeout\\":\d+/g, 'launch_timeout\\":0');

  $done({ body });
})();
