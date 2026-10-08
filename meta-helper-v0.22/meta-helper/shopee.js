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
  const NOT_NAME = /^(฿|อัตราค่าคอม|ค่าคอม|ขายได้|ขายแล้ว|EXTRA\s*COMM|Mall|Preferred|เอา\s*ลิงก์|รับลิงก์|get link|＋ คิวคลิป|✓ ในคิว|กำลังเพิ่ม)/i;

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
    const commission = (text.match(/ค่าคอม\S*\s*([\d.]+\s*%)/) || [])[1] || '';
    const price = (text.match(/฿\s*[\d,.]+/) || [])[0] || '';
    const a = card.querySelector('a[href*="shopee.co.th"], a[href*="-i."]');
    return { imgCount: card.querySelectorAll('img').length, name: name.replace(/\s*…$/, ''), imageUrls: [...new Set([...imgs, ...bg])].slice(0, 2), commission, price, productUrl: a ? a.href : '' };
  }

  let lastLinkCard = null; // ชื่อสินค้าของการ์ดที่เพิ่งกด "เอา ลิงก์"

  function decorateAffiliate() {
    for (const btn of document.querySelectorAll('button, a, div[role=button], span')) {
      if (btn.dataset.mahDone || !GET_LINK_RE.test((btn.innerText || '').trim()) || btn.children.length > 2) continue;
      const card = cardOf(btn);
      if (!card || card.querySelector('.mah-queue-btn')) continue;
      btn.dataset.mahDone = '1';
      btn.addEventListener('click', () => { lastLinkCard = readCard(card).name; }, true);
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
    const fields = [...document.querySelectorAll('input, textarea')].map((i) => i.value);
    const texts = [...document.querySelectorAll('[role=dialog], .shopee-modal, [class*="modal" i], [class*="popup" i]')]
      .map((d) => d.innerText || '');
    const m = [...fields, ...texts].join('\n').match(LINK_RE);
    if (!m) return;
    const name = lastLinkCard;
    lastLinkCard = null;
    if (await setLinkFor(name, m[0])) toast(`เก็บลิงก์แล้ว ✓ ${m[0]}`);
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
