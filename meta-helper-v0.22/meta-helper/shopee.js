// ฝั่ง Shopee: ปุ่ม "＋ คิวคลิป" บนหน้า Shopee Affiliate (ข้อเสนอผลิตภัณฑ์) และหน้าสินค้า Shopee
// เก็บชื่อ/รูป/ค่าคอม/ลิงก์ affiliate ลงคิว แล้วไปทำคลิปต่อในแผงบน meta.ai
(() => {
  if (window.__mahShopee) return;
  window.__mahShopee = true;

  const LINK_RE = /https:\/\/s\.shopee\.co\.th\/[A-Za-z0-9]+/;
  const GET_LINK_RE = /^(เอา\s*ลิงก์|รับลิงก์|get link)$/i;

  // ถ้ารีโหลด extension แล้วไม่รีเฟรชหน้า chrome.* จะใช้ไม่ได้ (Extension context invalidated)
  const alive = () => { try { return !!chrome.runtime.id; } catch (e) { return false; } };
  const store = {
    get: (k) => new Promise((r, j) => { try { chrome.storage.local.get(k, (v) => r(v || {})); } catch (e) { j(e); } }),
    set: (o) => new Promise((r, j) => { try { chrome.storage.local.set(o, r); } catch (e) { j(e); } }),
  };
  // แก้คิวทีละงาน กันกดหลายอันพร้อมกันแล้วเขียนทับกัน
  let chain = Promise.resolve();
  const mutate = (fn) => (chain = chain.then(async () => {
    const { mah3Products = [] } = await store.get('mah3Products');
    const out = fn(mah3Products);
    await store.set({ mah3Products });
    return out;
  }));
  const withTimeout = (p, ms) => Promise.race([p, new Promise((r) => setTimeout(() => r(null), ms))]);
  const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  function toast(text, ok = true) {
    let box = document.getElementById('mah-toasts');
    if (!box) {
      box = document.createElement('div');
      box.id = 'mah-toasts';
      Object.assign(box.style, { position: 'fixed', left: '50%', bottom: '32px', transform: 'translateX(-50%)', zIndex: 2147483647,
        display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center', pointerEvents: 'none' });
      document.body.appendChild(box);
    }
    const t = document.createElement('div');
    t.textContent = text;
    Object.assign(t.style, { background: ok ? '#111' : '#c62828', color: '#fff', padding: '10px 18px', borderRadius: '10px',
      font: '14px system-ui, sans-serif', boxShadow: '0 6px 20px rgba(0,0,0,.25)', maxWidth: '80vw' });
    box.appendChild(t);
    setTimeout(() => t.remove(), 3000);
  }

  const fullImage = (u) => (u || '').replace(/_tn(\.\w+)?$/, '').split('@')[0];

  let lastImageError = '';
  function fetchImage(url) {
    return new Promise((resolve) => {
      try {
        const t = setTimeout(() => { lastImageError = 'หมดเวลา'; resolve(null); }, 15000);
        chrome.runtime.sendMessage({ type: 'fetchImage', url }, (r) => {
          clearTimeout(t);
          if (chrome.runtime.lastError || !r || !r.ok) {
            lastImageError = (chrome.runtime.lastError && chrome.runtime.lastError.message) || (r && r.error) || 'ไม่ทราบสาเหตุ';
            resolve(null);
          } else resolve(r.dataUrl);
        });
      } catch (e) { lastImageError = String(e); resolve(null); }
    });
  }

  // สำรอง: โหลดรูปจากหน้าเว็บเอง (ใช้ได้ถ้าเซิร์ฟเวอร์รูปอนุญาต CORS)
  async function fetchImageInPage(url) {
    try {
      const res = await fetch(url, { credentials: 'omit', signal: AbortSignal.timeout(10000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const bmp = await createImageBitmap(await res.blob());
      const k = Math.min(1, 1536 / Math.max(bmp.width, bmp.height));
      const c = document.createElement('canvas');
      c.width = Math.round(bmp.width * k);
      c.height = Math.round(bmp.height * k);
      c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
      return c.toDataURL('image/jpeg', 0.9);
    } catch (e) {
      lastImageError += ` / ${e}`;
      return null;
    }
  }

  const key = (s) => (s || '').replace(/\s+/g, ' ').trim().toLowerCase();
  // บันทึกชื่อ/ลิงก์ลงคิวทันที แล้วค่อยโหลดรูปพร้อมกัน (รูปละไม่เกิน ~15 วิ)
  async function addToQueue(item) {
    const { existed, id } = await mutate((list) => {
      let p = list.find((x) => key(x.name) === key(item.name));
      const existed = !!p;
      if (!p) {
        p = { id: newId(), name: item.name, on: false, done: false, images: [], link: '', productUrl: '', commission: '', price: '' };
        list.push(p);
      }
      p.link = item.link || p.link || '';
      p.productUrl = item.productUrl || p.productUrl || '';
      p.commission = item.commission || p.commission || '';
      p.price = item.price || p.price || '';
      p.desc = item.desc || p.desc || '';
      return { existed, id: p.id };
    });
    const { mah3Products: now = [] } = await store.get('mah3Products');
    const cur = now.find((x) => x.id === id) || { images: [], imageUrls: [] };
    const want = (item.imageUrls || []).filter((u) => !(cur.imageUrls || []).includes(u.slice(0, 300))).slice(0, Math.max(0, 4 - cur.images.length));
    const got = await Promise.all(want.map((u) => withTimeout(
      (/^(data|blob):/.test(u) ? fetchImageInPage(u) : fetchImage(fullImage(u)).then((d) => d || fetchImageInPage(fullImage(u)))), 25000)
      .then((d) => d && { u: u.slice(0, 300), d })));
    return mutate((list) => {
      const p = list.find((x) => x.id === id);
      if (!p) return { existed, product: { images: [] } };
      for (const g of got) {
        if (!g || p.images.length >= 4 || (p.imageUrls || []).includes(g.u)) continue;
        p.images.push({ name: `product-${p.images.length + 1}.jpg`, type: 'image/jpeg', dataUrl: g.d });
        p.imageUrls = [...(p.imageUrls || []), g.u];
      }
      return { existed, product: p };
    });
  }

  function setLinkFor(name, link) {
    return mutate((list) => {
      const p = list.find((x) => key(x.name) === key(name));
      if (!p || p.link === link) return false;
      p.link = link;
      return true;
    });
  }

  // ---------- หน้า Shopee Affiliate: การ์ดสินค้าในตาราง ----------
  // รูปที่ "ใหญ่พอเป็นรูปสินค้า" (ไม่ใช่ไอคอน/ป้าย Mall)
  const bigEnough = (x) => { const w = x.getBoundingClientRect().width; return w ? w >= 80 : (x.naturalWidth || 0) >= 150; };
  function bgUrl(x) {
    const m = (x.style.backgroundImage || getComputedStyle(x).backgroundImage || '').match(/url\(["']?([^"')]+)/);
    return m ? m[1] : '';
  }
  const hasBigImage = (el) => [...el.querySelectorAll('img')].some(bigEnough)
    || [...el.querySelectorAll('div, span, a, picture')].some((x) => x.getBoundingClientRect().width >= 80 && bgUrl(x));
  // นับปุ่ม "เอา ลิงก์" ในกล่อง (ปุ่มซ้อน <button><span>เอา ลิงก์</span></button> นับเป็น 1)
  function linkBtnCount(el) {
    const m = [...el.querySelectorAll('button, a, div[role=button], span')].filter((b) => GET_LINK_RE.test((b.innerText || '').trim()));
    return m.filter((b) => !m.some((o) => o !== b && o.contains(b))).length;
  }
  // ไล่ขึ้นจากปุ่มจนเจอกล่องที่มีทั้งราคา (฿) และรูปสินค้าใหญ่ แต่ไม่กินการ์ดอื่น
  function cardOf(btn) {
    let el = btn.parentElement, fallback = null;
    for (let i = 0; i < 12 && el && el !== document.body; i++, el = el.parentElement) {
      if (linkBtnCount(el) > 1) break; // เกินการ์ดเดียวแล้ว
      if (!/฿/.test(el.innerText || '')) continue;
      if (hasBigImage(el)) return el;
      if (!fallback && el.querySelector('img')) fallback = el;
    }
    return fallback;
  }

  // บรรทัดที่ไม่ใช่ชื่อสินค้า (ราคา ยอดขาย ค่าคอม ป้าย ปุ่ม)
  const NOT_NAME = /^(฿|อัตราค่าคอม|ค่าคอม|คอมมิชชั่น|ขายได้|ขายแล้ว|E?XTRA\s*COMM|COMMISSIONS?\s*E?XTRA|Mall|Preferred|เอา\s*ลิงก์|รับลิงก์|get link|＋ คิวคลิป|✓ ในคิว|กำลังเพิ่ม)/i;

  // ทำ URL ให้เต็ม: //x → https://x, http → https, รับ data:/blob: ที่เป็นรูปจริง
  function normUrl(u) {
    if (!u) return '';
    if (/^data:image\//.test(u)) return u.length > 2000 ? u : ''; // ข้ามรูปหลอก 1x1
    if (/^blob:/.test(u)) return u;
    try { const x = new URL(u, location.href); if (x.protocol === 'http:') x.protocol = 'https:'; return x.protocol === 'https:' ? x.href : ''; } catch (e) { return ''; }
  }
  function imgUrl(i) {
    const fromSet = (i.getAttribute('srcset') || i.getAttribute('data-srcset') || '').split(',').pop().trim().split(' ')[0];
    const pic = i.closest('picture');
    const fromSource = pic ? ((pic.querySelector('source[srcset]') || { getAttribute: () => '' }).getAttribute('srcset') || '').split(',').pop().trim().split(' ')[0] : '';
    // รูปแบบ lazy-load: src เป็นรูปหลอก (data:) ส่วนรูปจริงอยู่ใน data-src / srcset
    const all = [i.currentSrc, i.getAttribute('data-src'), i.getAttribute('data-original'), i.getAttribute('data-lazy'), fromSet, fromSource, i.src].map(normUrl).filter(Boolean);
    return all.find((u) => /^https:/.test(u)) || all[0] || '';
  }

  function readCard(card) {
    const text = card.innerText || '';
    // 1) ชื่อเต็มมักอยู่ใน title/alt (ข้อความบนการ์ดถูกตัดด้วย …)
    const attrNames = [...card.querySelectorAll('[title], img[alt]')]
      .map((x) => (x.getAttribute('title') || x.getAttribute('alt') || '').trim())
      .filter((t) => t.length > 6 && !NOT_NAME.test(t));
    // 2) บรรทัดข้อความที่ยาวที่สุดที่ไม่ใช่ราคา/ค่าคอม/ปุ่ม
    const lines = text.split('\n').map((x) => x.trim()).filter((l) => l.length > 3 && !NOT_NAME.test(l) && !/^\d+([.,]\d+)?%$/.test(l));
    const name = [...attrNames, ...lines].sort((a, b) => b.length - a.length)[0] || '';
    // รูป: รูปใหญ่ในการ์ด (โดเมนรูปของ Shopee หรือรูปที่แสดงกว้าง ≥ 100px)
    const imgs = [...card.querySelectorAll('img')]
      .filter(bigEnough)
      .sort((a, b) => b.getBoundingClientRect().width - a.getBoundingClientRect().width)
      .map(imgUrl)
      .filter((u) => u && !/icon|logo|badge|sprite/i.test(u.slice(0, 300)));
    const bg = [...card.querySelectorAll('div, span, a, picture')]
      .filter((x) => x.getBoundingClientRect().width >= 80)
      .map((x) => normUrl(bgUrl(x))).filter((u) => u && !/icon|logo|badge|sprite/i.test(u.slice(0, 300)));
    const commission = (text.match(/ค่าคอม(?!\S*พิเศษ)\S*\s*(?:สูงสุด\s*)?([\d.]+\s*%)/) || [])[1] || ''; // ไม่เอา "ค่าคอมพิเศษ" มาเป็นค่าคอมปกติ
    const price = (text.match(/฿\s*[\d,.]+/) || [])[0] || '';
    const a = card.querySelector('a[href*="shopee.co.th"], a[href*="-i."]');
    return { imgCount: card.querySelectorAll('img').length, name: name.replace(/\s*…$/, ''), imageUrls: [...new Set([...imgs, ...bg])].slice(0, 2), commission, price, productUrl: a ? a.href : '' };
  }

  let lastLinkCard = null; // ชื่อสินค้าของการ์ดที่เพิ่งกด "เอา ลิงก์"
  let linkBefore = new Set(); // ลิงก์ที่อยู่บนหน้าอยู่แล้วก่อนกด (ป๊อปอัปของตัวก่อนค้างอยู่) — ไม่เอามาเป็นลิงก์ของตัวนี้

  function decorateAffiliate() {
    for (const btn of document.querySelectorAll('button, a, div[role=button], span')) {
      if (btn.dataset.mahDone || !GET_LINK_RE.test((btn.innerText || '').trim()) || btn.children.length > 2) continue;
      const card = cardOf(btn);
      if (!card || card.querySelector('.mah-queue-btn')) continue;
      btn.dataset.mahDone = '1';
      btn.addEventListener('click', () => { lastLinkCard = readCard(card).name; linkBefore = new Set(linksNow()); }, true);
      const q = document.createElement('button');
      q.className = 'mah-queue-btn';
      q.type = 'button';
      q.textContent = '＋ คิวคลิป';
      Object.assign(q.style, {
        marginRight: '6px', padding: '3px 10px', border: '1px solid #111', borderRadius: '4px', background: '#111',
        color: '#fff', font: '12px system-ui, sans-serif', cursor: 'pointer', lineHeight: '18px',
      });
      q.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const item = readCard((btn.isConnected && cardOf(btn)) || cardOf(q) || card); // อ่านการ์ดใหม่ตอนกด (หน้าเว็บอาจวาดการ์ดใหม่แล้ว)
        if (!item.name) { toast('อ่านชื่อสินค้าไม่ได้ - เพิ่มเข้าคิวแบบไม่มีชื่อ แก้ชื่อเองใน meta.ai', false); item.name = `สินค้า ${new Date().toLocaleTimeString('th-TH')}`; }
        if (!alive()) { toast('extension ถูกอัปเดต - กด F5 รีเฟรชหน้านี้ก่อน แล้วกดใหม่', false); return; }
        q.disabled = true;
        q.textContent = 'กำลังเพิ่ม...';
        lastLinkCard = item.name;
        linkBefore = new Set(linksNow());
        fetchDescLater(item.name, item.productUrl);
        btn.click(); // เปิดหน้าต่าง "เอา ลิงก์" เพื่อเก็บลิงก์ affiliate (ระหว่างรอรูป)
        let r;
        try { r = await addToQueue(item); } catch (err) {
          q.disabled = false;
          q.textContent = '＋ คิวคลิป';
          toast(/invalidated/i.test(String(err)) ? 'extension ถูกอัปเดต - กด F5 รีเฟรชหน้านี้ก่อน แล้วกดใหม่' : `เพิ่มไม่สำเร็จ: ${err.message || err}`, false);
          return;
        }
        q.disabled = false;
        q.textContent = '✓ ในคิว';
        q.style.background = '#0a7d3c';
        q.style.borderColor = '#0a7d3c';
        toast(`${r.existed ? 'อัปเดต' : 'เพิ่มเข้าคิว'}: ${item.name.slice(0, 40)} · รูป ${r.product.images.length}`);
        if (!r.product.images.length) {
          toast(item.imageUrls.length ? `โหลดรูปไม่ได้ (${lastImageError}) - เพิ่มรูปเองใน meta.ai ได้` : `ไม่เจอรูปในการ์ดนี้ (รูปในการ์ด ${item.imgCount}) - เพิ่มรูปเองใน meta.ai ได้`, false);
        }
      });
      btn.parentElement.insertBefore(q, btn);
    }
  }

  // ดักลิงก์ affiliate ที่ Shopee สร้างให้ (ในหน้าต่างป๊อปอัป)
  async function captureLink() {
    if (!lastLinkCard) return;
    const link = linksNow().find((l) => !linkBefore.has(l)); // เฉพาะลิงก์ที่เพิ่งขึ้นหลังกด
    if (!link) return;
    const name = lastLinkCard;
    lastLinkCard = null;
    if (await setLinkFor(name, link)) toast(`เก็บลิงก์แล้ว ✓ ${link}`);
  }

  // ---------- หน้าสินค้า Shopee ปกติ ----------
  // รายละเอียดสินค้า (ให้ Gemini เขียนบทตรงขึ้น) — ตัดให้สั้น
  const cleanDesc = (t) => String(t || '').replace(/\s+/g, ' ').trim().slice(0, 600);
  // หน้า Affiliate ไม่มีรายละเอียด → ลองอ่านจากหน้าสินค้าเบื้องหลัง (ไม่ได้ก็ไม่เป็นไร)
  function fetchDescLater(name, url) {
    if (!url || !alive()) return;
    try {
      chrome.runtime.sendMessage({ type: 'productDesc', url }, (r) => {
        if (chrome.runtime.lastError || !r || !r.ok || !r.desc) return;
        mutate((list) => {
          const p = list.find((x) => key(x.name) === key(name));
          if (p && !p.desc) p.desc = cleanDesc(r.desc);
        }).catch(() => {});
      });
    } catch (e) {}
  }

  function readProductPage() {
    let p = {};
    for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
      try { [].concat(JSON.parse(s.textContent)).forEach((x) => { if (x && x['@type'] === 'Product') p = x; }); } catch (e) {}
    }
    const meta = (n) => (document.querySelector(`meta[property="${n}"]`) || {}).content || '';
    let imgs = [].concat(p.image || []);
    document.querySelectorAll('img').forEach((i) => {
      const s = i.currentSrc || i.src || '';
      const r = i.getBoundingClientRect();
      const skip = i.closest('header, nav, [class*="avatar" i], [class*="shop" i]');
      if (/susercontent\.com\/file\//.test(s) && r.width >= 250 && !skip) imgs.push(s);
    });
    if (!imgs.length && meta('og:image')) imgs.push(meta('og:image'));
    imgs = [...new Set(imgs.map(fullImage))].slice(0, 4);
    const name = (p.name || meta('og:title') || document.title).replace(/\s*\|\s*Shopee Thailand\s*$/, '').trim();
    const named = (n) => (document.querySelector(`meta[name="${n}"]`) || {}).content || '';
    const desc = cleanDesc(p.description || meta('og:description') || named('description'));
    return { name, desc, imageUrls: imgs, productUrl: location.href.split('?')[0] };
  }

  function productPageButton() {
    if (!/-i\.\d+\.\d+|\/product\/\d+\/\d+/.test(location.href) || document.getElementById('mah-shopee-fab')) return;
    const b = document.createElement('button');
    b.id = 'mah-shopee-fab';
    b.textContent = '＋ ส่งเข้าคิวทำคลิป';
    Object.assign(b.style, {
      position: 'fixed', right: '20px', bottom: '96px', zIndex: 2147483646, padding: '12px 18px', borderRadius: '24px',
      border: '1px solid #e5e5e5', background: '#fff', color: '#111', font: '600 14px system-ui, sans-serif',
      boxShadow: '0 6px 20px rgba(0,0,0,.18)', cursor: 'pointer',
    });
    b.onclick = async () => {
      const item = readProductPage();
      if (!item.name) { toast('อ่านข้อมูลสินค้าไม่ได้', false); return; }
      if (!alive()) { toast('extension ถูกอัปเดต - กด F5 รีเฟรชหน้านี้ก่อน แล้วกดใหม่', false); return; }
      b.disabled = true;
      b.textContent = 'กำลังเพิ่ม...';
      let r;
      try { r = await addToQueue(item); } catch (err) {
        b.disabled = false;
        b.textContent = '＋ ส่งเข้าคิวทำคลิป';
        toast(`เพิ่มไม่สำเร็จ: ${err.message || err}`, false);
        return;
      }
      b.disabled = false;
      b.textContent = '✓ อยู่ในคิวแล้ว';
      toast(`${r.existed ? 'อัปเดต' : 'เพิ่มเข้าคิว'}: ${item.name.slice(0, 40)} · รูป ${r.product.images.length}`);
    };
    document.body.appendChild(b);
  }

  // ---------- ค้นหาให้แผงบน meta.ai (แท็บ Affiliate เบื้องหลัง · ไม่ต้องใช้ Open API) ----------
  // background เปิดหน้าข้อเสนอผลิตภัณฑ์ไว้ แล้วสั่งผ่านข้อความ: affSearch (พิมพ์คำค้น → อ่านการ์ด) · affLink (กด "เอา ลิงก์" → ส่งลิงก์กลับ)
  const onAffiliate = () => location.hostname.startsWith('affiliate.') && !/login/i.test(location.pathname);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const shownEl = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const labelOf = (e) => `${e.getAttribute('placeholder') || ''} ${e.getAttribute('aria-label') || ''} ${e.innerText || ''}`.trim();
  function searchInput() {
    return [...document.querySelectorAll('input')].filter((i) => !/hidden|checkbox|radio|file/.test(i.type) && shownEl(i))
      .find((i) => /ค้นหา|search|ชื่อสินค้า/i.test(labelOf(i))) || null;
  }
  function pageCards() { // การ์ดสินค้าทุกใบที่มีปุ่ม "เอา ลิงก์"
    const seen = new Set(), out = [];
    for (const b of document.querySelectorAll('button, a, div[role=button], span')) {
      if (!GET_LINK_RE.test((b.innerText || '').trim()) || b.children.length > 2) continue;
      const card = cardOf(b);
      if (card && !seen.has(card)) { seen.add(card); out.push({ card, btn: b }); }
    }
    return out;
  }
  const cardSig = () => pageCards().slice(0, 4).map((x) => readCard(x.card).name).join('|');
  // same = ค้นคำเดิมที่หน้าแรกอยู่แล้ว (ผลเหมือนเดิมได้) → นิ่ง 3 วิก็นับว่าเสร็จ (เดิมรอให้ "เปลี่ยน" จนหมดเวลา 15 วิ ทุกครั้งที่กด 📈 / ค้นซ้ำ)
  async function waitResults(before, ms, same = false) { // รอผลค้นหาเปลี่ยนแล้วนิ่ง · ไม่มีการ์ดเลยนิ่ง 3 วิ = ไม่เจอ
    const t0 = Date.now(), end = t0 + ms;
    let prev = null, stable = 0;
    while (Date.now() < end) {
      await sleep(500);
      const s = cardSig();
      if (s === prev && (s !== before || !s || (same && Date.now() - t0 > 3000))) { if (++stable >= (s ? 2 : 6)) return true; } else stable = 0;
      prev = s;
    }
    return false;
  }
  // ป้ายคอมพิเศษจากร้าน: "XTRA COMM" / "Commissions XTRA" / "คอมมิชชั่นพิเศษ" / "ค่าคอมพิเศษ" / ป้าย "XTRA" เดี่ยวๆ (ข้อความหรือรูป)
  // ไม่ดูในชื่อสินค้า (กัน "Extra Virgin", "Extra Large") · ไม่นับ "ส่งฟรี Xtra" / "Coins Cashback Xtra"
  const XTRA_TAG = String.raw`(?:e?xtra\s*comm\w*|comm\w*\s*e?xtra|คอม(?:มิชชั่น|มิชชัน)?\s*(?:พิเศษ|e?xtra))`;
  const XTRA_RE = new RegExp(String.raw`${XTRA_TAG}|^\s*\+?\s*e?xtra\s*(?:\+?\s*\d+(?:\.\d+)?\s*%)?\s*$`, 'im');
  const XTRA_PCT_RE = new RegExp(String.raw`(?:${XTRA_TAG}|^\s*\+?\s*e?xtra)\s*[:+]?\s*(?:สูงสุด|up\s*to)?\s*\+?\s*(\d+(?:\.\d+)?)\s*%`, 'im');
  const NOT_XTRA_LINE = /ส่งฟรี|free\s*ship|coin|เหรียญ|cashback|แคชแบ็ก/i;
  const NOT_TAG = /^(฿|เอา\s*ลิงก์|รับลิงก์|get link|＋ คิวคลิป|✓ ในคิว|กำลังเพิ่ม|ขาย(?:ได้|แล้ว))/i;
  function readResult({ card }) {
    const c = readCard(card), text = card.innerText || '';
    const cut = (l) => l.replace(/\s*(…|\.\.\.)$/, '');
    // บรรทัดอื่นที่ไม่ใช่ชื่อสินค้า (ชื่อบนการ์ดมักถูกตัดด้วย …)
    const rest = text.split('\n').map((l) => l.trim()).filter((l) => l && !(c.name && cut(l) && (c.name.startsWith(cut(l)) || cut(l).startsWith(c.name))));
    const tagText = rest.filter((l) => !NOT_XTRA_LINE.test(l)).join('\n');
    const badgeImg = [...card.querySelectorAll('img')].some((i) => {
      const alt = i.getAttribute('alt') || '';
      return /xtra/i.test(`${alt.length <= 30 ? alt : ''} ${(i.getAttribute('src') || '').slice(0, 300)}`) && !NOT_XTRA_LINE.test(alt);
    });
    const xm = tagText.match(XTRA_PCT_RE);
    return {
      name: c.name, image: fullImage(c.imageUrls[0] || ''), price: c.price, commission: c.commission, productUrl: c.productUrl,
      isExtra: XTRA_RE.test(tagText) || badgeImg, extra: xm ? `${+xm[1]}%` : '',
      sold: ((text.match(/ขาย(?:ได้|แล้ว)\s*([\d.,]+\s*(?:พัน|หมื่น|แสน|ล้าน|k)?)/i) || [])[1] || '').trim(),
      // ป้ายสั้นๆ บนการ์ด (ไว้บอกผู้ใช้เมื่อหา Extra Comm ไม่เจอ — หน้าเว็บอาจเปลี่ยนคำบนป้าย)
      tags: rest.filter((l) => l.length <= 30 && !NOT_TAG.test(l)).slice(0, 6),
    };
  }
  // อ่านการ์ดทั้งหน้า: เลื่อนทีละจอจนสุดหน้า แล้วเก็บการ์ดที่โผล่มาระหว่างทาง
  // (บางหน้าวาดการ์ดเฉพาะส่วนที่มองเห็น / รูปโหลดตอนเลื่อนถึง — เดิมอ่านแค่ที่วาดอยู่ตอนนั้น เลยได้ทีละไม่กี่ตัว)
  async function results() {
    const got = new Map(); // ชื่อ → สินค้า (ตัวที่มีรูปทับตัวที่ยังไม่มี)
    const grab = () => { for (const x of pageCards()) { const r = readResult(x); if (r.name && (!got.has(r.name) || (!got.get(r.name).image && r.image))) got.set(r.name, r); } };
    grab();
    const step = Math.max(300, Math.round(window.innerHeight * 0.8));
    for (let y = 0, k = 0; k < 40; k++) {
      y += step;
      window.scrollTo(0, y);
      await sleep(250);
      grab();
      if (y + window.innerHeight >= document.documentElement.scrollHeight - 5) break;
    }
    let scrolled = 0; // ยังไม่มีรูป (เลื่อนผ่านเร็วไป) → เลื่อนให้เห็นทีละใบ
    for (const x of pageCards()) {
      if (scrolled >= 60) break;
      const r = readResult(x);
      if (!r.name || (got.get(r.name) || {}).image) continue;
      x.card.scrollIntoView({ block: 'center' });
      scrolled++;
      await sleep(150);
      grab();
    }
    return [...got.values()];
  }
  const pageInfo = () => {
    const all = [...document.querySelectorAll('input')], shown = all.filter(shownEl);
    return `หน้า ${location.pathname} · แท็บ${document.visibilityState === 'visible' ? 'เปิดดูอยู่' : 'อยู่เบื้องหลัง'} · ช่องพิมพ์ ${shown.length}/${all.length}`
      + `${shown.length ? `: ${shown.map((i) => `“${(i.placeholder || i.type).slice(0, 25)}”`).join(', ')}` : ''} · ปุ่มเอาลิงก์ ${pageCards().length}`
      + ` · บนหน้า: “${(document.body.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 80)}”`;
  };
  // หน้า Affiliate เป็นเว็บแอป วาดเนื้อหาหลังเปิดหน้า (แท็บเบื้องหลังยิ่งช้า) → รอให้ช่องค้นหา/การ์ดขึ้นก่อน
  async function waitReady(ms) {
    const end = Date.now() + ms;
    while (Date.now() < end && !searchInput() && !pageCards().length) await sleep(500);
    return !!(searchInput() || pageCards().length);
  }

  // ปุ่มเรียงลำดับของหน้าข้อเสนอผลิตภัณฑ์ (แท็บ / ปุ่ม / <select> / dropdown "เรียงตาม") — ไม่รู้คำบนหน้าแน่ชัด → จับหลายแบบ
  // ไม่นับป้าย "ขายดี" บนการ์ดสินค้า · ไม่กดเมนูข้าง/ลิงก์ที่พาไปหน้าอื่น
  const SORT_RE = {
    sales: /^(ขายดี(?:ที่สุด)?|ยอดขาย(?:สูงสุด)?|สินค้าขายดี|top\s*sales?|best\s*sell(?:ing|ers?)|sales)$/i,
    relevance: /^(เกี่ยวข้อง|ความเกี่ยวข้อง|เกี่ยวข้องที่สุด|relevan(?:ce|t)|most\s*relevant)$/i,
  };
  const textOf = (e) => (e.textContent || '').replace(/\s+/g, ' ').trim();
  const isActive = (e) => [e, e.parentElement].some((x) => x && (/(^|[\s_-])(active|selected|current|checked)([\s_-]|$)/i.test(String(x.className))
    || ['aria-selected', 'aria-checked', 'aria-pressed', 'aria-current'].some((a) => x.getAttribute(a) === 'true')));
  const leavesPage = (a) => { // ลิงก์ที่พาไปหน้าอื่น (ไม่ใช่ # / หน้าข้อเสนอผลิตภัณฑ์เดิม)
    const h = a && a.getAttribute('href');
    if (!h || h.startsWith('#') || /^javascript:/i.test(h)) return false;
    try { return !/product_offer/.test(new URL(h, location.href).pathname); } catch (x) { return false; }
  };
  function sortControl(re) {
    const cards = pageCards().map((x) => x.card);
    const hits = [...document.querySelectorAll('button, [role=tab], [role=button], [role=option], [role=menuitem], [role=radio], li, a, label, span, div')]
      .filter((e) => { const t = textOf(e); return t.length <= 30 && re.test(t) && shownEl(e); })
      .filter((e) => !cards.some((c) => c.contains(e)) && !e.closest('nav, aside, [role=navigation], [class*="sidebar" i], #mah-shopee-fab')
        && !leavesPage(e.closest('a[href]')));
    return hits.filter((e) => !hits.some((o) => o !== e && e.contains(o)))[0] || null; // ชิ้นในสุด
  }
  async function applySort(kind) { // true = หน้าเว็บเรียงแบบนี้แล้ว · false = หาปุ่มเรียงไม่เจอ
    const re = SORT_RE[kind];
    for (const sel of document.querySelectorAll('select')) {
      const o = [...sel.options].find((x) => re.test(x.text.trim()));
      if (!o) continue;
      if (sel.value !== o.value) {
        const before = cardSig();
        Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(sel, o.value);
        sel.dispatchEvent(new Event('change', { bubbles: true }));
        await waitResults(before, 15000);
      }
      return true;
    }
    let hit = sortControl(re);
    if (!hit) { // dropdown "เรียงตาม ▾" → เปิดก่อนแล้วหาตัวเลือก
      const trig = [...document.querySelectorAll('button, [role=button], [role=combobox], div, span')]
        .find((e) => { const t = textOf(e); return t.length <= 40 && /^(เรียง(?:ตาม|ลำดับ)?|sort(?:\s*by)?)(\b|\s|:|$)/i.test(t) && shownEl(e); });
      if (trig) { trig.click(); await sleep(700); hit = sortControl(re); }
      if (!hit && trig) document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true }));
    }
    if (!hit) return false;
    if (isActive(hit)) return true;
    const before = cardSig();
    hit.click();
    await waitResults(before, 15000);
    return true;
  }
  // view.sort = แบบเรียงที่ขอไว้ล่าสุด (ขอแล้วหาปุ่มไม่เจอก็นับว่าขอแล้ว — ไม่ค้นซ้ำทุกครั้งที่โหลดเพิ่ม)
  async function syncSort(sort) {
    if (sort) { view.sort = sort; return applySort(sort); }
    if (view.sort) { view.sort = ''; await applySort('relevance'); } // เคยเรียงขายดีไว้ → กลับไปเรียงเกี่ยวข้อง
    return null;
  }

  // view = หน้าเว็บกำลังแสดงผลค้นคำไหน หน้าที่เท่าไร · want = ผลค้นหาที่แผงบน meta.ai ดูอยู่
  // (affLink อาจค้นชื่อสินค้าแทรก → ตอนโหลดเพิ่มต้องพากลับไปหน้าที่แผงดูอยู่ก่อน)
  const view = { kw: null, page: 1, sort: '' }, want = { kw: null, page: 1 };
  // หน้าถัดไป: (1) แถบเลขหน้า → กดเลขถัดจากหน้าปัจจุบัน (2) ปุ่ม "ดูเพิ่มเติม / โหลดเพิ่ม" (3) ปุ่ม ถัดไป / › (4) เลื่อนลงล่างสุด
  // ไม่ใช่ลูกศรของแบนเนอร์สไลด์ · ไม่ใช่ลิงก์ไปหน้าอื่น · nextWhy = ทำไมไปต่อไม่ได้ (บอกผู้ใช้)
  let nextWhy = '';
  async function nextStep() { // คืน true = ได้ของเพิ่ม/ไปหน้าถัดไปแล้ว
    nextWhy = '';
    const before = cardSig(), n = pageCards().length;
    const inSlider = (b) => !!b.closest('[class*="swiper" i], [class*="slick" i], [class*="carousel" i], [class*="slider" i], [class*="banner" i]');
    const cards = pageCards().map((x) => x.card);
    const usable = (b) => shownEl(b) && !b.disabled && b.getAttribute('aria-disabled') !== 'true' && !inSlider(b) && !leavesPage(b.closest('a[href]')) && !cards.some((c) => c.contains(b));
    const pool = [...document.querySelectorAll('button, li, a, span, div[role=button]')].filter(usable);
    const leafs = (list) => list.filter((b) => !list.some((o) => o !== b && b.contains(o)));
    let next = null, how = '';
    // (1) แถบเลขหน้า 1 2 3 … (หน้าปัจจุบันมีป้าย active/aria-current)
    const nums = leafs(pool.filter((b) => /^\d{1,3}$/.test((b.innerText || '').trim())));
    const cur = nums.find((b) => isActive(b) || b.getAttribute('aria-current') === 'page');
    if (cur) { const want = +cur.innerText.trim() + 1; next = nums.find((b) => +b.innerText.trim() === want && (cur.parentElement.parentElement || document.body).contains(b)) || null; if (next) how = `เลขหน้า ${want}`; }
    // (2) ปุ่มโหลดเพิ่ม
    if (!next) { next = leafs(pool.filter((b) => /^(ดู(?:สินค้า)?เพิ่มเติม|โหลดเพิ่ม(?:เติม)?|แสดง(?:เพิ่ม|เพิ่มเติม|มากขึ้น)|see more|load more|show more|view more)$/i.test((b.innerText || '').trim())))[0] || null; if (next) how = 'ปุ่มโหลดเพิ่ม'; }
    // (3) ปุ่มถัดไป · ในแถบแบ่งหน้าก่อน
    if (!next) {
      const cands = pool.filter((b) => /^(ถัดไป|next|>|›|»)$/i.test((b.innerText || '').trim()) || /next|arrow-right|chevron-right|icon-right|--right/i.test(`${b.getAttribute('aria-label') || ''} ${String(b.className)}`));
      next = cands.find((b) => b.closest('[class*="pag" i], [role=navigation], nav')) || cands.find((b) => /^(ถัดไป|next)$/i.test((b.innerText || '').trim())) || cands[0] || null;
      if (next) how = 'ปุ่มถัดไป';
    }
    let moved = false;
    if (next) { next.click(); moved = (await waitResults(before, 15000)) && (cardSig() !== before || pageCards().length > n); }
    if (!moved) { // (4) เลื่อนลงล่างสุด (หน้าแบบเลื่อนแล้วโหลดต่อ)
      window.scrollTo(0, document.documentElement.scrollHeight);
      for (let t = 0; t < 16 && pageCards().length <= n; t++) await sleep(500);
      moved = pageCards().length > n;
      if (moved) how = 'เลื่อนลงล่างสุด';
    }
    if (moved) view.page++;
    else nextWhy = next ? `กด${how}แล้วสินค้าไม่เปลี่ยน` : 'หาเลขหน้า / ปุ่มหน้าถัดไป / ปุ่มดูเพิ่มเติมไม่เจอ และเลื่อนลงแล้วไม่มีของเพิ่ม';
    return moved;
  }


  async function affSearch({ keyword, more, home, page, sort = '' }) {
    if (!onAffiliate()) return { ok: false, login: true, error: 'ยังไม่ได้เข้าสู่ระบบ Shopee Affiliate ในเบราว์เซอร์นี้' };
    if (home) { // สินค้าแนะนำ = การ์ดที่หน้าข้อเสนอผลิตภัณฑ์แสดงเองตอนเปิด (ยังไม่ได้ค้น)
      if (view.kw !== null || !/product_offer/.test(location.pathname)) return { ok: false, reload: true, error: `เปิดหน้าข้อเสนอผลิตภัณฑ์ไม่ได้ (${pageInfo()})` }; // เคยค้นแล้ว/อยู่หน้าอื่น → ให้ background เปิดหน้าใหม่
      await waitReady(25000);
      for (let t = 0; t < 30 && !pageCards().length; t++) await sleep(500);
      if (!pageCards().length) {
        const bodyText = (document.body.innerText || '').slice(0, 3000);
        if (!searchInput() && /เข้าสู่ระบบ|log\s*in|sign\s*in|ลงทะเบียน|สมัคร/i.test(bodyText)) return { ok: false, login: true, error: 'ยังไม่ได้เข้าสู่ระบบ Shopee Affiliate ในเบราว์เซอร์นี้' };
        return { ok: false, notReady: !document.querySelector('input'), error: `หน้า Affiliate ไม่มีสินค้าแนะนำขึ้น — ลองกดหมวดหรือพิมพ์ค้นหาแทน (${pageInfo()})` };
      }
      await waitResults('', 6000); // รอการ์ดโหลดครบแล้วนิ่ง
      Object.assign(view, { kw: '', page: 1 });
      const sorted = await syncSort(sort); // 📈 ขายดี
      Object.assign(want, view);
      return { ok: true, items: await results(), more: true, sorted };
    }
    if (more) {
      // หน้าที่แผงดูอยู่ · แท็บนี้เพิ่งโหลดใหม่ (ตัวแปรหาย) → ใช้เลขหน้าที่แผงส่งมา (page = หน้าที่ขอ)
      const at = Math.max(want.kw === keyword ? want.page : 1, (+page || 0) - 1);
      if (view.kw === null && keyword === '' && /product_offer/.test(location.pathname)) Object.assign(view, { kw: '', page: 1 }); // โหลดใหม่ = รายการแนะนำหน้าแรก
      const sortOff = (view.sort || '') !== sort; // เปลี่ยนแบบเรียง → ค้นใหม่แล้วไล่หน้า
      if (view.kw !== keyword || view.page !== at || sortOff) { // หน้าเว็บถูกเปลี่ยนไป → ค้นคำเดิม (ถ้าต้อง) แล้วไล่ไปหน้าเดิมก่อน
        if (view.kw !== keyword || view.page > at || sortOff) {
          const r = await gotoSearch(keyword);
          if (!r.ok) return r;
          await syncSort(sort);
        }
        while (view.page < at && (await nextStep()));
      }
      const moved = await nextStep();
      Object.assign(want, view);
      return { ok: true, items: await results(), more: moved, why: moved ? '' : `${nextWhy} (${pageInfo()})` };
    }
    const r = await gotoSearch(keyword);
    if (!r.ok) return r;
    const sorted = await syncSort(sort);
    Object.assign(want, view);
    return { ok: true, items: await results(), more: true, sorted };
  }

  // พิมพ์คำค้นบนหน้าข้อเสนอผลิตภัณฑ์แล้วรอผลขึ้น
  async function gotoSearch(keyword) {
    await waitReady(25000);
    let input = searchInput();
    if (!input) { // ไม่ได้อยู่หน้าข้อเสนอผลิตภัณฑ์ → กดเมนูไปก่อน
      const nav = [...document.querySelectorAll('a, [role=menuitem], li, span')].find((a) => /product_offer/.test(a.getAttribute('href') || '') || /^(ข้อเสนอ\s*ผลิตภัณฑ์|product offers?)$/i.test((a.innerText || '').trim()));
      if (nav) { nav.click(); for (let t = 0; t < 20 && !(input = searchInput()); t++) await sleep(500); }
    }
    // ไม่มีช่องพิมพ์ + หน้าชวนล็อกอิน (path เดิม ไม่ได้ไป /login) = ยังไม่ได้ล็อกอิน
    const bodyText = (document.body.innerText || '').slice(0, 3000);
    if (!input && !pageCards().length && /เข้าสู่ระบบ|log\s*in|sign\s*in|ลงทะเบียน|สมัคร/i.test(bodyText)) {
      return { ok: false, login: true, error: 'ยังไม่ได้เข้าสู่ระบบ Shopee Affiliate ในเบราว์เซอร์นี้' };
    }
    // ไม่มีช่องพิมพ์เลย = หน้ายังไม่วาด (อาจรอให้เปิดดูแท็บ) → ให้ background สลับไปแท็บนั้น
    if (!input) return { ok: false, notReady: !document.querySelector('input'), error: `หาช่องค้นหาบนหน้า Affiliate ไม่เจอ (${pageInfo()})` };
    const before = cardSig(), same = view.kw === keyword && view.page === 1 && !!before;
    input.focus();
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, keyword);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    for (const t of ['keydown', 'keypress', 'keyup']) input.dispatchEvent(new KeyboardEvent(t, { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
    await sleep(2500);
    if (cardSig() === before && !same) { // Enter ไม่ทำงาน → กดปุ่มค้นหาข้างช่อง (ไม่ใช่ปุ่ม ✕ ล้างคำค้น — เดิมกดปุ่มไอคอนตัวแรก อาจล้างคำค้นทิ้ง)
      const box = input.closest('form') || input.parentElement.parentElement || input.parentElement;
      const desc = (b) => `${labelOf(b)} ${b.getAttribute('title') || ''} ${String(b.className)}`;
      const btns = [...box.querySelectorAll('button, [role=button]')].filter((b) => shownEl(b) && !/clear|close|reset|ล้าง|ลบ|ยกเลิก|×|✕/i.test(desc(b)));
      const btn = btns.find((b) => /ค้นหา|search/i.test(desc(b))) || btns.find((b) => b.querySelector('svg'));
      if (btn && input.value === keyword) btn.click();
    }
    if (!(await waitResults(before, 15000, same)) && !pageCards().length) return { ok: false, error: `ค้นหาแล้วไม่มีผลขึ้น (${pageInfo()})` };
    Object.assign(view, { kw: keyword, page: 1 });
    return { ok: true };
  }

  // กด "เอา ลิงก์" ของสินค้าชื่อนี้ แล้วอ่านลิงก์ affiliate จากป๊อปอัป
  const linksNow = () => [...document.querySelectorAll('input, textarea')].map((i) => i.value)
    .concat([...document.querySelectorAll('[role=dialog], .shopee-modal, [class*="modal" i], [class*="popup" i]')].map((d) => d.innerText || ''))
    .join('\n').match(new RegExp(LINK_RE.source, 'g')) || [];
  function closePopup() {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true }));
    for (const b of document.querySelectorAll('[role=dialog] button, .shopee-modal button, [class*="modal" i] button')) {
      if (/^(ปิด|close|×|✕)$/i.test((b.innerText || b.getAttribute('aria-label') || '').trim()) || /close/i.test(b.getAttribute('aria-label') || '')) b.click();
    }
  }
  // ไปหน้าผลค้นหาที่แผงโหลดสินค้านั้นมา (คำค้น + แบบเรียง + เลขหน้าเดิม) — ค้นใหม่ก็ต่อเมื่อคำ/แบบเรียงต่าง หรือต้องย้อนหน้า
  async function gotoView(kw, page, sort) {
    if (kw === '') { // สินค้าแนะนำ
      if (view.kw === null && /product_offer/.test(location.pathname)) { // หน้าเพิ่งเปิดใหม่ = รายการแนะนำหน้าแรก
        await waitReady(25000);
        for (let t = 0; t < 30 && !pageCards().length; t++) await sleep(500);
        await waitResults('', 6000);
        Object.assign(view, { kw: '', page: 1 });
        await syncSort(sort);
      } else if (view.kw !== '' || view.page > page || (view.sort || '') !== sort) return { ok: false, reload: true, error: 'ต้องเปิดหน้าสินค้าแนะนำใหม่' };
    } else if (view.kw !== kw || view.page > page || (view.sort || '') !== sort) {
      const r = await gotoSearch(kw);
      if (!r.ok) return r;
      await syncSort(sort);
    }
    while (view.page < page && (await nextStep()));
    return { ok: true };
  }
  async function affLink({ name, kw, page, sort = '' }) {
    if (!onAffiliate()) return { ok: false, login: true, error: 'ยังไม่ได้เข้าสู่ระบบ Shopee Affiliate ในเบราว์เซอร์นี้' };
    await waitReady(10000);
    const find = () => pageCards().find((x) => key(readCard(x.card).name) === key(name));
    let hit = find();
    if (!hit && typeof kw === 'string' && +page > 0) { // สินค้าจากหน้าอื่นของผลค้นหาที่แผงโหลดไว้ (โหลดหลายหน้าให้เอง) → กลับไปหน้านั้นก่อน
      const r = await gotoView(kw, +page, sort);
      if (r.login || r.reload) return r; // reload = background เปิดหน้าใหม่แล้วส่งคำขอนี้มาอีกครั้ง
      hit = find();
    }
    if (!hit) { // ยังไม่เจอ (หน้าเว็บเปลี่ยนไปแล้ว / เพิ่มจากที่อื่น) → ค้นด้วยชื่อสินค้าตรงๆ
      const r = await gotoSearch(name.slice(0, 100));
      if (r.login) return r;
      hit = find();
    }
    if (!hit) return { ok: false, error: 'หาสินค้านี้บนหน้า Affiliate ไม่เจอ (ค้นหาใหม่แล้วกดอีกครั้ง)' };
    closePopup(); await sleep(300); // ป๊อปอัปของตัวก่อนค้าง → ปิดก่อน
    const before = new Set(linksNow());
    const dlgs = () => [...document.querySelectorAll('[role=dialog], .shopee-modal, [class*="modal" i], [class*="popup" i]')].filter(shownEl);
    const shownBefore = new Set(dlgs());
    hit.btn.click();
    lastLinkCard = null; // คลิกนี้แผงรับลิงก์เอง — ตัวดักลิงก์ไม่ต้องเขียนคิวซ้ำ (เขียนพร้อมกัน = ทับของกัน)
    const dlgLink = () => { // ลิงก์ในป๊อปอัปที่เพิ่งเปิด (กรณีลิงก์ซ้ำกับที่มีบนหน้าอยู่แล้ว)
      for (const d of dlgs()) if (!shownBefore.has(d)) { const m = `${d.innerText || ''} ${[...d.querySelectorAll('input, textarea')].map((i) => i.value).join(' ')}`.match(LINK_RE); if (m) return m[0]; }
      return '';
    };
    for (let t = 0; t < 30; t++) {
      await sleep(400);
      const fresh = linksNow().find((l) => !before.has(l)) || (t >= 8 && dlgLink());
      if (fresh) { closePopup(); return { ok: true, link: fresh }; }
    }
    closePopup();
    return { ok: false, error: 'Shopee ไม่ส่งลิงก์กลับมา' };
  }

  if (window.top === window) {
    let affChain = Promise.resolve(); // ทำทีละคำสั่ง
    try {
      chrome.runtime.onMessage.addListener((m, _s, send) => {
        if (!m || (m.type !== 'affSearch' && m.type !== 'affLink')) return false;
        affChain = affChain.then(() => (m.type === 'affSearch' ? affSearch(m) : affLink(m)))
          .then(send, (e) => send({ ok: false, error: String(e.message || e) }));
        return true;
      });
      // บอก background ว่าแท็บนี้พร้อม (และล็อกอินแล้วหรือยัง)
      chrome.runtime.sendMessage({ type: 'affHello', login: !onAffiliate() }, () => void chrome.runtime.lastError);
    } catch (e) {}
  }

  let timer = null;
  const run = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (location.hostname.startsWith('affiliate.')) { decorateAffiliate(); captureLink(); }
      else productPageButton();
    }, 250);
  };
  new MutationObserver(run).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  document.addEventListener('input', run, true);
  run();
})();
