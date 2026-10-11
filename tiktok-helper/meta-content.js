// Meta AI browser adapter. Input/send/video detection adapted from
// meta-helper-v0.22/meta-helper/content.js; that project remains unchanged.
(() => {
  let active = null;
  let media = null;
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const shown = e => { const r = e.getBoundingClientRect(), s = getComputedStyle(e); return r.width > 8 && r.height > 8 && s.display !== 'none' && s.visibility !== 'hidden'; };
  const label = e => [e.getAttribute('aria-label'), e.title, e.textContent].filter(Boolean).join(' ');
  const input = () => [...document.querySelectorAll('textarea, [contenteditable="true"], [contenteditable="plaintext-only"]')].filter(shown).sort((a,b) => b.getBoundingClientRect().bottom - a.getBoundingClientRect().bottom)[0];
  const text = e => (e?.value ?? e?.innerText ?? '').replace(/\s+/g, ' ').trim();
  const busy = () => [...document.querySelectorAll('button,[role="button"],[aria-busy="true"],[role="progressbar"]')].some(e => shown(e) && (e.getAttribute('aria-busy') === 'true' || e.getAttribute('role') === 'progressbar' || /^\s*stop|stop generat|หยุด/i.test(label(e))));
  const src = v => v.currentSrc || v.src || v.querySelector('source')?.src || '';
  const norm = u => { try { const x = new URL(u); return x.origin + x.pathname; } catch { return u; } };
  const videos = () => [...document.querySelectorAll('video')].filter(v => src(v));
  function check(job) { if (job.cancelled) throw new Error('หยุดแล้ว'); }
  async function until(job, fn, ms) {
    const end = Date.now() + ms;
    while (Date.now() < end) { check(job); const value = await fn(); if (value) return value; await sleep(500); }
    throw new Error('หมดเวลารอ Meta AI — ตรวจหน้าเว็บก่อนลองใหม่');
  }
  async function put(box, value) {
    box.focus();
    if (box.tagName === 'TEXTAREA') {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(box, value);
      box.dispatchEvent(new Event('input', {bubbles:true}));
    } else {
      const select = () => { const r = document.createRange(); r.selectNodeContents(box); const s = getSelection(); s.removeAllRanges(); s.addRange(r); };
      select(); const dt = new DataTransfer(); dt.setData('text/plain', value);
      box.dispatchEvent(new ClipboardEvent('paste', {clipboardData:dt, bubbles:true, cancelable:true}));
      await sleep(500);
      if (text(box) !== value.replace(/\s+/g,' ').trim()) { select(); document.execCommand('insertText', false, value); }
    }
    await sleep(700);
    if (text(box) !== value.replace(/\s+/g,' ').trim()) throw new Error('ใส่พรอมป์ต์ใน Meta AI ไม่ครบ — ยังไม่ได้ส่ง');
  }
  async function fingerprint(blob) {
    const hash = await crypto.subtle.digest('SHA-256', await blob.slice(0,262144).arrayBuffer());
    return [...new Uint8Array(hash)].map(x => x.toString(16).padStart(2,'0')).join('');
  }
  async function read(url, job) {
    const res = await fetch(url, {signal: job.controller.signal});
    if (!res.ok) throw new Error(`โหลดคลิปไม่ได้ HTTP ${res.status}`);
    const blob = await res.blob();
    if (!blob.size || (blob.type && !/^video\//.test(blob.type) && blob.type !== 'application/octet-stream')) throw new Error('Meta AI ไม่ได้ส่งไฟล์วิดีโอ');
    return blob;
  }
  async function generate(m) {
    if (active) throw new Error('แท็บ Meta AI นี้กำลังทำงานอยู่');
    if (media) throw new Error('มีคลิปที่ยังไม่ได้รับ — รับคลิปเดิมก่อน');
    const job = {id:m.id, cancelled:false, controller:new AbortController()}; active = job;
    const timeout = setTimeout(() => job.controller.abort(), 12 * 60000);
    try {
      await until(job, () => !busy(), 60000);
      const box = await until(job, input, 30000);
      if (text(box)) throw new Error('ช่องพิมพ์ Meta AI มีข้อความอยู่ — ล้างหรือส่งข้อความเดิมก่อน');
      const oldUrls = new Set(videos().map(v => norm(src(v))));
      const oldHashes = new Set();
      for (const v of videos()) {
        // Never accept a re-rendered old video if its contents cannot be checked.
        oldHashes.add(await fingerprint(await read(src(v), job)));
      }
      if (m.image) {
        const f = [...document.querySelectorAll('input[type="file"]')].find(e => /image/.test(e.accept));
        if (!f) throw new Error('ไม่พบช่องแนบรูป — เปิดเมนูแนบรูปใน Meta AI ก่อน');
        const response = await fetch(m.image.dataUrl);
        const dt = new DataTransfer(); dt.items.add(new File([await response.blob()], m.image.name, {type:m.image.type}));
        f.files = dt.files; f.dispatchEvent(new Event('change', {bubbles:true})); await sleep(2000);
      }
      await put(box, m.prompt); check(job);
      const ir = box.getBoundingClientRect();
      const send = await until(job, () => [...document.querySelectorAll('button,[role="button"]')].filter(e => shown(e) && !e.disabled && e.getAttribute('aria-disabled') !== 'true' && !e.getAttribute('aria-haspopup'))
        .filter(e => /send|submit|generate|create|animate|ส่ง|สร้าง/i.test(label(e)) && !/stop|cancel|attach|upload|share|download|image|photo|new chat|หยุด|แนบ|รูป|ภาพ|แชร์|ดาวน์โหลด/i.test(label(e)))
        .map(e => ({e, d:Math.hypot(e.getBoundingClientRect().left-ir.right,e.getBoundingClientRect().top-ir.top), strong:/send|submit|ส่ง/i.test(label(e))}))
        .filter(x => x.d < 400).sort((a,b) => Number(b.strong)-Number(a.strong) || a.d-b.d)[0]?.e, 10000);
      send.click(); await until(job, () => !text(input()), 15000);
      let candidate = '', stableAt = 0;
      const blob = await until(job, async () => {
        const fresh = videos().filter(v => !oldUrls.has(norm(src(v))) && Number.isFinite(v.duration) && v.duration > 1).sort((a,b) => b.duration-a.duration);
        if (!fresh.length || busy()) { candidate=''; return null; }
        const key = norm(src(fresh[0])) + ':' + fresh[0].duration;
        if (candidate !== key) { candidate=key; stableAt=Date.now(); return null; }
        if (Date.now()-stableAt < 10000) return null;
        const b = await read(src(fresh[0]),job);
        if (oldHashes.has(await fingerprint(b))) { oldUrls.add(norm(src(fresh[0]))); candidate=''; return null; }
        return b;
      }, 10*60000);
      check(job); media = {id:m.id, blob};
      return {ok:true, size:blob.size, mime:blob.type || 'video/mp4'};
    } finally { clearTimeout(timeout); active=null; }
  }
  chrome.runtime.onMessage.addListener((m, sender, reply) => {
    if (sender.id !== chrome.runtime.id || !m?.type?.startsWith('tthMeta')) return;
    (async () => {
      if (m.type === 'tthMetaPing') return {ok:true, input:!!input(), busy:!!active || busy(), pending:media?.id || null};
      if (m.type === 'tthMetaCancel') { if (active?.id === m.id) { active.cancelled=true; active.controller.abort(); } return {ok:true}; }
      if (m.type === 'tthMetaGenerate') return generate(m);
      if (m.type === 'tthMetaInfo') { if (media?.id !== m.id) throw new Error('ไม่พบคลิปค้างในแท็บนี้'); return {ok:true,size:media.blob.size,mime:media.blob.type || 'video/mp4'}; }
      if (m.type === 'tthMetaChunk') {
        if (media?.id !== m.id || !Number.isInteger(m.offset) || m.offset<0) throw new Error('ไม่พบคลิปหรือช่วงข้อมูลไม่ถูกต้อง');
        const bytes = new Uint8Array(await media.blob.slice(m.offset,m.offset+262144).arrayBuffer());
        let binary=''; for (const byte of bytes) binary+=String.fromCharCode(byte);
        return {ok:true, data:btoa(binary)};
      }
      if (m.type === 'tthMetaRelease') { if (media?.id === m.id) media=null; return {ok:true}; }
      throw new Error('คำสั่งไม่ถูกต้อง');
    })().then(reply,e => reply({ok:false,error:e.message || String(e)}));
    return true;
  });
})();
