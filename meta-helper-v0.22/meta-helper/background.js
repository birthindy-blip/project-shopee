// งานยาว (อัปโหลดคลิป / รอ Reel ประมวลผล / ค้นผ่านหน้า Affiliate): service worker หลับเองเมื่อไม่มีการเรียก API ของส่วนเสริมเกิน 30 วิ
// (fetch ไม่นับ) → หลับกลางคัน = งานหายและหน้าเว็บไม่ได้คำตอบ · เรียก API เบาๆ ทุก 20 วิจนงานเสร็จ
function keepAlive(promise) {
  const t = setInterval(() => { try { chrome.runtime.getPlatformInfo(() => void chrome.runtime.lastError); } catch (e) {} }, 20000);
  return Promise.resolve(promise).finally(() => clearInterval(t));
}

// โหลดรูปสินค้าจาก Shopee (ข้ามข้อจำกัด CORS ของหน้าเว็บ) แล้วย่อเป็น JPEG เก็บในเครื่อง
chrome.runtime.onMessage.addListener((m, _sender, send) => {
  if (m && m.type === 'fetchImage') {
    fetchImage(m.url, m.max).then((dataUrl) => send({ ok: true, dataUrl }), (e) => send({ ok: false, error: String(e) }));
    return true; // ตอบกลับแบบ async
  }
  if (m && m.type === 'affHello') { affHello(_sender, m); return false; } // แท็บ Affiliate โหลดเสร็จ
  if (m && (m.type === 'affSearch' || m.type === 'affLink')) { // ค้นหา/เอาลิงก์ผ่านหน้าเว็บ Affiliate (ไม่ต้องใช้ API)
    keepAlive(affCall(m)).then(send, (e) => send({ ok: false, error: String(e.message || e) }));
    return true;
  }
  if (m && /^fb(Pages|Photos|Reel|Recomment|Text)$/.test(m.type)) { // โพสต์ Facebook Page (Graph API)
    keepAlive(({ fbPages, fbPhotos, fbReel, fbRecomment, fbText })[m.type](m)).then((r) => send({ ok: true, ...r }), (e) => send({ ok: false, error: String(e.message || e) }));
    return true;
  }
  if (m && m.type === 'shopeeSearch') { // ค้นหาสินค้าผ่าน Shopee Affiliate Open API
    keepAlive(shopeeSearch(m)).then((r) => send({ ok: true, ...r }), (e) => send({ ok: false, error: String(e.message || e) }));
    return true;
  }
  if (m && m.type === 'download') { // ดาวน์โหลดคลิปจาก meta.ai ลงโฟลเดอร์ Downloads/ShopeeVideo
    const dl = (filename) => chrome.downloads.download({ url: m.url, filename, conflictAction: 'uniquify', saveAs: false })
      .then((id) => { chrome.storage.local.set({ mahLastDownload: id }); return id; });
    // บางเครื่องไม่รับชื่อไฟล์ภาษาไทย → ลองใหม่ด้วยชื่ออังกฤษ
    const ascii = `ShopeeVideo/clip-${new Date().toISOString().replace(/\D/g, '').slice(0, 14)}${(m.filename.match(/\.\w+$/) || ['.mp4'])[0]}`;
    dl(m.filename).then((id) => send({ ok: true, id }), (e1) => dl(ascii) // ชื่อสำรอง → บอกแผงว่าเปลี่ยนชื่อเพราะอะไร
      .then((id) => send({ ok: true, id, renamed: ascii.split('/').pop(), why: String((e1 && e1.message) || e1) }), (e) => send({ ok: false, error: String(e) })));
    return true;
  }
  if (m && m.type === 'removeByName') { // ลบคลิป/รูปโพสต์/.txt ของสินค้าตามชื่อ (ไฟล์ที่ทำก่อนจำเลขไฟล์ได้)
    removeByName(m.base).then((r) => send({ ok: true, ...r }), (e) => send({ ok: false, error: String(e.message || e) }));
    return true;
  }
  if (m && m.type === 'removeFiles') { // ลบไฟล์ในเครื่องที่ส่วนเสริมโหลดไว้เอง (รูปโพสต์หลังโพสต์ลงเพจแล้ว)
    removeFiles(m.ids || []).then((r) => send({ ok: true, ...r }), (e) => send({ ok: false, error: String(e.message || e) }));
    return true;
  }
  if (m && m.type === 'geminiModels') { // รายชื่อรุ่นที่ key นี้ใช้ได้
    geminiModels(m).then((models) => send({ ok: true, models }), (e) => send({ ok: false, error: String(e.message || e) }));
    return true;
  }
  if (m && m.type === 'productDesc') { // อ่านรายละเอียดสินค้าจากหน้าสินค้า Shopee (ถ้ามีใน HTML)
    productDesc(m.url).then((desc) => send({ ok: true, desc }), (e) => send({ ok: false, error: String(e.message || e) }));
    return true;
  }
  if (m && m.type === 'showFolder') { // เปิดโฟลเดอร์ที่เก็บคลิป (ชี้ไฟล์ล่าสุด)
    chrome.storage.local.get('mahLastDownload', ({ mahLastDownload }) => {
      if (mahLastDownload) chrome.downloads.search({ id: mahLastDownload }, (r) => {
        if (r && r[0] && r[0].exists !== false && r[0].state === 'complete') chrome.downloads.show(mahLastDownload);
        else chrome.downloads.showDefaultFolder();
        send({ ok: true });
      });
      else { chrome.downloads.showDefaultFolder(); send({ ok: true }); }
    });
    return true;
  }
  if (m && m.type === 'svStatus') { // โปรแกรมโพสต์ Shopee Video ในเครื่อง (shopee-poster) — อ่านสถานะอย่างเดียว
    svStatus().then((r) => send({ ok: true, ...r }), (e) => send({ ok: false, error: String(e.message || e) }));
    return true;
  }
  if (m && m.type === 'gemini') { // เขียนบทพูดด้วย Gemini API
    keepAlive(gemini(m)).then((text) => send({ ok: true, text }), (e) => send({ ok: false, error: String(e.message || e) }));
    return true;
  }
  return false;
});

// ลบเฉพาะไฟล์ที่ส่วนเสริมโหลดเอง (อ้างด้วยเลขดาวน์โหลด) และอยู่ในโฟลเดอร์ ShopeeVideo เท่านั้น · ลบไฟล์แล้วลบรายการในประวัติดาวน์โหลดด้วย
async function removeFiles(ids) {
  let removed = 0, missing = 0;
  const errors = [];
  for (const id of ids.filter((x) => Number.isInteger(x))) {
    const [d] = await chrome.downloads.search({ id });
    if (!d || !/[\\/]ShopeeVideo[\\/]|ShopeeVideo-|[\\/]clip-\d+/.test(d.filename || '')) continue; // ไม่ใช่ไฟล์ของเรา → ไม่แตะ
    try { if (d.exists !== false && d.state === 'complete') { await chrome.downloads.removeFile(id); removed++; } else missing++; } catch (e) { if (/not.?found|does not exist/i.test(String(e.message || e))) missing++; else errors.push(String(e.message || e)); } // missing = ไฟล์ถูกย้าย/ลบไปก่อนแล้ว
    try { await chrome.downloads.erase({ id }); } catch (e) {}
  }
  return { removed, missing, errors };
}

// โปรแกรมโพสต์ Shopee Video (shopee-poster · เปิดด้วย start.bat) = เว็บในเครื่อง 127.0.0.1:8765 · อ่าน /api/status อย่างเดียว ไม่สั่งงาน
// ไม่ได้เปิดโปรแกรม = { on: false } · ส่งกลับเฉพาะที่แท็บ 🛍 ใช้ (ไม่ส่งบันทึกการทำงานทั้งหมด)
// โปรแกรมไล่หามือถือ USB ทุก 15 วิ (ครั้งละ ~5–8 วิ) → รอได้ถึง 12 วิ
const SV_URL = 'http://127.0.0.1:8765';
async function svStatus() {
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 12000);
  let s;
  try {
    const res = await fetch(`${SV_URL}/api/status`, { cache: 'no-store', signal: ctl.signal });
    s = res.ok ? await res.json() : null;
  } catch (e) { return { on: false, url: SV_URL }; } finally { clearTimeout(t); }
  if (!s || !Array.isArray(s.clips) || !s.job || !s.phone) return { on: false, url: SV_URL, error: 'พอร์ต 8765 มีโปรแกรมอื่นใช้อยู่' };
  const p = s.phone, j = s.job, set = s.settings || {};
  return {
    on: true, url: SV_URL,
    phone: { state: p.state, model: p.model || '', message: p.message || '', checked: !!p.checked },
    job: { running: !!j.running, state: j.state || 'idle', waiting: !!j.prompt, last: (j.logs || []).slice(-1)[0] || '' },
    pending: s.pending || 0, today: s.today || 0, limit: set.daily_limit || 0, autoPost: !!set.auto_post, ready: !!s.ready,
    productsReady: !!s.products_ready, folder: set.clips_folder || '', notes: (s.notes || []).slice(0, 5),
    clips: s.clips.map((c) => ({ name: c.name, file: c.file, mb: c.size_mb, state: c.state, link: !!c.has_link, id: (c.product || {}).status === 'resolved' })),
  };
}

// หาไฟล์ของสินค้าจากประวัติดาวน์โหลดด้วยชื่อ: ShopeeVideo/ชื่อ(-A|-B)(-photo-N)( (N)).นามสกุล หรือ ShopeeVideo-ชื่อ… (ชื่อสำรอง)
// ใช้กับคลิปที่ทำก่อนจำเลขไฟล์ได้ · เฉพาะไฟล์ที่ยังอยู่ในประวัติดาวน์โหลด · ลบผ่าน removeFiles (ลบได้แค่ไฟล์ในโฟลเดอร์ ShopeeVideo)
const reEsc = (t) => String(t).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
async function removeByName(base) {
  const name = String(base || '').trim();
  if (!name) return { removed: 0, found: 0, errors: [] };
  const filenameRegex = String.raw`[\\/]ShopeeVideo[\\/-]` + reEsc(name) + String.raw`(-[AB])?(-photo-\d+)?( \(\d+\))?\.(mp4|webm|txt|jpe?g|png|webp)$`;
  const found = await chrome.downloads.search({ filenameRegex, state: 'complete' });
  let similar = [];
  if (!found.length) { // ไม่เจอชื่อตรง → บอกไฟล์ชื่อคล้าย (ขึ้นต้นเหมือนกัน) ให้ดู · ไม่ลบให้ (อาจเป็นสินค้าอื่น)
    const head = reEsc([...name].slice(0, 12).join(''));
    const near = await chrome.downloads.search({ filenameRegex: String.raw`[\\/]ShopeeVideo[\\/-]` + head, state: 'complete', limit: 5 });
    similar = near.map((d) => String(d.filename).split(/[\\/]/).pop());
  }
  return { ...(await removeFiles(found.map((d) => d.id))), found: found.length, similar };
}

// key ทั้งแบบ AQ. (แบบใหม่ของ AI Studio ตั้งแต่ พ.ค. 2026) และ AIza ใช้ endpoint เดียวกัน ส่งทาง header x-goog-api-key
async function gemini({ key, model, prompt, images = [], base }) {
  const parts = [{ text: prompt }, ...images.map((d) => ({ inlineData: { mimeType: d.slice(5, d.indexOf(';')), data: d.split(',')[1] } }))];
  const url = `${base || 'https://generativelanguage.googleapis.com'}/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({ contents: [{ role: 'user', parts }], generationConfig: { temperature: 1.0, responseMimeType: 'application/json' } }),
    signal: AbortSignal.timeout(60000),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(errText(res.status, j));
  const text = ((((j.candidates || [])[0] || {}).content || {}).parts || []).map((x) => x.text || '').join('');
  if (!text) throw new Error(`Gemini ไม่ส่งข้อความกลับมา${j.promptFeedback && j.promptFeedback.blockReason ? ` (${j.promptFeedback.blockReason})` : ''}`);
  return text;
}

async function fetchImage(url, max = 1536) { // max = ด้านยาวสุด (รูปย่อในผลค้นหาใช้เล็กๆ)
  const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const bmp = await createImageBitmap(await res.blob());
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const canvas = new OffscreenCanvas(Math.round(bmp.width * k), Math.round(bmp.height * k));
  canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height);
  const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.9 });
  const buf = new Uint8Array(await blob.arrayBuffer());
  let bin = '';
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return `data:image/jpeg;base64,${btoa(bin)}`;
}

// ข้อความผิดพลาดเต็มจาก Gemini เช่น "503 UNAVAILABLE: The model is overloaded..."
function errText(status, j) {
  const e = j.error || {};
  return `${status} ${e.status || (status >= 500 ? 'SERVER_ERROR' : 'ERROR')}${e.message ? `: ${e.message}` : ''}`.trim().slice(0, 220);
}

async function geminiModels({ key, base }) {
  const res = await fetch(`${base || 'https://generativelanguage.googleapis.com'}/v1beta/models?pageSize=200`, {
    headers: { 'x-goog-api-key': key }, signal: AbortSignal.timeout(20000),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(errText(res.status, j));
  return (j.models || []).filter((x) => (x.supportedGenerationMethods || []).includes('generateContent')).map((x) => x.name.replace(/^models\//, ''));
}

// Shopee Affiliate Open API (GraphQL) — ขอ AppID + Secret ที่ affiliate.shopee.co.th → Open API
// ลายเซ็น: SHA256(AppID + Timestamp + Payload + Secret) · Payload = body ที่ส่งจริงทุกตัวอักษร
const SHOPEE_API = 'https://open-api.affiliate.shopee.co.th/graphql';
async function sha256hex(s) {
  const h = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)));
  return [...h].map((b) => b.toString(16).padStart(2, '0')).join('');
}
async function shopeeApi(appId, secret, query) {
  const payload = JSON.stringify({ query });
  const ts = Math.floor(Date.now() / 1000);
  const sig = await sha256hex(`${appId}${ts}${payload}${secret}`);
  const res = await fetch(SHOPEE_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `SHA256 Credential=${appId}, Timestamp=${ts}, Signature=${sig}` },
    body: payload,
    signal: AbortSignal.timeout(20000),
  });
  const j = await res.json().catch(() => ({}));
  if (j.errors && j.errors.length) {
    const e = j.errors[0], x = e.extensions || {};
    throw new Error(`${x.code || res.status}: ${x.message || e.message || 'ผิดพลาด'}`.slice(0, 220));
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return j.data || {};
}
// sortType: 1 เกี่ยวข้อง · 2 ขายดี · 4 ราคาต่ำ→สูง · 5 คอมสูง · isAMSOffer = เฉพาะสินค้าที่ร้านให้คอมพิเศษ (Extra Comm)
async function shopeeSearch({ appId, secret, keyword, sortType = 1, page = 1, limit = 20, xtra }) {
  if (!appId || !secret) throw new Error('ยังไม่ได้ใส่ AppID / Secret');
  const args = [`sortType: ${+sortType || 1}`, `page: ${+page || 1}`, `limit: ${+limit || 20}`];
  if (String(keyword || '').trim()) args.unshift(`keyword: ${JSON.stringify(String(keyword).trim())}`); // ไม่มีคำค้น = สินค้าแนะนำ
  if (xtra) args.push('isAMSOffer: true');
  const data = await shopeeApi(appId, secret, `{ productOfferV2(${args.join(', ')}) {
    nodes { itemId productName imageUrl priceMin priceMax sales ratingStar commissionRate sellerCommissionRate shopeeCommissionRate shopName productLink offerLink }
    pageInfo { hasNextPage } } }`);
  const r = data.productOfferV2 || {};
  return { nodes: r.nodes || [], hasNextPage: !!(r.pageInfo && r.pageInfo.hasNextPage) };
}

// ---------- โพสต์ Facebook Page ผ่าน Graph API (รูป 4 ภาพ / Reel + คอมเมนต์ลิงก์ตะกร้าในนามเพจ) ----------
// ต้องใช้ User Token ที่มีสิทธิ์ pages_show_list, pages_read_engagement, pages_manage_posts, pages_manage_engagement (Reel = video_reels ใช้ pages_manage_posts · ไม่ต้องมี publish_video)
// เรียกแบบไม่ระบุเวอร์ชัน = ใช้เวอร์ชันตั้งต้นของแอป (ไม่ต้องตามแก้เมื่อเวอร์ชันเก่าหมดอายุ)
const GRAPH = 'https://graph.facebook.com';
async function graph(path, params = {}, method = 'POST', form) {
  const url = new URL(`${GRAPH}/${path}`);
  const inUrl = method === 'GET' || form; // GET / อัปโหลดไฟล์ → พารามิเตอร์ไปอยู่ใน URL
  if (inUrl) for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url, { method, body: form || (inUrl ? undefined : new URLSearchParams(params)), signal: AbortSignal.timeout(180000) });
  const j = await res.json().catch(() => ({}));
  if (j.error) throw new Error(`${j.error.code || res.status}${j.error.error_subcode ? `/${j.error.error_subcode}` : ''}: ${j.error.message || 'Graph API error'}`.slice(0, 260));
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return j;
}
const dataBlob = async (dataUrl) => (await fetch(dataUrl)).blob();
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
// รายชื่อเพจที่ token นี้จัดการได้ (+ Page Token ของแต่ละเพจ)
async function fbPages({ userToken }) {
  if (!userToken) throw new Error('ยังไม่ได้ใส่ User Token');
  const r = await graph('me/accounts', { fields: 'id,name,access_token', limit: 100, access_token: userToken }, 'GET');
  // อายุ + สิทธิ์ของ token (เจ้าของแอปตรวจ token ตัวเองได้) — ตรวจไม่ได้ก็ไม่เป็นไร
  let info = null;
  try { info = (await graph('debug_token', { input_token: userToken, access_token: userToken }, 'GET')).data || null; } catch (e) {}
  return { pages: (r.data || []).map((p) => ({ id: p.id, name: p.name, token: p.access_token })),
    expiresAt: info ? +info.expires_at || 0 : null, scopes: info && Array.isArray(info.scopes) ? info.scopes : null };
}
// คอมเมนต์ในนามเพจ (ปักตะกร้า) · Reel ต้องรอประมวลผลก่อน → ลองซ้ำได้
async function fbComment(objectId, token, message, tries = 1) {
  let last = '';
  for (let t = 0; t < tries; t++) {
    if (t) await wait(5000);
    try { await graph(`${objectId}/comments`, { message, access_token: token }); return { commented: true }; } catch (e) { last = e.message; }
  }
  return { commented: false, commentError: last };
}
// ปักตะกร้าซ้ำ (โพสต์ขึ้นแล้วแต่คอมเมนต์ไม่ติด เช่น Reel ประมวลผลนานเกิน 2 นาที) — ไม่โพสต์ใหม่
const fbRecomment = ({ objectId, token, message }) => fbComment(objectId, token, message, 3);
// โพสต์รูป: อัปโหลดแบบยังไม่เผยแพร่ → โพสต์เดียวแนบทุกรูป → คอมเมนต์ลิงก์
async function fbPhotos({ pageId, token, photos = [], message, comment }) {
  if (!photos.length) throw new Error('ไม่มีรูปให้โพสต์');
  const ids = [];
  for (const ph of photos.slice(0, 10)) {
    const form = new FormData();
    form.append('published', 'false');
    if (ph.dataUrl) form.append('source', await dataBlob(ph.dataUrl), 'photo.jpg'); else form.append('url', ph.url);
    ids.push((await graph(`${pageId}/photos`, { access_token: token }, 'POST', form)).id);
  }
  const params = { message, access_token: token };
  ids.forEach((id, i) => { params[`attached_media[${i}]`] = JSON.stringify({ media_fbid: id }); });
  const post = await graph(`${pageId}/feed`, params);
  return { postId: post.id, ...(comment ? await fbComment(post.id, token, comment) : {}) };
}
// โพสต์ข้อความล้วน (โพสต์คั่นไม่ขายของ — ไม่มีรูป ไม่มีลิงก์ ไม่มีคอมเมนต์)
async function fbText({ pageId, token, message }) {
  if (!String(message || '').trim()) throw new Error('ไม่มีข้อความให้โพสต์');
  const post = await graph(`${pageId}/feed`, { message, access_token: token });
  return { postId: post.id };
}
// Reel: start → อัปโหลดไฟล์ (binary หรือ file_url) → finish (PUBLISHED) → รอประมวลผลแล้วคอมเมนต์ลิงก์
async function fbReel({ pageId, token, video, description, comment }) {
  if (!video) throw new Error('ไม่มีคลิปให้โพสต์');
  const start = await graph(`${pageId}/video_reels`, { upload_phase: 'start', access_token: token });
  const id = start.video_id;
  const headers = { Authorization: `OAuth ${token}` };
  let body;
  if (video.dataUrl) {
    body = await dataBlob(video.dataUrl);
    Object.assign(headers, { offset: '0', file_size: String(body.size), 'Content-Type': 'application/octet-stream' });
  } else headers.file_url = video.url;
  const up = await fetch(start.upload_url || `https://rupload.facebook.com/video-upload/v23.0/${id}`, { method: 'POST', headers, body, signal: AbortSignal.timeout(300000) });
  const uj = await up.json().catch(() => ({}));
  if (!up.ok || uj.error || uj.success === false) throw new Error(`อัปโหลดคลิปไม่ได้: ${(uj.error && (uj.error.message || JSON.stringify(uj.error))) || `HTTP ${up.status}`}`.slice(0, 260));
  await graph(`${pageId}/video_reels`, { upload_phase: 'finish', video_id: id, video_state: 'PUBLISHED', description, access_token: token });
  return { videoId: id, ...(comment ? await fbComment(id, token, comment, 24) : {}) };
}

// ---------- ค้นหาผ่านหน้าเว็บ Shopee Affiliate (ใช้บัญชีที่ล็อกอินไว้ในเบราว์เซอร์นี้ · ไม่ต้องใช้ API) ----------
// เปิดหน้าข้อเสนอผลิตภัณฑ์ไว้ในแท็บเบื้องหลัง (ใช้แท็บเดิมซ้ำ) แล้วส่งคำสั่งให้ shopee.js ในแท็บนั้นทำ
const AFF_URL = 'https://affiliate.shopee.co.th/offer/product_offer';
const affWaiters = new Map(); // tabId → รอ affHello
function affHello(sender, m) {
  const id = sender.tab && sender.tab.id;
  (affWaiters.get(id) || []).forEach((r) => r(m));
  affWaiters.delete(id);
}
const waitHello = (id, ms) => new Promise((res) => {
  const t = setTimeout(() => res(null), ms);
  affWaiters.set(id, [...(affWaiters.get(id) || []), (m) => { clearTimeout(t); res(m); }]);
});
// quiet = โหลดเองตอนเปิดแท็บ 🔎 (ผู้ใช้ไม่ได้กด) → ไม่สลับแท็บไปหน้าล็อกอิน
const loginError = (id, quiet) => {
  if (quiet) return new Error('ยังไม่ได้เข้าสู่ระบบ Shopee Affiliate — กด 🔥 แนะนำ หรือค้นหา แล้วจะเปิดแท็บให้ล็อกอิน');
  chrome.tabs.update(id, { active: true }).catch(() => {});
  return new Error('ยังไม่ได้เข้าสู่ระบบ Shopee Affiliate — ล็อกอินในแท็บที่เปิดให้ แล้วกดค้นหาใหม่');
};
async function affTabId(quiet) {
  const { affTab } = await chrome.storage.session.get('affTab'); // service worker หลับแล้วตื่นใหม่ ตัวแปรหาย → เก็บไว้ใน session
  const tab = affTab != null ? await chrome.tabs.get(affTab).catch(() => null) : null;
  if (tab) {
    // แท็บถูกใช้เปิดเว็บอื่นไปแล้ว (ไม่ใช่หน้า Affiliate / หน้าล็อกอิน) → พากลับหน้าข้อเสนอผลิตภัณฑ์ ไม่งั้นจะขึ้นว่ายังไม่ได้ล็อกอิน
    const u = tab.pendingUrl || tab.url || '';
    if (!/^https:\/\/affiliate\.shopee\.co\.th\//.test(u) && !/login|signin|verify|captcha/i.test(u)) {
      const hello = waitHello(affTab, 40000);
      await chrome.tabs.update(affTab, { url: AFF_URL });
      const hi = await hello;
      if (hi && hi.login) throw loginError(affTab, quiet);
    }
    return affTab;
  }
  const t = await chrome.tabs.create({ url: AFF_URL, active: false });
  await chrome.storage.session.set({ affTab: t.id });
  const hi = await waitHello(t.id, 40000);
  if (!hi) throw new Error('เปิดหน้า Shopee Affiliate ไม่ขึ้น (หมดเวลา)');
  if (hi.login) throw loginError(t.id, quiet);
  return t.id;
}
async function affCall(m) {
  const quiet = !!m.quiet;
  const id = await affTabId(quiet);
  let reloaded = false, homeLoaded = false;
  for (let t = 0; ; t++) { // หน้าเพิ่งโหลด/เพิ่งเปลี่ยน ตัวรับข้อความอาจยังไม่พร้อม → ลองซ้ำ
    try {
      const r = await new Promise((res, rej) => {
        const timer = setTimeout(() => rej(new Error('หน้า Affiliate ไม่ตอบ (หมดเวลา)')), 150000); // ย้อนไปหน้าเดิม (ค้นใหม่ + เรียง + ไล่หลายหน้า) ใช้เวลาได้
        chrome.tabs.sendMessage(id, m, (x) => { clearTimeout(timer); const e = chrome.runtime.lastError; if (e) rej(new Error(e.message)); else res(x); });
      });
      if (r && r.login) throw loginError(id, quiet);
      if (r && r.reload && !homeLoaded) { // สินค้าแนะนำ: หน้าเคยค้นไปแล้ว → เปิดหน้าข้อเสนอผลิตภัณฑ์ใหม่ (รายการตั้งต้น)
        homeLoaded = true;
        const hello = waitHello(id, 40000);
        await chrome.tabs.update(id, { url: AFF_URL });
        const hi = await hello;
        if (hi && hi.login) throw loginError(id, quiet);
        continue;
      }
      if (r && r.notReady) { // หน้าไม่วาดตอนอยู่เบื้องหลัง / ต้องล็อกอิน → เปิดให้เห็น
        if (quiet) return { ...r, error: `${r.error} — กด 🔥 แนะนำ หรือค้นหาอีกครั้งเพื่อเปิดแท็บ Shopee Affiliate` };
        chrome.tabs.update(id, { active: true }).catch(() => {});
        return { ...r, error: `${r.error} — สลับไปแท็บ Shopee Affiliate ให้แล้ว: ถ้าต้องล็อกอินให้ล็อกอิน รอหน้าขึ้นครบ แล้วกลับมากดค้นหาอีกครั้ง` };
      }
      return r || { ok: false, error: 'หน้า Affiliate ไม่ตอบ' };
    } catch (e) {
      if (!/establish connection|receiving end/i.test(e.message)) throw e;
      // ลองซ้ำ 3 วิ แล้วยังไม่มีตัวรับ = แท็บยังรันโค้ดชุดเก่า (หลังกด Reload ส่วนเสริม) → รีโหลดแท็บเอง 1 ครั้ง
      if (t === 3 && !reloaded) {
        reloaded = true;
        const hello = waitHello(id, 40000);
        await chrome.tabs.reload(id);
        const hi = await hello;
        if (hi && hi.login) throw loginError(id, quiet);
        continue;
      }
      if (t >= 12) throw new Error('ติดต่อแท็บ Shopee Affiliate ไม่ได้ — ปิดแท็บนั้นแล้วกดค้นหาใหม่');
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
}

async function productDesc(url) {
  if (!/^https:\/\/([a-z0-9-]+\.)*shopee\.co\.th\//.test(url)) throw new Error('ไม่ใช่ลิงก์ Shopee');
  const res = await fetch(url, { credentials: 'include', signal: AbortSignal.timeout(12000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = (await res.text()).slice(0, 800000);
  const unesc = (t) => t.replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  const meta = html.match(/<meta[^>]+(?:property|name)=["'](?:og:description|description)["'][^>]+content=["']([^"']{20,})["']/i)
    || html.match(/<meta[^>]+content=["']([^"']{20,})["'][^>]+(?:property|name)=["'](?:og:description|description)["']/i);
  if (meta) return unesc(meta[1]);
  const ld = html.match(/"description"\s*:\s*"((?:[^"\\]|\\.){20,})"/);
  if (ld) { try { return JSON.parse(`"${ld[1]}"`); } catch (e) { return ld[1]; } }
  return '';
}
