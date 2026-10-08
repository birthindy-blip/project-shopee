// โหลดรูปสินค้าจาก Shopee (ข้ามข้อจำกัด CORS ของหน้าเว็บ) แล้วย่อเป็น JPEG เก็บในเครื่อง
chrome.runtime.onMessage.addListener((m, _sender, send) => {
  if (m && m.type === 'fetchImage') {
    fetchImage(m.url).then((dataUrl) => send({ ok: true, dataUrl }), (e) => send({ ok: false, error: String(e) }));
    return true; // ตอบกลับแบบ async
  }
  if (m && m.type === 'download') { // ดาวน์โหลดคลิปจาก meta.ai ลงโฟลเดอร์ Downloads/ShopeeVideo
    const dl = (filename) => chrome.downloads.download({ url: m.url, filename, conflictAction: 'uniquify', saveAs: false })
      .then((id) => { chrome.storage.local.set({ mahLastDownload: id }); return id; });
    // บางเครื่องไม่รับชื่อไฟล์ภาษาไทย → ลองใหม่ด้วยชื่ออังกฤษ
    const ascii = `ShopeeVideo/clip-${new Date().toISOString().replace(/\D/g, '').slice(0, 14)}${(m.filename.match(/\.\w+$/) || ['.mp4'])[0]}`;
    dl(m.filename).catch(() => dl(ascii))
      .then((id) => send({ ok: true, id }), (e) => send({ ok: false, error: String(e) }));
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
  if (m && m.type === 'gemini') { // เขียนบทพูดด้วย Gemini API
    gemini(m).then((text) => send({ ok: true, text }), (e) => send({ ok: false, error: String(e.message || e) }));
    return true;
  }
  return false;
});

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

async function fetchImage(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const bmp = await createImageBitmap(await res.blob());
  const k = Math.min(1, 1536 / Math.max(bmp.width, bmp.height));
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
