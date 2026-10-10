// TikTok Content Posting API (ทางการ · ฟรี) — ยกมาจาก meta-helper (ใช้งานจริงแล้ว) · ทำงานในหน้า app.html (ไม่ผ่าน service worker → อัปโหลดนานไม่หลุด)
// inbox = ส่งเข้ากล่องร่างในแอป (ใช้ได้เลย ไม่ต้องรอตรวจแอป) · direct = โพสต์ตรง (แอปยังไม่ผ่านตรวจ TikTok บังคับเป็นส่วนตัว)
// ข้อมูลแอป + token เก็บในเครื่องนี้เท่านั้น (chrome.storage.local: tth)
const TT = 'https://open.tiktokapis.com/v2';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const ttGet = async () => (await chrome.storage.local.get('tth')).tth || { accounts: [] };
async function ttForm(form) { // ขอ/ต่ออายุ token
  const res = await fetch(`${TT}/oauth/token/`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(form), signal: AbortSignal.timeout(30000) });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || j.error || !j.access_token) throw new Error(`TikTok token: ${j.error_description || j.error || `HTTP ${res.status}`}`.slice(0, 220));
  return j;
}
// หลายบัญชี: tth.accounts = [{ openId, name, on, tok }] · refresh token ไม่บอกอายุ = ถือว่า 1 ปี
const ttTok = (t) => ({ access: t.access_token, refresh: t.refresh_token, exp: Date.now() + t.expires_in * 1000, refreshExp: Date.now() + (t.refresh_expires_in || 365 * 86400) * 1000, scope: t.scope || '', openId: t.open_id });
// แก้ค่าทีละงาน (หลายบัญชีต่ออายุ token พร้อมกันจะได้ไม่เขียนทับกัน)
let ttLock = Promise.resolve();
const ttWrite = (fn) => (ttLock = ttLock.then(async () => { const cfg = await ttGet(); if (!Array.isArray(cfg.accounts)) cfg.accounts = []; fn(cfg); await chrome.storage.local.set({ tth: cfg }); }, () => {}));
async function ttApi(path, body, access, method = 'POST') {
  const res = await fetch(`${TT}/${path}`, { method, headers: { Authorization: `Bearer ${access}`, 'Content-Type': 'application/json; charset=UTF-8' }, body: method === 'GET' ? undefined : JSON.stringify(body || {}), signal: AbortSignal.timeout(60000) });
  const j = await res.json().catch(() => ({}));
  if ((j.error && j.error.code && j.error.code !== 'ok') || !res.ok) throw new Error(`TikTok ${(j.error && j.error.code) || res.status}: ${(j.error && j.error.message) || 'ผิดพลาด'}`.slice(0, 240));
  return j.data || {};
}
// access token อายุ 24 ชม. → ต่ออายุเองด้วย refresh token
async function ttAccess(openId) {
  const cfg = await ttGet();
  const a = (cfg.accounts || []).find((x) => x.openId === openId);
  if (!a) throw new Error('ไม่พบบัญชี TikTok นี้แล้ว (เพิ่มบัญชีใหม่)');
  if (a.tok.exp - 120000 > Date.now()) return a.tok.access;
  const t = await ttForm({ client_key: cfg.clientKey, client_secret: cfg.clientSecret, grant_type: 'refresh_token', refresh_token: a.tok.refresh });
  await ttWrite((c) => { const x = c.accounts.find((y) => y.openId === a.openId); if (x) x.tok = ttTok({ ...t, open_id: t.open_id || a.openId }); });
  return t.access_token;
}
// ช่องว่าง = ใช้ค่าที่บันทึกไว้
async function ttSetup({ clientKey, clientSecret }) {
  const key = String(clientKey || '').trim(), secret = String(clientSecret || '').trim();
  if (key || secret) await ttWrite((c) => { if (key) c.clientKey = key; if (secret) c.clientSecret = secret; });
  return ttStatus();
}
async function ttStatus() {
  const cfg = await ttGet();
  const accounts = (cfg.accounts || []).map((a) => ({ openId: a.openId, name: a.name || '', on: a.on !== false, scope: (a.tok && a.tok.scope) || '', expired: !!(a.tok && a.tok.refreshExp && a.tok.refreshExp < Date.now()) }));
  return { redirect: chrome.identity.getRedirectURL(), hasApp: !!(cfg.clientKey && cfg.clientSecret), accounts };
}
// เปิด/ปิดบัญชีในการสลับ · ลบบัญชีออก
async function ttAccount({ openId, on, remove }) {
  await ttWrite((c) => {
    if (remove) c.accounts = c.accounts.filter((a) => a.openId !== openId);
    else { const a = c.accounts.find((x) => x.openId === openId); if (a) a.on = !!on; }
  });
  return ttStatus();
}
// ล็อกอิน TikTok (OAuth) — หน้า TikTok เด้งให้กดอนุญาต · redirect URI = https://<id ส่วนเสริม>.chromiumapp.org/ (ต้องลงทะเบียนในแอป TikTok)
async function ttLogin({ direct }) {
  const cfg = await ttGet();
  if (!cfg.clientKey || !cfg.clientSecret) throw new Error('ยังไม่ได้ใส่ Client Key / Client Secret');
  const redirect = chrome.identity.getRedirectURL();
  const state = Math.random().toString(36).slice(2);
  const scope = `user.info.basic,video.upload${direct ? ',video.publish' : ''}`;
  // disable_auto_auth=1 = โชว์หน้าอนุญาตทุกครั้ง (เพิ่มบัญชีอื่นได้: สลับบัญชีบน tiktok.com ก่อน หรือในหน้าต่างนี้)
  const url = `https://www.tiktok.com/v2/auth/authorize/?client_key=${encodeURIComponent(cfg.clientKey)}&response_type=code&scope=${scope}&redirect_uri=${encodeURIComponent(redirect)}&state=${state}&disable_auto_auth=1`;
  const back = new URL(await chrome.identity.launchWebAuthFlow({ url, interactive: true }));
  const q = back.searchParams;
  if (q.get('error')) throw new Error(`TikTok ไม่อนุญาต: ${q.get('error_description') || q.get('error')}`);
  if (q.get('state') !== state) throw new Error('state ไม่ตรง (ลองเชื่อมใหม่)');
  const t = await ttForm({ client_key: cfg.clientKey, client_secret: cfg.clientSecret, code: q.get('code'), grant_type: 'authorization_code', redirect_uri: redirect });
  let name = '';
  try { // ชื่อบัญชีไว้แสดง
    const u = await ttApi('user/info/?fields=open_id,display_name', null, t.access_token, 'GET');
    name = (u.user && u.user.display_name) || '';
  } catch (e) {}
  // บัญชีเดิม (open_id เดียวกัน) = ต่อ token ใหม่ · บัญชีใหม่ = เพิ่มเข้ารายการ (เปิดใช้)
  await ttWrite((c) => {
    const id = t.open_id || `acc${Date.now()}`, a = c.accounts.find((x) => x.openId === id);
    if (a) Object.assign(a, { tok: ttTok(t), name: name || a.name, on: true });
    else c.accounts.push({ openId: id, name, on: true, tok: ttTok(t) });
  });
  return ttStatus();
}
// อัปโหลดไฟล์คลิป: init → PUT ไฟล์ (≤64MB = ชิ้นเดียว · ใหญ่กว่า = ชิ้นละ 64MB ชิ้นสุดท้ายรวมเศษ) → เช็กสถานะจน TikTok รับแล้ว
// onStep(ข้อความ) = บอกความคืบหน้าในแถวคลิป
async function ttUpload({ file, title, mode, openId, aigc, onStep = () => {} }) {
  if (!file || !file.size) throw new Error('ไม่มีไฟล์คลิป');
  const access = await ttAccess(openId);
  const size = file.size, MB = 1024 * 1024;
  const chunk = size <= 64 * MB ? size : 64 * MB;
  const count = Math.floor(size / chunk);
  const source_info = { source: 'FILE_UPLOAD', video_size: size, chunk_size: chunk, total_chunk_count: count };
  let init, privacy = '';
  onStep('ขอที่อัปโหลด...');
  if (mode === 'direct') {
    const ci = await ttApi('post/publish/creator_info/query/', {}, access);
    const opts = ci.privacy_level_options || [];
    privacy = opts.includes('PUBLIC_TO_EVERYONE') ? 'PUBLIC_TO_EVERYONE' : opts[0] || 'SELF_ONLY';
    // is_aigc = คลิปสร้างด้วย AI — ติดป้ายตามกฎ TikTok
    init = await ttApi('post/publish/video/init/', { post_info: { title: String(title || '').slice(0, 2200), privacy_level: privacy, disable_duet: false, disable_comment: false, disable_stitch: false, is_aigc: !!aigc }, source_info }, access);
  } else init = await ttApi('post/publish/inbox/video/init/', { source_info }, access);
  for (let i = 0; i < count; i++) {
    const start = i * chunk, end = i === count - 1 ? size : start + chunk;
    onStep(`ส่งไฟล์ ${count > 1 ? `ชิ้น ${i + 1}/${count} · ` : ''}${(size / MB).toFixed(1)} MB...`);
    const res = await fetch(init.upload_url, { method: 'PUT', headers: { 'Content-Type': file.type || 'video/mp4', 'Content-Range': `bytes ${start}-${end - 1}/${size}` }, body: file.slice(start, end), signal: AbortSignal.timeout(300000) });
    if (![200, 201, 206].includes(res.status)) throw new Error(`อัปโหลดไป TikTok ไม่ได้ (HTTP ${res.status})`);
  }
  let status = 'PROCESSING_UPLOAD';
  for (let t = 0; t < 24 && /PROCESSING/.test(status); t++) {
    onStep(`TikTok กำลังประมวลผล... (${(t + 1) * 5} วิ)`);
    await wait(5000);
    const s = await ttApi('post/publish/status/fetch/', { publish_id: init.publish_id }, access);
    status = s.status || status;
    if (status === 'FAILED') throw new Error(`TikTok ไม่รับคลิป: ${s.fail_reason || 'FAILED'}`);
  }
  return { publishId: init.publish_id, status, privacy };
}
// ข้อจำกัดจำนวนของ TikTok → ข้อความไทยที่บอกว่าต้องทำอะไร ('' = ไม่ใช่เรื่องเพดาน)
const ttLimitWhy = (err) => (/too_many_pending_share/.test(err) ? 'กล่องร่าง TikTok เต็ม (ค้างได้ไม่เกิน 5 คลิปใน 24 ชม.) — เปิดแอป TikTok โพสต์คลิปที่ค้างก่อน'
  : /spam_risk|reached_active_user_cap|rate_limit/.test(err) ? 'TikTok จำกัดจำนวนโพสต์ต่อวันแล้ว — ลองใหม่พรุ่งนี้' : '');
