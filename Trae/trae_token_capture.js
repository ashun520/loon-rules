/*
 * TRAE 凭证捕获（Loon http-request）
 *
 * 只在 api.trae.cn 的请求上运行：
 *   - 把 Authorization 里的 Cloud-IDE-JWT 存到本地
 *   - 把 x-device-id 存到本地
 * 两者仅供本机每日签到脚本复用，不上传任何数据。
 */

const TOKEN_KEY = "trae_cloud_ide_jwt";
const DEVICE_KEY = "trae_device_id";

const headers = $request.headers || {};
let auth = "";
let device = "";

for (const name of Object.keys(headers)) {
  const lower = name.toLowerCase();
  const value = String(headers[name] || "").trim();
  if (lower === "authorization") auth = value;
  if (lower === "x-device-id") device = value;
}

if (auth.indexOf("Cloud-IDE-JWT") === 0) {
  const token = auth.slice("Cloud-IDE-JWT".length).trim();
  if (token) $persistentStore.write(token, TOKEN_KEY);
  if (device) $persistentStore.write(device, DEVICE_KEY);
}

$done({});
