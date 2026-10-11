// TikTok Uploader — หน้าเดียว: บัญชี (หลายบัญชี สลับทีละคลิป) · เลือกคลิปในเครื่อง + แคปชันจาก .txt · อัปโหลดทีละคลิป/ทั้งหมด · ประวัติกันอัปซ้ำ
const $ = (id) => document.getElementById(id);
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const store = chrome.storage.local;
let msgTimer;
const msg = (text, cls) => { clearTimeout(msgTimer); $('msg').textContent = text; $('msg').className = cls || ''; if (cls === 'ok') msgTimer = setTimeout(() => { $('msg').textContent = ''; }, 6000); };
const MODES = [['inbox', '📥 กล่องร่าง (กดโพสต์เองในแอป)'], ['direct', '🚀 โพสต์ตรง']];
const GAPS = [['0', 'ไม่เว้น'], ['1', '1 นาที'], ['5', '5 นาที'], ['15', '15 นาที']];
let st = { mode: 'inbox', gap: '1', aigc: true, next: 0, theme: 'dark' };
let acc = { redirect: '', hasApp: false, accounts: [] }; // จาก ttStatus() (token ไม่ออกมานอก tt.js)
let items = []; // คลิปในรายการ: { id, file, key, base, caption, fromTxt, openId, state: wait|busy|ok|err, note, dom }
let uploads = []; // { key, name, account, openId, mode, status, at }
const paused = new Set(); // บัญชีที่ติดเพดานในรอบนี้ (พักไว้ ลองบัญชีอื่น)
const bulk = { on: false, stop: false, done: 0, total: 0, nextAt: 0 };
const saveSt = () => store.set({ tthSettings: st });
const saveHist = () => store.set({ tthHistory: uploads.slice(-500) });

// ---------- ชื่อไฟล์ ↔ แคปชัน ----------
// "ชื่อ.mp4" / "ชื่อ-A.mp4" / "ชื่อ (1).mp4" ↔ "ชื่อ.txt" (แบบเดียวกับไฟล์ที่ meta-helper โหลดไว้)
const UNIQ_RE = /\s*\(\d+\)$/, PART_RE = /-(?:A|B|[12]|รวม)$/;
const baseName = (n) => { let s = String(n).replace(/\.[^.]+$/, '').replace(UNIQ_RE, ''); while (PART_RE.test(s)) s = s.replace(PART_RE, ''); return s.trim(); };
// .txt ของ meta-helper: แคปชัน · แฮชแท็ก · 🛒 พิกัด 👉 ลิงก์ → TikTok กดลิงก์ไม่ได้ ตัดบรรทัดลิงก์/พิกัดออก · ไม่เอาแท็กชื่อแพลตฟอร์มอื่น
function captionFromTxt(text) {
  const lines = String(text).replace(/^﻿/, '').split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !/https?:\/\/|พิกัด|ลิงก์ affiliate/i.test(l));
  const cap = [], tags = [];
  for (const l of lines) {
    if (l.startsWith('#')) tags.push(...l.split(/\s+/).filter((w) => w.startsWith('#') && !/shopee|lazada|facebook/i.test(w)));
    else cap.push(l);
  }
  return [cap.join('\n'), [...new Set(tags)].join(' ')].filter(Boolean).join('\n\n').slice(0, 2200);
}
const isVideo = (f) => /^video\//.test(f.type) || /\.(mp4|mov|webm)$/i.test(f.name);
const mb = (n) => `${(n / 1048576).toFixed(1)} MB`;
const when = (t) => { const d = new Date(t); return `${d.getDate()}/${d.getMonth() + 1} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
const doneBefore = (it) => uploads.filter((h) => h.key === it.key);

async function addFiles(list) {
  const files = [...list];
  const txts = new Map();
  for (const f of files.filter((x) => /\.txt$/i.test(x.name))) txts.set(baseName(f.name), await f.text());
  let added = 0, dup = 0;
  for (const f of files.filter(isVideo)) {
    const key = `${f.name}|${f.size}`;
    if (items.some((x) => x.key === key)) { dup++; continue; }
    const base = baseName(f.name), txt = txts.get(base);
    items.push({ id: Math.random().toString(36).slice(2), file: f, key, base, caption: txt != null ? captionFromTxt(txt) : base, fromTxt: txt != null, openId: '', state: 'wait', note: '' });
    added++;
  }
  // .txt ที่ลากตามมาทีหลัง → เติมแคปชันให้คลิปที่ยังใช้ชื่อไฟล์เป็นแคปชัน
  for (const it of items) if (!it.fromTxt && txts.has(it.base)) { it.caption = captionFromTxt(txts.get(it.base)); it.fromTxt = true; if (it.dom) it.dom.ta.value = it.caption; }
  items.filter((x) => x.state === 'wait' && !x.openId).forEach(pick); // แบ่งบัญชีให้เลย (สลับทีละคลิป)
  render();
  const noCap = items.filter((x) => !x.fromTxt).length;
  msg(added ? `เพิ่ม ${added} คลิป ✓${dup ? ` · ซ้ำ ${dup}` : ''}${noCap ? ` · ไม่มี .txt ${noCap} คลิป (ใช้ชื่อไฟล์เป็นแคปชัน แก้ได้)` : ''}` : files.some(isVideo) ? 'คลิปเหล่านี้อยู่ในรายการแล้ว' : 'ไม่พบไฟล์คลิป (.mp4 / .mov / .webm)', added ? 'ok' : 'err');
}

// ---------- บัญชี: สลับทีละคลิป · ติดเพดาน = พักบัญชีนั้นในรอบนี้ ----------
const accountsOn = () => acc.accounts.filter((a) => a.on && !a.expired);
const usable = () => accountsOn().filter((a) => !paused.has(a.openId));
const nextAccount = () => { const u = usable(); return u.length ? u[(st.next || 0) % u.length] : null; };
const accName = (a) => (a && a.name) || 'บัญชี TikTok';
function pick(it) { // บัญชีของคลิปนี้: ตัวที่เลือกไว้ถ้ายังใช้ได้ · ไม่งั้นบัญชีถัดไปในรอบสลับ
  let a = usable().find((x) => x.openId === it.openId);
  if (!a && it.accountLocked && it.openId) return null;
  if (!a && (a = nextAccount())) { st.next = (st.next || 0) + 1; saveSt(); it.openId = a.openId; }
  return a || null;
}

// ---------- อัปโหลด ----------
async function uploadOne(it, retry = true) {
  if (it.state === 'busy') return false;
  const a = pick(it);
  if (!a) { it.state = 'err'; it.note = it.accountLocked && it.openId ? 'บัญชีที่เลือกไม่พร้อมใช้งาน — เปิดใช้บัญชีหรือเลือกปลายทางใหม่' : accountsOn().length ? 'ทุกบัญชีติดเพดานในรอบนี้ — ลองใหม่ทีหลัง' : 'ยังไม่ได้เพิ่ม/เปิดใช้บัญชี TikTok'; render(); return false; }
  it.state = 'busy'; it.note = `→ ${accName(a)} · เริ่ม...`; render();
  try {
    const r = await ttUpload({ file: it.file, title: it.caption, mode: st.mode, openId: a.openId, aigc: it.generated || st.aigc, onStep: (t) => { it.note = `→ ${accName(a)} · ${t}`; render(); } });
    const where = /PROCESSING/.test(r.status || '') ? 'ส่งแล้ว TikTok ยังประมวลผลอยู่ (เช็กในแอปอีกสักครู่)'
      : st.mode !== 'direct' || r.status === 'SEND_TO_USER_INBOX' ? 'เข้ากล่องร่างแล้ว — เปิดแอป TikTok วางแคปชันแล้วกดโพสต์'
      : r.privacy === 'SELF_ONLY' ? 'โพสต์แล้วแบบส่วนตัว (แอปยังไม่ผ่านตรวจ TikTok)' : 'โพสต์แล้ว';
    it.state = 'ok'; it.note = `✓ ${accName(a)}: ${where}`;
    uploads.push({ key: it.key, name: it.file.name, account: a.name || '', openId: a.openId, mode: st.mode, status: r.status || '', at: Date.now() });
    saveHist();
    return true;
  } catch (e) {
    const err = String(e.message || e), why = ttLimitWhy(err);
    if (why && !paused.has(a.openId)) { // ติดเพดาน → พักบัญชีนี้ คลิปนี้ไปบัญชีอื่น (ลองทันที 1 ครั้ง)
      paused.add(a.openId); it.openId = '';
      if (it.accountLocked) { it.openId = a.openId; it.state = 'err'; it.note = `${accName(a)}: ${why} — เก็บคลิปไว้บัญชีเดิม`; return false; }
      if (retry && usable().length) { it.state = 'wait'; it.note = `⏸ “${accName(a)}” ${why} — ลองบัญชีถัดไป`; render(); return uploadOne(it, false); }
    }
    it.state = 'err'; it.note = `${accName(a)}: ${why || err}`;
    return false;
  } finally { render(); }
}
// อัปโหลดทั้งหมด: ตัวที่ยังไม่เสร็จและไม่เคยอัป · ทีละคลิป เว้นระยะตามที่ตั้ง · กดอีกครั้ง = หยุด
async function uploadAll() {
  if (bulk.on) { bulk.stop = true; render(); return; }
  const list = items.filter((x) => x.state !== 'ok' && x.state !== 'busy' && !doneBefore(x).length);
  if (!list.length) { msg(items.length ? 'ไม่มีคลิปที่ต้องอัป (เสร็จ/เคยอัปแล้วทั้งหมด — อัปซ้ำกดปุ่มที่คลิปนั้น)' : 'เพิ่มคลิปก่อน', 'err'); return; }
  if (!accountsOn().length) { msg('ยังไม่ได้เพิ่ม/เปิดใช้บัญชี TikTok', 'err'); return; }
  Object.assign(bulk, { on: true, stop: false, done: 0, total: list.length, nextAt: 0 });
  paused.clear();
  render();
  let ok = 0;
  try {
    for (let i = 0; i < list.length && !bulk.stop; i++) {
      if (!usable().length) { msg('ทุกบัญชีติดเพดานในรอบนี้ — หยุดอัปโหลด', 'err'); break; }
      if (items.includes(list[i]) && list[i].state !== 'ok' && (await uploadOne(list[i]))) ok++;
      bulk.done = i + 1;
      if (i < list.length - 1 && !bulk.stop && +st.gap) {
        bulk.nextAt = Date.now() + +st.gap * 60000;
        while (Date.now() < bulk.nextAt && !bulk.stop) { render(); await wait(Math.min(5000, bulk.nextAt - Date.now())); }
        bulk.nextAt = 0;
      }
    }
  } finally {
    const stopped = bulk.stop;
    Object.assign(bulk, { on: false, stop: false, nextAt: 0 });
    render();
    msg(`${stopped ? 'หยุดแล้ว · ' : ''}อัปโหลดทั้งหมด: สำเร็จ ${ok}/${bulk.total} คลิป`, ok ? 'ok' : 'err');
  }
}

// ---------- หน้าจอ ----------
function renderSettings() {
  const chips = (box, opts, key) => $(box).replaceChildren(...opts.map(([v, t]) => {
    const b = el('button', st[key] === v ? 'on' : '', t);
    b.onclick = () => { st[key] = v; saveSt(); render(); };
    return b;
  }));
  chips('mode', MODES, 'mode');
  chips('gap', GAPS, 'gap');
  $('aigc').checked = st.aigc !== false;
  $('modeHint').textContent = st.mode === 'direct'
    ? 'โพสต์ตรง: ขึ้นช่องเลย แต่แอปต้องผ่านการตรวจของ TikTok ก่อน ไม่งั้นขึ้นเป็นส่วนตัว · ต้องเพิ่มบัญชีใหม่หลังเปลี่ยนเป็นโพสต์ตรง (ขอสิทธิ์ video.publish) · ใช้แคปชันในรายการ'
    : 'กล่องร่าง: คลิปเข้ากล่องร่างในแอป TikTok แล้วกดโพสต์เอง (ใส่เสียงเทรนด์ได้) · ไม่ต้องรอ TikTok ตรวจแอป · กล่องร่างไม่รับแคปชัน → กด 📋 แคปชัน แล้ววางในแอป · ค้างได้ไม่เกิน 5 คลิปใน 24 ชม. ต่อบัญชี';
  document.documentElement.dataset.theme = st.theme === 'light' ? 'light' : 'dark';
  $('theme').textContent = st.theme === 'light' ? '🌙' : '☀️';
}
function renderAccounts() {
  const accs = acc.accounts, next = nextAccount();
  $('accState').textContent = accs.length ? `เชื่อม ${accs.length} บัญชี · ใช้ ${accountsOn().length}${next ? ` · คลิปถัดไปไป “${accName(next)}”` : ''}` : acc.hasApp ? 'ยังไม่มีบัญชี — กด ➕ เพิ่มบัญชี' : 'ยังไม่ได้ตั้งค่าแอป — ดู 🔑 ด้านล่าง';
  $('accounts').replaceChildren(...(accs.length ? accs.map((a) => {
    const row = el('div', 'acc');
    const b = el('button', `name${a.on ? ' on' : ''}`, `${a.on && next && a.openId === next.openId ? '👉 ' : ''}${accName(a)} · ${a.on ? 'เปิดใช้' : 'ปิดใช้'}`);
    b.setAttribute('aria-pressed', String(a.on));
    b.title = a.on ? 'กดเพื่อไม่ใช้บัญชีนี้' : 'กดเพื่อใช้บัญชีนี้';
    b.onclick = async () => { acc = await ttAccount({ openId: a.openId, on: !a.on }); render(); };
    const note = a.expired ? 'token หมดอายุ — กด ➕ เพิ่มบัญชี แล้วล็อกอินบัญชีนี้ใหม่' : paused.has(a.openId) ? 'พักในรอบนี้ (ติดเพดาน)'
      : st.mode === 'direct' && !/video\.publish/.test(a.scope) ? 'โพสต์ตรง: กด ➕ เพิ่มบัญชี แล้วล็อกอินบัญชีนี้ใหม่' : '';
    const x = el('button', 'icon', '🗑');
    x.title = 'เอาบัญชีนี้ออก';
    x.onclick = async () => { if (!confirm(`เอาบัญชี “${accName(a)}” ออก?`)) return; acc = await ttAccount({ openId: a.openId, remove: true }); render(); };
    row.append(b, el('span', 'note', note), x);
    return row;
  }) : [el('div', 'empty', acc.hasApp ? 'ยังไม่มีบัญชี — กด ➕ เพิ่มบัญชี TikTok' : 'ตั้งค่าแอปใน 🔑 ด้านล่างก่อน แล้วกด ➕ เพิ่มบัญชี')]));
  $('add').disabled = !acc.hasApp;
  $('redirect').textContent = acc.redirect || '-';
  $('key').placeholder = acc.hasApp ? 'Client Key (บันทึกไว้แล้ว — ว่างไว้ = ใช้ค่าเดิม)' : 'Client Key';
  $('secret').placeholder = acc.hasApp ? 'Client Secret (บันทึกไว้แล้ว — ว่างไว้ = ใช้ค่าเดิม)' : 'Client Secret';
  if (!acc.hasApp) $('setup').open = true;
  const filter = $('uploadFilter'), selected = filter.value;
  const options = [['', 'ทุกบัญชี'], ...accs.map(a => [a.openId, accName(a)])];
  if (filter.dataset.sig !== JSON.stringify(options)) {
    filter.replaceChildren(...options.map(([v,t])=>{ const o=el('option','',t); o.value=v; return o; })); filter.value=selected; filter.dataset.sig=JSON.stringify(options);
  }
  document.dispatchEvent(new Event('tthAccountsChanged'));
}
// แถวคลิป: สร้างครั้งเดียวแล้วอัปเดตเฉพาะส่วน (พิมพ์แก้แคปชันระหว่างอัปโหลดตัวอื่นได้ ไม่หลุด)
function rowFor(it) {
  if (it.dom) return it.dom;
  const row = el('div', 'item');
  const head = el('div'), nm = el('div', 'nm', it.file.name), meta = el('div', 'meta');
  head.append(nm, meta);
  const acts = el('div', 'acts');
  const up = el('button', 'btn dark'), cp = el('button', 'pill', '📋 แคปชัน'), rm = el('button', 'icon', '🗑');
  cp.title = 'คัดลอกแคปชัน + แฮชแท็ก (กล่องร่างไม่รับแคปชัน → วางในแอปเอง)';
  cp.onclick = () => navigator.clipboard.writeText(it.caption).then(() => msg('คัดลอกแคปชันแล้ว ✓ วางในแอป TikTok ได้เลย', 'ok'), () => msg('คัดลอกไม่ได้', 'err'));
  rm.title = 'เอาออกจากรายการ';
  rm.onclick = () => { if (it.state === 'busy') return; items = items.filter((x) => x !== it); render(); };
  up.onclick = () => uploadOne(it);
  acts.append(up, cp, rm);
  const sel = el('select');
  sel.title = 'บัญชีที่คลิปนี้จะไป';
  sel.onchange = () => { it.openId = sel.value; it.accountLocked = !!sel.value; document.dispatchEvent(new CustomEvent('tthItemAssigned', {detail:{id:it.id,openId:it.openId}})); render(); };
  const ta = el('textarea');
  ta.rows = 3; ta.placeholder = 'แคปชัน + แฮชแท็ก (โพสต์ตรงใช้แคปชันนี้ · กล่องร่างกด 📋 แล้ววางในแอป)'; ta.value = it.caption;
  ta.oninput = () => { it.caption = ta.value; };
  const note = el('div', 'note');
  row.append(head, acts, sel, ta, note);
  it.dom = { row, meta, up, sel, note, ta };
  return it.dom;
}
function renderItems() {
  const box = $('list');
  const rows = items.filter(it=>!$('uploadFilter').value || it.openId===$('uploadFilter').value).map((it) => {
    const d = rowFor(it), before = doneBefore(it);
    d.row.className = `item ${it.state}`;
    d.meta.replaceChildren(el('span', '', mb(it.file.size)), el('span', '', it.generated ? '🎬 Meta AI · แคปชันที่คุณใส่' : it.fromTxt ? '📝 แคปชันจาก .txt' : '📝 แคปชัน = ชื่อไฟล์'),
      ...(before.length ? [el('span', 'done', `✓ เคยอัป ${before.length} ครั้ง (ล่าสุด “${before[before.length - 1].account || 'บัญชี'}” ${when(before[before.length - 1].at)})`)] : []));
    d.up.textContent = it.state === 'busy' ? 'กำลังอัป...' : it.state === 'ok' || before.length ? '⬆ อัปอีกครั้ง' : '⬆ อัปโหลด';
    d.up.className = it.state === 'ok' || before.length ? 'btn' : 'btn dark';
    d.up.disabled = it.state === 'busy' || !accountsOn().length;
    const opts = [['', '— แบ่งไปบัญชีถัดไป —'], ...accountsOn().map((a) => [a.openId, `→ ${accName(a)}${paused.has(a.openId) ? ' (พัก)' : ''}`])];
    if (it.openId && !accountsOn().some(a=>a.openId===it.openId)) opts.push([it.openId, 'บัญชีที่เลือกไม่พร้อมใช้งาน']);
    if (d.sel.dataset.sig !== JSON.stringify(opts)) { d.sel.replaceChildren(...opts.map(([v, t]) => { const o = el('option', '', t); o.value = v; return o; })); d.sel.dataset.sig = JSON.stringify(opts); }
    d.sel.value = it.openId || '';
    d.sel.disabled = it.state === 'busy';
    d.note.textContent = it.note;
    return d.row;
  });
  if (rows.length !== box.children.length || rows.some((r, i) => box.children[i] !== r)) box.replaceChildren(...(rows.length ? rows : [el('div', 'empty', 'ยังไม่มีคลิป — ลากไฟล์มาวาง หรือกดเลือกไฟล์/โฟลเดอร์')]));
  const wait = items.filter((x) => x.state !== 'ok' && x.state !== 'busy' && !doneBefore(x).length).length;
  $('qState').textContent = items.length ? `${items.length} คลิป · รออัป ${wait} · เสร็จ ${items.filter((x) => x.state === 'ok').length}` : '';
  $('navUploads').textContent=wait;
  const mins = bulk.nextAt ? Math.max(1, Math.ceil((bulk.nextAt - Date.now()) / 60000)) : 0;
  $('all').textContent = bulk.on ? (bulk.stop ? 'กำลังหยุด...' : `⏹ หยุด · อัปแล้ว ${bulk.done}/${bulk.total}${mins ? ` · คลิปถัดไปอีก ${mins} นาที` : ''}`) : `▶ อัปโหลดทั้งหมด (${wait} คลิป)`;
  $('all').className = bulk.on ? 'btn danger' : 'btn dark';
  $('all').disabled = !bulk.on && (!wait || !accountsOn().length);
  $('clearDone').disabled = !items.some((x) => x.state === 'ok');
}
function renderHistory() {
  const h = uploads.slice(-30).reverse();
  $('hState').textContent = uploads.length ? `${uploads.length} ครั้ง (โชว์ล่าสุด 30)` : '';
  $('uploads').replaceChildren(...(h.length ? h.map((x) => {
    const r = el('div', 'hist');
    r.append(el('span', 'when', when(x.at)), el('span', '', x.name), el('span', '', `→ ${x.account || 'บัญชี'}`), el('span', '', x.mode === 'direct' ? 'โพสต์ตรง' : 'กล่องร่าง'));
    return r;
  }) : [el('div', 'empty', 'ยังไม่มี')]));
}
function render() { renderSettings(); renderAccounts(); renderItems(); renderHistory(); }

// ---------- ปุ่ม ----------
$('theme').onclick = () => { st.theme = st.theme === 'light' ? 'dark' : 'light'; saveSt(); render(); };
$('aigc').onchange = () => { st.aigc = $('aigc').checked; saveSt(); };
$('add').onclick = async () => {
  $('add').disabled = true; msg('หน้าต่าง TikTok เด้งขึ้น — ล็อกอินบัญชีที่จะเพิ่ม แล้วกดอนุญาต', '');
  try { acc = await ttLogin({ direct: st.mode === 'direct' }); msg('เพิ่ม/ต่ออายุบัญชี TikTok แล้ว ✓', 'ok'); } catch (e) { msg(`เพิ่มบัญชีไม่ได้: ${e.message || e}`, 'err'); }
  render();
};
$('saveApp').onclick = async () => { acc = await ttSetup({ clientKey: $('key').value, clientSecret: $('secret').value }); $('key').value = ''; $('secret').value = ''; msg(acc.hasApp ? 'บันทึกข้อมูลแอปแล้ว ✓ ต่อไปกด ➕ เพิ่มบัญชี TikTok' : 'ใส่ Client Key + Client Secret ให้ครบ', acc.hasApp ? 'ok' : 'err'); render(); };
$('copyRedirect').onclick = () => navigator.clipboard.writeText(acc.redirect).then(() => msg('คัดลอก Redirect URI แล้ว ✓', 'ok'));
$('pick').onclick = () => $('files').click();
$('pickDir').onclick = () => $('dir').click();
for (const id of ['files', 'dir']) $(id).onchange = async (e) => { await addFiles(e.target.files); e.target.value = ''; };
$('all').onclick = () => uploadAll();
$('clearDone').onclick = () => { items = items.filter((x) => x.state !== 'ok'); render(); };
const drop = $('drop');
drop.ondragover = (e) => { e.preventDefault(); drop.classList.add('over'); };
drop.ondragleave = () => drop.classList.remove('over');
drop.ondrop = (e) => { e.preventDefault(); drop.classList.remove('over'); addFiles(e.dataTransfer.files); };
window.addEventListener('beforeunload', (e) => { if (items.some((x) => x.state === 'busy') || bulk.on) { e.preventDefault(); e.returnValue = ''; } }); // กำลังอัป → เตือนก่อนปิดแท็บ

const appReady = (async () => {
  const o = await store.get(['tthSettings', 'tthHistory']);
  st = { ...st, ...(o.tthSettings || {}) };
  uploads = Array.isArray(o.tthHistory) ? o.tthHistory : [];
  acc = await ttStatus();
  render();
})();
