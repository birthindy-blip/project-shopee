// Shopee Video ผู้ช่วยทำคลิป v0.22 (บน meta.ai): คิวสินค้า + คลังพรีเซนเตอร์ + prompt ทีละคลิป (คลิปละ 10 วิ) + รันคิวอัตโนมัติ
(() => {
  if (window.__mahLoaded) return;
  window.__mahLoaded = true;

  // ---------- ส่วนประกอบ prompt: แบบสั้น บรรทัดละเรื่อง (ตามแบบที่ใช้ได้จริงบน meta.ai) ----------
  // prompt ยาวแบ่งหมวด [..] + สั่งจัดการไฟล์ (ffmpeg/ลบไฟล์) → meta.ai ขึ้น "Something went wrong"
  // ห้ามมีชื่อแบรนด์/แอป (Shopee, Facebook ฯลฯ) — meta.ai แปลงเป็นวิดเจ็ตแอปแล้วพัง
  const CLIP_HEAD = 'Product: "'; // บรรทัดที่ 2 ของ prompt (ชื่อสินค้า) — ใช้หาข้อความที่ส่งบนหน้าแชต
  const R = {
    style: { auto: '', minimal: 'minimal clean background, soft neutral colors', natural: 'natural lifestyle, bright daylight',
      ugc: 'UGC style, filmed on a phone fixed on a tripod (never handheld) — real person casually showing and reviewing the product, authentic and natural, not an ad',
      tryout: 'real hands-on try-out filmed on a phone — authentic and unpolished, like a real person testing it where they would really use it, not an ad' }, // 🙌 ลองใช้จริง (เห็นแค่มือ) // ไม่บังคับเซลฟี่ — มุมกล้องให้ meta เลือก
    who: {
      auto: 'Real Thai person, hands or cute animal — whatever fits the product',
      person: 'Real Thai person talking to camera',
      animal: 'Cute real cat or dog with the product, Thai voice-over',
      hands: 'Only realistic hands using the product, no face or body, Thai voice-over',
      none: 'No people or animals, product-only shots, Thai voice-over',
    },
    tone: { seller: 'confident and persuasive, like a seller pitching to customers', bright: 'bright cheerful', soft: 'soft warm calm', excited: 'excited amazed', casual: 'casual warm, like chatting with a friend', pro: 'clear confident expert', asmr: 'quiet ASMR whisper, slow',
      hype: 'lively and genuinely excited, like hyping a favorite find to friends, talking naturally — not reading a script' }, // ป้ายยา
    text: { keywords: '2–3 short Thai keywords next to the features', captions: 'Thai subtitles in sync with speech, lower third', hook: 'one short Thai title at the start' },
    fx: {
      auto: '', pop: 'bouncy pop-in text, bold rounded white font', type: 'typewriter text', highlight: 'karaoke word highlight, white text with black outline',
      neon: 'glowing neon text', hand: 'white handwritten Thai text writing itself, underline and arrow to the feature',
      doodle: 'Doodle text: cute colorful letters with white outline, stars hearts arrows checkmarks sparkles dotted lines, bottom banner',
    },
    // ช่วงของคลิป: meta.ai ทำได้ทีละ ~10 วิ แล้วต่อคลิป ภาพตรงรอยต่อมักไม่ต่อเนื่อง → ช่วงหลังวิ 10 เป็นช็อตใหม่
    story: {
      10: [{ t: [0, 2], what: 'first frame: product close-up' }, { t: [2, 6], what: 'product details' }, { t: [6, 10], what: 'in use, best feature' }],
      15: [{ t: [0, 2], what: 'first frame: product close-up' }, { t: [2, 6], what: 'product details' }, { t: [6, 10], what: 'in use' },
        { t: [10, 15], what: 'fresh shot: everyday use, best feature' }],
      20: [{ t: [0, 2], what: 'first frame: product close-up' }, { t: [2, 6], what: 'product details' }, { t: [6, 10], what: 'in use' },
        { t: [10, 20], what: 'fresh shots: everyday use, new angles' }],
    },
    // 15 วิ แบบโชว์สินค้าท้ายคลิป: 10–15 วิ (หลังรอยต่อ หน้าคน/ปากมักเพี้ยน) = สินค้าล้วน + เพลง ไม่พูด
    outro: { t: [10, 15], what: 'product only, music only, no speech', silent: true },
    cuts: { fast: 'fast cuts every 0.5–1s, a different shot each cut', normal: 'cut every 1.5–2s, a different shot each cut (close-up, in use, detail, wide)' }, // ผู้ใช้ขอตัดสลับซีนเยอะขึ้น (ปกติเดิมทุก 2–3 วิ)
    vfx: {
      auto: 'trendy effects (punch-in zoom, whip-pan, speed ramp) with whoosh/pop', none: 'no camera effects',
      zoom: 'punch-in zoom', whip: 'whip-pan', ramp: 'speed ramp', freeze: 'freeze-frame flash', split: 'split-screen', shake: 'beat shake',
    },
    music: {
      fast: 'Upbeat trendy background music, lower during speech',
      kawaii: 'Upbeat cute kawaii pop background music, ukulele light drums / lo-fi pop bouncy, music lower during speech',
      none: 'No background music',
    },
    // ธีมสีตามสีสินค้า แบบน่ารัก (ตัวหนังสือ ดูเดิล แถบ ของประกอบฉาก) — ไม่ใส่กับสไตล์มินิมอล
    theme: "Color theme: cute, matched to the product's colors (text, doodles, banner, props)",
    // ไม่ได้พิมพ์ฉาก → ให้ meta.ai เลือกฉากที่เข้ากับสินค้าเอง (ไม่ล็อกฉากตายตัว)
    autoScene: 'setting that fits the product (food → kitchen or dining table, clothes → bedroom, gadgets → desk, beauty → vanity), background visible',
    // แนว UGC (ไม่ได้ตั้งฉาก): ห้องสต็อกของคนขาย — สินค้าวางเต็มด้านหน้าและหลัง กล่องลังสลับด้านหลัง (ผู้ใช้สั่ง)
    ugcScene: 'a seller\'s small stock room — lots of units of exactly this product piled and lined up on the table in the foreground, filling the front of the frame, more on shelves behind (all identical to the product reference, no other products; a large item: one or two set up around the seller, more in boxes behind), brown cardboard shipping boxes stacked here and there',
    // 🙌 ลองใช้จริง: ฉากที่ใช้สินค้าจริง (ไม่ล็อกบ้าน) แสงธรรมชาติ (ผู้ใช้ขอ — ไม่เหมือนโฆษณา) · ยังไม่อมเหลือง
    tryScene: 'the real place where this product is actually used — wherever fits it, not only at home (e.g. kitchen items → kitchen counter, beauty → vanity, gadgets → desk, car accessories → inside a car, fitness gear → gym or park, camping gear → outdoors), real and lived-in, background visible', // ผู้ใช้เลือก ก: ไม่ล็อกบ้าน
    natLight: 'natural daylight (from a window indoors, open daylight outdoors) — soft, real-life light, not studio lighting; neutral white balance (not warm or yellow)',
    bright: 'very bright clean white daylight, high-key, evenly lit, neutral white balance (not warm or yellow), no dark shadows', // แสงสว่าง ไม่อมเหลือง (ทั้งคลิปและรูป)
    // ตัวหนังสือบนรูปโพสต์ให้แบบเดียวกับในคลิป (ลูกเล่นตัวหนังสือที่เลือก) · หัวข้อสั้นกระชับ
    photoText: {
      doodle: 'cute colorful handwritten Thai text, white outline, stars hearts arrows checkmarks sparkles dotted lines, bottom banner',
      hand: 'white handwritten Thai text with underline and arrow to the feature',
      pop: 'bold rounded white Thai text', neon: 'glowing neon Thai text', highlight: 'white Thai text with black outline',
      other: 'cute colorful rounded Thai text',
    },
    // โพสต์ (แคปชัน + แฮชแท็ก): ภาษาเป็นกันเอง · ใส่ใน code block → ดึงข้อความได้ตรงๆ ไม่โดนจัดรูปแบบ markdown
    postAsk: [
      'Casual, friendly Thai like excitedly recommending a favorite find to a close friend so they want one too — creative and eye-catching (first line specific to this product, not generic): 2–3 short lines with emoji, everyday words, use เรา, no ครับ/ค่ะ, real excitement but no exaggeration, not like an ad, no price or promo; vary how lines end — avoid ending with นะ or เลยนะ', // ผู้ใช้ขอแนวเป็นกันเอง ชวนให้อยากได้ (อธิบายเป็นอังกฤษ — ไม่ใส่คำแสลงไทย meta จะเขียนคำนั้นออกมา)
      'Last line: 4–6 relevant hashtags',
      'Put the whole post in one code block',
    ],
    // กฎบรรทัดเดียวของ prompt รูปโพสต์ (แบบที่ใช้ได้ดี — คงไว้)
    rulesShort: 'no price no promo no platform no review badge, no children, Thai only, Thai text spelled exactly or none, no exaggerated or health claims, product exactly as reference',
    // ทำใหม่เพราะคลิปรอบก่อนไม่เวิค → บอกจุดที่ต้องแก้ (อังกฤษล้วน — ไม่ใส่คำไทยที่อาจถูกพูดออกมา)
    redo: {
      face: "Fix from last try: the person's face looked different or distorted — this time keep it exactly like image 1 in every shot",
      product: 'Fix from last try: the product looked different from the reference — this time show it exactly as in the reference images',
      speech: 'Fix from last try: the speech was unclear or awkward — this time short, clear, natural Thai',
      look: 'Fix from last try: the video looked odd or low quality — this time clean, sharp and natural, real-photo look',
    },
    // ล้างไฟล์ในพื้นที่ทำงานของ meta.ai (จำกัด ~500MB) — ส่งเป็นข้อความแยก ไม่ใส่ใน prompt คลิป
    files: {
      sweep: 'Housekeeping only: please delete all old video and image files from earlier requests in your workspace to free storage. Do not create any image or video. Reply with one short line when done.',
    },
  };

  // คำต้องห้าม (ตรวจบทพูด/ฉากก่อนใส่ prompt)
  const BANNED = [
    ['ห้ามบอกราคา', /ราคา|บาท|฿|\d+\s*\.-|ถูก(มาก|สุด|ๆ|จัด)/],
    ['ห้ามบอกโปร', /(?<!กระ)โปร(?!ด|แกรม|ตีน|ไฟล์|เจ|่)|ส่วนลด|ลด(ราคา|เหลือ|ทันที|\s*\d)|โค้ด|คูปอง|แถม(?!ยัง)|ส่งฟรี|ฟรี(?!ไซ)|sale|เซล|%|แฟลช|วันนี้วันเดียว|รีบ(สั่ง|ซื้อ|กด)/i],
    ['ห้ามพูดเกินจริง', /ที่สุด|อันดับ\s*1|เบอร์\s*1|100\s*%|การันตี|รับประกัน|หายขาด|รักษา(?!ความ|อุณหภูมิ|รูปทรง|สภาพ)|เห็นผล|ปาฏิหาริย์/],
    ['ห้ามอ้างสุขภาพ', /ลดน้ำหนัก|ผอม|ไม่อ้วน|เผาผลาญ|บำรุง|ดีต่อสุขภาพ|ดีท็อกซ์|ภูมิคุ้มกัน/],
    ['ห้ามพูดถึงเด็ก', /เด็ก|ลูกน้อย|ทารก/],
  ];
  function checkText(text) {
    const out = [];
    for (const [rule, re] of BANNED) {
      const m = (text || '').match(re);
      if (m) out.push(`${rule}: “${m[0]}”`);
    }
    return out;
  }
  // รายละเอียดสินค้าที่ส่งให้ meta.ai คิดบท: ตัดราคา/โปร/คำต้องห้ามทิ้ง (meta.ai อาจพูดออกมาตรงๆ)
  // รายละเอียดที่ดึงจาก Shopee ยุบเป็นบรรทัดเดียว → แยกตามสัญลักษณ์/ประโยค แล้วท่อนที่ติดคำต้องห้ามตัดเฉพาะคำนั้น + ตัวเลขที่ติดกัน (ราคา)
  const dropBanned = (x) => {
    const w = x.split(/\s+/), bad = w.map((t) => checkText(t).length > 0);
    return w.filter((t, i) => !bad[i] && !(/^[\d,.]+(\.-)?$/.test(t) && (bad[i - 1] || bad[i + 1])) && !(/^(ลด|เหลือ|เพียง|แค่)$/.test(t) && bad[i + 1])).join(' ');
  };
  // ลิงก์/โดเมนในรายละเอียด (ลิงก์ร้าน ฯลฯ) ไม่ใช้คิดบท และกันชื่อแอปในลิงก์ (shopee.co.th) เหลือเศษเข้า prompt
  const URL_RE = /\bhttps?:\/\/\S+|\bwww\.\S+|\b[\w-]+\.(?:co\.th|in\.th|com|net|ly|me)\b\S*/gi;
  const cleanDesc = (s) => (s || '').replace(URL_RE, ' ').split(/\n|[•·●▪◆★✓✔✅|]|\s[-*]\s|[.!?]\s/)
    .map((x) => (checkText(x).length ? dropBanned(x) : x).replace(/\s+/g, ' ').trim())
    .filter((x) => x && !checkText(x).length).join(' · ').replace(BRAND_RE, '')
    .replace(/[*_~`#><|[\]{}]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 500); // ยังติดอยู่ (เช่น "ลด 50") → ทิ้งทั้งท่อน · ตัดอักษร markdown เหมือนชื่อสินค้า
  // ชื่อสินค้าสำหรับ prompt: ชื่อจาก Shopee มักมีป้ายโปร เช่น "(พร้อมส่ง โค้ด 30% Max1,000) … ลิงค์ 1" → ตัดออก (ชื่อบนการ์ดยังเป็นชื่อเต็ม)
  // meta.ai แปลงชื่อแอปเป็นวิดเจ็ต (แล้วสร้างไม่สำเร็จ) · รวมคำติดกันเช่น ShopeeMall และแอปที่รายละเอียดสินค้าชอบใส่ (ติดตาม Facebook / IG)
  const BRAND_RE = /\b(shopee\w*|lazada\w*|tiktok\w*|facebook\w*|fb|instagram|ig|youtube|whatsapp|messenger)\b/gi;
  // สินค้าเป็นเสื้อผ้า → บอก meta.ai ว่ารูปสินค้าคือชุดที่คนต้องใส่ (ไม่ใช้ "ชุด" เดี่ยวๆ เพราะชนกับ "ชุดเครื่องครัว")
  // ชุดชั้นใน / ชุดนอนเซ็กซี่ / ชุดว่ายน้ำ: meta.ai ไม่ทำแบบมีคนใส่ (ปฏิเสธว่าเซ็กซี่เกิน) → ถ่ายสินค้าล้วน (แขวน พับ โคลสอัพผ้า)
  const MODEST_RE = /ชุดชั้นใน|เสื้อใน|บรา(?!ซิล|วนี่|วน์)|\bbra\b|กางเกงใน|จีสตริง|g-?string|ชุดว่ายน้ำ|บิกินี่|bikini|lingerie|เซ็กซี่|sexy|ซีทรู|see.?through|ไนตี้|nightie|ชุดนอน.{0,40}(?:ซาติน|ลูกไม้|สายเดี่ยว|ไม่มีโครง)|(?:ซาติน|ลูกไม้|สายเดี่ยว).{0,40}ชุดนอน|สายเดี่ยว.{0,30}ลูกไม้|ลูกไม้.{0,30}สายเดี่ยว/i;
  // สินค้าผู้ชาย → คน/เสียงผู้ชาย (ชาย ที่ไม่ใช่ ชายหาด/ชายเสื้อ · มีทั้งชายและหญิง = ไม่นับ)
  const MALE_RE = /ผู้ชาย|สุภาพบุรุษ|ชาย(?!หาด|ทะเล|เสื้อ|คา|แดน|ขอบ)|\bmen'?s?\b|\bmale\b|\bman\b|หนุ่ม|เครา|หนวด|โกนหนวด|มีดโกน|ที่โกน|บ็อกเซอร์|\bboxer/i;
  // หมวดที่เหมาะกับผู้ชาย (ผู้ใช้ขอ: อุปกรณ์ช่าง เตาอั้งโล่ ฯลฯ) · ไม่เอาคีมตัดเล็บ / ถ่านไฟฉาย
  const MALE_CAT_RE = /เครื่องมือช่าง|อุปกรณ์ช่าง|ชุดเครื่องมือ|สว่าน|ไขควง|ประแจ|คีม(?!ตัดเล็บ)|ค้อน|เลื่อย|เครื่องเจียร|หินเจียร|ลูกบ็อกซ์|ลูกบล็อก|ตลับเมตร|หัวแร้ง|เครื่องเชื่อม|ตู้เชื่อม|ปั๊มลม|แม่แรง|เครื่องตัดหญ้า|เครื่องพ่นยา|อั้งโล่|เตาถ่าน|เตาปิ้ง|เตาย่าง|เตาบาร์บี|ถ่านไม้|ถ่านอัด|น้ำมันเครื่อง|อะไหล่|ล้อแม็ก|ยางรถ|มอเตอร์ไซค์|รถจักรยานยนต์|ท่อไอเสีย|หมวกกันน็อ|เบ็ด|รอกตกปลา|ตกปลา|เหยื่อปลอม|(drill|wrench|screwdriver|grill|bbq)/i;
  const BOTH_RE = /ผู้หญิง|หญิง|สตรี|\bwomen|\blad(y|ies)|unisex|ยูนิเซ็กซ์|สาว/i;
  const isMalePres = (p) => !!p && (p.gender === 'm' || /ชาย|หนุ่ม|พ่อ|\bman\b|\bmale\b/i.test(`${p.name || ''} ${p.desc || ''}`));
  const OUTFIT_RE = /เสื้อ|กระโปรง|กางเกง|เดรส|ชุดเดรส|ชุดนอน|ชุดเซ็[ทต]|แจ็[คก]เก็ต|คาร์ดิแกน|ฮู้ด|ครอป|สายเดี่ยว|\b(dress|shirt|t-?shirt|tee|skirt|pants|jeans|jacket|hoodie|cardigan|blouse|outfit)\b/i;
  const NAME_NOISE =/พร้อมส่ง|ส่งไว|ส่งด่วน|ของแท้|ลิง[คก]์\s*\d*|\blink\s*\d*|\bmax\s*[\d,]+|flash\s*sale/gi;
  // ตัดอักษร markdown (* _ ~ ` # > < | [ ] { }) ด้วย: meta.ai แสดงแชตเป็น markdown → ชื่อมี ** หรือ [ ] จะกลายเป็นตัวหนา/ลิงก์
  // ข้อความแตกเป็นหลายท่อน → หาบรรทัด Product: "…" ที่เราส่งไม่เจอ → จับรูป 4 ภาพ/แคปชันไม่ได้
  const promptName = (name) => dropBanned(String(name || '')
    .replace(/[([【{][^)\]】}]*[)\]】}]/g, (m) => (checkText(m).length || m.match(NAME_NOISE) ? ' ' : m))
    .replace(NAME_NOISE, ' ').replace(BRAND_RE, ' ').replace(/[*_~`#><|[\]{}]/g, ' '))
    .replace(/^[\s\-–|:,/]+|[\s\-–|:,/]+$/g, '').replace(/\s+/g, ' ').trim();

  const OPTIONS = {
    duration: [['10', '10 วิ'], ['15', '15 วิ'], ['20', '20 วิ']],
    pace: [['fast', 'เร็ว (ตัดภาพไว)'], ['normal', 'ปกติ']],
    talk: [['fast', 'เร็ว'], ['normal', 'ปกติ'], ['slow', 'ช้า']], // ความเร็วพูด (แยกจากจังหวะตัดภาพ)
    scenes: [['auto', 'อัตโนมัติ'], ['1', '1 ซีน (เทคเดียว)'], ['3', '3 ซีน'], ['4', '4 ซีน'], ['5', '5 ซีน'], ['6', '6 ซีน'], ['8', '8 ซีน']],
    fbCmtPhotos: [['0', 'ไม่แนบ'], ['1', '1 รูป'], ['2', '2 รูป']], // รูปโพสต์แนบในคอมเมนต์ Reel (ผู้ใช้ขอ)
    music: [['auto', 'ตามจังหวะ'], ['kawaii', 'ป๊อปน่ารัก (อูคูเลเล่)'], ['none', 'ไม่มีเพลง']],
    spSort: [['1', 'เกี่ยวข้อง'], ['2', 'ขายดี'], ['5', 'คอมสูง'], ['4', 'ราคาต่ำ']],
    cleanEvery: [['1', 'ทุกคลิป'], ['3', 'ทุก 3 คลิป'], ['5', 'ทุก 5 คลิป'], ['10', 'ทุก 10 คลิป']],
    variants: [['1', '1 คลิป'], ['2', '2 แบบ (A/B เลือกตัวที่ดีกว่า)']],
    post: [['on', 'สร้าง'], ['off', 'ไม่สร้าง']],
    gap: [['0', 'ไม่พัก'], ['5', '5 วิ'], ['15', '15 วิ'], ['30', '30 วิ']],
    newChat: [['0', 'ไม่เปิดใหม่'], ['1', 'ทุกคลิป'], ['5', 'ทุก 5 คลิป'], ['10', 'ทุก 10 คลิป'], ['20', 'ทุก 20 คลิป']],
    fillEvery: [['0', 'ไม่แทรก'], ['1', 'ทุก 1 โพสต์ขาย'], ['2', 'ทุก 2 โพสต์ขาย'], ['3', 'ทุก 3 โพสต์ขาย']],
    fbGap: [['5', '5 นาที'], ['15', '15 นาที'], ['30', '30 นาที'], ['45', '45 นาที'], ['60', '1 ชม.']],
    vfx: [['auto', 'อัตโนมัติ'], ['zoom', 'ซูมกระแทก'], ['whip', 'ปัดเปลี่ยนฉาก'], ['ramp', 'เร่ง-สโลว์'], ['freeze', 'ภาพค้าง+แฟลช'], ['split', 'แบ่งจอ'], ['shake', 'สั่นตามจังหวะ'], ['none', 'ไม่ใส่']],
    style: [['auto', 'อัตโนมัติ'], ['minimal', 'มินิมอล'], ['natural', 'ธรรมชาติ'], ['ugc', 'UGC (คนรีวิวจริง)'], ['tryout', 'ลองใช้จริง (เห็นแค่มือ)']],
    view: [['auto', 'อัตโนมัติ'], ['full', 'เห็นทั้งตัว'], ['hands', 'เห็นแค่มือ'], ['none', 'ไม่เห็นคน']],
    presenter: [['auto', 'อัตโนมัติ'], ['human', 'คน'], ['animal', 'สัตว์']],
    voiceSex: [['auto', 'ตามสินค้า'], ['f', 'ผู้หญิง'], ['m', 'ผู้ชาย']], // เพศผู้แสดง + เสียง (มือ/คน กับเสียงเพศเดียวกันเสมอ)
    tone: [['auto', 'อัตโนมัติ (แม่ค้า)'], ['seller', 'แม่ค้า (เชียร์ขาย)'], ['bright', 'สดใส'], ['soft', 'นุ่มนวล'], ['excited', 'ตื่นเต้น'], ['casual', 'เป็นกันเอง'], ['hype', 'ป้ายยา'], ['pro', 'มืออาชีพ'], ['asmr', 'กระซิบ ASMR']],
    text: [['none', 'ไม่มี'], ['keywords', 'คำเด่นเด้ง'], ['captions', 'ซับบทพูด'], ['hook', 'หัวข้อเปิด']],
    scriptMode: [['meta', '🎬 meta.ai คิดให้'], ['same', '✍ พิมพ์เอง (บทเดียวทุกตัว)']], // เอา “✨ Gemini เขียนก่อน” ออกแล้ว (ผู้ใช้สั่ง) — Gemini ใช้แค่เขียนข้อความขายแชร์กลุ่ม
    fx: [['auto', 'อัตโนมัติ'], ['pop', 'เด้ง'], ['type', 'พิมพ์ทีละตัว'], ['highlight', 'ไฮไลต์คำ'], ['neon', 'นีออน'], ['hand', 'ลายมือ + ลูกศร'], ['doodle', 'ดูเดิลน่ารัก']],
  };

  // แนวสำเร็จรูป: กดทีเดียวตั้งค่าหลายอย่าง
  const PRESETS = [
    { label: '🏠 ในห้อง', desc: 'สินค้าในห้องสว่าง + ลายมือชี้จุดเด่น (ไม่เห็นคน)', set: { style: 'natural', view: 'none', presenter: 'auto', tone: 'casual', text: 'keywords', fx: 'hand',
      scene: 'bright white living room, light neutral tones, light wooden floor, big windows daylight, wide room shots + product close-ups, room visible (no background blur)' } },
    // ภาพจริง + ดูเดิล kawaii ทับ + แถบชมพูด้านล่าง + เพลงป๊อปน่ารัก · ตัดภาพช้าลง/ไม่ใส่ลูกเล่นกล้อง ให้อ่านดูเดิลทัน
    // ฉากว่าง = meta.ai เลือกฉากให้เข้ากับสินค้าเอง (ไม่ล็อกห้องนอน)
    { label: '✨ ดูเดิล', desc: 'ภาพจริง + ดูเดิลน่ารัก + ข้อความไทย + เพลงป๊อป', set: { style: 'auto', view: 'full', presenter: 'human', tone: 'bright', pace: 'normal', music: 'kawaii', vfx: ['none'], text: 'keywords', fx: 'doodle',
      scene: '' } },
    // UGC: คนจริงพูดป้ายยากับกล้อง (พรีเซนเตอร์ที่เลือก · ไม่บังคับเซลฟี่) · สลับฉาก/มุมกล้อง · ไม่มีเอฟเฟกต์/เพลง/ธีมสี ให้ดูจริงใจไม่เหมือนโฆษณา · ฉากให้ meta.ai เลือก
    { label: '🤳 UGC', desc: 'ค่าหลัก · แม่ค้าขายของ — กล้องตั้งนิ่ง เห็นครึ่งตัว หน้านิ่ง พูดเชียร์ขาย · สินค้าวางเต็มโต๊ะด้านหน้าและชั้นด้านหลัง มีกล่องลังสลับด้านหลัง (ไม่ได้ตั้งฉาก)', set: { style: 'ugc', view: 'auto', presenter: 'human', tone: 'seller', talk: 'fast', pace: 'normal', music: 'none', vfx: ['none'], text: 'none', fx: 'auto',
      scene: '' } },
    // ผู้ใช้ขอ: 20 วิ เห็นแค่มือ ไม่เห็นหน้า · hook → ลองใช้จริง → จุดเด่น · แสงธรรมชาติ ไม่เหมือนโฆษณา · พากย์แบบเล่าให้เพื่อนฟัง (ไม่ใช่แม่ค้า)
    { label: '🙌 ลองใช้จริง', desc: '20 วิ เห็นแค่มือกับสินค้า ไม่เห็นหน้า · บทเปิดด้วย hook → ทดลองใช้จริง → โชว์จุดเด่น · ฉากที่ใช้สินค้าจริง แสงธรรมชาติ ไม่เหมือนโฆษณา', set: { style: 'tryout', view: 'hands', presenter: 'human', duration: '20', tone: 'casual', talk: 'normal', pace: 'normal', music: 'none', vfx: ['none'], text: 'none', fx: 'auto', scenes: 'auto',
      scene: '' } },
  ];
  // ฉากของแนวสำเร็จรูปรุ่นเก่า → อัปเดตเป็นค่าแนวรุ่นใหม่ให้อัตโนมัติ (ตำแหน่งตรงกับ PRESETS)
  const OLD_PRESET_SCENES = [
    ['Cozy living room in warm cream tones, light wooden floor, soft natural window light, softly blurred background. Close-up product shots with smooth camera moves.',
      'Cozy living room in warm cream tones, light wooden floor, soft natural window light, softly blurred background. Close-up product shots with slow, smooth camera moves.',
      'Bright, airy living room in warm cream tones with a light wooden floor and plenty of daylight from large windows — bright and cheerful. Mix wide shots that show the whole room and its cozy atmosphere with close-ups of the product; keep the room clearly visible behind the product (no heavy background blur).',
      'bright airy living room, warm cream tones, light wooden floor, big windows daylight, wide room shots + product close-ups, room visible (no background blur)'],
    ['Cute, cozy pastel bedroom in soft pink and lilac tones — fairy lights, plush toys and soft bright daylight; dreamy and cheerful. Keep the room clearly visible behind the product (no heavy background blur).',
      'Bright bedroom with a white bed and soft daylight, cozy and cheerful; full body in frame. Keep the room clearly visible (no heavy background blur).',
      'Bright bedroom with a white bed and soft daylight, cozy and cheerful. Keep the room clearly visible (no heavy background blur).',
      'bright bedroom, white bed, soft daylight, room visible (no background blur)'],
  ];
  const MULTI = new Set(['vfx']); // ตัวเลือกที่เลือกได้หลายอัน
  const DEFAULTS = { duration: '15', style: 'ugc', presenter: 'human', view: 'auto', tone: 'seller', pace: 'normal', talk: 'fast', music: 'none', outro: true, photos: false, scenes: 'auto', spSort: '2', spXtra: true, qFilter: 'all', theme: 'dark', fbPost: 'reel', voiceSex: 'auto', fbAiFlag: true, fbComment: true, fbReelLink: true, autoClear: true, fbCmtPhotos: '2', fbDelPhotos: true, gap: '15', variants: '1', cleanOn: true, cleanEvery: '5', newChat: '1', delOldChat: true, fillEvery: '2', aiLabel: false, fbGap: '15', post: 'on', vfx: ['none'], scriptMode: 'meta', text: 'none', fx: 'auto', osText: '', scene: '', lines: {}, presenterId: '' };
  let st = { ...DEFAULTS };
  let products = [];
  let presenters = []; // [{ id, name, desc, image }]

  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const newProduct = () => ({ id: uid(), name: '', on: true, done: false, images: [], link: '', commission: '', price: '' });

  const styleKey = () => (modestNow && st.style === 'ugc' ? 'natural' : st.style);
  let modeOverride, modestNow = false; // ระหว่างรัน: สินค้าที่ต้องถ่ายสินค้าล้วน (MODEST_RE)
  function mode() {
    if (modeOverride) return modeOverride;
    if (st.view === 'none') return 'none';
    if (st.view === 'hands') return 'hands';
    if (st.presenter === 'animal') return 'animal';
    if (st.view === 'full' || st.presenter === 'human') return 'person';
    return 'auto';
  }
  // พรีเซนเตอร์ที่ใช้: ระหว่างรันคิว ถ้าเพจ FB ที่สินค้านี้จะลงมีพรีเซนเตอร์ประจำเพจ → ใช้ตัวนั้น (undefined = ใช้ตัวที่เลือกในตั้งค่า · null = ไม่ใช้รูปหน้า)
  let presenterOverride;
  const maleProduct = () => { const n = active().map((p) => p.name || '').join(' '); return (MALE_RE.test(n) || MALE_CAT_RE.test(n)) && !BOTH_RE.test(n); };
  const maleNow = () => st.voiceSex === 'm' || (st.voiceSex !== 'f' && maleProduct()); // ตั้งเอง หรือ ตามสินค้า (สินค้าผู้ชาย = ผู้ชาย) // สินค้าผู้ชาย (ไม่ใช่ของทั้งชายหญิง)
  const sexMale = () => maleNow() || (faceUsable() && isMalePres(presenter())); // สินค้าผู้ชาย หรือใช้รูปหน้าผู้ชายอยู่
  const presenter = () => {
    const base = presenterOverride !== undefined ? presenterOverride : presenters.find((p) => p.id === st.presenterId) || null;
    if (base && !isMalePres(base) && maleNow()) return presenters.find(isMalePres) || null; // สินค้าผู้ชาย: หน้าผู้ชาย · ไม่มี = ไม่แนบรูปหน้า (meta สร้างผู้ชายเอง)
    return base;
  };
  let noFace = false; // ชั่วคราว: meta.ai พังซ้ำ → ลองใหม่โดยไม่แนบรูปพรีเซนเตอร์ (เฉพาะสินค้าตัวนั้น)
  const faceUsable = () => !noFace && !!presenter() && (mode() === 'person' || mode() === 'auto');
  let runItem = null; // ระหว่างรันคิว: ทำทีละสินค้า
  const todo = () => products.filter((p) => !p.done && (p.name.trim() || p.images.length)); // ทุกตัวในคิวที่ยังไม่เสร็จ
  const active = () => (runItem ? [runItem] : todo().slice(0, 1));
  const seconds = () => ({ 15: 15, 20: 20 })[st.duration] || 10;
  // ช่วงของคลิป · 15 วิ + ติ๊ก "โชว์สินค้าท้ายคลิป" → ช่วง 4 เป็นสินค้าล้วนไม่พูด (บทเหลือ 3 บรรทัด)
  const outroOn = () => seconds() === 15 && !!st.outro;
  const storySegs = () => (outroOn() ? [...R.story[15].slice(0, 3), R.outro] : R.story[seconds()]);
  const spokenSegs = () => storySegs().filter((g) => !g.silent);

  // รูปที่จะแนบตามลำดับ (ลำดับต้องตรงกับที่บอกใน prompt)
  function filesFor() {
    return [faceUsable() ? presenter().image : null, ...active().flatMap((p) => p.images)].filter(Boolean);
  }
  // ไฟล์ที่แนบส่ง meta.ai (ลำดับเดียวกับ filesFor) — ตั้งชื่อใหม่ไม่ซ้ำข้ามสินค้า: เดิมรูปจากแท็บค้นหาชื่อ product-1.jpg ทุกตัว
  // แชตเดียวกันมีหลายไฟล์ชื่อเดียวกัน → meta.ai สลับรูปสินค้าเก่ากับตัวใหม่ (เอาถุงซีลตัวก่อนมาแปะบนกล่องบราวนี่)
  function sendFiles() {
    const mime = (img) => img.type || (String(img.dataUrl).match(/^data:([^;,]+)/) || [])[1] || 'image/jpeg'; // รูปเก่าบางรูปไม่ได้เก็บชนิดไฟล์
    const named = (img, base) => { const type = mime(img); return { ...img, type, name: `${base}.${/png/.test(type) ? 'png' : /webp/.test(type) ? 'webp' : 'jpg'}` }; };
    const out = faceUsable() ? [named(presenter().image, `person-${presenter().id}`)] : [];
    for (const p of active()) p.images.forEach((img, k) => out.push(named(img, `product-${p.id}-${k + 1}`)));
    return out.map(dataUrlToFile);
  }

  // หน้าตาคนในคลิป/รูป (ผู้ใช้ขอ: เคยออกมาดูโทรม/ป้าๆ) — มีรูปหน้า = หน้าตามรูป แค่ดูแลตัวเอง/แต่งหน้าบางๆ · ไม่มีรูปหน้า = หน้าตาดี อายุ 20 กว่า
  const looksLine = (short) => (sexMale() ? (faceUsable() ? (short ? 'well-groomed, neat hair' : 'well-groomed, neat hair, clean-shaven or a neat short beard, fresh skin — never tired-looking')
      : short ? 'good-looking young Thai man, well-groomed' : 'good-looking young Thai man in his 20s, well-groomed, neat hair, clean-shaven or a neat short beard, fresh skin — never tired or older-looking')
    : faceUsable() ? (short ? 'well-groomed, light natural makeup' : 'well-groomed, light natural makeup, neat hair, fresh skin — never tired-looking')
    : short ? 'attractive young adult, well-groomed, light natural makeup' : 'attractive young adult in their 20s, well-groomed, light natural makeup, neat hair, fresh skin — never tired or older-looking');
  const sceneText = () => (st.scene || '').trim().replace(/[.\s]+$/, ''); // ไม่มีจุดท้าย (ต่อท้ายด้วย , ได้)

  // รูปอ้างอิง (ลำดับตรงกับรูปที่แนบใน filesFor) · photo = ใช้กับ prompt รูปโพสต์
  function refLines(photo) {
    const m = mode();
    const pr = presenter();
    const desc = faceUsable() ? String(pr.desc || '').trim() : ''; // พรีเซนเตอร์รุ่นเก่าอาจไม่มีคำบรรยาย
    // แชตเดียวหลายสินค้า: meta.ai เคยหยิบรูปสินค้าเก่าจากข้อความก่อนๆ มาปน → บอกให้ใช้แค่รูปที่แนบกับข้อความนี้
    const out = [filesFor().length ? 'Use only this message\'s images — ignore earlier images, products and people in this chat' : 'New, separate product — ignore earlier images, products and people in this chat'];
    let n = 1;
    if (faceUsable()) out.push(photo ? `Person face must match exactly: image 1${desc ? ` — ${desc}` : ''}` : `Image 1 = the person's face (see Face lock)${!photo && outroOn() ? ' — part 1 only, never given to part 2' : ''}${desc ? ` — ${desc}` : ''}`);
    if (faceUsable()) n = 2;
    let wears = false;
    for (const p of active()) {
      if (!p.images.length) continue;
      const img = p.images.length > 1 ? `images ${n}–${n + p.images.length - 1}` : `image ${n}`;
      n += p.images.length;
      if ((m === 'person' || m === 'auto') && OUTFIT_RE.test(p.name)) { // เสื้อผ้า + เห็นคน → ใส่ชุดสินค้า
        wears = true;
        out.push(photo ? `Outfit must match exactly: ${img}` : `${img[0].toUpperCase()}${img.slice(1)} = the outfit to wear${faceUsable() ? ' (not the clothes in the face photo)' : ''}`);
      } else out.push(photo ? `Product must match exactly: ${img} (shape, color, logo, text printed on the product — not the shop's banners, stickers or price/sale text on the photo); an exact copy, never embellished — nothing added, removed or redesigned` : `${img[0].toUpperCase()}${img.slice(1)} = the product (see Product lock)`);
    }
    // รูปแนบ: เอาแค่หน้า + สินค้า — เปลี่ยนฉากหลังและชุดเสมอ (สินค้าเป็นเสื้อผ้า = ชุดคือสินค้า ต้องใส่ชุดนั้น)
    if (n > 1) {
      const take = [faceUsable() ? 'the face' : '', wears ? 'the product outfit' : 'the product'].filter(Boolean).join(' and ');
      const newOutfit = faceUsable() && !wears;
      out.push(photo ? `From the reference images use only ${take} — always a new background${newOutfit ? ' and a new outfit' : ''} (never copy their background${newOutfit ? ' or clothes' : ''})` : `Take only ${take} from them — always a new background${newOutfit ? ' and outfit' : ''}`);
    }
    return out;
  }

  // opts.photos = สั่งรูปโพสต์ 4 ภาพมาใน prompt เดียวกับคลิป (หมวด PHOTOS)
  function buildPrompt(opts = {}) {
    const m = mode();
    const items = active();
    const p0 = items[0];
    const sec = seconds();
    const doodle = st.text !== 'none' && st.fx === 'doodle';
    const names = items.map((p, i) => promptName(p.name) || `product ${i + 1}`).join('", "') || 'the product';

    // ไม่กำหนดว่าแต่ละวิต้องมีอะไร — ให้ meta.ai เรียงคลิปเอง · มีบท = พูดตามลำดับ · ไม่มีบท = meta.ai คิดเอง
    const said = (st.scriptMode === 'same' ? st.lines[1] || '' : scriptOf(p0)).split('\n').map((x) => x.trim()).filter(Boolean)
      .map((x) => x.replace(/เลย(?:นะ)?(?!นะทุกคน|ทุกคน)/g, 'เลยนะทุกคน')); // ผู้ใช้สั่ง: คำว่า เลย → เลยนะทุกคน (บทที่พิมพ์เอง)
    // รายละเอียดสั้นๆ พอรู้ว่าสินค้าคืออะไร (ยาวไป meta ไล่พูดทุกจุดเด่น) · ตัดที่จบท่อน ไม่ตัดกลางคำ
    let info = !said.length && p0 ? cleanDesc(p0.desc).split(' · ').reduce((a, x) => (!a || (a + ' · ' + x).length <= 100 ? (a ? `${a} · ${x}` : x) : a), '') : '';
    if (info.length > 100) info = info.slice(0, 100).replace(/\s+\S*$/, ''); // ท่อนเดียวยาว → ตัดที่ช่องว่าง
    // ไม่มีบท = meta.ai คิดบทเองทั้งหมด (ไม่กำหนดจำนวนบรรทัด/ตัวอักษร/ประโยคเปิด) — บอกแค่ให้สั้นพอจบในคลิป · ไม่ใช่แคปชัน (เคยเอาแคปชันมาพูด)
    const onCam = m === 'person' || (m === 'auto' && faceUsable()); // มีคนพูดกับกล้อง (ไม่ใช่เสียงพากย์)
    const talk = st.tone === 'asmr' ? 'slow' : st.talk || 'fast'; // ความเร็วพูด · กระซิบ ASMR = ช้าเสมอ
    // แนว UGC = แม่ค้าขายของ: กล้องตั้งนิ่ง เห็นครึ่งตัว หน้านิ่ง พูดเชียร์ขาย สินค้าวางเต็มหน้า-หลัง (ผู้ใช้สั่ง) · ชุดชั้นใน/ชุดนอนเซ็กซี่ = สินค้าล้วนเหมือนเดิม
    const ugc = st.style === 'ugc' && !modestNow;
    const oneTake = ugc || st.scenes === '1';
    const tryout = st.style === 'tryout'; // 🙌 ลองใช้จริง: มือลองใช้จริง เล่าแบบเพื่อน ไม่ใช่แม่ค้า
    const seller = ugc || st.tone === 'seller' || !st.tone || st.tone === 'auto'; // พูดแนวแม่ค้าเชียร์ขาย (ผู้ใช้ขอ): แนว UGC · โทนแม่ค้า · โทนอัตโนมัติ // ฉากเดียวเทคเดียว: แนว UGC เสมอ · แนวอื่นเลือก “1 ซีน”
    // ปริมาณบท: ไม่กำหนดจำนวนประโยค (ผู้ใช้สั่ง) — ให้ค่อนข้างยาว เต็มเวลาพูด แต่ห้ามเกินคลิป (เคยสั่งยาวเฉยๆ แล้วพูดไม่จบ)
    const speakTime = outroOn() ? 'the first 10 seconds (no speech in the last 5)' : `the whole ${sec} seconds`; // 15 วิ + 5 วิสุดท้ายโชว์สินค้า = พูด 10 วิ
    // ความยาวบทที่ผู้ใช้บอกว่ากำลังดี (บทบราวนี่ 10 วิ = 3 ประโยคยาวปานกลาง ไม่เว้นวรรค พูดรัว) → ราว 3 ประโยคต่อเวลาพูด 10 วิ
    const spoken = sec - (outroOn() ? 5 : 0);
    const flowN = (talk === 'slow' ? ['two to three', 'four', 'four to six (two to three in each half)'] : ['three', 'five', 'six (three in each half)'])[spoken <= 10 ? 0 : spoken <= 15 ? 1 : 2];
    // 20 วิ สั่ง 6 ประโยค meta เขียนประโยคละ ~13 ได้แค่ 77 พยางค์ → เงียบท้ายคลิป ~4 วิ → เพิ่มเป็น 7 ประโยค + ให้นับพยางค์ก่อนตอบ
    // นับพยางค์ (ผู้ใช้ขอ): บทที่กำลังดี ≈ 49 พยางค์/10 วิ ประโยคละ ≈ 15–17 · บทที่ยาวเกิน ≈ 76 → กำหนดราว 15 พยางค์ต่อประโยค
    const sylTotal = (talk === 'slow' ? ['about 30', 'about 45', 'about 60'] : ['45–50', '65–70', '90–100'])[spoken <= 10 ? 0 : spoken <= 15 ? 1 : 2];
    // บทต่อท่อน (meta ทำทีละ 10 วิ): ท่อน 1 = เท่าบท 10 วิ · ท่อน 2 ตามความยาว (20 วิ = เท่าท่อน 1)
    const perTen = talk === 'slow' ? 'about 30' : '45–50';
    const part2Syl = sec - 10 >= 10 ? perTen : talk === 'slow' ? 'about 15' : 'about 22–25';
    const sylEach = talk === 'slow' ? 'about 12' : 'about 15';
    // ประโยคปิด (ผู้ใช้เลือก): สุ่ม 5 แนว คลิปละแนว ให้เข้ากับประเภทสินค้า · ไม่ใส่ประโยคไทยตัวอย่าง (meta ลอกไปพูดทุกคลิป)
    const closeStyles = 'in one of these styles, a different one each clip: a friend-style endorsement (you use it yourself and love it), an invitation to try it, a call-out to the kind of people it suits, worth stocking up on or buying for family, or a must-have to keep where it is used — always fitted to the product type (food and snacks: at home or for snacking; beauty: in the bag or daily routine; clothes and shoes: in the wardrobe, wearing it; gadgets: on the desk or in the car; pet items: for their pet; kitchen and home items: at home); no price, promo, discount or rushing words';
    const speech = said.length ? `Says in Thai, in order: ${said.map((x) => `"${x}"`).join(' / ')} — one smooth, flowing delivery`
      : `Speech: ${onCam ? (ugc ? 'the seller talks straight to camera' : 'the presenter talks partly to camera, partly over the product shots') : 'Thai voice-over'}${tryout ? ', like a real person trying it out for the first time and telling a friend' : seller ? ', like a top Thai online live-selling host pitching to viewers' : st.tone === 'hype' ? ', hyping it like a favorite find (real excitement, no exaggeration)' : ''} — you write it from the product info: ${tryout ? 'the first sentence opens with a quick hook said straight to viewers (just a few words — a must-try call-out, a question like whether they have tried it yet, or a surprised reaction; a different hook each clip, never a greeting); then it talks through actually trying it as the hands use it on screen — what is being done and how it works and feels in real use; then the standout features you can see on camera; the last one closes with a warm personal recommendation ' + closeStyles + ', and the speech stops right there; honest, natural everyday Thai like telling a friend — not like an ad, no hard selling, no exaggeration' : seller ? 'the first sentence opens with a quick hook said straight to viewers (just a few words — a must-try call-out, a question like whether they have tried it yet, or a surprised reaction; a different hook each clip, never a greeting) and runs right into one standout benefit, the last one closes with a warm personal recommendation ' + closeStyles + ', and the speech stops right there; present the product as a whole and how it feels to use — never list features or specs; everyday spoken Thai, punchy and heartfelt, no exaggeration' : 'a fresh angle for this product (not a generic review line), only a feature or two (no spec list), ending with a warm recommendation ' + closeStyles + ', simple everyday Thai'}, correct grammar; about ${flowN} short sentences for ${speakTime} — each ${sylEach} Thai syllables, ${sylTotal} syllables in total (count them before answering — if under, add another sentence; too short leaves silence at the end) — each one quick idea said in a single breath: no second clause, no piled-up describing words, no extra tag at the end, no spaces inside; said ${{ fast: 'rapid-fire', normal: 'at a lively pace', slow: 'calmly' }[talk] || 'rapid-fire'} and finishing right at the end, never running past it; one idea per sentence${seller || tryout ? '' : ', the most important point first'}; never say a brand or model name — call it by what it is; never say กดตะกร้า or tell viewers to tap or press anything; sentences linked with natural connecting words so it sounds like one unbroken pitch from start to end${sec > 10 && !outroOn() ? ' — one continuous script for the whole clip, spread evenly so the speech after 10 seconds is just as full as before it' : ''}; said non-stop with no pauses; avoid ending with a bare นะ or เลยนะ — but whenever a sentence uses เลย, say เลยนะทุกคน; never say sizes, weights or amounts${opts.post ? '; not the caption' : ''}`;
    const story = [
      `First frame: ${ugc && onCam ? 'the seller showing the product to camera — held up if small; a large item (furniture, shelf, appliance) is never held, it stands set up beside the seller, fully in frame' : tryout ? 'hands on the product close to camera, about to try it — a small item held, a heavy or bulky one left standing where it is' : 'product close-up'}${st.text !== 'none' ? ' + Thai text already on screen' : ''}`, // เฟรมแรก = ปกคลิป
      // ของชิ้นใหญ่ ห้ามถือ — ตั้งไว้ เห็นทั้งชิ้นชัดๆ สาธิตตรงที่ตั้ง (ผู้ใช้สั่ง)
      m === 'person' || m === 'auto' ? (ugc ? 'The product is clearly visible and fully in frame ' + (outroOn() ? 'while talking' : 'the whole time') + ' — a small item held up, turned and demonstrated; a large item never held, shown set up and used in place; the face clear and natural'
        : 'Product first: clearly visible most of the time (close-ups, in use), the person supports it — a large item is never held, it is shown set up, whole and clear; the face clear and natural when shown') : '', // เน้นสินค้ามากกว่าคน
      // ผู้ใช้สั่ง: แบบเห็นแต่มือ — สินค้าหนักไม่ยกขึ้นมา + มีสาธิตการใช้ (ให้ meta ดูจากรูป/ข้อมูลสินค้าเอง — ชื่อสินค้าหลอกได้ เช่น ลิ้นเตา/ตาดเตาเป็นชิ้นเล็ก)
      m === 'hands' && !modestNow ? 'Hands: a short real demonstration of how it is used (the main use from the product info), so viewers see it working — a small, light item can be held and turned; a heavy or bulky item (stove, shelf, furniture, appliance, big container) is never lifted, carried or held up: it stays set in place, whole in frame, and the hands use it right there' : '',
      modestNow ? 'Product only — on a hanger, folded flat lay and close-ups of the lace, straps and fabric; nobody wears it (no model, no mannequin)' : '', // ชุดชั้นใน/ชุดนอนเซ็กซี่ → สินค้าล้วน
      ugc ? `Camera: fixed on a tripod, never handheld — the same ${onCam ? 'medium-wide ' : ''}shot ${outroOn() ? 'for the whole talking part (0–10s)' : 'for the whole clip'}${onCam ? ' (the seller standing, seen from about mid-thigh up, with more of the table and stock room visible; wide enough to show a large item whole)' : ''}, one continuous take: no movement, zoom, pans or cuts` // UGC: กล้องนิ่งเทคเดียว · ยืนขาย มุมกว้างกว่าครึ่งตัว (ผู้ใช้ขอซูมออก)
        : tryout ? 'Visuals: a hands-on try-out from a first-person point of view — the hands really using the product step by step: first touch, trying it for real, then close-ups of the result and the standout details; filmed on a phone held by hand with slight natural movement, real moments — no staged ad shots, no glossy slow-motion' // 🙌 ลองใช้จริง
        : oneTake ? `Visuals: one continuous take${outroOn() ? ' until 10s' : ''}, no cuts — smooth camera moves around the product, a reveal or a real-life moment` // 1 ซีน
        : 'Visuals: creative and scroll-stopping — interesting angles, a reveal or a real-life moment that fits the product',
      speech,
      outroOn() ? `Last 5s (part 2, generated longer and then sped up to fit — see VIDEO) — product-only ending: no person at all (no face, hands or body), no speech, instrumental music only (a style that fits the product, no singing); 2–3 quick product shots that switch on the music beat (close-up, slow turn, detail, the product set in a clean setting that fits it), all real moving video — no still images; animated on-screen text: ${R.fx[st.fx] || R.fx.pop} — lots of spec and feature callouts: 4–6 short labels (2–4 words each) taken from the product info — spec numbers with units (capacity, size, power, number of programs or pieces) and named features or technologies are welcome, written exactly as in the product info and never invented; plain benefits in Thai; popping in one after another on the beat and staying on, placed around the product, never covering it` : '', // ผู้ใช้ขอ: 5 วิท้าย = เพลง + สินค้าล้วน สลับซีน + ตัวอักษรฟีเจอร์สินค้าเยอะๆ
    ];
    // ล็อก (หมวด RULES): สินค้า → หน้า → คน/มือ/สัตว์ (เกิน 10 วิ) → เสียง (ล็อกเสียงที่เดียว ครบทุกอย่าง)
    const locks = [
      '- Product lock: every product shown — held, in use, opened or stacked — is an exact copy of the product in the reference images: same shape, color, pattern, material, logo, printed text, parts and proportions. Never embellish or change it: no added parts, accessories, decorations, stickers, text or features that are not in the reference, nothing removed, never redesigned; never a look-alike, generic or other-color version; in use it keeps exactly the same design. Ignore what the shop added on the photo (banners, stickers, price or sale text, borders).', // ผู้ใช้สั่ง: เป๊ะ ห้ามแต่งเติม
      faceUsable() ? `- Face lock: the face stays identical to image 1 ${outroOn() ? 'throughout the talking part (0–10s); the last 5s have no person' : oneTake ? 'throughout the clip' : 'in every shot'} — same eyes, nose, mouth, face shape, skin tone and hair; natural, never morphing.` : '',
      // ผู้ใช้สั่ง: UGC หน้านิ่ง ไม่ยิ้ม — เสียงสั่งให้อิน/ตื่นเต้น ตัวสร้างวิดีโอเลยชอบทำหน้ายิ้มตาม → ย้ำเป็นกฎ (meta ทำตามกฎเคร่งกว่า)
      ugc && onCam ? `- Expression lock: a straight calm face ${outroOn() ? 'the whole time while talking' : 'for the whole clip'} — never smiling, grinning or laughing; all the emotion is in the voice only, the face stays neutral.` : '',
      m === 'hands' ? `- Hands lock: only ${sexMale() ? 'male' : 'female'} hands in frame (the same gender as the voice), never a face or head${sec > 10 && !outroOn() ? `; the same hands (skin tone, nails, sleeves) for all ${sec} seconds, also after the 10-second join` : ''}.`
        : sec <= 10 || m === 'none' || outroOn() ? ''
        : m === 'animal' ? `- Animal lock: the same animal (breed, colors, markings) for all ${sec} seconds, also after the 10-second join.`
        : `- Person lock: ${m === 'auto' && !faceUsable() ? 'whoever appears stays the same' : 'the same person'} for all ${sec} seconds (face, hair, body, outfit), also after the 10-second join.`,
      `- Voice lock: one voice for the whole clip${outroOn() ? ' (speech only in the first 10 seconds, none in part 2)' : sec > 10 ? ', part 2 included (the same voice description in both parts)' : ''} — same speaker, timbre, pitch, tone, emotion, loudness, energy and accent, and the same ${{ fast: 'fast', normal: 'relaxed', slow: 'slow' }[talk] || 'same'} speed and rhythm from the first word to the last${sec > 10 && !outroOn() ? ' (part 2 continues at exactly the same speed and rhythm)' : ''}; never change the voice, get louder or quieter, speed up, slow down or change the rhythm.`,
      // UGC: ล็อกกล้อง (ผู้ใช้สั่ง) — แนวอื่นสั่งตัดภาพ/ขยับกล้องอยู่ ไม่ใส่
      ugc ? `- Camera lock: tripod, never handheld — the camera never moves, same position, angle, height, framing and zoom ${outroOn() ? 'for the first 10 seconds; no cuts or new angles until the product-only ending' : `for the whole clip${sec > 10 ? ', part 2 included' : ''}; no cuts, no new angles`}.` : '',
      R.redo[(p0 || {}).redoWhy] ? `- ${R.redo[p0.redoWhy]}` : '', // ทำใหม่: จุดที่ต้องแก้
    ];
    const talkLine = { fast: 'talks fast like a live seller — short sentences back to back, no pauses, every word clear', normal: 'relaxed everyday pace', slow: 'slow and calm, short pauses between sentences' }[talk] || '';
    const man = sexMale(); // สินค้าผู้ชาย / รูปหน้าผู้ชาย → คน/มือ/เสียงพากย์ผู้ชาย
    const whoBase = R.who[m === 'auto' && faceUsable() ? 'person' : m];
    const sexed = (t, sx) => t.replace('Only realistic hands', `Only realistic ${sx} hands`).replace('Thai voice-over', `Thai ${sx} voice-over${/hands/.test(t) ? ` (the same ${sx} as the hands)` : ''}`); // มือกับเสียงเพศเดียวกัน
    const who = (man ? sexed(whoBase.replace('Real Thai person', 'Real Thai man (male presenter)'), 'male')
      : sexed(faceUsable() ? whoBase : whoBase.replace('Real Thai person', 'Real Thai woman (female presenter)'), 'female')) + (ugc && onCam ? `, ${st.view === 'full' ? 'full body' : 'framed from about mid-thigh up (a bit wider than waist-up)'}, a seller standing behind a table with the products, straight calm face the whole time while talking — no smiling or grinning`
      : st.view === 'full' && m === 'person' ? ', full body' : '')
      + (m === 'person' || m === 'auto' ? (m === 'auto' && !faceUsable() ? `; any person shown: ${looksLine()}` : `, ${looksLine()}`) : '') // หน้าตาดี ไม่โทรม
      // ชุดเข้าธีมสินค้า (ผู้ใช้สั่ง) · สินค้าเป็นเสื้อผ้า = ใส่สินค้านั้น (บอกในรูปอ้างอิงแล้ว)
      + ((m === 'person' || m === 'auto') && !items.some((p) => OUTFIT_RE.test(p.name)) ? '; outfit themed to match the product — a style and colors that fit it (e.g. an apron for kitchen items, sportswear for fitness gear, a cozy home look for home items); plain clothes — no logos, brand names or printed text on them' : '');
    // พูดไทยชัด (บอกที่เดียว) · ลื่นไม่หยุดตรงเว้นวรรค · แม่ค้า: เสียงแหลมสูง สดใส พูดไวแบบแม่ค้าไลฟ์ มีอินเนอร์ (ผู้ใช้สั่ง — ไม่ใส่ชื่อแอปใน prompt) · โทนอื่น: ตามที่เลือก
    const voice = ['Native Central Thai speech — every word pronounced correctly and completely (tones, final consonants, vowel lengths), natural grammar, no foreign accent, real Thai words only',
      st.tone === 'asmr' ? R.tone.asmr
        : seller ? `${man ? 'an upbeat, energetic male voice — bright and lively, clearly a man (never deep, slow or flat)' : 'a high, bright, energetic voice — clearly higher pitch than normal talk'}; delivered like a top Thai online live-selling host: ${{ fast: 'fast', normal: 'lively', slow: 'unhurried' }[talk] || 'fast'}, punchy and non-stop, full of real feeling — truly into it, warm, excited and heartfelt, like someone who really loves this product, strong emotion and emphasis in the voice, rising on the key words`
        : [talkLine, 'key words stressed', R.tone[st.tone] || R.tone.casual].filter(Boolean).join('; '),
      'smooth and flowing, never pausing at the spaces in Thai text',
      man ? 'a male voice that speaks as a man — polite ending ครับ, never ค่ะ or คะ' : faceUsable() ? '' : 'a female voice that speaks as a woman — polite ending ค่ะ, never ครับ', // เพศเสียงตรงกับมือ/คน (ไม่มีรูปหน้าให้ดู)
      faceUsable() ? 'voice fits the face photo\'s gender and age' : '', 'no laughing or giggling, clean voice'].filter(Boolean).join('; ');
    const custom = (st.osText || '').trim();
    const text = st.text === 'none' ? (outroOn() ? 'No on-screen text while talking; text only in the last 5s (see STORY)' : 'No on-screen text')
      : [R.fx[st.fx] || '', R.text[st.text] || '', custom ? `text: "${custom}"` : '', 'never covering product or face'].filter(Boolean).join(', ');
    const vfx = Array.isArray(st.vfx) && st.vfx.length ? st.vfx : ['auto'];
    const shots = +st.scenes;
    const edit = oneTake ? '' // เทคเดียว: บอกไว้ในบรรทัด Camera/Visuals แล้ว
      : tryout ? 'a few simple cuts between the steps (about 4–6 shots in total), no effects or transitions' // ลองใช้จริง: ตัดน้อย ไม่ใส่ลูกเล่น
      : [shots ? `${shots} shots, ~${(sec / shots).toFixed(1).replace(/\.0$/, '')}s each` : R.cuts[st.pace === 'normal' ? 'normal' : 'fast'],
        vfx.includes('none') ? R.vfx.none : vfx.includes('auto') ? R.vfx.auto : vfx.map((x) => R.vfx[x]).filter(Boolean).join(' + ')].filter(Boolean).join(', ');
    const music = st.music === 'kawaii' ? R.music.kawaii
      : outroOn() && (st.music === 'none' || st.pace === 'normal') ? 'No music while speaking; in the last 5s an instrumental background track fades in and plays to the end — you pick a music style that fits this product and its mood (no singing)' // 5 วิท้ายเงียบ = มีเพลงเสมอ
      : st.music === 'none' ? R.music.none : st.pace !== 'normal' ? R.music.fast : '';

    // แบ่งหมวดเหมือนเดิม · บรรทัดที่ 2 = Product: "…" (ใช้หาข้อความบนหน้า) · บรรทัดสุดท้าย = จุดจบของตัวอ่านคำปฏิเสธ
    return [
      section(sec > 10 ? `VIDEO — ${sec} SECONDS, ONE CLIP` : 'VIDEO', [
        `${CLIP_HEAD}${names}"${info ? ` — ${info}` : ''}`, // บรรทัดที่ 2 ของ prompt — ใช้หาข้อความบนหน้า (known.head)
        // 15/20 วิ: คลิปเดียว · meta.ai ทำท่อน 2 เอง → เริ่มจากเฟรมจริง 9.9 วิ + รูปอ้างอิงเดิม + ทุกอย่างเหมือนท่อน 1
        sec > 10 ? `${sec} seconds as ONE continuous clip in one file — never split it or stop to ask to continue` : '',
        sec > 10 ? `Continuity at 10 seconds: ${outroOn() ? '(1) make part 2 (the product-only ending) as newly generated moving video of the product, from the product image only — never give image 1 (the face) or any part 1 footage to part 2, and never mention the person in its prompt: part 2 has no person, face, hands or body; use the product reference image only to get the product right, never as a frame in the video; no snapshot, still photo, frozen frame or photo slideshow anywhere; the cut at 10s is a straight cut on the music beat; (2) make part 1 first, then part 2 — one at a time, never in parallel — and save each under its own filename (part1_talking, part2_product) so neither overwrites the other; (3) before joining, look at the frames: part 1 shows the talking person, part 2 has no person — if the part 2 file shows a person it is the wrong file (or redo part 2); (4) join the two parts into one file in code — part 2 comes out longer than 5 seconds: cut off its opening 1 second (its first frames can show the reference photo), then speed up ALL the rest of its footage to fit exactly 5 seconds — never just cut a 5-second piece out of it, every shot and every label must be in; for the sound, take its music from that same point for 5 seconds at normal speed (not sped up) with a short fade-out at the end; the final file is exactly 15 seconds and no photo ever flashes at the 10s cut. ' : '(1) take the frame at 9.9 seconds of part 1 as a snapshot; (2) make part 2 starting from that exact snapshot as its start image, with the same reference images; (3) keep the exact same scene, framing, light, person, outfit and product — no frame jump, cut or reset, the motion and speech just carry on; (4) join the two parts into one file. '}${outroOn() // 5 วิท้ายไม่พูด = เสียงอยู่ท่อน 1 อย่างเดียว
          ? 'Speech: only in part 1 — the whole script is said in part 1 and finishes just before 10 seconds; part 2 (10–15s) has no speech at all, music only, so there is just one voice. '
          : `Script: write the whole ${sec}-second script first as one continuous piece, then split it at a sentence break so each part is filled for its whole length — part 1 (0–10s) ${perTen} syllables, part 2 (10–${sec}s) ${part2Syl} syllables${sec - 10 >= 10 ? ' (within 2 syllables of part 1, never thinner) — both parts built the same way: the same number of sentences, each about the same length, so the talking speed and rhythm stay identical' : ''}; part 2 picks up with the next sentence (no new greeting, restart or repeated lines), same flow and energy; no silence at the join — part 1 keeps talking right up to the cut and part 2 starts talking immediately. Voice: first write one voice description (gender, age, pitch, tone, emotion, energy, loudness, speed, rhythm) and use that exact description for both parts; record the whole ${sec}-second speech once as one continuous audio track (one voice, one take) and lay it over both parts${onCam ? ', lip movement following it' : ''} — never generate a second voice for part 2; part 2 sounds like the same person in the same mood at the same speed and volume (no volume jump at 10s), never a new voice. `}Send back only the final joined ${sec}s file` : '',
        `Vertical 9:16 1080x1920, ${sec > 10 ? '' : `${sec} seconds, `}real photo${doodle ? ' + kawaii doodle overlay' : ''}${R.style[styleKey()] ? `, ${R.style[styleKey()]}` : ''}, sharp natural colors`,
        filesFor().length ? `Opening frames: a generated video can start on a reference photo shown as a still — before sending, check the first frames of every part and cut off in code any that show a reference photo (the face or product photo with its own background or outfit), so the clip opens on real moving video${onCam ? '; the person starts talking about half a second in, so the trim never cuts a word' : ''}` : '', // ผู้ใช้เห็นรูปต้นฉบับแวบตอนต้นคลิป
        st.style === 'minimal' || st.style === 'ugc' || tryout ? '' : R.theme, // มินิมอล / UGC / ลองใช้จริง = ไม่ใส่ธีมสีน่ารัก
        opts.photos ? `Deliver: 1 video${sec > 10 ? ` (${sec} seconds, one file)` : ''} + ${photoN()} photo${photoN() > 1 ? 's' : ''} (see PHOTOS)` : '',
      ]),
      section('REFERENCE IMAGES', refLines(false)),
      section('PRESENTER', [who + (outroOn() && m !== 'none' ? ' — only in part 1 (0–10s); the last 5 seconds show no person' : ''), voice]),
      section('SCENE', [`${sceneText() || (ugc ? R.ugcScene : tryout ? R.tryScene : R.autoScene)}, ${tryout ? R.natLight : R.bright}`, // ตั้งฉากเอง = ใช้ฉากนั้น
        oneTake ? `One single scene ${outroOn() ? 'while talking (0–10s)' : 'for the whole clip'} — never change location, background or set` : '']),
      section('STORY', [...story, edit ? `Editing: ${edit}` : '', music,
        outroOn() ? 'End on a product-only shot with the text, no pointing' : tryout ? 'End right on the last spoken line (no silent seconds after it), on a clear shot of the product — in the hands if small, a heavy item in place with the hands on it' : `End right on the last spoken line (no silent seconds after it), no pointing, no laugh or sound after the last word — just a calm ${ugc && onCam ? 'straight face, no smile' : 'smile'}`]),
      section('ON-SCREEN TEXT', [text]),
      opts.photos ? section('PHOTOS', ((p) => [p.size, p.text, p.look, p.shots, p.same])(photoSpec())) : '',
      // คอนเทนต์โพสต์ (.txt) — ห้ามเขียนคำว่า Facebook · แคปชันต้องไม่ถูกเอาไปพูด/ขึ้นในคลิป
      opts.post ? section('POST CAPTION — separate text reply, not part of the video', [
        'Also write a social post caption — NOT spoken and NOT shown in the video; different wording from the spoken lines',
        ...R.postAsk,
      ]) : '',
      section('RULES — MUST FOLLOW', [...locks,
        `- Thai only — speech and on-screen text (on-screen spec numbers, units and named features may stay exactly as written in the product info); ${said.length ? 'say the given lines exactly; ' : ''}Thai text spelled exactly right or left out.`,
        '- Every เลย in the speech is said as เลยนะทุกคน.', // ผู้ใช้สั่ง (กฎ = meta.ai ทำตามเคร่งกว่า)
        '- No price, discount, promotion, free shipping or urgency; no platform logos, shopping-app screens or review badges.',
        '- No children — no babies, kids or anyone who looks under 18.',
        '- No exaggerated or health claims; only facts from the product info.',
        sec > 10 ? `- One video only: all ${sec} seconds delivered as one clip, never two separate videos; ${outroOn() ? 'the last 5s are the product-only ending (moving video with music and text — no person, no speech, no still photos) — the same product as the reference images' : `part 2 continues from the 9.9s frame snapshot — seamless, no frame jump, reset, ${oneTake ? 'scene, ' : ''}person or product change`}` : '']), // บรรทัดสุดท้ายของ prompt (ตัวจับคำปฏิเสธใช้เป็นจุดจบ)
    ].filter(Boolean).join('\n\n');
  }
  // จุดสังเกตข้อความที่เราส่งบนหน้าแชต = บรรทัดที่ 2 แค่ `Product: "ชื่อ"` (ไม่รวมรายละเอียดท้ายบรรทัด ซึ่งอาจโดน markdown แปลงจนข้อความแตก)
  function headOf(prompt) {
    const line = prompt.split('\n')[1] || '';
    const end = line.indexOf('"', CLIP_HEAD.length);
    return line.slice(0, Math.min(60, end > 0 ? end + 1 : 60));
  }
  // หมวดของ prompt: [ชื่อหมวด] + บรรทัด (ไม่มีบรรทัดเลย = ไม่ใส่หมวดนี้)
  function section(title, lines) {
    const l = lines.filter(Boolean);
    return l.length ? [`[${title}]`, ...l].join('\n') : '';
  }

  // สเปกรูปโพสต์ 4 ภาพ (ปุ่ม "รูป Facebook") · สี่เหลี่ยมจัตุรัส 1080x1080 — ใช้ทั้งหมวด PHOTOS ใน prompt คลิป และ prompt รูปแยก
  // รูปที่ meta ทำ = จำนวนรูปในคอมเมนต์ Reel (ผู้ใช้เอาโพสต์รูป 4 ภาพออกแล้ว) · 0 = ไม่ทำรูป
  const photoN = () => Math.max(0, Math.min(4, +st.fbCmtPhotos || 0));
  const photosOn = () => photoN() > 0;
  function photoSpec() {
    const p = active()[0];
    const m = mode();
    const person = m === 'person' || m === 'auto';
    const doodle = st.text !== 'none' && st.fx === 'doodle';
    const wears = person && p && OUTFIT_RE.test(p.name);
    const scene = sceneText();
    return {
      // สไตล์เดียวกับคลิป (ภาพจริง/ดูเดิล + สไตล์ที่เลือก)
      size: `Square 1080x1080, ${photoN() || 1} separate photo${photoN() > 1 ? 's' : ''} (images, not video), real photo${doodle ? ' + kawaii doodle overlay style' : ''}${R.style[styleKey()] ? `, ${R.style[styleKey()]}` : ''}`,
      // ตัวหนังสือไทยแบบเดียวกับในคลิป · หัวข้อสั้นกระชับ เข้ากับแต่ละภาพ (ไม่กำหนดจำนวนคำ)
      // ผู้ใช้ขอตัวหนังสือบอกฟีเจอร์เยอะขึ้น (เดิมแค่หัวข้อสั้น 1 บรรทัด) — เอาจากข้อมูลสินค้าเท่านั้น ไม่มีราคา/โปร
      text: `Thai text on each photo: a short punchy headline + 2–4 short feature callouts (small arrows, lines or icons pointing at the part they describe) — what it does, material, how to use, what stands out — only from the product info, no prices or promotions; ${R.photoText[st.fx] || R.photoText[doodle ? 'doodle' : 'other']}, never covering the product`,
      theme: st.style === 'minimal' || st.style === 'ugc' || st.style === 'tryout' ? '' : R.theme,
      // ตั้งฉากไว้ (เช่นแนวสินค้าในห้อง) = รูปฉากเดียวกับคลิป · ไม่ตั้ง = meta.ai เลือกโลเคชั่นเอง (แต่ละภาพต่างกันได้)
      look: `Real photo, ${scene ? `same setting as the video: ${scene}` : 'location of your choice that fits the product (can differ per photo)'}, ${R.bright}${person && st.view === 'full' ? ', full body posing' : ''}`,
      shots: ((list) => { const n = Math.max(1, photoN()); return `${n} shot${n > 1 ? 's' : ''}${n > 1 ? ', each a different composition' : ''}: ${list.slice(0, n).map((x, i) => `(${i + 1}) ${x}`).join(' · ')}`; })(modestNow
        ? ['on a hanger against a clean wall, the whole piece visible', 'folded flat lay from above with a few soft matching props', 'close-up of the lace, straps and fabric texture', 'styled in a bright bedroom, laid out neatly — nobody wears it']
        : ['hero shot — the product alone, centered and sharp on a clean surface that suits it, soft natural shadow', person ? `a real person (${looksLine(true)}) ${wears ? 'wearing it, natural pose that shows the fit and how it looks' : 'using it in a natural everyday moment, product clearly in focus'}` : m === 'hands' ? 'hands using it in a real everyday moment, product clearly in focus' : 'the product set up where it is used, ready to use — no people', 'detail close-up — texture, material, label or the key feature filling the frame', 'lifestyle — the product in the real place it is used, styled with a few matching props']),
      // ผู้ใช้ขอบรรยายรูปเยอะขึ้น (เดิม 4 คำสั้น: product alone · person using it · detail close-up · lifestyle)
      // ล็อกแค่หน้า ชุดเปลี่ยนได้ — ยกเว้นสินค้าเป็นเสื้อผ้า (ชุดคือสินค้า) · ไม่มีรูปหน้า = ไม่พูดถึงหน้า
      same: wears ? `Same ${faceUsable() ? 'face and ' : ''}product outfit as the references (the person wears it)`
        : faceUsable() ? 'Same face and product as the references; outfit can vary' : 'Same product as the references',
    };
  }
  // prompt รูปแยก (แบบบรรทัดเรียบที่ใช้ได้ดี — คงไว้) · ใช้สำรองเมื่อสั่งรวมกับคลิปแล้ว meta.ai ไม่ได้ทำรูปมาด้วย
  function buildPhotoPrompt() {
    const p = active()[0];
    const s = photoSpec();
    return [
      s.size,
      `${CLIP_HEAD}${promptName(p && p.name) || 'the product'}"`, // บรรทัดที่ 2 — ใช้หาข้อความบนหน้า
      s.text,
      s.theme,
      ...refLines(true),
      s.look,
      s.shots,
      R.rulesShort,
    ].filter(Boolean).join('\n');
  }

  // ---------- หาช่องพิมพ์ + ใส่ข้อความ ----------
  const isOurs = (x) => x === host || host.contains(x);
  function visible(x) {
    const r = x.getBoundingClientRect();
    const cs = getComputedStyle(x);
    return r.width > 50 && r.height > 10 && cs.visibility !== 'hidden' && cs.display !== 'none';
  }
  function findInput() {
    const c = [...document.querySelectorAll(
      'textarea, [contenteditable="true"][role="textbox"], div[contenteditable="true"], [contenteditable="plaintext-only"]')]
      .filter((x) => !isOurs(x) && visible(x));
    return c.sort((a, b) => b.getBoundingClientRect().bottom - a.getBoundingClientRect().bottom)[0] || null;
  }
  // ช่องพิมพ์แบบ Lexical (meta.ai) อัปเดตหน้าจอช้ากว่าเหตุการณ์เล็กน้อย จึงรอแล้วค่อยเช็ก
  const boxText = (b) => (b.tagName === 'TEXTAREA' || b.tagName === 'INPUT' ? b.value : b.innerText || '').replace(/\s+/g, ' ').trim();
  async function landed(box, text, ms = 1500) {
    const head = text.replace(/\s+/g, ' ').trim().slice(0, 25);
    for (let t = 0; t < ms; t += 150) {
      const b = box.isConnected ? box : findInput();
      if (b && boxText(b).includes(head)) return true;
      await sleep(150);
    }
    return false;
  }
  // ช่องพิมพ์มีรูป/ข้อความของเราที่ยังไม่ได้ส่ง (พลาดก่อนส่ง → ต้องล้างก่อนสินค้าตัวถัดไป ไม่งั้นรูปสินค้า 2 ตัวไปปนกันในข้อความเดียว) · sends = จำนวนข้อความที่ส่งได้จริง
  let composerDirty = false, sends = 0;
  async function insertInto(box, text) {
    composerDirty = true;
    box.focus();
    if (box.tagName === 'TEXTAREA' || box.tagName === 'INPUT') {
      const proto = box.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, 'value').set.call(box, text);
      box.dispatchEvent(new Event('input', { bubbles: true }));
      box.dispatchEvent(new Event('change', { bubbles: true }));
      return landed(box, text);
    }
    const selectAll = () => {
      const sel = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(box);
      sel.removeAllRanges();
      sel.addRange(range);
    };
    selectAll();
    const dt = new DataTransfer();
    dt.setData('text/plain', text);
    box.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
    if (await landed(box, text)) return true;
    box.focus();
    selectAll();
    document.execCommand('insertText', false, text);
    return landed(box, text);
  }

  // ---------- แนบรูป ----------
  function dataUrlToFile({ name, type, dataUrl }) {
    const bin = atob(dataUrl.split(',')[1]);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new File([arr], name, { type });
  }
  function findFileInput() {
    const all = [...document.querySelectorAll('input[type=file]')].filter((i) => !isOurs(i));
    return all.find((i) => /image/.test(i.accept || '')) || all[0] || null;
  }
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  async function attachFiles(files) {
    if (!files.length) return { ok: true };
    composerDirty = true;
    let input = findFileInput();
    if (input) {
      if (input.multiple) {
        const dt = new DataTransfer();
        files.forEach((f) => dt.items.add(f));
        input.files = dt.files;
        input.dispatchEvent(new Event('change', { bubbles: true }));
      } else {
        for (const f of files) {
          input = findFileInput();
          if (!input) break;
          const dt = new DataTransfer();
          dt.items.add(f);
          input.files = dt.files;
          input.dispatchEvent(new Event('change', { bubbles: true }));
          await sleep(900);
        }
      }
      return { ok: true };
    }
    const target = findInput();
    if (!target) return { ok: false };
    const dt = new DataTransfer();
    files.forEach((f) => dt.items.add(f));
    for (const t of ['dragenter', 'dragover', 'drop']) target.dispatchEvent(new DragEvent(t, { dataTransfer: dt, bubbles: true, cancelable: true }));
    return { ok: true };
  }
  function shrink(source, w, h, name) {
    const k = Math.min(1, 1536 / Math.max(w, h));
    const c = document.createElement('canvas');
    c.width = Math.round(w * k);
    c.height = Math.round(h * k);
    c.getContext('2d').drawImage(source, 0, 0, c.width, c.height);
    return { name, type: 'image/jpeg', dataUrl: c.toDataURL('image/jpeg', 0.9) }; // อาจ throw SecurityError
  }
  function loadImage(file) {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onerror = reject;
      fr.onload = () => {
        const img = new Image();
        img.onerror = reject;
        img.onload = () => resolve(shrink(img, img.width, img.height, `${file.name.replace(/\.\w+$/, '') || 'image'}.jpg`));
        img.src = fr.result;
      };
      fr.readAsDataURL(file);
    });
  }

  // ---------- Gemini เขียนบทพูดไทยทีละสินค้า ----------
  const FALLBACK_MODELS = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-flash-latest', 'gemini-flash-lite-latest'];
  let gemini = { key: '', model: '', lastGood: '' }; // model ว่าง = เลือกอัตโนมัติ · lastGood = รุ่นล่าสุดที่ตอบได้
  // ความยาวบทต่อวินาทีของแต่ละช่วง (ตัวอักษรไทย) · ปรับลดจาก v0.14 (15 วิ ยาวเกิน)
  const SCRIPT_RATE = { fast: [7, 8.5], normal: [5, 6.5] }; // ตัวอักษรไทย/วินาที (v0.16 สั้นลงอีก)
  const scriptFast = () => st.pace !== 'normal' && st.tone !== 'asmr';
  const scriptKey = () => `${seconds()}|${scriptFast() ? 'fast' : 'normal'}|v2${outroOn() ? '|outro' : ''}`; // โชว์สินค้าท้าย = บท 3 บรรทัด
  // บทที่ต้องเขียน (ใหม่): ยังไม่มีบท หรือบทที่ Gemini เขียนไว้สำหรับความยาว/จังหวะอื่น (บทที่แก้เองไม่ทับ)
  const needsScript = (p) => !(p.script || '').trim() || (p.scriptBy !== 'user' && p.scriptFor !== scriptKey());
  // บทที่ใช้จริง: พิมพ์เอง หรือบท Gemini ที่ตรงกับความยาว/จังหวะนี้ · ว่าง = ให้ meta.ai คิดบทเอง
  const scriptOf = (p) => (p && p.scriptBy === 'user' && (p.script || '').trim() ? p.script : ''); // บทที่พิมพ์เองเท่านั้น (บทที่ Gemini เคยเขียนไม่ใช้แล้ว)
  // หมุนแบบเปิดคลิป (hook) ทีละสินค้า กันขึ้นต้นเหมือนกันทุกตัว
  const HOOKS = [
    'a direct question to the viewer about a small everyday problem this product solves',
    'POV style — put the viewer straight into a relatable everyday moment', // ไม่ขึ้นต้น "POV:" (ขัดกับกฎห้ามคำอังกฤษ)
    'a relatable complaint or pain point, then the product as the fix',
    'a friend-to-friend recommendation ("บอกต่อ" style) naming who it is perfect for',
    'start by describing the moment of using it — what you see, hear or feel',
    'a quick comparison with the usual old way of doing it',
    'start straight with the most interesting visible detail of the product',
    'a casual first-time reaction in your own words, then what surprised you',
  ];
  let hookIdx = 0;
  // แบบเปิดคลิปเมื่อให้ meta.ai คิดบท: ผูกกับสินค้า (คัดลอก prompt ซ้ำได้แบบเดิม · คนละสินค้าได้คนละแบบ)
  const hookFor = (p) => HOOKS[[...((p && p.id) || '')].reduce((a, c) => a + c.charCodeAt(0), 0) % HOOKS.length];
  // คำอุทานขึ้นต้น (Gemini ชอบเปิดด้วย "เฮ้ย") → ห้าม / ตัดทิ้ง
  const INTERJ = /^\s*(เฮ้ย|เห้ย|เฮ้|เห้|เฮ้ยย+|โอ้โห|โห+|ว้าว+|อุ๊ย|อุ้ย|เอ้า|เออ|อ้าว|อะ|นี่|แก)(?=[\s!?,.…~ๆ]|$)[\s!?,.…~ๆ]*/;
  const startsInterj = (script) => INTERJ.test((script || '').split('\n')[0]);
  const stripInterj = (script) => { const L = script.split('\n'); L[0] = L[0].replace(INTERJ, '').trim() || L[0]; return L.join('\n'); };
  const firstWords = (script) => (script || '').split('\n')[0].replace(/\s+/g, ' ').trim().slice(0, 14);
  const TONE_TH = { seller: 'แม่ค้าเชียร์ขาย มั่นใจ ชวนซื้อ', bright: 'สดใส ร่าเริง', soft: 'นุ่มนวล อบอุ่น', excited: 'ตื่นเต้น มีพลัง (แต่ไม่พูดเกินจริง)', casual: 'เป็นกันเอง เหมือนคุยกับเพื่อน', hype: 'อินจริง ตื่นเต้น ชวนให้อยากได้ตาม เหมือนบอกต่อของโปรดให้เพื่อน (แต่ไม่พูดเกินจริง)', pro: 'ชัดเจน น่าเชื่อถือ แบบผู้รู้', asmr: 'กระซิบ ช้าๆ ผ่อนคลาย' };
  function scriptRequest(p, violations, hook, recent) {
    const m = mode();
    const sec = seconds();
    const fast = scriptFast();
    const segs = spokenSegs();
    const rate = SCRIPT_RATE[fast ? 'fast' : 'normal'];
    const segSpec = segs.map((g, i) => {
      const d = g.t[1] - g.t[0];
      return `${i + 1}) ${g.t[0]}–${g.t[1]}s (${g.what.split(' — ')[0]}): ${Math.round(d * rate[0])}–${Math.round(d * rate[1])} Thai characters`; // คำสั่งภาพ (หลัง —) ไม่ต้องบอกคนเขียนบท
    });
    const L = [
      'You write a short spoken Thai script for a Shopee Video product clip.',
      `Product: "${promptName(p.name) || 'unknown'}"`,
      (p.desc || '').trim() ? `Shop page details (may contain sales talk — never repeat prices or promotions): "${p.desc.trim().slice(0, 600)}"` : '',
      p.images.length ? 'The attached images show the product.' : '',
      `The ${sec}-second clip has ${segs.length} ${outroOn() ? 'spoken segments (the last 5s are product-only with music — no speech)' : 'segments'}. Write one complete Thai line per segment (never split a sentence across segments), at about these lengths — never longer:`,
      ...segSpec,
      sec > 10 && !outroOn() ? 'Hard cut at 10s: segment 3 must finish the thought; segment 4 starts fresh.' : '',
      outroOn() ? 'Segment 3 is the last spoken line — make it a natural, complete ending.' : '',
      `Speaker: ${m === 'person' || m === 'auto' ? 'a real person talking to the camera' : 'a voice-over (not on screen)'}. Tone: ${TONE_TH[st.tone] || TONE_TH.casual}.`,
      'Language: everyday spoken Thai, the way Thai people really talk to a close friend — natural words (จริงๆ, แบบ, มาก), short loose phrasing, talking to the viewer directly. Nothing formal, written or ad-like. Vary sentence endings — นะ / เลยนะ at most once in the whole script.',
      'Use เรา for I/we; never ผม, ดิฉัน, ครับ, ค่ะ or คะ (the voice may be male or female).',
      'Spell every word correctly (vowels, tone marks); use common words that are easy to pronounce — no slang spellings a voice could misread.',
      fast ? 'Delivery: fast, punchy and energetic like a viral TikTok/Shopee review — short phrases, no padding, keep talking to the end.' : 'Delivery: relaxed and natural.',
      `Opening line style: ${hook.style}, specific to this product. The first word must be about the product or the viewer's situation — never an interjection or filler (เฮ้ย, เห้ย, เฮ้, โห, โอ้โห, ว้าว, อุ๊ย, เอ้า, เออ, อะ, นี่, แก).`,
      recent.length ? `Other clips in this batch open like this — start differently, with different words: ${recent.map((x) => `"${x}"`).join(', ')}` : '',
      'Content: what it is, what stands out, how it is used in real life — only what the name, details and images show; do not invent specs. Be creative: a fresh angle for this product, not generic review phrases.',
      'Hard rules (script and caption):',
      '- No price, baht, discount, promotion, sale, coupon, code, freebies, free shipping, percentages, "today only" or urgency (รีบ...).',
      '- No exaggerated claims (ที่สุด, อันดับ 1, เบอร์ 1, 100%, การันตี, รับประกัน, เห็นผล, ปาฏิหาริย์) and no health or body claims (ลดน้ำหนัก, ผอม, บำรุง, ดีต่อสุขภาพ, รักษา, ภูมิคุ้มกัน).',
      '- Never mention children or babies (เด็ก, ลูกน้อย, ทารก).',
      '- No fake experiences or claims of long-term use (e.g. "ใช้มา 3 เดือน").',
      '- Script: Thai only — no English words, emoji or hashtags.',
      violations && violations.length ? `Fix these problems from your previous attempt: ${violations.join('; ')}.` : '',
      'Also write a post caption: 2–3 short casual Thai lines like excitedly recommending a favorite find to a close friend so they want one too (real excitement, no exaggeration, not like an ad; avoid ending with นะ / เลยนะ), plus 3–5 relevant hashtags (Thai or English, no promo words).',
      `Return JSON only: {"segments": ["<line 1>", ..., "<line ${segs.length}>"], "caption": "<Thai caption>", "hashtags": ["#...", "#..."]} with exactly ${segs.length} segment lines.`,
    ];
    return L.filter(Boolean).join('\n');
  }
  // กัน rate limit: โควตาฟรีคิดแยกตามรุ่น → รุ่นเดียวกันเว้น ≥ 6.5 วิ (~9 ครั้ง/นาที) · ทุกคำขอเว้น ≥ 1 วิ
  const GEMINI_GAP = 6500;
  const modelNext = {};
  let geminiNext = 0;
  async function askGeminiOnce(model, prompt, images) {
    bump('gemini');
    const now = Date.now();
    const at = Math.max(now, geminiNext, modelNext[model] || 0);
    geminiNext = at + 1000;
    modelNext[model] = at + GEMINI_GAP;
    if (at > now) await sleep(at - now);
    return new Promise((res, rej) => {
      try {
        chrome.runtime.sendMessage({ type: 'gemini', key: gemini.key, model, prompt, images, base: gemini.base },
          (r) => (r && r.ok ? res(r.text) : rej(new Error((r && r.error) || (chrome.runtime.lastError && chrome.runtime.lastError.message) || 'Gemini ไม่ตอบ'))));
      } catch (e) { rej(e); }
    });
  }
  const note = (t) => (run.on ? log(t, 'warn') : msg(t, ''));
  // Gemini ฟรีมักเจอ 503 (เซิร์ฟเวอร์แน่น) / 429 (โควตา) → รอแล้วลองใหม่ ถ้ายังไม่ได้เปลี่ยนรุ่น
  function listGeminiModels() {
    return new Promise((res, rej) => {
      try {
        chrome.runtime.sendMessage({ type: 'geminiModels', key: gemini.key, base: gemini.base },
          (r) => (r && r.ok ? res(r.models) : rej(new Error((r && r.error) || 'ดึงรายชื่อรุ่นไม่ได้'))));
      } catch (e) { rej(e); }
    });
  }
  const errCode = (e) => +(String(e && e.message).match(/^(\d{3})/) || [])[1] || 0;
  const keyError = (e) => [401, 403].includes(errCode(e)) || (errCode(e) === 400 && /API_KEY|API key/i.test(e.message));
  // รุ่นที่ key นี้ใช้ได้จริง (ถามจาก Google): เลือกตัวแทนรุ่นละ 1 ตัว (ปกติ + lite) กระจายหลายเวอร์ชัน
  // เพราะรุ่นใหม่สุดมักคนใช้เยอะ (503) · ถามไม่ได้ใช้รายการสำรอง
  let modelCache = null;
  function pickModels(names) {
    const reps = new Map();
    for (const n of names) {
      if (!/flash/.test(n) || /-latest$|image|tts|audio|live|embed|vision|thinking|computer|robotics|native/.test(n)) continue;
      const v = +((n.match(/gemini-(\d+(?:\.\d+)?)/) || [])[1] || 0);
      const lite = /lite/.test(n) ? 1 : 0;
      const score = (/preview|exp/.test(n) ? 100 : 0) + n.length; // เสถียร + ชื่อสั้นสุด (ตัวหลัก)
      const k = `${v}|${lite}`;
      if (!reps.has(k) || score < reps.get(k).score) reps.set(k, { n, v, lite, score });
    }
    return [...reps.values()].sort((a, b) => b.v - a.v || a.lite - b.lite).map((x) => x.n).slice(0, 12);
  }
  async function modelCandidates() {
    if (!modelCache) {
      try { modelCache = pickModels(await listGeminiModels()); } catch (e) {
        if (keyError(e)) throw new Error(`API key ใช้ไม่ได้ (${e.message})`);
        modelCache = [];
      }
    }
    return [...new Set([gemini.model, gemini.lastGood, ...(modelCache.length ? modelCache : FALLBACK_MODELS)].filter(Boolean))];
  }
  function rememberModel(model) {
    if (gemini.lastGood === model) return;
    gemini.lastGood = model;
    store.set({ mahGemini: gemini });
  }
  // เจอ 503/500/429 → ลองรุ่นถัดไปทันที ครบทุกรุ่นแล้วพักแล้ววนใหม่ (3 รอบ) · ได้แล้วจำรุ่นนั้นไว้ใช้ก่อนครั้งหน้า
  async function askGemini(prompt, images) {
    let models = await modelCandidates();
    let last = null;
    const busy = [];
    for (let round = 0; round < 3 && models.length; round++) {
      for (const model of [...models]) {
        try {
          const text = await askGeminiOnce(model, prompt, images);
          if (busy.length) note(`Gemini ${[...new Set(busy)].join(', ')} คนใช้เยอะ → ใช้ ${model} แทน`);
          rememberModel(model);
          return text;
        } catch (e) {
          last = e;
          if (keyError(e)) throw new Error(`API key ใช้ไม่ได้ (${e.message})`);
          if ([400, 404].includes(errCode(e))) { models = models.filter((x) => x !== model); continue; } // ไม่มีรุ่นนี้
          busy.push(model);
        }
      }
      if (round < 2 && models.length) { note(`Gemini ทุกรุ่นไม่ว่าง (${last && last.message}) รอ ${(round + 1) * 15} วิ แล้ววนใหม่`); await nap((round + 1) * 15000); }
    }
    throw last || new Error('ไม่มีรุ่น Gemini ที่ใช้ได้');
  }
  // ปุ่มทดสอบ: key ใช้ได้ไหม + ไล่รุ่นจนเจอตัวที่ตอบ (ข้อความสั้น ไม่มีรูป)
  async function testGemini() {
    const out = $('gTest');
    const line = (t, cls) => { out.append(el('div', cls || '', t)); };
    out.replaceChildren();
    if (!gemini.key) { line('ยังไม่ได้ใส่ key', 'warn'); return; }
    modelCache = null;
    try {
      const all = await listGeminiModels();
      line(`✓ key ใช้ได้ — บัญชีนี้มี ${all.length} รุ่น`, 'okline');
    } catch (e) { line(`✗ ${keyError(e) ? 'key ใช้ไม่ได้' : 'ถามรายชื่อรุ่นไม่ได้'}: ${e.message}`, 'warn'); if (keyError(e)) return; }
    for (const model of await modelCandidates()) {
      const t0 = Date.now();
      try {
        await askGeminiOnce(model, 'Reply with JSON only: {"script": "ok"}', []);
        rememberModel(model);
        line(`✓ ${model} ตอบแล้ว (${((Date.now() - t0) / 1000).toFixed(1)} วิ) → จะใช้รุ่นนี้ก่อน`, 'okline');
        return;
      } catch (e) {
        line(`✗ ${model}: ${errCode(e) === 503 ? '503 คนใช้เยอะ' : e.message}`, 'warn');
        if (keyError(e)) return;
      }
    }
    line('ยังไม่มีรุ่นไหนว่าง ลองใหม่อีกสักพัก', 'warn');
  }
  // คำตอบ Gemini → { script (1 บรรทัด/ช่วง), caption, tags }
  function parseScript(text) {
    let j = null;
    try { j = JSON.parse(text.replace(/^```(json)?|```$/g, '').trim()); } catch (e) {}
    const caption = j && typeof j.caption === 'string' ? j.caption.replace(/\s+/g, ' ').trim() : '';
    const tags = j && Array.isArray(j.hashtags) ? j.hashtags.map((t) => `#${String(t).replace(/^#+|\s+/g, '')}`).filter((t) => t.length > 1).slice(0, 6) : [];
    if (j && Array.isArray(j.segments)) return { script: j.segments.map((x) => String(x).replace(/\s*\n\s*/g, ' ').trim()).filter(Boolean).join('\n'), caption, tags };
    if (j && j.script) return { script: String(j.script).trim(), caption, tags };
    return { script: text.replace(/^[\s"'`{]+|[\s"'`}]+$/g, '').replace(/^script"?\s*:\s*"?/i, '').trim(), caption: '', tags: [] };
  }

  // เขียนบท → ตรวจคำต้องห้าม → ถ้าผิดให้เขียนใหม่ (สูงสุด 3 รอบ)
  async function writeScript(p) {
    if (!gemini.key) throw new Error('ยังไม่ได้ใส่ Gemini API key (แท็บ 📘 → 🧩 โพสต์คั่น)');
    const images = p.images.slice(0, 2).map((i) => i.dataUrl);
    let bad = null, script = '';
    const want = spokenSegs().length;
    const hook = { style: HOOKS[hookIdx++ % HOOKS.length] };
    try { chrome.storage.local.set({ mahHookIdx: hookIdx }); } catch (e) {}
    // ประโยคเปิดของบทอื่นในคิว (ล่าสุด 8 ตัว) — ห้ามซ้ำ
    const recent = [...new Set(products.filter((x) => x !== p && (x.script || '').trim()).slice(-8).map((x) => firstWords(x.script)).filter(Boolean))];
    const same = (sc) => { const f = firstWords(sc).slice(0, 6); return f.length >= 3 && recent.some((x) => x.startsWith(f)); };
    for (let t = 0; t < 3; t++) {
      const r = parseScript(await askGemini(scriptRequest(p, bad, hook, recent), images));
      script = r.script;
      const interj = startsInterj(script);
      if (interj && t === 2) script = stripInterj(script); // รอบสุดท้าย: ตัดคำอุทานออกเอง
      const banned = checkText(script);
      const got = script.split('\n').filter((x) => x.trim()).length;
      const dup = same(script);
      // จำนวนบรรทัดไม่ตรง / ขึ้นต้นซ้ำตัวอื่น → ขอใหม่ (รอบสุดท้ายยอมรับ)
      if (script && !banned.length && ((got === want && !dup && !interj) || t === 2)) {
        // แคปชัน/แฮชแท็กที่มีคำต้องห้าม → ทิ้ง (ไม่ทำให้บทพัง)
        Object.assign(p, { script, scriptBy: 'ai', scriptFor: scriptKey(), scriptError: '',
          caption: checkText(r.caption).length ? '' : r.caption, tags: r.tags.filter((t) => !checkText(t).length) });
        save();
        return script;
      }
      bad = [...banned, ...(got !== want ? [`return exactly ${want} lines (you returned ${got})`] : []), ...(dup ? [`the first line starts like another clip ("${firstWords(script)}") — open differently`] : []), ...(interj ? ['the first line starts with an interjection — start directly with the product or the viewer\'s situation'] : [])];
    }
    const why = script ? `บทที่ได้ยังมีคำต้องห้ามหลังลอง 3 รอบ (${(bad || []).join(' · ')})` : 'Gemini ตอบกลับมาว่าง';
    // เก็บบทล่าสุดไว้เป็นร่าง ให้แก้คำเดียวแล้วใช้ได้ (scriptFor ว่าง = ตอนรันจะให้ Gemini ลองเขียนใหม่ ถ้าไม่ได้แก้เอง)
    if (script) Object.assign(p, { script, scriptBy: 'ai', scriptFor: '' });
    p.scriptError = why;
    save();
    throw new Error(why);
  }

  // เขียนบทให้ทุกตัวที่ยังไม่มีบท ทีละตัว (เว้นระยะกัน rate limit) · กดซ้ำ = หยุด
  const writer = { on: false, stop: false, done: 0, total: 0 };
  async function writeAll() {
    if (writer.on) { writer.stop = true; renderQbar(); return; }
    if (!gemini.key) { msg('ใส่ Gemini API key ก่อน (แท็บ 📘 → 🧩 โพสต์คั่น)', 'err'); return; }
    const list = todo().filter(needsScript);
    if (!list.length) { msg('ทุกตัวมีบทที่ตรงกับคลิปแล้ว', 'ok'); return; }
    Object.assign(writer, { on: true, stop: false, done: 0, total: list.length });
    let fail = 0;
    const failed = [];
    renderQbar();
    for (const p of list) {
      if (writer.stop) break;
      msg(`✍ กำลังเขียนบท ${writer.done + 1}/${writer.total}: ${p.name.slice(0, 30)}`, '');
      try { await writeScript(p); } catch (e) {
        fail++;
        p.scriptError = String(e.message || e); // โชว์ค้างไว้ที่การ์ดสินค้า
        failed.push(`“${p.name.slice(0, 25)}”: ${p.scriptError}`);
        save();
        if (/API key/.test(e.message)) break;
        await sleep(1500);
      }
      writer.done++;
      renderProducts(); renderQbar();
    }
    const stopped = writer.stop;
    writer.on = false;
    renderAll();
    msg(`${stopped ? 'หยุดแล้ว · ' : ''}เขียนบทเสร็จ ${writer.done - fail}/${writer.total}${fail ? ` — ไม่ได้ ${fail} ตัว: ${failed.join(' · ')} (ดูที่การ์ดสินค้า)` : ''}`, fail ? 'err' : 'ok');
  }

  // ---------- สถิติวันนี้ ----------
  const today = () => new Date().toLocaleDateString('sv-SE'); // YYYY-MM-DD ตามเวลาเครื่อง
  let stats = { day: '', ok: 0, fail: 0, clips: 0, gemini: 0 };
  function bump(k, n = 1) {
    if (stats.day !== today()) stats = { day: today(), ok: 0, fail: 0, clips: 0, gemini: 0 };
    stats[k] += n;
    try { chrome.storage.local.set({ mahStats: stats }); } catch (e) {}
    if (typeof renderQbar === 'function' && root.getElementById('qbar')) renderQbar();
  }

  // ---------- รันคิวอัตโนมัติ: ใส่ prompt → กดส่ง → รอคลิป → ดาวน์โหลด ----------
  // หมายเหตุ: ตัวเลือกปุ่ม/วิดีโอเดาจากหน้าเว็บทั่วไป ต้องปรับตามหน้า meta.ai จริง
  // ปุ่มส่ง: ชื่อชัด (Send/ส่ง) มาก่อน · Create/Generate/สร้าง ใช้เมื่อไม่มีปุ่ม Send เลย
  const SEND_RE = /send|submit|generate|create|animate|ส่ง|สร้าง/i;
  const SEND_STRONG = /(^|\s)(send|submit|ส่ง)(\s|$)|send message|ส่งข้อความ/i;
  const NOT_SEND_RE = /stop|cancel|ยกเลิก|หยุด|attach|แนบ|upload|อัปโหลด|voice|mic|เสียง|menu|เมนู|more|share|แชร์|download|ดาวน์โหลด|\badd\b|เพิ่ม|photo|image|รูป|ภาพ|media|file|ไฟล์|camera|กล้อง|gallery|emoji|setting|ตั้งค่า|\bmode\b|โหมด|model|aspect|ratio|style|สไตล์|tool|เครื่องมือ|search|ค้นหา|copy|คัดลอก|edit|แก้ไข|new chat|แชทใหม่|dismiss|close|ปิด|error|retry|remove|ลบ|delete|clear|ล้าง|expand|ขยาย|collapse|dictat|audio|record|อัดเสียง|feedback|regenerat|สร้างใหม่|\b(dis)?like\b|thumb/i; // dismiss = ปุ่ม X ของแถบ error · remove/ลบ = ✕ ของรูปที่แนบ
  // ปุ่มที่เปิดหน้าต่างเลือกไฟล์/เมนู → ไม่ใช่ปุ่มส่งแน่นอน
  const opensPicker = (b) => !!(b.querySelector('input[type=file]') || (b.closest('label') && b.closest('label').querySelector('input[type=file]')) || b.getAttribute('aria-haspopup'));
  // ปุ่มที่เคยกดแล้วไม่ส่ง (จำไว้ ไม่กดซ้ำ)
  let badButtons = new Set();
  // ลายเซ็นปุ่ม = ชื่อ + ตำแหน่งในโครงหน้าเว็บ (ปุ่มไอคอนไม่มีชื่อ ต้องแยกด้วยตำแหน่ง)
  function btnSig(b) {
    const path = [];
    for (let e = b, i = 0; e && e !== document.body && i < 6; e = e.parentElement, i++) {
      const sib = e.parentElement ? [...e.parentElement.children].filter((x) => x.tagName === e.tagName) : [e];
      path.unshift(`${e.tagName.toLowerCase()}${sib.length > 1 ? `:${sib.indexOf(e)}` : ''}`);
    }
    return `${labelOf(b).replace(/\s+/g, ' ').slice(0, 30)}|${path.join('>')}`;
  }
  const labelOf = (b) => `${b.getAttribute('aria-label') || ''} ${b.title || ''} ${b.textContent || ''}`.trim();
  const isDisabled = (b) => b.disabled || b.getAttribute('aria-disabled') === 'true';
  // ปุ่มที่พาเปลี่ยนห้อง/หน้า — ห้ามนับเป็นปุ่มส่งเด็ดขาด (เคยไปกดไอคอน “แชตใหม่” ข้างช่องพิมพ์ → ห้องเปลี่ยน ช่องพิมพ์หาย ระบบนึกว่าส่งแล้ว)
  const NAV_WORDS = /new chat|new conversation|start new|แชตใหม่|แชทใหม่|สนทนาใหม่|compose|history|ประวัติ|sidebar|แถบข้าง|home|หน้าแรก|profile|โปรไฟล์|account|บัญชี/i;
  const navLike = (b) => !!(b.closest('a[href], nav, header, aside, [role=navigation], [role=banner], [role=complementary]')
    || NAV_WORDS.test([labelOf(b), ...[...b.querySelectorAll('[aria-label], [title], title')].map((x) => x.getAttribute('aria-label') || x.getAttribute('title') || x.textContent || '')].join(' '))
    || /new[-_ ]?(chat|conversation)|sidebar|nav/i.test(`${b.getAttribute('data-testid') || ''} ${b.id || ''}`));
  // ส่วนของช่องพิมพ์ที่เห็นบนจอ — prompt ยาวทำให้ช่องสูงเกินจอ (เลื่อนในกรอบ) ถ้าวัดจากกลางช่องทั้งก้อน ปุ่มส่งจริงจะดูไกล
  function inputRow(input) {
    const ir = input.getBoundingClientRect();
    let top = Math.max(ir.top, 0), bottom = Math.min(ir.bottom, innerHeight);
    for (let e = input.parentElement; e && e !== document.body; e = e.parentElement) { // กรอบที่เลื่อนได้/ตัดขอบ
      if (!/auto|scroll|hidden|clip/.test(getComputedStyle(e).overflowY)) continue;
      const r = e.getBoundingClientRect();
      top = Math.max(top, r.top); bottom = Math.min(bottom, r.bottom);
    }
    if (bottom - top < 10) { top = Math.max(0, Math.min(ir.top, innerHeight - 10)); bottom = Math.min(innerHeight, Math.max(top + 10, ir.bottom)); }
    return { left: ir.left, right: ir.right, width: ir.width, top, bottom };
  }
  // ระยะจากกลางปุ่มถึงขอบขวาของส่วนที่เห็น (ปุ่มส่งอยู่ขวา/ขวาล่างของช่อง)
  const rowDist = (row, r) => { const y = r.top + r.height / 2; return Math.hypot(r.left + r.width / 2 - row.right, y < row.top ? row.top - y : y > row.bottom ? y - row.bottom : 0); };
  const inRow = (row, r) => r.top >= row.top - 90 && r.bottom <= row.bottom + 90 && r.left >= row.left - 60 && r.left <= row.right + 160;
  function sendCandidates(input) {
    const row = inputRow(input), ir = input.getBoundingClientRect();
    return [...document.querySelectorAll('button, [role=button]')]
      .filter((b) => !isOurs(b) && b.getBoundingClientRect().width > 0 && !opensPicker(b) && !navLike(b) && !badButtons.has(btnSig(b)))
      .filter((b) => { const l = labelOf(b); return SEND_RE.test(l) && !NOT_SEND_RE.test(l) && (SEND_STRONG.test(l) || l.length <= 24); }) // ไม่มีคำว่า Send = ต้องเป็นป้ายสั้น (ไม่ใช่ชิปแนะนำ “Create an image of …”)
      .map((b) => { const r = b.getBoundingClientRect(); return { b, r, strong: SEND_STRONG.test(labelOf(b)), d: Math.min(rowDist(row, r), Math.hypot(r.left + r.width / 2 - ir.right, r.top + r.height / 2 - (ir.top + ir.height / 2))) }; })
      // อยู่ในแถวช่องพิมพ์เท่านั้น — เดิมรับปุ่มในรัศมี 400 px เลยไปกด “Animate” บนรูปในแชต / ชิปแนะนำหน้าแชตใหม่
      .filter((x) => x.d < 400 && (x.strong || (inRow(row, x.r) && x.r.top + x.r.height / 2 >= row.top))) // ชื่อ Send/ส่ง = ในรัศมี 400 px เหมือนเดิม (เดิมบีบให้อยู่ในแถว → ปุ่มส่งจริงหลุด ส่งไม่ได้) // ไม่มีคำว่า Send = ต้องไม่อยู่เหนือช่องพิมพ์ (ชิปแนะนำ/ปุ่มบนรูปที่เพิ่งทำ อยู่ข้างบน)
      .sort((a, b) => (b.strong - a.strong) || (a.d - b.d));
  }
  function findSendButton(input) {
    const c = sendCandidates(input);
    if (c.some((x) => x.strong)) return c[0].b; // มีปุ่ม Send → ใช้ตัวนั้นเท่านั้น
    return (c[0] || {}).b || null;
  }
  // ปุ่มเห็นบนจอไหม (ปุ่มไอคอนเล็ก ~30px — ใช้ visible() ของช่องพิมพ์ไม่ได้ เพราะต้องกว้าง > 50px)
  function shown(e) {
    const r = e.getBoundingClientRect();
    if (r.width < 8 || r.height < 8) return false;
    const cs = getComputedStyle(e);
    return cs.visibility !== 'hidden' && cs.display !== 'none' && +cs.opacity !== 0;
  }
  // ปุ่มไอคอนไม่มีชื่อ ที่อยู่ขวาสุดของช่องพิมพ์ (หลายเว็บใช้เป็นปุ่มส่ง) — ใช้เมื่อหาปุ่มที่มีชื่อไม่เจอ
  function iconSendButton(input) {
    const row = inputRow(input);
    const c = [...document.querySelectorAll('button, [role=button]')].filter((b) => {
      if (isOurs(b) || !shown(b) || !b.querySelector('svg') || opensPicker(b) || navLike(b) || badButtons.has(btnSig(b))) return false;
      const l = labelOf(b), r = b.getBoundingClientRect();
      return !NOT_SEND_RE.test(l) && l.length <= 24 && r.left >= row.left + row.width * 0.5 && r.left < row.right + 120 && r.top + r.height / 2 >= row.top - 10 && r.top + r.height / 2 <= row.bottom + Math.max(80, row.bottom - row.top); // แถวช่องพิมพ์ที่เห็นบนจอเท่านั้น (ไม่ใช่ปุ่มบนรูป/ข้อความในแชต)
    });
    return c.sort((a, b) => b.getBoundingClientRect().right - a.getBoundingClientRect().right)[0] || null;
  }
  // meta.ai กำลังทำงานอยู่ไหม (มีปุ่มหยุด / กำลังสร้าง)
  function isBusy() {
    return [...document.querySelectorAll('button, [role=button], [aria-busy="true"], [role=progressbar]')].some((b) => {
      if (isOurs(b) || !shown(b)) return false;
      if (b.getAttribute('aria-busy') === 'true' || b.getAttribute('role') === 'progressbar') return true;
      return /^\s*(stop|หยุด)|stop generat|stop respond|cancel generat/i.test(labelOf(b));
    });
  }
  async function waitIdle() {
    if (!isBusy()) return;
    log('⏳ meta.ai ยังทำงานก่อนหน้าอยู่ — รอให้ว่างก่อนส่งตัวถัดไป');
    if (!(await waitFor(() => !isBusy(), 5 * 60000, 2000))) log('⚠ meta.ai ยังไม่ว่างหลังรอ 5 นาที — ลองส่งต่อเลย', 'warn');
  }
  // ข้อมูลโครงหน้า meta.ai รอบช่องพิมพ์ (ไม่มีข้อความแชต/ลิงก์เต็ม) ไว้ส่งให้ผู้พัฒนาปรับตัวจับปุ่ม/วิดีโอ
  function pageDiag() {
    const box = (e) => { const r = e.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)]; };
    const input = findInput();
    const ir = input && input.getBoundingClientRect();
    const near = (e) => { if (!ir) return null; const r = e.getBoundingClientRect(); return Math.round(Math.hypot(r.left + r.width / 2 - ir.right, r.top + r.height / 2 - (ir.top + ir.height / 2))); };
    const buttons = [...document.querySelectorAll('button, [role=button]')].filter((b) => !isOurs(b) && shown(b))
      .map((b) => ({ label: labelOf(b).replace(/\s+/g, ' ').slice(0, 40), aria: (b.getAttribute('aria-label') || '').slice(0, 40), disabled: isDisabled(b), svg: !!b.querySelector('svg'), box: box(b), dist: near(b) }))
      .sort((a, b) => (a.dist == null ? 1e9 : a.dist) - (b.dist == null ? 1e9 : b.dist)).slice(0, 20);
    const host = (u) => (!u ? 'none' : u.startsWith('blob:') ? 'blob' : (() => { try { return new URL(u).host; } catch (e) { return '?'; } })());
    const videos = allVideos().slice(-15).map((v) => ({ src: host(srcOf(v)), dur: Math.round(v.duration || 0), visible: visible(v), box: box(v) }));
    const sb = input && findSendButton(input), ib = input && iconSendButton(input);
    return JSON.stringify({
      version: chrome.runtime.getManifest().version, path: location.pathname, viewport: [innerWidth, innerHeight],
      input: input ? { tag: input.tagName, role: input.getAttribute('role'), editable: input.getAttribute('contenteditable'), box: box(input), textLength: textOf(input).length } : null,
      busy: isBusy(), sendButton: sb ? labelOf(sb).slice(0, 40) || '(no label)' : null, iconButton: ib ? labelOf(ib).slice(0, 40) || '(no label)' : null,
      fileInputs: [...document.querySelectorAll('input[type=file]')].filter((i) => !isOurs(i)).map((i) => ({ accept: i.accept, multiple: i.multiple })),
      promptOnPage: !!findAnchor(CLIP_HEAD), badButtons: [...badButtons], buttons, videos,
    }, null, 1);
  }
  class Stopped extends Error {}
  class MetaError extends Error {} // meta.ai แจ้งว่าสร้างไม่สำเร็จ (ส่งใหม่ได้)
  // ส่วนเสริมถูก Reload/อัปเดตทั้งที่หน้านี้เปิดอยู่ → โค้ดหน้านี้ติดต่อส่วนเสริมไม่ได้อีก (Extension context invalidated) ต้องรีเฟรชหน้า
  const ctxGone = () => { try { return !(chrome.runtime && chrome.runtime.id); } catch (e) { return true; } };
  let ctxTold = false;
  function ctxGoneNotice() {
    if (ctxTold) return;
    ctxTold = true;
    if (run.on) { // ระหว่างรันคิว: รีเฟรชหน้าเอง แล้วระบบทำต่อหลังรีเฟรชพาทำคิวต่อ (ธงรันยังเปิดอยู่)
      log('⚠ ส่วนเสริมถูก Reload/อัปเดตระหว่างรันคิว — รีเฟรชหน้าเองใน 5 วิ แล้วทำคิวต่อ (อย่ากด Reload ส่วนเสริมตอนรันคิว)', 'err');
      msg('ส่วนเสริมถูก Reload — รีเฟรชหน้าเองใน 5 วิ แล้วทำคิวต่อ', 'err');
      setTimeout(() => location.reload(), 5000);
    } else msg('ส่วนเสริมถูก Reload/อัปเดต — กด F5 รีเฟรชหน้านี้ก่อนใช้งานต่อ', 'err');
  }
  class CtxGone extends Error {}
  class Refused extends Error {} // meta.ai ตอบปฏิเสธ (สินค้าอันตราย/ผิดกฎ) — ส่งใหม่/"ทำมา" ก็ปฏิเสธซ้ำ → ข้ามสินค้านี้
  // คำปฏิเสธในคำตอบของ meta.ai (ไทย/อังกฤษ) — ดูเฉพาะข้อความหลัง prompt ของเรา
  const REFUSE_RE = /ไม่สามารถ|ทำ(?:ให้)?ไม่ได้|(?:สร้าง|ทำ)[^s.!?]{0,30}ให้ไม่ได้|ไม่ได้(?:ค่ะ|ครับ|นะคะ)|ขออภัย.{0,60}ไม่|ขัด(?:กับ|ต่อ)?(?:กฎ|นโยบาย|แนวทาง|หลัก)|ไม่เหมาะสม|(?:อยาก|ต้องการ)ให้.{0,80}(?:ไหม|มั้ย)s*(?:คะ|ครับ)?s*[?？]|can['’]?t (?:help|create|make|generate|assist|do)|cannot (?:help|create|make|generate|assist)|(?:not able|unable) to|won['’]t be able to|against (?:our|my|the) (?:polic|guideline)|would you like (?:me )?to (?:try|make|create)/i; // ตอบปฏิเสธ/เสนอทำแบบอื่นแทน (ดูเฉพาะตอนไม่มีวิดีโอใหม่ + meta.ai ว่างแล้ว)
  // สินค้าที่ meta.ai มักไม่ทำให้ (สารเคมีอันตราย) — แค่เตือนในแถว ไม่บล็อก
  const HAZARD_RE = /ยาเบื่อ|เบื่อหนู|ยาฆ่า|ฆ่าแมลง|ฆ่าหญ้า|ยาพิษ|สารพิษ|rodenticide|pesticide|insecticide|herbicide/i;
  const hazardBadge = () => { const b = el('span', 'bad', '⚠ meta.ai อาจไม่ทำ'); b.title = 'สารเคมีอันตราย (เช่น ยาเบื่อหนู ยาฆ่าแมลง) — meta.ai มักปฏิเสธ · ถ้าปฏิเสธ ส่วนเสริมจะข้ามตัวนี้ให้เอง'; return b; };
  function metaRefusal(known) { // ข้อความปฏิเสธที่ meta.ai ตอบมา ('' = ไม่เจอ)
    const anchor = findAnchor(known.head);
    if (!anchor) return '';
    const texts = [];
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n; (n = w.nextNode());) {
      const e = n.parentElement;
      if (!e || !n.nodeValue.trim() || isOurs(e) || anchor.contains(e) || e.closest('script, style, noscript, template, [contenteditable], textarea, button, [role=button]') || !shown(e)) continue; // เฉพาะข้อความที่เห็นบนจอ (ไม่อ่านข้อมูลแชตเก่าใน <script>)
      if (anchor.compareDocumentPosition(n) & Node.DOCUMENT_POSITION_FOLLOWING) texts.push(n.nodeValue);
    }
    // prompt ของเราอาจแตกเป็นหลายบรรทัด/หลาย element → เริ่มดูหลังบรรทัดสุดท้ายของ prompt (กฎท้าย)
    const end = texts.map((t) => /only facts from the product info|One video only:/.test(t)).lastIndexOf(true);
    const text = texts.slice(end + 1).join(' ').replace(/\s+/g, ' ').trim();
    const m = text.match(REFUSE_RE);
    return m ? text.slice(Math.max(0, m.index - 30), m.index + 120).trim() : '';
  }
  // แถบข้อความผิดพลาดของ meta.ai บนหน้า (ไม่นับปุ่ม/ช่องพิมพ์/แผงของเรา) — คืน element ที่เห็นอยู่
  const META_ERR_RE = /something went wrong|please try again|try again later|couldn['’]t (generate|create)|can['’]t (generate|create)|cannot generate|เกิดข้อผิดพลาด|โปรดลองอีกครั้ง|กรุณาลองใหม่/i;
  function metaErrorEls() {
    const out = [];
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n; (n = w.nextNode());) {
      if (n.nodeValue.length > 200 || !META_ERR_RE.test(n.nodeValue)) continue;
      const e = n.parentElement;
      if (e && !isOurs(e) && !e.closest('[contenteditable], textarea, button, [role=button]') && shown(e)) out.push(e);
    }
    return out;
  }
  // ปิดแถบ error เก่าก่อนส่ง: meta.ai ใช้แถบเดิมซ้ำ (นับจำนวนแล้วไม่เพิ่ม) → ถ้าไม่ปิดก่อน จะจับ error รอบใหม่ไม่ได้
  const DISMISS_RE = /dismiss|close error|ปิดข้อผิดพลาด/i;
  async function dismissMetaErrors() {
    let n = 0;
    for (const b of document.querySelectorAll('button, [role=button]')) {
      if (!isOurs(b) && shown(b) && DISMISS_RE.test(labelOf(b))) { b.click(); n++; }
    }
    if (n) await nap(500);
  }
  // จุดตั้งต้นก่อนส่ง: แถบ error ที่ยังเห็นอยู่ (ไม่นับเป็น error รอบนี้) + เวลาเริ่ม
  const errBaseline = () => ({ errSet: new Set(metaErrorEls()), sentAt: Date.now() });
  // error รอบนี้: แถบที่ขึ้นใหม่หลังส่ง · หรือแถบเก่าที่ปิดไม่ได้ ยังขึ้นอยู่ + meta.ai ไม่ทำงานเกิน 20 วิ
  function newMetaError(known) {
    if (!known.errSet) return '';
    const els = metaErrorEls();
    const fresh = els.find((e) => !known.errSet.has(e));
    if (fresh) return fresh.textContent.trim().slice(0, 100);
    if (els.length && !isBusy() && Date.now() - known.sentAt > 20000) return els[0].textContent.trim().slice(0, 100);
    return '';
  }
  const run = { on: false, stop: false, log: [], status: {} };
  async function nap(ms) { // รอแบบกดหยุดได้
    const end = Date.now() + ms;
    while (Date.now() < end) { if (run.stop) throw new Stopped(); await sleep(Math.min(500, end - Date.now())); }
    if (run.stop) throw new Stopped();
  }
  async function waitFor(fn, ms, every = 1000) {
    const end = Date.now() + ms;
    for (;;) { const v = fn(); if (v) return v; if (Date.now() > end) return null; await nap(every); }
  }
  const textOf = (box) => (box.tagName === 'TEXTAREA' || box.tagName === 'INPUT' ? box.value : box.innerText).trim();
  // กันหน้าต่างเลือกไฟล์เด้ง: ระหว่างที่เรากดปุ่ม ถ้ามีการเปิด input[type=file] → ยกเลิก
  async function guardedClick(b) {
    let picker = false;
    const block = (e) => { if (e.target && e.target.matches && e.target.matches('input[type=file]')) { e.preventDefault(); e.stopImmediatePropagation(); picker = true; } };
    document.addEventListener('click', block, true);
    try { b.click(); await sleep(300); } finally { document.removeEventListener('click', block, true); }
    return picker;
  }
  function rememberBad(b) {
    if (SEND_STRONG.test(labelOf(b))) return; // ปุ่มชื่อ Send/ส่ง ไม่จำว่าผิด (เคยจำปุ่มส่งจริงที่แค่ช้า → กดปุ่มอื่นแทนตลอด)
    badButtons.add(btnSig(b));
    try { chrome.storage.local.set({ mahBadButtons: [...badButtons].slice(-30) }); } catch (e) {}
  }
  async function submit(input) {
    // รอปุ่มส่งที่กดได้ (รูปอัปโหลดเสร็จ) สูงสุด 60 วิ · ถ้า 3 วิแล้วไม่มีปุ่มที่มีชื่อเลย ลองปุ่มไอคอนขวาสุดของช่องพิมพ์
    const sentNow = () => !input.isConnected || !textOf(input) || isBusy();
    const done = (how) => { sends++; composerDirty = false; return how; };
    let forgot = false;
    for (let attempt = 0; attempt < 3; attempt++) {
      const t0 = Date.now();
      let how = 'ปุ่มส่ง';
      const btn = await waitFor(() => {
        const b = findSendButton(input);
        if (b) { how = SEND_STRONG.test(labelOf(b)) ? 'ปุ่มส่ง' : `ปุ่ม “${labelOf(b).slice(0, 20)}”`; return isDisabled(b) ? null : b; }
        const ib = Date.now() - t0 > 3000 && iconSendButton(input);
        if (ib && !isDisabled(ib)) { how = `ปุ่มไอคอน “${(labelOf(ib) || 'ไม่มีชื่อ').slice(0, 20)}”`; return ib; }
        return null;
      }, attempt ? 8000 : 60000, 500);
      if (!btn && badButtons.size && !forgot) { // ไม่เจอปุ่มเลย อาจเพราะเคยจำปุ่มส่งจริงผิด (meta.ai เปลี่ยนหน้าจอ) → ล้างความจำแล้วลองใหม่
        forgot = true;
        badButtons = new Set();
        try { chrome.storage.local.set({ mahBadButtons: [] }); } catch (e) {}
        log('ไม่เจอปุ่มส่ง — ล้างปุ่มที่เคยจำว่าไม่ใช่ปุ่มส่ง แล้วลองใหม่', 'warn');
        continue;
      }
      if (!btn) break;
      const picker = await guardedClick(btn), strong = SEND_STRONG.test(labelOf(btn));
      if (!picker && await waitFor(sentNow, strong ? 15000 : 8000, 400)) return done(how); // prompt ยาว + รูปกำลังอัป → meta.ai ล้างช่องช้า
      if (strong && !picker) { log('⚠ กดปุ่มส่งแล้ว meta.ai ยังไม่รับ — กดใหม่', 'warn'); continue; } // ปุ่มส่งจริง: กดซ้ำ ไม่ไปลองปุ่มอื่น
      // ไม่ใช่ปุ่มส่ง → จำไว้ แล้วลองตัวถัดไป
      rememberBad(btn);
      log(`⚠ ปุ่ม ${how} ไม่ใช่ปุ่มส่ง${picker ? ' (เปิดหน้าต่างเลือกไฟล์ — กันไว้แล้ว)' : ''} — จำไว้ไม่กดอีก ลองปุ่มอื่น`, 'warn');
    }
    // สุดท้าย: กด Enter ในช่องพิมพ์
    input.focus();
    for (const t of ['keydown', 'keypress', 'keyup']) input.dispatchEvent(new KeyboardEvent(t, { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true }));
    if (await waitFor(sentNow, 8000, 400)) return done('Enter');
    const nearBtns = (() => { const box = findInput(); if (!box) return ''; const ir = box.getBoundingClientRect();
      return [...document.querySelectorAll('button, [role=button]')].filter((b) => !isOurs(b) && shown(b)).map((b) => { const r = b.getBoundingClientRect(); return { l: labelOf(b).replace(/\s+/g, ' ').slice(0, 20) || '(ไอคอน)', d: Math.hypot(r.left + r.width / 2 - ir.right, r.top + r.height / 2 - ir.bottom) }; })
        .filter((x) => x.d < 300).sort((a, b) => a.d - b.d).slice(0, 6).map((x) => `“${x.l}”`).join(' '); })();
    throw new Error(`หาปุ่มส่งที่ใช้ได้ไม่เจอ${isBusy() ? ' (meta.ai ยังทำงานอยู่)' : ''}${nearBtns ? ` · ปุ่มแถวช่องพิมพ์: ${nearBtns}` : ''} — กด 🔍 คัดลอกข้อมูลหน้าเว็บ ส่งให้ผู้พัฒนาดู`);
  }

  const srcOf = (v) => v.currentSrc || v.src || (v.querySelector('source') || {}).src || '';
  const allVideos = () => [...document.querySelectorAll('video')].filter((v) => !isOurs(v));
  // ลิงก์วิดีโอแบบไม่มีพารามิเตอร์ (ลิงก์ fbcdn เปลี่ยนลายเซ็นทุกครั้งที่โหลด)
  const normSrc = (u) => { if (!u || u.startsWith('blob:')) return u; try { const x = new URL(u, location.href); return x.origin + x.pathname; } catch (e) { return u; } };
  function snapshot(head) { const vs = allVideos(); return { els: new Set(vs), norm: new Set(vs.map((v) => normSrc(srcOf(v))).filter(Boolean)), head: head || '' }; }

  // ลายนิ้วมือไฟล์ (hash 256KB แรก): meta.ai วาดหน้าใหม่บ่อย คลิปเก่าได้ element/ลิงก์ใหม่ → ใช้เนื้อไฟล์แยกคลิปเก่า/ใหม่
  const fpCache = new Map();
  let seenClips = new Set(); // คลิปที่เคยอยู่บนหน้า/เคยโหลดแล้ว (จำข้ามการรีเฟรช)
  async function fingerprint(v) {
    const src = srcOf(v), k = normSrc(src);
    if (fpCache.has(k)) return fpCache.get(k);
    let fp = `url:${k}`;
    try {
      const res = await fetch(src, src.startsWith('blob:') ? {} : { headers: { Range: 'bytes=0-262143' } });
      const buf = await (await res.blob()).slice(0, 262144).arrayBuffer();
      const h = new Uint8Array(await crypto.subtle.digest('SHA-256', buf));
      fp = `h:${[...h.slice(0, 12)].map((b) => b.toString(16).padStart(2, '0')).join('')}`;
    } catch (e) {}
    fpCache.set(k, fp);
    return fp;
  }
  function rememberClips(fps) {
    fps.filter(Boolean).forEach((f) => seenClips.add(f));
    try { chrome.storage.local.set({ mahSeenClips: [...seenClips].slice(-500) }); } catch (e) {}
  }
  // ก่อนเริ่มรัน: จำคลิปที่อยู่บนหน้าอยู่แล้วทั้งหมดว่าเป็นของเก่า
  // skipHead = ทำต่อหลังหน้าโหลดใหม่: คลิปที่อยู่หลัง prompt ของตัวที่ค้าง = ของตัวนั้นที่ยังไม่ได้โหลด → ไม่นับเป็นของเก่า (เดิมนับ แล้วส่ง prompt ซ้ำ)
  async function markExisting(skipHead) {
    const anchor = skipHead ? findAnchor(skipHead) : null;
    const fps = [];
    for (const v of allVideos().slice(-40)) if (srcOf(v) && !(anchor && anchor.compareDocumentPosition(v) & Node.DOCUMENT_POSITION_FOLLOWING)) fps.push(await fingerprint(v));
    rememberClips(fps);
  }
  // ข้อความที่ไม่ใช่แชตบนจอ: ช่องพิมพ์ + ข้อมูลในแท็ก script/style (หน้าเว็บอาจเก็บข้อความแชตเป็น JSON ไว้ในนั้น)
  const NOT_CHAT = '[contenteditable], textarea, script, style, noscript, template';
  // ข้อความ prompt ที่เราเพิ่งส่ง (บนหน้าแชต) — คลิปใหม่ต้องอยู่ "หลัง" ข้อความนี้
  const plainQuotes = (s) => s.replace(/[“”„‟″]/g, '"').replace(/[‘’]/g, "'"); // หน้าแชตอาจแปลง " เป็น “ ”
  function findAnchor(head) {
    if (!head) return null;
    head = plainQuotes(head);
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let last = null, n;
    while ((n = w.nextNode())) {
      if (!plainQuotes(n.nodeValue).includes(head)) continue;
      const e = n.parentElement;
      if (e && !isOurs(e) && !e.closest(NOT_CHAT) && !e.closest('nav, aside, header, [role=navigation], [role=complementary]')) last = e; // ไม่นับชื่อห้องในแถบซ้าย (meta.ai ตั้งชื่อห้องจากข้อความแรก = มีบรรทัด Product ของเรา)
    }
    return last;
  }
  // ---------- meta.ai พังตอนส่ง (“Something went wrong”) แล้วพาไปหน้าแชตใหม่ว่างๆ → กดกลับห้องที่ส่ง prompt (บนสุดของแถบซ้าย) แล้วพิมพ์ “ทำมา” ----------
  const homePath = () => { try { const a = document.querySelector('a[data-testid="new-chat-button"]'); return new URL((a && a.getAttribute('href')) || '/', location.href).pathname; } catch (e) { return '/'; } };
  const linkPath = (a) => { try { const u = new URL(a.getAttribute('href'), location.href); return u.origin === location.origin ? u.pathname : ''; } catch (e) { return ''; } };
  // หลุดจากห้องที่ส่ง prompt = อยู่หน้าแชตใหม่ (ลิงก์ New chat) และไม่เห็นข้อความ prompt ของเราบนหน้า
  const leftChat = (known) => location.pathname === homePath() && !findAnchor(known.head);
  // ห้องแชตในแถบซ้าย = ลิงก์ที่ท้ายเป็นรหัสห้อง · บนสุด = ล่าสุด (แถบซ้ายพับอยู่ = ตัวแรกในหน้า)
  function topChatLink() {
    const home = homePath();
    const c = [...document.querySelectorAll('a[href]')].filter((a) => !isOurs(a) && a.getAttribute('data-testid') !== 'new-chat-button' && a.closest('nav, aside, [role=navigation]'))
      .filter((a) => { const p = linkPath(a), id = p.split('/').pop(); return p && p !== home && id.length >= 8 && /\d/.test(id); });
    const vis = c.filter((a) => a.getBoundingClientRect().height > 0);
    return (vis.length ? vis.sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top)[0] : c[0]) || null;
  }
  async function backToChat(known) {
    const a = (known.chatPath && [...document.querySelectorAll('a[href]')].find((x) => !isOurs(x) && linkPath(x) === known.chatPath)) || topChatLink();
    if (!a) { log('⚠ หาห้องที่ส่ง prompt ในแถบซ้ายไม่เจอ (เปิดแถบซ้ายของ meta.ai ค้างไว้)', 'warn'); return false; }
    log(`↩ กดห้อง “${(a.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 30)}” (${linkPath(a)})`);
    a.click();
    if (await waitFor(() => findAnchor(known.head) && findInput(), 15000, 500)) { log('↩ กลับเข้าห้องที่ส่ง prompt แล้ว', 'ok'); return true; }
    log('⚠ ห้องบนสุดไม่ใช่ห้องที่ส่ง prompt — ไม่พิมพ์ “ทำมา” ในห้องนี้ กลับไปแชตใหม่', 'warn');
    const nc = document.querySelector('a[data-testid="new-chat-button"], button[data-testid="new-chat-button"]');
    if (nc) { nc.click(); await waitFor(() => location.pathname === homePath() && findInput(), 10000, 500); }
    return false;
  }
  // รอวิดีโอใหม่จนนิ่ง (วิดีโอเดียวกันที่โชว์หลายที่ = นับครั้งเดียว)
  // want = ความยาวที่สั่ง (วิ) · เกิน 10 วิ: meta.ai โชว์ท่อน 10 วิแรกก่อนแล้วค่อยต่อ → ต้องได้คลิปยาว ≥ 75% ก่อนถึงจะโหลด (เดิมโหลดท่อน 10 วิไปก่อน)
  async function waitForNewVideos(known, ms, want = 0) {
    const t0 = Date.now(), minDur = want > 10 ? want * 0.75 : 0, hardEnd = t0 + ms * 2; // ครบเวลาแล้ว meta.ai ยังทำงานอยู่ = รอต่อได้อีกเท่าตัว (เดิมตัดว่าพลาด → คลิปมาทีหลังไม่ได้โหลด)
    const mins = () => Math.round((Date.now() - t0) / 60000);
    let end = t0 + ms, toldLate = false, seen = 0, errSince = 0; // seen = วิดีโอใหม่ที่เห็นรอบก่อน (ยังโหลด/ยังไม่นิ่ง) · errSince = เห็น error ตอน meta.ai ยังทำงานตั้งแต่เมื่อไหร่
    let prev = '', stable = 0, toldOld = false, refusedSeen = 0, short = null, idleSince = 0, away = 0, lastPath = location.pathname, lastTell = Date.now();
    const diag = { old: 0, total: 0 };
    for (;;) {
      if (Date.now() >= end) {
        if ((!isBusy() && !seen) || Date.now() >= hardEnd) break; // คลิปขึ้นแล้วแต่ยังไม่นิ่ง = รอต่อ (เดิมครบเวลาพอดีตอน meta.ai เพิ่งว่าง → ตัดทิ้งทั้งที่คลิปอยู่บนหน้า)
        if (!toldLate && isBusy()) { toldLate = true; log(`⏳ ครบ ${Math.round(ms / 60000)} นาทีแล้ว meta.ai ยังทำคลิปอยู่ — รอต่ออีกไม่เกิน ${Math.round(ms / 60000)} นาที (ไม่ส่งซ้ำ)`, 'warn'); }
        end = Math.min(hardEnd, Date.now() + 30000);
      }
      await nap(2000);
      if (location.pathname !== homePath()) known.chatPath = location.pathname; // ห้องที่ส่ง prompt (ไว้กดกลับเข้าไป)
      let fresh = allVideos().filter((v) => srcOf(v) && !known.els.has(v) && !known.norm.has(normSrc(srcOf(v))));
      diag.total = allVideos().length;
      seen = fresh.length;
      if (location.pathname !== lastPath) { log(`🔀 meta.ai เปลี่ยนหน้า ${lastPath} → ${location.pathname}${findAnchor(known.head) ? '' : ' · ไม่เห็น prompt ของเราบนหน้า'}`, 'warn'); lastPath = location.pathname; }
      if (Date.now() - lastTell >= 30000) { lastTell = Date.now(); log(`⏳ รอคลิป ${Math.round((Date.now() - (known.sentAt || Date.now())) / 1000)} วิ · หน้า ${location.pathname} · ${findAnchor(known.head) ? 'เห็น prompt ของเรา' : 'ไม่เห็น prompt ของเรา'} · วิดีโอใหม่ ${fresh.length} · meta.ai ${isBusy() ? 'กำลังทำงาน' : 'ว่าง'}`); }
      // ชอบวิดีโอที่อยู่หลัง prompt ที่เพิ่งส่ง แต่ถ้าหน้าเว็บเรียงคลิปใหม่ไว้บนสุด ก็รับตัวที่ไม่ใช่ของเก่าได้
      const anchor = findAnchor(known.head);
      if (anchor) {
        const after = fresh.filter((v) => anchor.compareDocumentPosition(v) & Node.DOCUMENT_POSITION_FOLLOWING);
        if (after.length || known.strict) fresh = after; // strict = ทำต่อหลังหน้าโหลดใหม่ (คลิปเก่าที่วาดทีหลังอยู่ก่อน prompt)
      }
      fresh.forEach((v) => { if (v.readyState === 0) { v.preload = 'metadata'; try { v.load(); } catch (e) {} } });
      const ready = [];
      for (const v of fresh.filter((x) => x.duration > 1 && isFinite(x.duration))) {
        const fp = await fingerprint(v);
        if (seenClips.has(fp)) { // คลิปเก่าที่ถูกวาดใหม่ → ไม่เอา
          known.norm.add(normSrc(srcOf(v)));
          diag.old++;
          if (!toldOld) { toldOld = true; log('ข้ามคลิปเก่าที่ meta.ai แสดงซ้ำ'); }
          continue;
        }
        if (!ready.some((x) => x.fp === fp)) ready.push({ v, fp });
      }
      if (!ready.length) { // ยังไม่มีคลิป แต่ meta.ai ขึ้นข้อความผิดพลาด → เลิกรอ
        const err = newMetaError(known);
        // error ขึ้นแต่ meta.ai ยังทำงานอยู่ = มักไม่ได้พังจริง (prompt ไปถึงแล้ว กำลังทำคลิป) → รอดูก่อน (เดิมสั่ง “ทำมา” เลย = meta ทำคลิปเดิมซ้ำอีกรอบ) · ค้างเกิน 90 วิ = พังจริง
        if (err && (!isBusy() || (errSince && Date.now() - errSince > 90000))) throw new MetaError(err);
        if (err && !errSince) { errSince = Date.now(); log(`⚠ meta.ai ขึ้น “${err.slice(0, 60)}” แต่ยังทำงานอยู่ — รอดูก่อน ไม่สั่ง “ทำมา” ซ้ำ`, 'warn'); }
        if (!err) errSince = 0;
        // meta.ai พังแล้วพาไปหน้าแชตใหม่ว่างๆ (แถบ error หายไปกับหน้าเดิม) — เดิมรอคลิปบนหน้าว่าง 10 นาที
        away = !fresh.length && Date.now() - (known.sentAt || 0) > 8000 && leftChat(known) ? away + 1 : 0;
        if (away >= 3) throw new MetaError('meta.ai พาไปหน้าแชตใหม่ว่างๆ (Something went wrong)');
        // ตอบปฏิเสธเป็นข้อความ (ไม่มีวิดีโอใหม่ + เขียนเสร็จแล้ว) 2 รอบติด → ข้ามเลย ไม่รอจนหมดเวลา
        const why = !fresh.length && !isBusy() && Date.now() - (known.sentAt || 0) > 15000 ? metaRefusal(known) : '';
        refusedSeen = why ? refusedSeen + 1 : 0;
        if (refusedSeen >= 2) throw new Refused(`meta.ai ไม่ทำคลิปให้ — ตอบปฏิเสธ (สินค้าอาจเข้าข่ายอันตราย/ผิดกฎ): “${why}…” → ข้ามตัวนี้`);
      }
      const sig = ready.map((x) => x.fp).join('|');
      if (ready.length && sig === prev) {
        if (++stable >= 2) {
          const longest = Math.max(...ready.map((x) => x.v.duration || 0));
          if (longest >= minDur) return ready.map((x) => x.v);
          // ได้แค่ท่อนสั้น: meta.ai ยังทำต่อ → รอ · ว่างนิ่ง 45 วิแล้วไม่มีคลิปยาวกว่า = ทำมาแค่นั้นจริง → เอาเท่าที่ได้ (collectClips เตือนว่าสั้นกว่าที่สั่ง)
          if (!short) log(`⏳ ได้คลิป ${Math.round(longest)} วิก่อน (สั่ง ${want} วิ) — meta.ai กำลังต่อให้ครบ รอคลิปเต็มแล้วค่อยโหลด`);
          short = ready.map((x) => x.v);
          if (isBusy()) idleSince = 0;
          else if (!idleSince) idleSince = Date.now();
          else if (Date.now() - idleSince > 45000) { log(`⚠ meta.ai หยุดที่ ${Math.round(longest)} วิ ไม่ต่อให้ครบ ${want} วิ — โหลดเท่าที่ได้`, 'warn'); return short; }
        }
      } else { stable = 0; idleSince = 0; }
      prev = sig;
    }
    if (short && short.every((v) => v.isConnected)) { log(`⚠ รอคลิปเต็ม ${want} วิ นานเกิน ${mins()} นาที — โหลดท่อนที่ได้แทน`, 'warn'); return short; }
    throw new Error(`รอคลิปนานเกิน ${mins()} นาที (บนหน้ามีวิดีโอ ${diag.total} ตัว · ข้ามคลิปเก่า ${diag.old} · meta.ai ${isBusy() ? 'ยังทำงานอยู่' : 'ว่างแล้ว'}${findAnchor(known.head) ? '' : ' · ไม่เห็นข้อความ prompt บนหน้า — อาจส่งไม่ติด'})`);
  }
  // ชื่อไฟล์: ตัดอักขระต้องห้าม · ตัดทีละตัวอักษรจริง (ไม่ผ่าอีโมจิครึ่งตัว) · ไม่ขึ้นต้น/ลงท้ายด้วยจุด · ว่าง = "สินค้า"
  const safeName = (s) => [...String(s || '').replace(/[\\/:*?"<>|#%\n\r\t\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim()]
    .slice(0, 60).join('').replace(/^[.\s]+|[.\s]+$/g, '') || 'สินค้า';
  async function bgDownload(url, filename) { // คืนเลขไฟล์ดาวน์โหลด (ไว้ลบทีหลัง) · ผ่าน bg() = คลิปใหญ่ส่งเป็นท่อน (เดิม > ~48 MB ส่งไม่ได้ → ตกไป Downloads ชั้นนอก)
    const r = await bg({ type: 'download', url, filename });
    if (r && r.ok && r.renamed) log(`⚠ ชื่อไฟล์ “${filename.split('/').pop()}” ใช้ไม่ได้ (${r.why || '-'}) — บันทึกเป็น ${r.renamed} แทน`, 'warn');
    if (r && r.ok) return r.id;
    throw new Error((r && r.error) || 'ดาวน์โหลดไม่ได้');
  }
  const blobToDataUrl = (blob) => new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = rej; fr.readAsDataURL(blob); });
  // โหลดผ่าน chrome.downloads (รองรับชื่อไทย + โฟลเดอร์ Downloads/ShopeeVideo)
  // ไฟล์วิดีโอจริงเท่านั้น: ลิงก์หมดอายุ/แชตถูกลบ → ได้หน้า error (HTML) แทนวิดีโอ → เคยส่งขึ้น Reel แล้ว Facebook ตอบ 422
  const okVideo = (b) => !!(b && b.size > 20000 && (!b.type || /^video\/|octet-stream/.test(b.type)));
  async function fetchVideo(src) {
    const res = await fetch(src);
    if (!res.ok) { const e = new Error(`ลิงก์คลิปใช้ไม่ได้แล้ว (HTTP ${res.status})`); e.dead = true; throw e; }
    const blob = await res.blob();
    if (!okVideo(blob)) { const e = new Error('ลิงก์คลิปไม่ได้ส่งไฟล์วิดีโอกลับมา'); e.dead = true; throw e; }
    return blob;
  }
  async function readVideo(v) {
    const src = srcOf(v);
    try { return { src, blob: await fetchVideo(src) }; } catch (e) {
      if (src.startsWith('blob:')) throw e;
      if (!e.dead) { // หน้า meta.ai โหลดคลิปข้ามเว็บไม่ได้ → ให้ส่วนเสริมโหลด (ได้ไฟล์จริงไว้โพสต์ Reel · เดิมได้แค่ลิงก์ → Facebook โหลดไม่ได้ 422)
        const r = await bg({ type: 'fetchMedia', url: src });
        if (r.ok) { try { const blob = await (await fetch(r.dataUrl)).blob(); if (okVideo(blob)) return { src, blob }; } catch (x) {} }
      }
      return { src, blob: null }; // ลิงก์ข้ามโดเมน → ให้ Chrome โหลดเอง
    }
  }
  async function saveVideo({ src, blob }, base) {
    if (!blob) return bgDownload(src, `ShopeeVideo/${base}.mp4`); // คืนเลขไฟล์ดาวน์โหลด (ลบทีหลังได้)
    const ext = /webm/.test(blob.type) ? 'webm' : 'mp4';
    try { return await bgDownload(await blobToDataUrl(blob), `ShopeeVideo/${base}.${ext}`); } catch (e) {
      log(`⚠ ส่งคลิปให้ส่วนเสริมโหลดไม่ได้ (${e.message || e}) — โหลดจากหน้าเว็บแทน: ไฟล์ชื่อ ShopeeVideo-${base}.${ext} อยู่ใน Downloads (ไม่ใช่โฟลเดอร์ ShopeeVideo)`, 'warn');
      const a = document.createElement('a'); // สำรอง: โหลดจากหน้าเว็บ (ชื่อไฟล์อาจไม่ตรง)
      a.href = URL.createObjectURL(blob);
      a.download = `ShopeeVideo-${base}.${ext}`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 60000);
    }
  }
  // ตัดไฟล์ซ้ำ (วิดีโอเดียวกันที่โชว์หลายที่ / คนละลิงก์แต่ไฟล์เดียวกัน)
  async function uniqueVideos(vids) {
    const out = [], seen = new Set();
    for (const v of vids) {
      const fp = await fingerprint(v);
      if (seen.has(fp) || seenClips.has(fp)) continue;
      seen.add(fp);
      out.push({ ...(await readVideo(v)), dur: v.duration, fp });
    }
    return out;
  }
  // คลิปเดียวเสมอ (ไม่ต่อคลิป ไม่รวมท่อน) — ถ้า meta.ai ส่งมาหลายอัน เอาอันที่ยาวที่สุด
  async function collectClips(known) {
    const uniq = await uniqueVideos(await waitForNewVideos(known, (seconds() > 10 ? 10 : 6) * 60000, seconds())); // คลิปยาว: meta.ai ทำ 2 รอบ (10 วิแรก + ต่อ) → รอนานขึ้น
    const best = uniq.sort((a, b) => (b.dur || 0) - (a.dur || 0))[0];
    if (best && seconds() > 10 && best.dur < seconds() * 0.75) log(`⚠ meta.ai ทำมา ${Math.round(best.dur)} วิ (สั่ง ${seconds()} วิ) — โหลดคลิปเดียวตามที่ได้`, 'warn');
    return best ? [best] : [];
  }

  // ---------- โพสต์ (แคปชัน + แฮชแท็ก) ที่ meta.ai เขียน → .txt + ปุ่ม 📋 โพสต์ ----------
  // แยกข้อความโพสต์ → แคปชัน (ตัดบรรทัดที่มีคำต้องห้าม) + แฮชแท็ก
  function parsePost(raw) {
    const text = String(raw || '').replace(/[*_`]+/g, '').replace(/^\s*(caption|hashtags?)\s*:\s*/gim, '');
    const tags = [...new Set(text.match(/#[^\s#,.;:()]+/g) || [])].filter((t) => !checkText(t).length).slice(0, 8);
    const caption = text.split('\n').map((x) => x.replace(/#[^\s#,.;:()]+/g, '').trim()).filter((x) => x && !checkText(x).length).join('\n').slice(0, 500);
    return caption.length >= 4 ? { caption, tags } : null;
  }
  // อ่านโพสต์ที่ตอบมาหลังข้อความของเรา: code block อันล่าสุดที่มีแฮชแท็ก (ข้อความในกล่องโค้ดไม่โดนจัดรูปแบบ)
  // สำรอง: ถ้า meta.ai ไม่ใส่กล่องโค้ด แต่เขียนแบบ "CAPTION: … HASHTAGS: …"
  function readPost(head) {
    const anchor = findAnchor(head);
    if (!anchor) return null;
    const after = (x) => anchor.compareDocumentPosition(x) & Node.DOCUMENT_POSITION_FOLLOWING;
    const block = [...document.querySelectorAll('pre, code')].filter((b) => !isOurs(b) && !b.closest('[contenteditable], textarea') && after(b) && /#\S/.test(b.innerText || '')).pop();
    if (block) return parsePost(block.innerText);
    const parts = [];
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n; (n = w.nextNode());) {
      const e = n.parentElement;
      if (e && !isOurs(e) && !e.closest(NOT_CHAT) && (anchor === e || after(n))) parts.push(n.nodeValue);
    }
    const text = parts.join('\n'), i = text.lastIndexOf('CAPTION:');
    return i >= 0 ? parsePost(text.slice(i)) : null;
  }
  // รอโพสต์จนพิมพ์เสร็จ (ข้อความไม่เปลี่ยน 2 รอบติด) กันได้แคปชันครึ่งๆ
  async function waitPost(head, ms) {
    const end = Date.now() + ms;
    let prev = '';
    while (Date.now() < end) {
      const r = readPost(head), sig = r ? JSON.stringify(r) : '';
      if (r && sig === prev) return r;
      prev = sig;
      await nap(1500);
    }
    return readPost(head);
  }
  // สำรอง: คำตอบพร้อมคลิปไม่มีโพสต์ → ส่งข้อความสั้นๆ ขอโพสต์อย่างเดียว (ตัวหนังสือล้วน meta.ai ตอบแทบทุกครั้ง)
  async function askPost(p) {
    const head = `Post for: "${promptName(p.name) || 'the product'}"`.slice(0, 60);
    const text = [`Post for: "${promptName(p.name) || 'the product'}"`, 'Write a social post caption for this product (text only, no image or video) — different wording from the video\'s spoken lines', ...R.postAsk].join('\n');
    await waitIdle();
    const input = await waitFor(findInput, 30000);
    if (!input || !(await insertInto(input, text))) return null;
    await nap(600);
    await submit(findInput() || input);
    return waitPost(head, 60000);
  }

  // ไฟล์ข้อความโพสต์คู่คลิป
  function postText(p) {
    const tags = (p.tags && p.tags.length ? p.tags : ['#ShopeeVideo', '#รีวิว', '#ของใช้ดีบอกต่อ']).join(' ');
    const link = p.link || ''; // ลิงก์ affiliate เท่านั้น (ลิงก์สินค้าธรรมดาไม่ได้ค่าคอม)
    const body = [(p.caption || p.name || '').trim(), '', tags, link ? `\n🛒 พิกัด 👉 ${link}` : p.productUrl ? `\n(ยังไม่มีลิงก์ affiliate — หน้าสินค้า: ${p.productUrl})` : ''].join('\n').trim(); // แบบเดียวกับคอมเมนต์ปักตะกร้า FB
    return `﻿${body}\n`; // BOM ให้ Notepad อ่านไทยถูก
  }
  async function savePost(p, base) {
    const b64 = btoa(unescape(encodeURIComponent(postText(p))));
    p.txtFile = await bgDownload(`data:text/plain;charset=utf-8;base64,${b64}`, `ShopeeVideo/${base}.txt`); // เลขไฟล์ (ลบทีหลังได้)
  }
  function log(text, cls) {
    const t = new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    run.log.push({ text: `${t}  ${text}`, cls: cls || '' });
    if (run.log.length > 200) run.log.shift();
    renderRun();
    saveLog();
  }
  // เก็บบันทึกลงเครื่อง (ทุก 3 วิ) — หน้าโหลดใหม่แล้วบันทึกไม่หาย · ไว้ดูย้อนหลังว่าเกิดอะไรขึ้น
  let logTimer = 0;
  function saveLog() {
    if (logTimer) return;
    logTimer = setTimeout(() => { logTimer = 0; try { chrome.storage.local.set({ mahLog: run.log.slice(-200) }); } catch (e) {} }, 3000);
  }
  function setStatus(p, text) { run.status[p.id] = text; renderProducts(); renderRun(); }

  // meta.ai ขึ้น "Something went wrong": ครั้งที่ 1–2 พิมพ์ "ทำมา" ต่อในแชตเดิม (makeClipOnce) ·
  // ครั้งที่ 3 + ใช้รูปพรีเซนเตอร์อยู่ → เอารูปพรีเซนเตอร์ออก ส่ง prompt ใหม่ แล้ว "ทำมา" ได้อีก 2 ครั้ง · ครั้งที่ 6 (หรือ 3 ถ้าไม่มีรูปพรีเซนเตอร์) = ข้าม
  async function makeClip(p, base, label, extras = {}) {
    const tries = { fails: 0 };
    let round = 1;
    try {
      for (;;) {
        try { return await makeClipOnce(p, base, label, { ...extras, tries }); } catch (e) {
          extras = { ...extras, adopt: null }; // รอบต่อไปส่ง prompt ใหม่ (ไม่รอผลเดิมซ้ำ)
          if (!(e instanceof MetaError)) throw e;
          if (round === 1 && faceUsable()) {
            noFace = true; round = 2;
            log(`⚠ meta.ai พัง ${tries.fails} ครั้ง — เอารูปพรีเซนเตอร์ออก แล้วส่งใหม่ใน 5 วิ (ไม่ล็อกหน้า)`, 'warn');
            setStatus(p, `⏳ meta.ai ผิดพลาด ส่งใหม่ไม่ใช้รูปพรีเซนเตอร์${label}`);
            await nap(5000);
            continue;
          }
          throw new Error(`meta.ai ขึ้น “${e.message}” ${tries.fails} ครั้ง${round === 2 ? ' (รวมรอบที่ไม่ใช้รูปพรีเซนเตอร์)' : ''} — อาจติดโควตารายวัน/ระบบไม่ว่าง หรือรูปสินค้า/ข้อความโดนกรอง (รอสักพักแล้วกด ↺)`);
        }
      }
    } finally {
      noFace = false; // สินค้าตัวถัดไปกลับมาใช้รูปพรีเซนเตอร์ตามปกติ
    }
  }
  // พิมพ์ "ทำมา" ต่อในแชตเดิม (meta.ai ยังมี prompt + รูปจากข้อความก่อน) แล้วตั้งจุดจับ error ใหม่
  async function nudgeMeta(...knowns) {
    if (leftChat(knowns[0])) { // อยู่หน้าแชตใหม่ว่างๆ → กลับห้องที่ส่ง prompt ก่อน (ไม่พิมพ์ “ทำมา” ลงห้องว่าง)
      log('↩ meta.ai พาไปหน้าแชตใหม่ — กดกลับห้องบนสุดในแถบซ้าย แล้วดูว่ายังทำคลิปอยู่ไหม');
      if (!(await backToChat(knowns[0]))) throw new MetaError('กลับเข้าห้องที่ส่ง prompt ไม่ได้');
    }
    // meta.ai ยังทำคลิปนี้อยู่ / คลิปขึ้นแล้ว → ไม่พิมพ์ “ทำมา” (เดิมพิมพ์เลย = meta ทำคลิปเดิมซ้ำอีกรอบ)
    const k0 = knowns[0];
    const working = () => isBusy() || allVideos().some((v) => srcOf(v) && !k0.els.has(v) && !k0.norm.has(normSrc(srcOf(v))));
    if (await waitFor(working, 15000, 1000)) {
      log('↩ meta.ai ยังทำคลิปนี้อยู่ — ไม่พิมพ์ “ทำมา” (กันทำคลิปเดิมซ้ำ) · รอผลต่อ', 'ok');
      const base = errBaseline();
      knowns.forEach((k) => Object.assign(k, base));
      return false;
    }
    await dismissMetaErrors();
    const input = await waitFor(findInput, 15000);
    if (!input || !(await insertInto(input, 'ทำมา'))) throw new MetaError('พิมพ์ “ทำมา” ไม่ได้');
    await nap(500);
    await submit(findInput() || input);
    log(`⌨ พิมพ์ “ทำมา” แล้ว · หน้า ${location.pathname}`);
    const base = errBaseline();
    knowns.forEach((k) => Object.assign(k, base));
  }
  // ทำต่อหลังหน้าโหลดใหม่: หน้าเปิดห้องเดิม (เห็น prompt ของตัวที่ค้าง) + meta.ai ยังทำงานอยู่/มีคลิปหลัง prompt แล้ว → รอผลเดิม ไม่ส่ง prompt ซ้ำ
  // ไม่เห็น prompt / meta.ai ว่างและไม่มีคลิป (งานหายไปกับการโหลดหน้า) → null = ส่งใหม่ตามปกติ
  async function adoptSent(cur) {
    if (!cur || !cur.head || !(await waitFor(() => findAnchor(cur.head), 15000, 500))) return null;
    const after = (x) => { const a = findAnchor(cur.head); return !!a && !!(a.compareDocumentPosition(x) & Node.DOCUMENT_POSITION_FOLLOWING); };
    if (!(await waitFor(() => isBusy() || allVideos().some((v) => srcOf(v) && after(v)), 20000, 1000))) return null;
    const vs = allVideos().filter((v) => !after(v));
    const known = { els: new Set(vs), norm: new Set(vs.map((v) => normSrc(srcOf(v))).filter(Boolean)), head: cur.head, strict: true, ...errBaseline() };
    known.sentAt = cur.at || Date.now();
    const pk = imgSnapshot(cur.head); // รูปที่อยู่บนหน้าแล้วไม่นับ (แยกรูปที่แนบไปกับรูปที่ meta.ai ทำไม่ได้) — ได้รูปใหม่ไม่ครบ = สั่งรูปแยกตามปกติ
    pk.sentAt = known.sentAt;
    return { known, pk };
  }
  // ส่ง 1 ครั้ง → รอคลิป (คลิปเดียว) → โหลด · คืนจำนวนไฟล์คลิปที่โหลดได้
  // extras.photos = สั่งรูปโพสต์ 4 ภาพใน prompt เดียวกัน แล้วโหลดรูปต่อ · extras.post = ให้เขียนคอนเทนต์โพสต์มาด้วย แล้วเก็บไว้ทำ .txt
  async function makeClipOnce(p, base, label, extras) {
    const withPhotos = !!extras.photos;
    let known, pk;
    const adopt = extras.adopt ? await adoptSent(extras.adopt) : null;
    if (adopt) {
      ({ known, pk } = adopt);
      log(`↺ ${base}: หน้าโหลดใหม่ระหว่างรอ — prompt เดิมยังอยู่ และ meta.ai ${isBusy() ? 'ยังทำงานอยู่' : 'ส่งคลิปมาแล้ว'} → รอผลเดิม ไม่ส่ง prompt ซ้ำ`, 'ok');
    } else {
    setStatus(p, `⏳ รอ meta.ai ว่าง${label}`);
    await waitIdle();
    setStatus(p, `⏳ ใส่ prompt${label}`);
    const input = await waitFor(findInput, 30000);
    if (!input) throw new Error('หาช่องพิมพ์ไม่เจอ');
    const prompt = buildPrompt({ photos: withPhotos, post: !!extras.post });
    known = snapshot(headOf(prompt)); // บรรทัด Product: "…"
    await dismissMetaErrors(); // ปิดแถบ error ของรอบก่อน แล้วค่อยตั้งจุดเริ่ม
    Object.assign(known, errBaseline());
    pk = imgSnapshot(known.head); // รูปที่มีอยู่ก่อนส่ง (ไม่นับเป็นรูปโพสต์)
    const files = sendFiles();
    const flat = prompt.replace(/\s+/g, ' ').trim();
    if (files.length) {
      const r = await attachFiles(files);
      if (!r.ok) throw new Error('แนบรูปไม่ได้');
      log(`📎 ${base}: แนบรูป ${files.length} ไฟล์ (${files.map((x) => x.name).join(', ').slice(0, 90)}) · หน้า ${location.pathname}`);
      await nap(1500);
    }
    const box = findInput() || input;
    if (!(await insertInto(box, prompt))) throw new Error('ใส่ข้อความไม่ได้');
    // meta.ai ไม่บอกเพดานความยาว prompt → เช็กว่าท้าย prompt (กฎห้ามราคา/เด็ก) อยู่ในช่องพิมพ์ครบ ไม่งั้นไม่ส่ง
    const inBox = () => boxText(findInput() || box);
    if (!(await waitFor(() => inBox().includes(flat.slice(-14)), 2000, 200))) {
      throw new Error(`meta.ai รับ prompt ไม่ครบ (ในช่องมี ${inBox().length.toLocaleString()} จาก ${flat.length.toLocaleString()} ตัวอักษร) — ไม่ส่ง เพราะกฎท้าย prompt จะหาย · ลดฉาก/รายละเอียดสินค้าแล้วลองใหม่`);
    }
    log(`⌨ ${base}: วาง prompt แล้ว (ในช่องพิมพ์ ${inBox().length.toLocaleString()} ตัวอักษร) — กำลังกดส่ง`);
    await nap(800);
    const how = await submit(box);
    known.sentAt = pk.sentAt = Date.now(); // นับเวลา "meta.ai ไม่ทำงาน" จากตอนส่งจริง
    if (files.length) ignoreSentImages(pk); // รูปที่แนบไปไม่นับเป็นรูปโพสต์
    log(`➤ ${base}: ส่งแล้ว (${how})${files.length ? ` + รูป ${files.length}` : ''}${withPhotos ? ` · สั่งรูปคอมเมนต์ ${photoN()} ภาพด้วย` : ''} · prompt ${flat.length.toLocaleString()} ตัวอักษร · หน้า ${location.pathname}`);
    }
    run.cur = { id: p.id, head: known.head, at: known.sentAt }; setRunFlag(true); // หน้าโหลดใหม่ระหว่างรอ = ทำต่อแล้วรอผลของ prompt นี้ (ไม่ส่งซ้ำ)
    setStatus(p, `⏳ กำลังสร้างคลิป ${seconds()} วิ${label}`);
    // รอคลิป (คลิปเดียว) · meta.ai ขึ้น error → พิมพ์ "ทำมา" ต่อในแชตเดิม (นับรวมกับ makeClip รอบละ 3 ครั้ง)
    const tries = extras.tries || { fails: 0 };
    let picks;
    for (;;) {
      try { picks = await collectClips(known); break; } catch (e) {
        if (!(e instanceof MetaError)) throw e;
        tries.fails++;
        if (tries.fails % 3 === 0) throw e; // ครบรอบละ 3 ครั้ง → ให้ makeClip ตัดสิน (เอารูปพรีเซนเตอร์ออก / ข้าม)
        log(`⚠ meta.ai: “${e.message}” — ดูก่อนว่าพังจริงไหม แล้วค่อยพิมพ์ “ทำมา” (ครั้งที่ ${(tries.fails % 3) + 1}/3${noFace ? ' · ไม่ใช้รูปพรีเซนเตอร์' : ''})`, 'warn');
        setStatus(p, `↪ บอก meta.ai “ทำมา”${label}`);
        await nap(5000);
        await nudgeMeta(known, pk);
      }
    }
    run.cur = null; setRunFlag(true); // ได้คลิปแล้ว — หน้าโหลดใหม่หลังจากนี้ไม่ต้องรอผลเดิม
    rememberClips(picks.map((x) => x.fp)); // กันโหลดซ้ำรอบหน้า
    if (picks[0] && !(mediaFor.get(p.id) || {}).video) rememberMedia(p, { video: picks[0] }); // เก็บไว้โพสต์ FB (แบบแรก)
    const outs = picks.map((x) => ({ clip: x, name: base }));
    setStatus(p, `⬇ ดาวน์โหลด${label}`);
    let saved = 0;
    for (const f of outs) {
      try { const fid = await saveVideo(f.clip, f.name); if (Number.isInteger(fid)) p.clipFiles = [...(p.clipFiles || []), fid]; saved++; bump('clips'); log(`✅ โหลดแล้ว ${f.name}`, 'ok'); }
      catch (e) { log(`❌ โหลด ${f.name} ไม่ได้ (${e.message || e}) - กดโหลดเองใน meta.ai`, 'err'); }
      await nap(800);
    }
    if (saved) { p.clipAt = Date.now(); save(); }
    if (ctxGone()) throw new CtxGone('ส่วนเสริมถูก Reload ระหว่างทำ — รูป/แคปชันของตัวนี้ทำต่อไม่ได้'); // คลิปอยู่ในเครื่องแล้ว — ถ้าค้าง/หยุดตอนรอรูปหรือแคปชัน รอบหน้าไม่ทำซ้ำ
    // โพสต์ที่ตอบมาพร้อมคลิป (อ่านหลังคลิปเสร็จ ข้อความพิมพ์เสร็จแล้ว)
    let post = extras.post && saved ? await waitPost(known.head, 8000) : null;
    if (withPhotos && saved) { // รูปโพสต์ไม่ได้ ไม่ถือว่าคลิปพลาด
      try { await collectPhotos(p, base, pk, label, () => { if (extras.post && !post) post = readPost(known.head); }); } catch (e) {
        if (e instanceof Stopped) throw e;
        log(`⚠ ${base}: ทำรูปโพสต์ไม่ได้ (${e.message || e}) — คลิปยังได้ปกติ`, 'warn');
      }
    }
    if (extras.post && saved && !post && withPhotos) post = await waitPost(known.head, 3000); // แคปชันอาจตอบมาทีหลังระหว่างรอรูป → ไม่ต้องขอซ้ำ
    if (extras.post && saved && !post) { // ไม่ได้มาพร้อมคลิป → ขอแยกอีกข้อความ (ตัวหนังสือล้วน)
      setStatus(p, `✍ ขอแคปชันโพสต์${label}`);
      log(`meta.ai ไม่ได้ส่งโพสต์มาพร้อมคลิป — ขอแคปชันแยกอีกข้อความ`);
      try { post = await askPost(p); } catch (e) { if (e instanceof Stopped) throw e; }
    }
    if (post) { Object.assign(p, post); save(); log(`📝 ${base}: ได้แคปชันโพสต์ + แฮชแท็ก ${post.tags.length} อัน`, 'ok'); }
    else if (extras.post && saved) log(`⚠ ${base}: ไม่ได้แคปชันจาก meta.ai — ใช้ชื่อสินค้า + แฮชแท็กพื้นฐานแทน`, 'warn');
    return saved;
  }

  // ---------- รูปโพสต์ 4 ภาพ: สั่งใน prompt คลิป (หรือข้อความแยกถ้าไม่ได้) → รอรูปใหม่ที่อยู่หลังข้อความนี้ → โหลด ----------
  const imgSrc = (i) => i.currentSrc || i.src || '';
  function imgSnapshot(head) { // รูปที่มีอยู่ก่อนส่ง (ไม่นับ)
    const imgs = [...document.querySelectorAll('img')];
    return { els: new Set(imgs), srcs: new Set(imgs.map((i) => normSrc(imgSrc(i))).filter(Boolean)), head, ...errBaseline() };
  }
  // รูปที่เราแนบโผล่ในข้อความที่ส่ง (ภายในไม่กี่วิหลังกดส่ง — meta.ai ทำรูปจริงนานกว่านั้นมาก) → จำไว้ว่าไม่ใช่รูปโพสต์
  // (ถ้าหน้าเว็บวางรูปแนบไว้ใต้ข้อความ prompt จะถูกนับเป็นรูปโพสต์ แล้วโหลด/โพสต์ผิดรูป)
  function ignoreSentImages(known, ms = 5000) {
    setTimeout(() => {
      for (const i of document.querySelectorAll('img')) {
        if (known.els.has(i) || isOurs(i)) continue;
        known.els.add(i);
        const s = normSrc(imgSrc(i));
        if (s) known.srcs.add(s);
      }
    }, ms);
  }
  // รูปปกวิดีโอ (poster / รูปข้างวิดีโอ) ไม่ใช่รูปโพสต์
  // = ลิงก์ตรงกับปกวิดีโอ หรือวางซ้อนทับตัววิดีโอ (ภาพปกก่อนกดเล่น) · รูปที่อยู่กล่องเดียวกับวิดีโอแต่วางข้างๆ = รูปโพสต์ (meta.ai วางรูป 4 ภาพกับคลิปไว้ด้วยกัน — เดิมตัดทิ้งหมด)
  const videoThumb = (i) => {
    const s = normSrc(imgSrc(i)), r = i.getBoundingClientRect();
    return allVideos().some((v) => {
      if (v.poster && normSrc(v.poster) === s) return true;
      const q = v.getBoundingClientRect();
      const ox = Math.max(0, Math.min(r.right, q.right) - Math.max(r.left, q.left)), oy = Math.max(0, Math.min(r.bottom, q.bottom) - Math.max(r.top, q.top));
      return r.width * r.height > 0 && ox * oy > 0.5 * r.width * r.height;
    });
  };
  // รูปที่ meta.ai สร้าง: อยู่หลังข้อความที่เราส่ง · โหลดเสร็จ · ใหญ่พอ (ไม่ใช่ไอคอน/อวตาร/รูปที่เราแนบ/ปกวิดีโอ)
  // loose = ข้อความสั่งรูปแยก (ไม่มีวิดีโอในคำตอบนี้): ไม่ตัดรูปที่อยู่กล่องเดียวกับวิดีโอ (การ์ดรูปของ meta.ai มีวิดีโอพรีวิวซ่อนอยู่ได้) · รับรูปเล็กลง (รูปย่อในตาราง)
  // skipped = เก็บเหตุผลของรูปใหม่ที่ไม่เอา (ไว้บอกในบันทึกตอนหาไม่เจอ)
  function newImages(known, loose = false, skipped = null) {
    const anchor = findAnchor(known.head);
    if (!anchor) return [];
    const out = new Map(); // ลิงก์ไม่มีพารามิเตอร์ → ลิงก์เต็ม (ลิงก์ fbcdn ต้องมีลายเซ็นถึงจะโหลดได้)
    for (const i of document.querySelectorAll('img')) {
      const s = imgSrc(i);
      if (isOurs(i) || known.els.has(i)) continue;
      if (!(anchor.compareDocumentPosition(i) & Node.DOCUMENT_POSITION_FOLLOWING) || known.srcs.has(normSrc(s))) continue;
      const w = i.naturalWidth, rw = Math.round(i.getBoundingClientRect().width);
      const why = !(loose ? /^(https:|blob:|data:image\/)/ : /^(https:|blob:)/).test(s) ? `ลิงก์ ${s.slice(0, 12)}`
        : w < 256 ? `เล็ก ${w}px` : rw < (loose ? 60 : 80) ? `แสดงเล็ก ${rw}px`
        : (loose ? allVideos().some((v) => v.poster && normSrc(v.poster) === normSrc(s)) : videoThumb(i)) ? 'ปก/ข้างวิดีโอ' : '';
      if (why) { if (skipped) skipped.push(why); continue; }
      if (!out.has(normSrc(s))) out.set(normSrc(s), s);
    }
    return [...out.values()];
  }
  const imgSkipNote = (known, loose) => { const sk = []; newImages(known, loose, sk); return sk.length ? ` (รูปใหม่ที่ไม่เอา ${sk.length} รูป: ${[...new Set(sk)].slice(0, 4).join(', ')})` : ' (ไม่เห็นรูปใหม่หลังข้อความเลย)'; };
  // รอรูปใหม่หลังข้อความของเรา · tick(ได้กี่รูป, กี่วิ) ไว้โชว์ความคืบหน้า · คืน [] = meta.ai ว่างแล้วแต่ไม่มีรูปใหม่เลย (ไม่ได้ทำรูปมา)
  // idleAfter = ต้องผ่านไปกี่ ms หลังส่งก่อนจะสรุปว่าไม่ทำรูป (ส่งรูปแยก: ต้องรอให้เริ่มทำก่อน)
  // busyMax = ครบเวลาแล้ว meta.ai ยังทำงานอยู่ → รอต่อได้ถึงเท่านี้ (รูปที่สั่งพร้อมคลิปมาช้า — เดิมเลิกรอแล้วสั่งรูปซ้ำ ทั้งที่ meta.ai กำลังทำให้)
  async function waitForNewImages(known, ms, tick, idleAfter = 20000, loose = false, busyMax = ms) {
    const t0 = Date.now(), hardEnd = t0 + Math.max(ms, busyMax);
    let end = t0 + ms, prevN = -1, stable = 0, idleEmpty = 0;
    for (;;) {
      if (Date.now() >= end) { if (!isBusy() || Date.now() >= hardEnd) break; end = Math.min(hardEnd, Date.now() + 15000); }
      await nap(2500);
      const got = newImages(known, loose);
      if (tick) tick(got.length, Math.round((Date.now() - t0) / 1000));
      if (!got.length) {
        const err = newMetaError(known);
        if (err && !isBusy()) throw new MetaError(err); // ยังทำงานอยู่ = รอดูก่อน
        idleEmpty = !isBusy() && Date.now() - (known.sentAt || t0) > idleAfter ? idleEmpty + 1 : 0;
        if (idleEmpty >= 10) return []; // ว่างแล้ว ไม่มีรูปใหม่ ~25 วิ → ไม่ต้องรอจนหมดเวลา
        prevN = 0; stable = 0;
        continue;
      }
      idleEmpty = 0;
      // นับจำนวนรูปที่นิ่ง (ลิงก์รูปเปลี่ยนได้ตอนโหลดความละเอียดสูงขึ้น — เดิมเทียบลิงก์ เลยไม่นิ่งสักทีแล้วค้างจนหมดเวลา)
      // ครบ 4 นิ่ง 2 รอบ · ไม่ครบแต่ไม่เพิ่มแล้ว ~12 วิ และ meta.ai ว่างแล้ว (ทำให้น้อยกว่า 4)
      if (got.length === prevN) { stable++; if ((got.length >= Math.max(1, photoN()) && stable >= 1) || (stable >= 5 && !isBusy())) return newImages(known, loose).slice(0, Math.max(1, photoN())); } else stable = 0;
      prevN = got.length;
    }
    const last = newImages(known, loose); // หมดเวลาแต่ได้รูปมาบ้าง = เอาเท่าที่ได้ (เดิมทิ้งหมดแล้วสั่งรูปใหม่)
    if (last.length) return last.slice(0, Math.max(1, photoN()));
    throw new Error(`รอรูปนานเกิน ${Math.round((Date.now() - t0) / 60000)} นาที${imgSkipNote(known, loose)}`);
  }
  async function saveImage(src, base, keep) { // keep = เก็บสำเนารูป (data URL) ไว้โพสต์ FB
    try { // โหลดในหน้าได้ → รู้ชนิดไฟล์จริง
      const blob = await (await fetch(src)).blob();
      const ext = /png/.test(blob.type) ? 'png' : /webp/.test(blob.type) ? 'webp' : 'jpg';
      const data = await blobToDataUrl(blob);
      if (keep) keep.push(data);
      return await bgDownload(data, `ShopeeVideo/${base}.${ext}`);
    } catch (e) {
      if (src.startsWith('blob:')) throw e;
      return bgDownload(src, `ShopeeVideo/${base}.jpg`); // ข้ามโดเมน → ให้ Chrome โหลดเอง
    }
  }
  // p.photoFiles = เลขไฟล์ดาวน์โหลดของรูปโพสต์ → ลบไฟล์ในเครื่องได้หลังโพสต์รูปลงเพจแล้ว
  async function downloadPhotos(got, base, p) {
    const ids = [], keep = [];
    for (let k = 0; k < got.length; k++) {
      try { const id = await saveImage(got[k], `${base}-photo-${k + 1}`, keep); if (Number.isInteger(id)) ids.push(id); } catch (e) { log(`⚠ โหลดรูป ${k + 1} ไม่ได้ (${e.message || e})`, 'warn'); }
      await nap(500);
    }
    if (p && keep.length) { mediaFor.set(p.id, { ...(mediaFor.get(p.id) || {}), photoData: keep }); mediaPut(`photos:${p.id}`, keep); } // ลบแชตเก่า/รีเฟรชแล้วยังโพสต์รูปลงเพจได้ (ลิงก์รูปของ meta.ai อาจใช้ไม่ได้)
    if (p) { p.photoFiles = ids; save(); }
    log(`🖼 ${base}: โหลดรูปโพสต์ ${ids.length}/${got.length} ภาพ`, ids.length ? 'ok' : 'warn');
  }
  // รูปที่สั่งมาพร้อมคลิป: มักขึ้นพร้อม/ก่อนคลิป → รอ 90 วิ (meta.ai ยังทำงานอยู่ = รอได้ถึง 5 นาที) · ไม่มาเลย = สั่งแยกอีกข้อความ (สำรอง)
  // beforeAsk = เรียกก่อนส่งข้อความสั่งรูปแยก (เก็บแคปชันที่ตอบมากับคลิปไว้ก่อน)
  async function collectPhotos(p, base, known, label, beforeAsk) {
    setStatus(p, `⏳ รอรูปคอมเมนต์ ${photoN()} ภาพ${label}`);
    let got = [];
    const tick = (n, sec) => setStatus(p, `⏳ รอรูปคอมเมนต์ ${photoN()} ภาพ${label} · ได้ ${n}/${photoN()} · ${sec} วิ`);
    try { got = await waitForNewImages(known, 90000, tick, 20000, false, 5 * 60000); } catch (e) { if (e instanceof Stopped) throw e; }
    if (!got.length) { log(`meta.ai ไม่ได้ทำรูปมาพร้อมคลิป${imgSkipNote(known, false)} — สั่งทำรูปแยกอีกข้อความ`, 'warn'); return makePhotos(p, base, beforeAsk); }
    rememberMedia(p, { photos: got }); // เก็บไว้โพสต์ FB
    await downloadPhotos(got, base, p);
  }
  async function makePhotos(p, base, beforeAsk) {
    setStatus(p, `⏳ สั่งทำรูปคอมเมนต์ ${photoN()} ภาพ`);
    await waitIdle();
    if (beforeAsk) beforeAsk(); // ข้อความสั่งรูปขึ้นต้น Product: "…" เหมือน prompt คลิป → ส่งแล้วหาแคปชันที่ตอบมากับคลิปไม่เจอ (เดิมต้องขอแคปชันซ้ำ)
    const input = await waitFor(findInput, 30000);
    if (!input) throw new Error('หาช่องพิมพ์ไม่เจอ');
    const prompt = buildPhotoPrompt();
    await dismissMetaErrors();
    const known = imgSnapshot(headOf(prompt)); // บรรทัด Product: "…"
    const files = sendFiles();
    if (files.length) {
      if (!(await attachFiles(files)).ok) throw new Error('แนบรูปไม่ได้');
      await nap(1500);
    }
    const box = findInput() || input;
    if (!(await insertInto(box, prompt))) throw new Error('ใส่ข้อความไม่ได้');
    await nap(800);
    await submit(box);
    known.sentAt = Date.now();
    if (files.length) ignoreSentImages(known); // รูปที่แนบไปไม่นับเป็นรูปโพสต์
    log(`➤ ${base}: สั่งทำรูปคอมเมนต์ ${photoN()} ภาพแล้ว`);
    setStatus(p, '⏳ กำลังสร้างรูปโพสต์');
    const got = await waitForNewImages(known, 4 * 60000, (n, sec) => setStatus(p, `⏳ กำลังสร้างรูปคอมเมนต์ · ได้ ${n}/${photoN()} · ${sec} วิ`), 90000, true, 6 * 60000);
    if (!got.length) throw new Error(`จับรูปที่ meta.ai ทำไม่ได้${imgSkipNote(known, true)}`);
    rememberMedia(p, { photos: got }); // เก็บไว้โพสต์ FB
    await downloadPhotos(got, base, p);
  }

  // เปิดแชตใหม่บน meta.ai (ปุ่ม New chat / แชตใหม่) — ไม่โหลดหน้าใหม่ คลิป/รูปที่จำไว้โพสต์ FB ยังอยู่
  const NEW_CHAT_RE = /^(new chat|new conversation|start (?:a )?new (?:chat|conversation)|create new chat|แชตใหม่|แชทใหม่|สนทนาใหม่|การสนทนาใหม่|เริ่มแชตใหม่|เริ่มแชทใหม่|เริ่มการสนทนาใหม่|เริ่มบทสนทนาใหม่)$/i;
  async function newChat() {
    await waitIdle();
    const labels = (b) => [b.getAttribute('aria-label'), b.title, b.textContent, ...[...b.querySelectorAll('[aria-label], [title], title')].map((x) => x.getAttribute('aria-label') || x.getAttribute('title') || x.textContent)];
    const isNew = (b) => labels(b).some((x) => NEW_CHAT_RE.test(String(x || '').replace(/\s+/g, ' ').trim())) || /new[-_ ]?(chat|conversation)/i.test(b.getAttribute('data-testid') || ''); // ป้าย/ชื่อ/ตัวหนังสือ (ของปุ่มหรือไอคอนข้างใน) ตัวใดตัวหนึ่งตรง
    // ลิงก์ New chat ของ meta.ai (data-testid) — กดได้แม้แถบซ้ายพับอยู่ · ไม่มี = หาจากชื่อปุ่ม
    const ownNew = () => document.querySelector('a[data-testid="new-chat-button"], button[data-testid="new-chat-button"]');
    const btn = ownNew() || [...document.querySelectorAll('a, button, [role=button]')].find((b) => !isOurs(b) && shown(b) && isNew(b));
    if (!btn) {
      if (!run.on) { log('⚠ หาปุ่มแชตใหม่ของ meta.ai ไม่เจอ — ทำต่อในแชตเดิม', 'warn'); return false; }
      log('🆕 หาปุ่มแชตใหม่ไม่เจอ — โหลดหน้าแรก meta.ai ใหม่ (= แชตใหม่) แล้วทำคิวต่อเองใน 10 วิ', 'warn');
      chatCount = { path: '', n: 0 }; saveChat(); setRunFlag(true);
      await nap(800);
      location.href = `${location.origin}/`;
      await nap(60000); // หน้ากำลังโหลดใหม่ — โค้ดหน้านี้จะหยุดเอง
      return false;
    }
    const url = location.href, oldPath = location.pathname, vids = allVideos().length, hadOurs = !!findAnchor(CLIP_HEAD);
    btn.click();
    // เปลี่ยนห้องจริง = ลิงก์หน้าเปลี่ยน หรือ prompt ของเรา/คลิปหายจากหน้า · เดิมเช็กทันทีหลังกด และผ่านเลยถ้าไม่มีวิดีโอบนจอ (meta.ai ยังไม่เปลี่ยนห้อง)
    // → ไปวาง prompt ตัวถัดไปในห้องเก่า แล้วห้องเปลี่ยนทีหลัง prompt หาย · แชตเก่าไม่ถูกลบ (ลิงก์ยังเป็นห้องเดิม)
    await nap(1000);
    const moved = () => location.href !== url || (hadOurs ? !findAnchor(CLIP_HEAD) : allVideos().length < vids);
    const ok = hadOurs || vids ? await waitFor(() => findInput() && moved(), 15000, 500)
      : (await nap(2000), findInput()); // ห้องนี้ไม่มีข้อความ/คลิปของเรา (ตัวก่อนพลาดก่อนส่ง) — ดูไม่ออกว่าเปลี่ยนแล้วไหม · แค่ให้ช่องพิมพ์ว่าง
    log(ok ? `🆕 เปิดแชตใหม่บน meta.ai แล้ว (${oldPath} → ${location.pathname})` : `⚠ เปิดแชตใหม่ไม่สำเร็จ (ยังอยู่ ${location.pathname}) — ทำต่อในแชตเดิม`, ok ? 'ok' : 'warn');
    await nap(2000);
    if (ok && st.delOldChat !== false) {
      await deleteChat(oldPath);
      if (oldPath !== '/' && location.pathname === oldPath) { // กด … ของแชตเก่าในแถบซ้ายแล้วหน้าพาเข้าแชตเก่า → กลับไปแชตใหม่ ไม่งั้นสินค้าตัวถัดไปลงแชตเก่า
        log('⚠ หลังลบแชตเก่า หน้าพากลับเข้าแชตเก่า — เปิดแชตใหม่อีกครั้ง', 'warn');
        const again = ownNew() || [...document.querySelectorAll('a, button, [role=button]')].find((b) => !isOurs(b) && shown(b) && isNew(b));
        if (again) { again.click(); await waitFor(() => location.pathname !== oldPath && findInput(), 15000, 500); }
        await nap(1500);
        if (location.pathname === oldPath) { log('⚠ กลับไปแชตใหม่ไม่ได้ — ทำต่อในแชตเดิม', 'warn'); return false; }
      }
    }
    return !!ok;
  }
  // ลบแชตเก่าบน meta.ai (หลังเปิดแชตใหม่แล้ว): แถบซ้าย → ปุ่ม … ของแชตนั้น → ลบ → ยืนยัน
  // ทำไม่ได้ขั้นไหน = ข้าม (ไม่หยุดคิว) · พลาด 3 ครั้งติด = พักการลบไว้ทั้งรอบ (หน้าเว็บอาจเปลี่ยน → 🔍 ส่งข้อมูลหน้าเว็บมาให้ปรับ)
  const DEL_RE = /^(delete|delete chat|delete conversation|ลบ|ลบแชต|ลบแชท|ลบการสนทนา|ลบบทสนทนา)$/i;
  const MORE_RE = /more|option|menu|action|ตัวเลือก|เพิ่มเติม|การดำเนินการ|^(…|\.\.\.|⋯|⋮)$/i;
  let delFails = 0;
  async function deleteChat(path) {
    if (!path || path === '/' || path === location.pathname || delFails >= 3) return false;
    const lbl = (b) => String(b.getAttribute('aria-label') || b.title || b.textContent || '').replace(/\s+/g, ' ').trim();
    const pathOf = (a) => { try { return new URL(a.getAttribute('href'), location.href).pathname; } catch (e) { return ''; } };
    const linkOf = () => [...document.querySelectorAll('a[href]')].find((a) => !isOurs(a) && pathOf(a) === path);
    const press = (b) => { ['pointerdown', 'mousedown', 'pointerup', 'mouseup'].forEach((t) => b.dispatchEvent(new MouseEvent(t, { bubbles: true }))); b.click(); }; // เมนูบางแบบเปิดตอน pointerdown
    const fail = (why) => {
      delFails++;
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); // ปิดเมนูที่ค้าง
      log(`⚠ ลบแชตเก่าไม่ได้ (${why})${delFails >= 3 ? ' — พักการลบแชตเก่าไว้ก่อน (กด 🔍 คัดลอกข้อมูลหน้าเว็บส่งมาให้ปรับได้)' : ''}`, 'warn');
      return false;
    };
    try {
      const link = linkOf();
      if (!link) return fail('ไม่เห็นแชตเก่าในแถบซ้าย — เปิดแถบซ้ายของ meta.ai ค้างไว้');
      // ปุ่ม … ของแถวนี้ (บางหน้าโชว์ตอนเอาเมาส์ชี้) — ไล่ขึ้นไม่เกิน 4 ชั้น ไม่เลยไปถึงกล่องที่มีหลายแชต
      let more = null;
      for (let row = link, k = 0; row && k < 4 && !more; row = row.parentElement, k++) {
        if (k && [...row.querySelectorAll('a[href]')].filter((a) => !isOurs(a) && pathOf(a) !== path).length) break;
        ['pointerover', 'pointerenter', 'mouseover', 'mouseenter'].forEach((t) => row.dispatchEvent(new MouseEvent(t, { bubbles: true })));
        more = [...row.querySelectorAll('button, [role=button], [aria-haspopup]')].find((b) => b !== link && !isOurs(b) && (b.getAttribute('aria-haspopup') || MORE_RE.test(lbl(b))));
      }
      if (!more) return fail('ไม่เจอปุ่ม … ของแชตเก่า');
      press(more);
      const item = await waitFor(() => {
        const vis = (q) => [...document.querySelectorAll(q)].filter((x) => !isOurs(x) && shown(x));
        return vis('[role=menuitem]').find((x) => DEL_RE.test(lbl(x))) || vis('[role=menu] button, [role=menu] li, [role=listbox] [role=option]').find((x) => DEL_RE.test(lbl(x)));
      }, 4000, 300);
      if (!item) return fail('ไม่เจอคำสั่ง “ลบ” ในเมนู');
      press(item);
      // หน้ายืนยัน (ถ้ามี) → กดลบ
      const okBtn = await waitFor(() => [...document.querySelectorAll('[role=dialog] button, [role=alertdialog] button')].find((x) => !isOurs(x) && shown(x) && /^(delete|ลบ|ยืนยัน|confirm|ok|ตกลง)$/i.test(lbl(x))), 3000, 300);
      if (okBtn) press(okBtn);
      if (!(await waitFor(() => !linkOf(), 6000, 500))) return fail('กดลบแล้วแชตเก่ายังอยู่');
      delFails = 0;
      log(`🗑 ลบแชตเก่าบน meta.ai แล้ว (${path}) · ตอนนี้อยู่ ${location.pathname}`, 'ok');
      return true;
    } catch (e) {
      if (e instanceof Stopped) throw e;
      return fail(String(e.message || e).slice(0, 80));
    }
  }
  // นับสินค้าที่ส่งตั้งแต่ส่วนเสริมเปิดแชตใหม่ครั้งล่าสุด (นับต่อข้ามรอบรัน/รีเฟรช · ตัวที่พลาดก็นับ เพราะข้อความก็ค้างในแชต)
  // ไม่ผูกกับลิงก์หน้า — meta.ai อาจเปลี่ยนลิงก์ทุกข้อความ (เดิมผูกไว้ เลยนับเริ่มใหม่ตลอด ไม่เคยถึง N)
  let chatCount = { path: '', n: 0 };
  try { chrome.storage.local.get('mahChat', (o) => { if (o && o.mahChat && typeof o.mahChat.n === 'number') chatCount = o.mahChat; }); } catch (e) {}
  const saveChat = () => { try { chrome.storage.local.set({ mahChat: chatCount }); } catch (e) {} };
  function bumpChat() { chatCount.n = (chatCount.n || 0) + 1; saveChat(); return chatCount.n; }
  const chatFull = () => +st.newChat > 0 && chatCount.n >= +st.newChat;
  async function freshChat() { // เปิดแชตใหม่สำเร็จ = เริ่มนับใหม่
    if (!(await newChat())) return false;
    chatCount = { path: location.pathname, n: 0 }; saveChat();
    composerDirty = false; // ห้องใหม่ = ช่องพิมพ์ว่าง
    return true;
  }
  // สั่ง meta.ai ล้างไฟล์เก่า (ข้อความแยก ไม่ทำวิดีโอ) ทุก N คลิปที่ทำเสร็จ
  let cleanCount = 0;
  async function maybeSweep() {
    cleanCount++;
    try { chrome.storage.local.set({ mahCleanCount: cleanCount }); } catch (e) {}
    const n = +st.cleanEvery || 5;
    if (!st.cleanOn || cleanCount % n) return; // "ทุกคลิป" = ล้างหลังทุกคลิป (ไม่ใส่คำสั่งไฟล์ใน prompt แล้ว)
    log(`🧹 ครบ ${n} คลิป — สั่ง meta.ai ล้างไฟล์เก่า`);
    try {
      await waitIdle();
      const input = await waitFor(findInput, 30000);
      if (!input || !(await insertInto(input, R.files.sweep))) throw new Error('ใส่ข้อความไม่ได้');
      await nap(600);
      await submit(findInput() || input);
      await nap(5000);
      await waitIdle();
      log('🧹 สั่งล้างไฟล์แล้ว', 'ok');
    } catch (e) {
      if (e instanceof Stopped) throw e;
      log(`⚠ สั่งล้างไฟล์ไม่สำเร็จ (${e.message || e}) — ทำต่อ`, 'warn');
    }
  }

  async function runQueue(opts = {}) {
    if (run.on) return;
    const queue = todo();
    if (!queue.length) { msg('ไม่มีสินค้าที่ยังไม่เสร็จในคิว', 'err'); return; }
    const problems = checkText(`${st.scriptMode === 'same' ? st.lines[1] || '' : ''} ${st.scene} ${st.text === 'none' ? '' : st.osText || ''}`);
    if (problems.length) { msg(`หยุด: บทพูด/ฉาก/ตัวหนังสือมีคำเสี่ยงผิดกฎ ${problems.join(' · ')}`, 'err'); return; }
    if (!findInput()) { msg('หาช่องพิมพ์ของ meta.ai ไม่เจอ - เปิดหน้าสร้างวิดีโอก่อน', 'err'); return; }
    run.on = true; run.stop = false; run.status = {};
    run.failed = opts.resumed ? [...(opts.failed || [])] : []; // ทำต่อหลังหน้าโหลดใหม่: ตัวที่พลาดไปแล้วไม่ทำซ้ำ
    run.attempts = opts.resumed ? { ...(opts.attempts || {}) } : {}; // นับรอบที่เริ่มแต่ละตัว (เก็บใน mahRun ผ่าน setRunFlag)
    run.cur = null; // prompt ที่ส่งแล้วกำลังรอคลิป (เก็บใน mahRun)
    let adoptCur = opts.resumed && opts.cur && opts.cur.id ? opts.cur : null; // หน้าโหลดใหม่ระหว่างรอคลิปตัวนี้ → รอผลเดิม ไม่ส่งซ้ำ
    if (!opts.resumed) run.log = [];
    setRunFlag(true);
    queue.forEach((p) => { run.status[p.id] = 'รอคิว'; });
    log(`เริ่มรันคิว ${queue.length} สินค้า · ${seconds()} วิ — เปิดแท็บนี้ค้างไว้`);
    // Gemini ไม่บังคับ: ไม่มี key / key ใช้ไม่ได้ / เขียนไม่สำเร็จ → ให้ meta.ai คิดบทเอง
    let useGemini = false; // Gemini ไม่เขียนบทพูดแล้ว (เอาออก) — meta.ai คิดเอง / บทที่พิมพ์เอง
    renderAll();
    try { await markExisting(adoptCur && adoptCur.head); } catch (e) {}
    let ok = 0;
    // หยิบตัวถัดไปจากคิวจริงทุกครั้ง: ตัวที่ลบ 🗑 ระหว่างรัน = ไม่ทำ · ตัวที่เพิ่มระหว่างรัน = ทำต่อให้ด้วย · ตัวที่ลองแล้ว (พลาด) ไม่วนซ้ำ
    const tried = new Set(run.failed);
    // 🧬 เวอร์ชันของสินค้าเดียวกันไม่ทำติดกัน (มีสินค้าอื่น = คั่นก่อน) · หน้าโหลดใหม่ระหว่างรอผลตัวไหน = ทำตัวนั้นก่อน
    let lastVg = null;
    const vgChat = new Map(); // กลุ่มเวอร์ชัน → แชตที่ส่งไปแล้ว (chatCount ของห้องนั้น)
    const nextItem = () => { const t = todo().filter((x) => !tried.has(x.id)); return (adoptCur && t.find((x) => x.id === adoptCur.id)) || (lastVg && t.find((x) => x.vg !== lastVg)) || t[0]; };
    try {
      if (composerDirty && nextItem()) { log('มีรูป/ข้อความที่ยังไม่ได้ส่งค้างในช่องพิมพ์ — เปิดแชตใหม่ก่อนเริ่ม (ไม่ให้ปนกับสินค้าตัวแรก)', 'warn'); await freshChat(); }
      else if (chatFull() && nextItem()) { log(`แชตนี้ส่งไปแล้ว ${chatCount.n} สินค้า (ครบ ${st.newChat}) — เปิดแชตใหม่ก่อนเริ่ม`); await freshChat(); }
      for (let i = 0, p; (p = nextItem()); i++) {
        if (ctxGone()) { ctxGoneNotice(); throw new Stopped(); }
        tried.add(p.id);
        lastVg = p.vg || null;
        if (p.clipAt) { // คลิปของตัวนี้โหลดไปแล้วรอบก่อน (ค้างตอนรอรูป/แคปชันแล้วหยุด/รีเฟรช) → ไม่ส่ง prompt เดิมซ้ำ
          p.done = true; histMark(p, 'made'); setStatus(p, '✅ เสร็จ'); save(); slimDone(p).then((x) => { if (x) save(); });
          if (st.post !== 'off' && !Number.isInteger(p.txtFile)) { try { await savePost(p, fileBase(p, safeName(p.name))); save(); log(`📝 ${safeName(p.name)}: เขียนไฟล์ข้อความโพสต์ (.txt) ที่ค้างให้แล้ว`, 'ok'); } catch (e) {} }
          log(`↷ ${safeName(p.name)}: คลิปโหลดไปแล้วรอบก่อน — ไม่ส่ง prompt ซ้ำ (อยากทำใหม่กด ↺ ทำใหม่)`, 'warn');
          continue;
        }
        run.attempts[p.id] = (run.attempts[p.id] || 0) + 1;
        if (run.attempts[p.id] > 2) { // หน้าเว็บโหลดใหม่กลางทางซ้ำๆ → ไม่วนส่งตัวเดิม
          run.failed.push(p.id); setRunFlag(true); bump('fail'); setStatus(p, '❌ ผิดพลาด');
          log(`❌ ${safeName(p.name)}: เริ่มใหม่ 2 รอบแล้วยังไม่จบ (หน้า meta.ai โหลดใหม่กลางทาง) — ข้ามไปตัวถัดไป · อยากลองใหม่กด ▶ อีกครั้ง`, 'err');
          continue;
        }
        if (!queue.includes(p)) log(`➕ ${safeName(p.name)}: เพิ่มเข้าคิวระหว่างรัน — ทำต่อให้`);
        const name = safeName(p.name || `สินค้า ${i + 1}`);
        runItem = p; run.cur = null; // ตัวก่อนพลาดระหว่างรอคลิป = ไม่ต้องรอผลของตัวนั้นแล้ว
        setRunFlag(true);
        svClaim(p);
        // 🧬 เวอร์ชันก่อนของสินค้านี้อยู่ในแชตนี้ → เปิดแชตใหม่ (ผู้ใช้: ค่อยๆ สั่ง meta.ai · แชตเดิมมีสินค้าตัวเดียวกัน = meta.ai อาจทำตามคลิปเดิม/อ่านแคปชันเก่า)
        if (p.vg && vgChat.get(p.vg) === chatCount && !(adoptCur && adoptCur.id === p.id)) { log(`🧬 ${name}: เวอร์ชันก่อนของสินค้านี้อยู่ในแชตนี้ — เปิดแชตใหม่ก่อน`); await freshChat(); }
        const fname = fileBase(p, name); // เวอร์ชันที่ไม่ลง Shopee → ShopeeVideo/FB-only/ชื่อ-vN
        const sends0 = sends;
        try {
          if (useGemini && needsScript(p)) {
            setStatus(p, '✍ Gemini กำลังเขียนบท');
            try { await writeScript(p); log(`✍ ${name}: “${p.script.split('\n').join(' / ')}”`); } catch (e) {
              if (e instanceof Stopped) throw e;
              p.scriptError = String(e.message || e);
              if (/API key/i.test(p.scriptError)) useGemini = false; // key ใช้ไม่ได้ → ไม่ต้องลองกับตัวถัดไป
              log(`⚠ ${name}: Gemini เขียนบทไม่ได้ (${p.scriptError}) — ให้ meta.ai คิดบทเองแทน`, 'warn');
            }
          }
          await ensureImages(p); // ตัวที่ทำเสร็จแล้วกดทำใหม่ → โหลดรูปสินค้าจากลิงก์ Shopee กลับมา
          const bad = st.scriptMode === 'same' ? [] : checkText(scriptOf(p)); // บทพิมพ์เองตรวจไปแล้วตอนเริ่ม
          if (bad.length) throw new Error(`บทพูดมีคำต้องห้าม: ${bad.join(' · ')}`);
          const variants = st.variants === '2' ? 2 : 1;
          let saved = 0;
          mediaFor.delete(p.id); mediaDel([p.id]); p.fbMedia = null; p.clipFiles = []; // ทำใหม่ = สื่อชุดใหม่สำหรับโพสต์ FB · เลขไฟล์คลิปชุดใหม่
          // กำหนดเพจ FB ปลายทางตอนทำคลิป (สลับทีละเพจ) → ใช้พรีเซนเตอร์ประจำเพจ หน้าในคลิป/รูปจะตรงกับเพจที่โพสต์
          const pg = assignFbPage(p);
          presenterOverride = pageFace(pg);
          modestNow = MODEST_RE.test(p.name || ''); modeOverride = modestNow ? 'none' : undefined;
          if (modestNow) log(`👗 ${name}: ชุดชั้นใน/ชุดนอนเซ็กซี่/ชุดว่ายน้ำ — ถ่ายสินค้าล้วน ไม่มีคนใส่ (meta.ai ไม่ทำแบบมีนางแบบ)`);
          if (maleNow()) log(`👨 ${name}: สินค้าผู้ชาย → คนและเสียงผู้ชาย${presenter() ? ` (หน้า: ${presenter().name})` : ' (ไม่แนบรูปหน้าผู้หญิง — meta สร้างผู้ชายให้)'}`);
          if (pg) log(`📘 ${name}: จะลงเพจ “${pg.name}”${presenterOverride ? ` · หน้า: ${presenterOverride.name}` : presenterOverride === null ? ' · ไม่ใช้รูปหน้า' : ''}`);
          // รูปโพสต์ 4 ภาพ: สั่งเฉพาะตอนติ๊ก 📷 ไว้
          const adopt = adoptCur && adoptCur.id === p.id ? adoptCur : null;
          if (adopt) adoptCur = null;
          const needPhotos = photosOn(); // ผู้ใช้: รูป = แนบคอมเมนต์ Reel เท่านั้น (0 = ไม่ทำรูป) // ตามช่องติ๊ก 📷 เท่านั้น (เดิมเลือกเพจ FB + โพสต์แบบมีรูป = สั่งรูปเองทั้งที่ติ๊กออก) · ไม่มีรูป = โพสต์เพจได้แค่ Reel
          for (let vi = 0; vi < variants; vi++) {
            const tag = variants > 1 ? `-${'AB'[vi]}` : '';
            // รูปโพสต์ + คอนเทนต์โพสต์สั่งใน prompt เดียวกับคลิป (เฉพาะแบบแรก กันได้ซ้ำ)
            const extras = { photos: needPhotos && vi === 0, post: st.post !== 'off' && vi === 0, adopt: vi === 0 ? adopt : null };
            try { saved += await makeClip(p, `${fname}${tag}`, variants > 1 ? ` แบบ ${'AB'[vi]}` : '', extras); } catch (e) {
              if (e instanceof Stopped || e instanceof Refused || e instanceof CtxGone || variants === 1) throw e;
              log(`❌ ${name}${tag}: ${e.message || e}`, 'err'); // แบบหนึ่งพลาด อีกแบบยังทำต่อ
            }
          }
          if (!saved) throw new Error('โหลดคลิปไม่ได้เลย');
          if (st.post !== 'off') {
            try { await savePost(p, fname); log(`📝 โหลดไฟล์ข้อความโพสต์ ${fname}.txt`, 'ok'); }
            catch (e) { log(`⚠ สร้างไฟล์ข้อความโพสต์ไม่ได้ (${e.message || e})`, 'warn'); }
          }
          p.done = true; ok++; delete p.redoWhy; // ทำใหม่สำเร็จ = เลิกสั่งแก้
          slimDone(p).then((x) => { if (x) save(); }); // เก็บแค่รูปย่อ
          histMark(p, 'made');
          bump('ok');
          await maybeSweep();
          setStatus(p, '✅ เสร็จ');
          save();
        } catch (e) {
          if (e instanceof Stopped) throw e;
          if (e instanceof CtxGone || ctxGone()) { log(`⚠ ${name}: ${e.message || e}`, 'err'); ctxGoneNotice(); throw new Stopped(); }
          bump('fail');
          setStatus(p, '❌ ผิดพลาด');
          if (p.vg && p.svPick === true && !p.clipAt) { delete p.svPick; save(); } // ไม่ได้คลิป = ปล่อยให้เวอร์ชันอื่นลง Shopee แทน
          run.failed.push(p.id); setRunFlag(true); // หน้าโหลดใหม่ทีหลัง = ไม่กลับมาทำตัวนี้ซ้ำ
          log(`❌ ${name}: ${e.message || e} — ข้ามไปตัวถัดไป`, 'err');
        }
        if (p.vg && sends > sends0) vgChat.set(p.vg, chatCount);
        if (nextItem()) await fillBetween(nextItem()); // 🧩 โพสต์คั่นของเพจที่ยังไม่ครบ
        // พลาดก่อนส่ง แต่รูป/ข้อความค้างในช่องพิมพ์ → เปิดแชตใหม่ให้ช่องว่างก่อน (ไม่งั้นตัวถัดไปส่งรูปของตัวนี้ไปด้วย)
        // ครบ N สินค้าในแชตนี้ (นับเฉพาะตัวที่ส่งข้อความไปจริง — สำเร็จหรือพลาดหลังส่งก็นับ) + ยังมีตัวต่อ → เปิดแชตใหม่ให้หน้าเบา · ไม่มีตัวต่อ = เปิดตอนเริ่มรอบหน้า
        if (composerDirty && nextItem()) { log(`${name}: ยังไม่ได้ส่ง — รูป/ข้อความค้างในช่องพิมพ์ เปิดแชตใหม่ให้ช่องว่างก่อนตัวถัดไป`, 'warn'); await freshChat(); }
        else if (+st.newChat && sends > sends0 && bumpChat() >= +st.newChat && nextItem()) { log(`ส่งไปแล้ว ${chatCount.n} สินค้าในแชตนี้ (ตั้งไว้ทุก ${st.newChat}) — เปิดแชตใหม่`); await freshChat(); }
        presenterOverride = undefined; modeOverride = undefined; modestNow = false; // สินค้าตัวถัดไปเลือกพรีเซนเตอร์/โหมดใหม่
        const gap = (+st.gap || 0) * 1000;
        const nx = gap && nextItem();
        if (nx) { setStatus(nx, '⏸ พักก่อนเริ่ม'); log(`พัก ${gap / 1000} วิ ก่อนสินค้าถัดไป`); await nap(gap); }
      }
      log(`จบคิว: สำเร็จ ${ok}/${tried.size}`, ok === tried.size ? 'ok' : 'warn');
    } catch (e) {
      if (!(e instanceof Stopped)) throw e;
      log('⏹ หยุดแล้ว (คลิปที่กำลังสร้างใน meta.ai ยังทำต่อได้ โหลดเองได้)', 'warn');
      products.forEach((p) => { if (run.status[p.id] && !/เสร็จ|ผิดพลาด/.test(run.status[p.id])) run.status[p.id] = ''; });
    } finally {
      run.on = false; runItem = null; presenterOverride = undefined; modeOverride = undefined; modestNow = false;
      setRunFlag(false);
      save(); renderAll();
    }
  }

  // ทำต่อหลังรีเฟรช: จำไว้ว่ากำลังรันอยู่ ถ้าหน้าโหลดใหม่กลางคัน → ทำต่อเองใน 10 วิ
  function setRunFlag(on) { try { chrome.storage.local.set({ mahRun: on ? { on, at: Date.now(), failed: run.failed || [], attempts: run.attempts || {}, cur: run.cur || null } : { on, at: Date.now() } }); } catch (e) {} }
  function scheduleResume(prev = {}) {
    run.resume = true;
    panel.hidden = false; $('fab').hidden = true;
    log('หน้าเว็บโหลดใหม่ระหว่างรันคิว — จะทำต่อใน 10 วิ (กด ⏹ เพื่อยกเลิก)', 'warn');
    setTimeout(async () => {
      if (!run.resume) return;
      run.resume = false;
      renderRun();
      const ok = await waitFor(findInput, 30000).catch(() => null);
      if (!ok) { setRunFlag(false); log('หาช่องพิมพ์ meta.ai ไม่เจอ — เปิดหน้าสร้างวิดีโอแล้วกด ▶ เพื่อทำต่อ', 'err'); return; }
      log('▶ ทำต่อจากตัวที่ค้าง');
      runQueue({ resumed: true, failed: prev.failed || [], attempts: prev.attempts || {}, cur: prev.cur || null }); // ข้ามตัวที่พลาดแล้ว · นับรอบตัวที่ค้าง
    }, 10000);
  }

  // ---------- UI (Shadow DOM) ----------
  const host = document.createElement('div');
  host.id = 'mah-root';
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = `
  <style>
    /* สีทั้งแผงมาจากตัวแปร — ธีมสว่าง (ค่าตั้งต้น) / ธีมมืด (:host(.dark)) */
    :host { all: initial;
      --bg: #fff; --fg: #111; --text2: #555; --muted: #999; --line: #e5e5e5; --line2: #f0f0f0; --field: #fafafa; --soft: #f2f2f2;
      --dash: #cfcfcf; --on-bg: #111; --on-fg: #fff; --hover: #333; --ok: #0a7d3c; --err: #c62828; --warnc: #b26a00;
      --xtra-bg: #fff0f0; --xtra-fg: #d0011b; --shadow: rgba(0,0,0,.12);
      --accent: #ee4d2d; --accent-fg: #fff; --accent-soft: #fff1ed; --ok-soft: #e7f6ec; --err-soft: #fdecec; }
    :host(.dark) {
      --bg: #17181b; --fg: #eceef1; --text2: #b4b8c0; --muted: #8b8f98; --line: #2e3138; --line2: #24262b; --field: #202227; --soft: #26282e;
      --dash: #454952; --on-bg: #eceef1; --on-fg: #17181b; --hover: #c9ccd2; --ok: #3ecf7a; --err: #ff6b6b; --warnc: #f0a63a;
      --xtra-bg: #3a1f22; --xtra-fg: #ff7a85; --shadow: rgba(0,0,0,.5);
      --accent: #ff6a45; --accent-fg: #fff; --accent-soft: #3a2320; --ok-soft: #173426; --err-soft: #3a1e1e; }
    * { box-sizing: border-box; font-family: system-ui, "Noto Sans Thai", "Leelawadee UI", sans-serif; }
    [hidden] { display: none !important; }
    #fab { position: fixed; right: 20px; bottom: 96px; z-index: 2147483646; height: 48px; padding: 0 18px; border-radius: 24px;
      border: 1px solid var(--line); cursor: pointer; background: var(--bg); color: var(--fg); font-size: 15px; font-weight: 600;
      box-shadow: 0 6px 20px var(--shadow); }
    #panel { position: fixed; top: 0; right: 0; bottom: 0; z-index: 2147483647; width: min(740px, 56vw); min-width: 420px; max-width: calc(100vw - 40px);
      background: var(--bg); color: var(--fg); border-left: 1px solid var(--line); display: flex; flex-direction: column;
      font-size: 15px; line-height: 1.5; box-shadow: -10px 0 40px var(--shadow); color-scheme: light; }
    :host(.dark) #panel { color-scheme: dark; }
    header { display: flex; justify-content: space-between; align-items: center; padding: 16px 24px 8px; border-bottom: 1px solid var(--line2); }
    header h1 { margin: 0; font-size: 20px; font-weight: 700; }
    header .hbtns { display: flex; gap: 4px; align-items: center; }
    header button { border: none; background: none; font-size: 26px; line-height: 1; color: var(--muted); cursor: pointer; }
    header #theme { font-size: 18px; padding: 4px 6px; }
    main { flex: 1; overflow: auto; padding: 4px 24px 16px; }
    .sec { border: 1px solid var(--line); border-radius: 14px; padding: 14px 16px 2px; margin: 14px 0; }
    .sec > h2, .sec > summary { margin: 0 0 12px; font-size: 15px; font-weight: 700; color: var(--fg); }
    details.sec > summary { cursor: pointer; }
    details.sec:not([open]) { padding-bottom: 2px; }
    #fbPages { flex-direction: column; align-items: stretch; }
    .fbrow { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; } .fbrow input { flex: 1 1 140px; min-width: 0; } /* แผงแคบ: ขึ้นบรรทัดใหม่แทนโดนตัด */
    #fbPages > .pill { align-self: flex-start; } #fbPages details .fbrow { margin-top: 6px; }
    .fbrow select { flex: 1 1 140px; min-width: 0; border: 1px solid var(--line); border-radius: 10px; padding: 7px 10px; font-size: 13px; color: var(--fg); background: var(--field); }
    .fbrow select:disabled { opacity: .45; }
    details.adv { margin: 0 0 14px; }
    details.adv > summary { font-size: 13px; color: var(--text2); cursor: pointer; margin-bottom: 8px; }
    .sub { font-size: 12px; font-weight: 400; color: var(--muted); margin-left: 4px; }
    .card { border: 1px solid var(--line); border-radius: 10px; padding: 8px 10px; margin-bottom: 6px; }
    .card.off { opacity: .5; } .card.done > :not(.meta) { opacity: .45; } /* เสร็จแล้ว: หรี่เนื้อหา แต่ปุ่ม (โพสต์/ทำใหม่) ยังชัด */
    .card-top { display: flex; gap: 8px; align-items: center; }
    .card-top input[type=text] { flex: 1; }
    .meta { display: flex; flex-wrap: wrap; gap: 6px 10px; align-items: center; font-size: 12px; color: var(--text2); margin-top: 8px; }
    .pill { border: 1px solid var(--line); border-radius: 999px; padding: 2px 10px; font-size: 12px; background: var(--bg); cursor: pointer; color: var(--fg); }
    .pill:hover { border-color: var(--fg); }
    .icon { border: none; background: none; cursor: pointer; color: var(--muted); font-size: 17px; padding: 4px 6px; }
    .icon:hover { color: var(--fg); }
    input[type=text], input[type=password], textarea { width: 100%; border: 1px solid var(--line); border-radius: 10px; padding: 9px 11px; font-size: 14px;
      color: var(--fg); background: var(--field); resize: vertical; }
    input::placeholder, textarea::placeholder { color: var(--muted); }
    input[type=text]:focus, input[type=password]:focus, textarea:focus { outline: none; border-color: var(--fg); background: var(--bg); }
    input[type=checkbox] { width: 17px; height: 17px; accent-color: var(--on-bg); margin: 0; }
    .imgs { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
    .thumb { position: relative; width: 68px; height: 68px; border-radius: 10px; overflow: hidden; background: var(--soft); }
    .thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .thumb button { position: absolute; top: 3px; right: 3px; width: 20px; height: 20px; border-radius: 50%; border: none;
      background: rgba(0,0,0,.6); color: #fff; font-size: 12px; line-height: 20px; padding: 0; cursor: pointer; }
    .add { width: 68px; height: 68px; border-radius: 10px; border: 1px dashed var(--dash); background: var(--bg); color: var(--muted); font-size: 12px; cursor: pointer; }
    .add:hover { border-color: var(--fg); color: var(--fg); }
    .ghost { width: 100%; border: 1px dashed var(--dash); background: var(--bg); border-radius: 12px; padding: 10px; font-size: 14px; color: var(--text2); cursor: pointer; }
    .ghost:hover { border-color: var(--fg); color: var(--fg); }
    .empty { font-size: 13px; color: var(--muted); padding: 6px 0 10px; }
    .opt { margin-bottom: 14px; }
    .opt-label { font-size: 13px; color: var(--text2); margin-bottom: 6px; }
    .chips { display: flex; flex-wrap: wrap; gap: 6px; }
    .chips button { border: 1px solid var(--line); background: var(--bg); border-radius: 999px; padding: 7px 14px; font-size: 14px; color: var(--fg); cursor: pointer; }
    .chips button.on { background: var(--on-bg); border-color: var(--on-bg); color: var(--on-fg); }
    .chips button:disabled { opacity: .35; cursor: not-allowed; }
    .hint { font-size: 12px; color: var(--muted); margin-top: 4px; }
    .warn { font-size: 12px; color: var(--err); margin-top: 4px; }
    .people { display: flex; flex-wrap: wrap; gap: 10px; }
    .person { width: 92px; border: 1px solid var(--line); border-radius: 12px; padding: 6px; cursor: pointer; position: relative; background: var(--bg); text-align: center; }
    .person.on { border-color: var(--fg); box-shadow: 0 0 0 1px var(--fg); }
    .person img { width: 78px; height: 78px; object-fit: cover; border-radius: 8px; display: block; margin: 0 auto 4px; }
    .person .nm { font-size: 12px; color: var(--fg); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .person .x { position: absolute; top: 2px; right: 2px; width: 20px; height: 20px; border-radius: 50%; border: none;
      background: rgba(0,0,0,.6); color: #fff; font-size: 12px; line-height: 20px; padding: 0; cursor: pointer; }
    .person.none { display: flex; align-items: center; justify-content: center; height: 112px; color: var(--text2); font-size: 13px; }
    .newp { border: 1px solid var(--line); border-radius: 12px; padding: 12px; margin-top: 10px; display: grid; grid-template-columns: 68px 1fr; gap: 8px 12px; }
    .newp .full { grid-column: 1 / -1; display: flex; gap: 8px; justify-content: flex-end; }
    .btn { border: 1px solid var(--line); background: var(--bg); border-radius: 10px; padding: 7px 12px; font-size: 13px; cursor: pointer; color: var(--fg); }
    .btn.dark { background: var(--on-bg); color: var(--on-fg); border-color: var(--on-bg); }
    .btn:disabled, .pill:disabled { opacity: .35; cursor: default; }
    footer { border-top: 1px solid var(--line); padding: 14px 24px 16px; background: var(--bg); }
    .actions { display: flex; gap: 8px; }
    .actions button { border-radius: 12px; padding: 12px; font-size: 15px; font-weight: 600; cursor: pointer; }
    .primary { flex: 1; background: var(--on-bg); color: var(--on-fg); border: 1px solid var(--on-bg); }
    .primary:hover { background: var(--hover); }
    #msg { font-size: 13px; min-height: 18px; margin-top: 8px; color: var(--text2); }
    #msg.ok { color: var(--ok); } #msg.err { color: var(--err); }
    .tabs { display: flex; gap: 0; padding: 0 12px; border-bottom: 1px solid var(--line2); overflow-x: auto; scrollbar-width: thin; } /* แผงแคบจนแท็บล้น = เลื่อนข้างได้ (เห็นแถบเลื่อน) */
    .tabs button { flex: none; white-space: nowrap; border: none; background: none; padding: 12px 8px 10px; font-size: 14px; font-weight: 600; color: var(--muted); cursor: pointer; border-bottom: 2px solid transparent; }
    .tabs button.on { color: var(--fg); border-bottom-color: var(--fg); }
    .runrow { display: flex; gap: 8px; margin-bottom: 8px; }
    .runrow button { border-radius: 12px; padding: 10px 12px; font-size: 14px; font-weight: 600; cursor: pointer; }
    .run { flex: 1; background: #0a7d3c; color: #fff; border: 1px solid #0a7d3c; }
    .run:disabled { opacity: .5; cursor: default; }
    .stop { background: var(--bg); color: var(--err); border: 1px solid var(--err); }
    .stop.subtle { color: var(--text2); border-color: var(--line); }
    .runrow button.icon { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1px; padding: 6px 8px; min-width: 54px; line-height: 1.1; }
    .runrow button.icon::after { content: attr(data-lb); font-size: 10px; font-weight: 500; color: var(--muted); } /* คำสั้นใต้ไอคอน */
    #runlog { font: 12px/1.6 ui-monospace, Menlo, Consolas, monospace; background: var(--field); border: 1px solid var(--line); border-radius: 10px;
      padding: 8px 10px; max-height: 150px; overflow: auto; margin-bottom: 8px; white-space: pre-wrap; }
    #gTest .okline { color: var(--ok); } #gTest .warn { margin: 0; }
    #runlog .ok { color: var(--ok); } #runlog .err { color: var(--err); } #runlog .warn { color: var(--warnc); }
    .status { font-weight: 600; color: var(--fg); }
    .qcard { display: grid; grid-template-columns: 52px 1fr; gap: 4px 10px; }
    .qcard .cover { width: 52px; height: 52px; border-radius: 8px; overflow: hidden; background: var(--soft); position: relative; cursor: pointer; grid-row: span 2; }
    .qcard .cover img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .qcard .cover .n { position: absolute; right: 2px; bottom: 2px; background: rgba(0,0,0,.65); color: #fff; font-size: 10px; border-radius: 6px; padding: 0 4px; }
    .qcard .cover.empty { display: flex; align-items: center; justify-content: center; font-size: 11px; color: var(--muted); border: 1px dashed var(--dash); background: var(--bg); }
    .qcard .row1 { display: flex; gap: 4px; align-items: center; }
    .qcard .row1 input { flex: 1; padding: 5px 8px; font-size: 13px; border-radius: 8px; }
    .qcard textarea { padding: 5px 8px; font-size: 13px; border-radius: 8px; min-height: 0; line-height: 1.4; }
    .qcard .meta { margin-top: 2px; gap: 4px 8px; grid-column: 2; }
    .qcard .redo .drop { border-color: var(--err); color: var(--err); }
    .qcard .redo { grid-column: 2; display: flex; gap: 6px; flex-wrap: wrap; align-items: center; font-size: 12px; color: var(--text2); } .qcard .redo label { display: flex; gap: 4px; align-items: center; }
    .qcard .linkrow { grid-column: 2; display: flex; gap: 6px; align-items: center; } .qcard .linkrow input { flex: 1; min-width: 0; padding: 5px 8px; font-size: 13px; border-radius: 8px; }
    .qcard .pill { padding: 1px 8px; font-size: 11px; }
    .qcard .warn { grid-column: 2; margin: 0; }
    .qcard .imgs { grid-column: 1 / -1; margin-top: 4px; gap: 6px; }
    .qcard .thumb, .qcard .add { width: 44px; height: 44px; border-radius: 8px; font-size: 11px; }
    .qbar { display: flex; gap: 8px; align-items: center; margin: 12px 0 8px; font-size: 12px; color: var(--text2); }
    .qbar .btn { padding: 5px 10px; font-size: 12px; }
    .btn.danger-t { color: var(--err); } /* ปุ่มลบ (ยังไม่ยืนยัน) */
    .qbar { flex-wrap: wrap; } .qbar .stat { margin-left: auto; color: var(--muted); }
    .qcard .more { grid-column: 1 / -1; display: grid; gap: 4px; margin-top: 4px; }
    .qcard .more .cap { font-size: 12px; color: var(--text2); white-space: pre-wrap; }
    .spbar { display: flex; gap: 8px; margin: 14px 0 10px; }
    .spbar input { flex: 1; }
    .chk { display: flex; gap: 8px; align-items: center; cursor: pointer; margin: 8px 0 0; }
    .grp { border-top: 1px solid var(--line2); padding-top: 12px; } .grp-h { font-size: 13px; font-weight: 600; margin-bottom: 6px; }
    .opt-label .sub { margin-left: 2px; }
    /* แท็บ 🛍: การ์ดสถานะ + ขั้นต่อไป + กลุ่มรายการ */
    .svbadge { font-size: 12px; font-weight: 600; padding: 2px 10px; border-radius: 999px; margin-left: 6px; background: var(--soft); color: var(--text2); vertical-align: middle; }
    .svbadge.on { background: var(--ok-soft); color: var(--ok); } .svbadge.off { background: var(--err-soft); color: var(--err); }
    .svtiles { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin: 0 0 10px; } .svtiles:empty { display: none; }
    .svtile { border: 1px solid var(--line); border-radius: 12px; padding: 10px 12px; background: var(--field); min-width: 0; }
    .svtile .k { font-size: 12px; color: var(--muted); } .svtile .v { font-size: 18px; font-weight: 700; margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .svtile .s { font-size: 11px; color: var(--muted); margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .svtile.good .v { color: var(--ok); } .svtile.bad { border-color: var(--err); } .svtile.bad .v { color: var(--err); }
    .svnext { border-radius: 12px; padding: 10px 12px; margin: 0 0 10px; font-size: 13px; font-weight: 600; background: var(--accent-soft); color: var(--fg); } .svnext:empty { display: none; }
    .svnext.ok { background: var(--ok-soft); } .svnext.bad { background: var(--err-soft); }
    .svsteps { margin: 0 0 10px; padding: 0; list-style: none; counter-reset: s; } .svsteps li { counter-increment: s; display: flex; gap: 10px; align-items: flex-start; padding: 6px 0; font-size: 13px; }
    .svsteps li::before { content: counter(s); flex: 0 0 22px; height: 22px; border-radius: 50%; background: var(--accent); color: var(--accent-fg); font-size: 12px; font-weight: 700; display: flex; align-items: center; justify-content: center; }
    .svgroup { font-size: 12px; font-weight: 700; color: var(--text2); margin: 12px 2px 6px; } .svgroup .sub { font-weight: 400; }
    .sptoggle { display: flex; gap: 8px; align-items: center; cursor: pointer; margin: -4px 0 12px; }
    .sp { display: grid; grid-template-columns: 64px 1fr auto; gap: 10px; align-items: center; }
    .sp img { width: 64px; height: 64px; border-radius: 8px; object-fit: cover; background: var(--soft); display: block; }
    .sp .nm { font-size: 13px; line-height: 1.35; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .sp .meta { margin-top: 4px; gap: 4px 10px; }
    .sp .com { color: var(--ok); font-weight: 600; }
    .spbtns { display: flex; flex-direction: column; gap: 6px; } .spbtns .btn { padding: 6px 10px; font-size: 12px; white-space: nowrap; }
    .xtra { background: var(--xtra-bg); color: var(--xtra-fg); border-radius: 6px; padding: 0 6px; font-weight: 600; }
    /* คิวแบบแถวย่อ (กดแถวเพื่อกางแก้ไข) + รายการคลิปเสร็จในแท็บ FB */
    .qrow { display: grid; grid-template-columns: 40px 1fr auto; gap: 10px; align-items: center; padding: 6px 8px; margin-bottom: 4px; }
    #products .qrow { cursor: pointer; } #products .qrow:hover { border-color: var(--dash); }
    .qrow.active { border-color: var(--ok); }
    .qrow .cover { width: 40px; height: 40px; border-radius: 8px; overflow: hidden; background: var(--soft); display: flex; align-items: center; justify-content: center; font-size: 10px; color: var(--muted); }
    .qrow .cover img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .qrow .mid { min-width: 0; }
    .qacts { display: flex; gap: 2px; align-items: center; }
    .meta .wait { color: var(--muted); } .meta .pend { color: var(--accent); font-weight: 600; } /* ยังไม่ลง FB / Shopee */
    .qrow .nm { font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .qrow .meta { margin-top: 1px; gap: 2px 8px; font-size: 11px; }
    .qrow .icon { padding: 2px 4px; font-size: 15px; }
    .qrow .btn { padding: 5px 10px; font-size: 12px; white-space: nowrap; }
    .meta .good { color: var(--ok); } .meta .bad { color: var(--warnc); }
    .qtools { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin: 12px 0 0; }
    .qtools input[type=text] { flex: 1; min-width: 140px; padding: 6px 10px; font-size: 13px; }
    .chips.small { gap: 4px; } .chips.small button { padding: 4px 10px; font-size: 12px; }
    /* แถวเดียวเลื่อนซ้าย-ขวา (หมวด/คำย่อย/ร้าน) — ขอบขวาจางบอกว่ายังมีต่อ */
    .chips.scroll { flex-wrap: nowrap; overflow-x: auto; padding-bottom: 6px; scrollbar-width: thin; scroll-behavior: smooth;
      -webkit-mask-image: linear-gradient(to right, #000 calc(100% - 28px), transparent); mask-image: linear-gradient(to right, #000 calc(100% - 28px), transparent); }
    .chips.scroll button { flex: 0 0 auto; white-space: nowrap; }
    .sprow { display: flex; flex-wrap: wrap; gap: 4px 16px; margin: 0 0 12px; } .sprow .sptoggle { margin: 0; font-size: 13px; color: var(--text2); }
    .btn.danger { color: var(--err); border-color: var(--err); }
    #spCats { margin: 0 0 8px; } #spSubs, #spShops { margin: 0 0 12px; }
    .hist { background: var(--soft); color: var(--text2); border-radius: 6px; padding: 0 6px; }
    .spbulk { margin: -4px 0 12px; } .spbulk .btn { width: 100%; padding: 9px 12px; font-size: 14px; font-weight: 600; }
    .spbulk.two { display: flex; gap: 8px; margin: 10px 0 0; } .spbulk.two .btn { flex: 1; width: auto; }
    .svinfo { display: grid; gap: 4px; font-size: 13px; margin: 8px 0 12px; } .svinfo:empty { display: none; }
    .svinfo .good { color: var(--ok); } .svinfo .bad { color: var(--warnc); }
    #histList { margin-top: 8px; max-height: 360px; overflow: auto; } .hrow { display: flex; gap: 8px; align-items: center; font-size: 12px; padding: 4px 0; border-bottom: 1px solid var(--line2); }
    .hrow .nm { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--fg); } .hrow .when { color: var(--muted); white-space: nowrap; } .hrow .icon { font-size: 13px; padding: 0 4px; }
    .fbrow input.pgniche { flex: 1; min-width: 0; padding: 7px 10px; font-size: 13px; } #fillList { margin-top: 10px; }
    .gbtns { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 6px; align-items: center; max-width: 230px; }
    .gpitch { font-size: 12px; color: var(--text2); white-space: pre-line; margin-top: 4px; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
    /* ขอบซ้ายของแผง: ลากปรับความกว้าง (จำไว้) */
    #grip { position: absolute; left: -4px; top: 0; bottom: 0; width: 8px; cursor: ew-resize; z-index: 2; }
    #grip:hover, #grip.on { background: linear-gradient(90deg, transparent 3px, var(--accent) 3px, var(--accent) 5px, transparent 5px); }
    .listhead { font-size: 13px; font-weight: 700; margin: 18px 0 8px; display: flex; gap: 8px; align-items: baseline; }
    .lhbtns { margin-left: auto; display: flex; gap: 6px; } .lhbtns .pill { font-weight: 400; } .pill.danger { color: var(--err); border-color: var(--err); }
    /* สีหลัก (ส้ม) — แท็บที่เลือก / ตัวเลือกที่เลือก / ปุ่มหลัก */
    .tabs button.on { color: var(--accent); border-bottom-color: var(--accent); }
    .chips button.on { background: var(--accent); border-color: var(--accent); color: var(--accent-fg); }
    .btn.dark { background: var(--accent); border-color: var(--accent); color: var(--accent-fg); }
    .btn.dark:hover:not(:disabled) { filter: brightness(1.08); }
    .person.on { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent); }
    input[type=text]:focus, input[type=password]:focus, textarea:focus { border-color: var(--accent); }
    input[type=checkbox] { accent-color: var(--accent); }
    #fab { background: var(--accent); color: var(--accent-fg); border-color: var(--accent); }
    header h1 .logo { display: inline-flex; width: 28px; height: 28px; border-radius: 8px; background: var(--accent); color: #fff; align-items: center; justify-content: center; font-size: 15px; margin-right: 8px; vertical-align: 2px; }
    /* หมวดตั้งค่าพับได้: หัวข้อโชว์ค่าที่เลือกอยู่ */
    details.fold > summary { list-style: none; display: flex; align-items: center; gap: 8px; }
    details.fold > summary::-webkit-details-marker { display: none; }
    details.fold > summary::after { content: '▾'; color: var(--muted); transition: transform .15s; }
    details.fold:not([open]) > summary::after { transform: rotate(-90deg); }
    details.fold:not([open]) > summary { margin-bottom: 12px; }
    .sum { margin-left: auto; font-size: 12px; font-weight: 400; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 62%; }
    details.fold[open] .sum { visibility: hidden; }
    /* สถานะในคิว: ป้ายสี */
    .status { border-radius: 999px; padding: 0 8px; font-weight: 600; }
    .st-run { background: var(--accent-soft); color: var(--accent); }
    .st-run::before { content: ''; display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: currentColor; margin-right: 5px; vertical-align: 1px; animation: mahPulse .9s ease-in-out infinite alternate; }
    .st-ok { background: var(--ok-soft); color: var(--ok); }
    .st-bad { background: var(--err-soft); color: var(--err); }
    .st-wait { background: var(--soft); color: var(--text2); }
    @keyframes mahPulse { from { opacity: .25; } to { opacity: 1; } }
    #products .qrow.active { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent); }
    /* ความคืบหน้าตอนรันคิว */
    .prog { height: 6px; border-radius: 999px; background: var(--soft); overflow: hidden; margin-bottom: 8px; }
    .prog i { display: block; height: 100%; background: linear-gradient(90deg, var(--accent), #ff9a3c); transition: width .4s; }
    /* คิวว่าง: เริ่มใช้ 3 ขั้น */
    .onboard { border: 1px dashed var(--dash); border-radius: 14px; padding: 14px; margin: 6px 0 10px; }
    .onboard .ob-title { font-weight: 700; margin-bottom: 10px; }
    .ob-step { display: grid; grid-template-columns: 28px 1fr; gap: 2px 10px; width: 100%; text-align: left; border: 1px solid var(--line); background: var(--bg); color: var(--fg);
      border-radius: 12px; padding: 10px 12px; margin-bottom: 6px; cursor: pointer; font: inherit; }
    .ob-step:hover { border-color: var(--accent); }
    .ob-step .n { grid-row: span 2; width: 28px; height: 28px; border-radius: 50%; background: var(--accent); color: var(--accent-fg); display: flex; align-items: center; justify-content: center; font-weight: 700; }
    .ob-step b { font-size: 14px; } .ob-step small { color: var(--text2); font-size: 12px; }
  </style>
  <button id="fab" title="ผู้ช่วยทำคลิป Shopee Video">🎬 Shopee Video</button>
  <div id="panel" hidden>
    <div id="grip" title="ลากเพื่อปรับความกว้างแผง (ดับเบิลคลิก = ขนาดเดิม)"></div>
    <header><h1><span class="logo">🎬</span>Shopee Video</h1><div class="hbtns"><button id="theme" title="สลับธีมมืด/สว่าง"></button><button id="close" title="ปิด">×</button></div></header>
    <nav class="tabs"><button data-tab="queue" id="tabQueue">📋 คิวสินค้า</button><button data-tab="search">🔎 หาสินค้า</button><button data-tab="fb" id="tabFb">📘 เพจ FB</button><button data-tab="sv" id="tabSv">🛍 Shopee Video</button><button data-tab="settings">⚙️ ตั้งค่าคลิป</button></nav>
    <main id="tab-queue">
      <div class="qtools"><div class="chips small" id="qFilter"></div><input type="text" id="qFind" placeholder="🔍 หาชื่อในคิว"></div>
      <div class="qbar" id="qbar"></div>
      <div id="products"></div>
      <button class="ghost" id="addProduct">+ เพิ่มสินค้าเอง</button>
      <div class="hint">กดแถวสินค้าเพื่อแก้ชื่อ/บทพูด/รูป/รายละเอียด (▴ ย่อกลับ) · เพิ่มสินค้า: แท็บ 🔎 หาสินค้า หรือปุ่ม “＋ คิวคลิป” บนหน้า Shopee Affiliate · กด ▶ แล้วทำทุกตัวในคิว ไม่เอาตัวไหนกด 🗑 · ทำเสร็จแล้วไปโพสต์ที่แท็บ 📘 / 🛍</div>
    </main>
    <main id="tab-search" hidden>
      <details class="sec" id="spSetup">
        <summary>🔑 Shopee Open API (ไม่บังคับ) <span class="sub" id="spState"></span></summary>
        <div class="opt"><div class="hint" style="margin:0 0 8px">ไม่ใส่ก็ค้นได้ — ค้นผ่านหน้าเว็บ Affiliate ที่ล็อกอินไว้ในเบราว์เซอร์นี้ · ใส่ AppID + Secret (affiliate.shopee.co.th → Open API) แล้วเร็วกว่า เรียงได้ ได้ลิงก์ทันที · เก็บไว้ในเครื่องนี้เท่านั้น</div>
          <input type="text" id="spApp" placeholder="AppID" autocomplete="off">
          <input type="password" id="spSecret" placeholder="Secret" autocomplete="off" style="margin-top:6px"></div>
      </details>
      <div class="spbar"><input type="text" id="spKw" placeholder="ค้นหาสินค้า เช่น เสื้อแขนยาว, เครื่องปั่นพกพา · หรือวางลิงก์ร้าน"><button class="btn dark" id="spGo">ค้นหา</button><button class="btn" id="spShop" title="ดึงสินค้าทั้งร้าน: วางลิงก์ร้าน / ลิงก์สินค้าของร้านนั้น ในช่องค้นหา แล้วกดปุ่มนี้ (พิมพ์ชื่อร้านได้ถ้าใส่ Open API) · หรือกด 🏪 ร้านนี้ ที่สินค้า">🏪 ทั้งร้าน</button></div>
      <div class="chips small scroll" id="spCats"></div>
      <div class="chips small scroll" id="spSubs" hidden></div>
      <div class="chips small scroll" id="spShops" hidden></div>
      <div class="opt"><div class="chips" data-key="spSort"></div></div>
      <div class="sprow"><label class="opt-label sptoggle" title="ร้านให้ค่าคอมพิเศษเพิ่ม (ดึงทั้งร้าน = ไม่กรอง)"><input type="checkbox" id="spXtra"> เฉพาะ Extra Comm</label>
      <label class="opt-label sptoggle" title="ซ่อนสินค้าที่มีป้าย ✓ เคยทำ · 📘 เคยโพสต์เพจ"><input type="checkbox" id="spHideMade"> ซ่อนตัวที่เคยทำแล้ว</label>
      <label class="opt-label sptoggle" title="ซ่อนสินค้าที่ขายได้ไม่ถึง 100 ชิ้น (ไม่บอกยอดขาย = ซ่อน)"><input type="checkbox" id="spSold"> ขายได้มากกว่า 100 ชิ้น</label></div>
      <details class="adv" id="histBox"><summary id="histSum">📜 ประวัติที่เคยทำ</summary>
        <div class="hint" style="margin:0 0 8px">สินค้าที่เคยทำคลิป/โพสต์เพจ — ใช้ขึ้นป้าย “✓ เคยทำ · 📘” ในผลค้นหา · ไม่หายตอนเคลียร์/ลบคิว · เก็บ 3,000 ตัวล่าสุด</div>
        <input type="text" id="histFind" placeholder="🔍 หาชื่อในประวัติ">
        <div id="histList"></div>
        <div class="spbulk" style="margin:8px 0 0"><button class="btn" id="histClear">🗑 ล้างประวัติทั้งหมด</button></div>
      </details>
      <div class="spbulk"><button class="btn dark" id="spAll" hidden></button></div>
      <div id="spList"></div>
      <button class="ghost" id="spMore" hidden>โหลดเพิ่ม</button>
    </main>
    <main id="tab-fb" hidden>
      <section class="sec">
        <h2>📘 โพสต์ Facebook Page <span class="sub" id="fbState"></span></h2>
        <div class="opt"><div class="hint" style="margin:0">📘 โพสต์เป็น <b>Reel</b> + คอมเมนต์ลิงก์ตะกร้า + รูปในคอมเมนต์ — กด “📘 โพสต์” ที่คลิปด้านล่าง</div><div class="hint" id="fbPhotoHint" hidden></div></div>
        <div class="opt grp"><div class="grp-h">🛒 ตะกร้า &amp; รูปในคอมเมนต์</div>
          <label class="opt-label chk" title="คอมเมนต์แรกในนามเพจ: 🛒 พิกัด 👉 ลิงก์ affiliate"><input type="checkbox" id="fbComment"> ปักตะกร้าในคอมเมนต์แรก <span class="sub">🛒 พิกัด 👉 ลิงก์</span></label>
          <label class="opt-label chk" title="Facebook ขึ้นตะกร้าสินค้าบนคลิปให้เอง สำหรับเพจที่เปิดโหมดมืออาชีพ + ได้สิทธิ์ Affiliate ของ Facebook · คอมเมนต์แรกยังปักเหมือนเดิม"><input type="checkbox" id="fbReelLink"> ใส่ลิงก์ในแคปชัน Reel ด้วย <span class="sub">ให้ Facebook ขึ้นตะกร้าบนคลิป</span></label>
          <div class="opt-label" style="margin-top:8px">📷 รูปในคอมเมนต์ Reel <span class="sub">meta ทำรูปตามจำนวนนี้ตอนทำคลิป · 1 คอมเมนต์ต่อรูป</span></div><div class="chips" data-key="fbCmtPhotos"></div>
        </div>
        <div class="opt grp"><div class="grp-h">⚙️ อื่นๆ</div>
          <label class="opt-label chk" title="ตั้งค่า is_ai_generated ตอนลง Reel — Facebook ติดป้าย “ข้อมูล AI” ให้เอง ไม่เพิ่มข้อความในแคปชัน · กฎ Meta: คลิปที่ดูเหมือนจริงแต่ทำด้วย AI ต้องบอก"><input type="checkbox" id="fbAiFlag"> 🤖 เปิดป้าย “ข้อมูล AI” ของ Facebook ให้ Reel <span class="sub">สวิตช์ในระบบ ไม่เพิ่มข้อความในแคปชัน</span></label>
          <label class="opt-label chk" title="กฎ Meta: คลิปที่ดูเหมือนจริงแต่ทำด้วย AI ต้องบอก"><input type="checkbox" id="aiLabel"> 📝 เขียนบอกท้ายแคปชันด้วย <span class="sub">“🤖 ภาพและวิดีโอสร้างด้วย AI”</span></label>
          <label class="opt-label chk" title="ประหยัดพื้นที่ · คลิปกับ .txt ไม่ลบ"><input type="checkbox" id="fbDelPhotos"> 🗑 โพสต์รูปสำเร็จ → ลบไฟล์รูปในเครื่อง</label></div>
        <div class="opt grp"><div class="grp-h">⏱ “โพสต์ทั้งหมด” ทยอยห่างกันทีละ <span class="sub">สลับเพจทุกโพสต์ · เพจเดียวกันห่าง ≥ 1 ชม.</span></div><div class="chips" data-key="fbGap"></div></div>
        <div class="opt grp"><div class="grp-h">📄 เพจที่ใช้</div><div class="hint" style="margin:0 0 8px">สลับทีละเพจต่อสินค้า · 👉 = สินค้าตัวถัดไปลงเพจนี้ · เลือก<b>พรีเซนเตอร์ประจำเพจ</b>ได้ (หน้าคนในคลิปตรงกับเพจ)</div><div class="chips" id="fbPages"></div></div>
        <details class="adv" id="fillBox"><summary>🧩 โพสต์คั่น (ไม่ขายของ · ปั้นเพจ) <span class="sub" id="fillSum"></span></summary>
          <div class="opt"><div class="opt-label">แทรกในปุ่ม “โพสต์ทั้งหมด” — โพสต์คั่น 1 โพสต์ ทุก…</div><div class="chips" data-key="fillEvery"></div>
            <div class="hint" id="fillHint"></div></div>
          <div class="opt"><div class="opt-label">ใครเขียน: <span id="gKeySum"></span></div>
            <input type="password" id="gKey" placeholder="Gemini API key (ฟรี: aistudio.google.com → Get API key) · ไม่ใส่ = meta.ai เขียนในแชต" autocomplete="off">
            <input type="text" id="gModel" placeholder="รุ่น (ว่าง = เลือกให้เอง)" style="margin-top:6px">
            <div style="margin-top:8px"><button class="btn" id="gTestBtn">🔌 ทดสอบ key</button></div>
            <div id="gTest" class="hint" style="white-space:pre-wrap"></div></div>
          <div class="spbulk two"><button class="btn" id="fillMake"></button></div>
          <div id="fillList"></div>
        </details>
        <details class="adv"><summary>🔑 เชื่อมบัญชี Facebook (User Token · ฟรี)</summary>
          <div class="hint">ทำครั้งเดียว: developers.facebook.com → สร้างแอป (use case “Manage everything on your Page”) → Use cases → Customize → กด Add ให้ pages_manage_engagement + pages_read_user_content (ขึ้น Ready for testing) → Tools → Graph API Explorer → User or Page = Get User Access Token ติ๊กสิทธิ์ pages_show_list, pages_read_engagement, pages_manage_posts, pages_manage_engagement → เลือก “ทุกเพจปัจจุบันและในอนาคต” (หน้าสรุปต้องมีสิทธิ์คอมเมนต์ ไม่งั้นปักตะกร้าไม่ได้) → คัดลอกมาวาง · กด Extend ใน Access Token Debugger ให้ใช้ได้ 60 วัน · เก็บในเครื่องนี้เท่านั้น</div>
          <input type="password" id="fbToken" placeholder="User Access Token" autocomplete="off" style="margin-top:8px">
          <div style="margin-top:8px"><button class="btn" id="fbLoad">ดึงรายชื่อเพจ</button></div>
        </details>
      </section>
      <div class="listhead">คลิปที่ทำเสร็จ <span class="sub" id="fbListSub"></span><span class="lhbtns"><button class="pill" id="fbFiles" title="เลือกไฟล์คลิป .mp4 หลายไฟล์จากโฟลเดอร์ Downloads/ShopeeVideo (Ctrl+A ได้) — จับคู่กับสินค้าในรายการจากชื่อไฟล์ ไว้ลง Reel (คลิปเก่าที่ลิงก์ meta.ai หมดอายุแล้ว)">📁 ใส่ไฟล์คลิป</button><input type="file" id="fbFileIn" accept="video/*" multiple hidden><button class="pill" id="fbClear" hidden></button><button class="pill" id="fbWipe" hidden></button></span></div>
      <div class="spbulk"><button class="btn dark" id="fbAll" hidden></button></div>
      <div class="spbulk"><button class="btn" id="fbSpread" hidden></button></div>
      <div id="fbList"></div>
    </main>
    <main id="tab-sv" hidden>
      <section class="sec">
        <h2>🛍 โปรแกรมโพสต์ Shopee Video <span class="svbadge" id="svState"></span></h2>
        <div class="svtiles" id="svTiles"></div>
        <div class="svnext" id="svNext"></div>
        <div class="hint" id="svHint" style="margin-top:0"></div>
        <div class="svinfo" id="svInfo"></div>
        <div class="spbulk two"><button class="btn dark" id="svOpen">↗ เปิดโปรแกรม</button><button class="btn" id="svRefresh">🔄 เชื่อมใหม่</button></div>
      </section>
      <div class="listhead">คลิปในคิวของโปรแกรม <span class="sub" id="svListSub"></span></div>
      <div id="svList"></div>
    </main>
    <main id="tab-settings" hidden>
      <section class="sec">
        <h2>✨ แนวสำเร็จรูป <span class="sub">กดแล้วตั้งค่าให้ แก้ต่อได้</span></h2>
        <div class="opt"><div class="chips" id="presets"></div><div class="hint" id="presetDesc"></div></div>
      </section>

      <details class="sec fold" data-fold="clip" open>
        <summary>🎬 คลิป <span class="sum" id="sumClip"></span></summary>
        <div class="opt"><div class="opt-label">ความยาว</div><div class="chips" data-key="duration"></div>
          <label class="opt-label chk" id="outroOpt"><input type="checkbox" id="outro"> 5 วิสุดท้ายโชว์สินค้าล้วน + เพลง (ไม่พูด)</label>
          <div class="hint">15 / 20 วิ: สั่งวิดีโอเดียวเต็มความยาว ห้ามแบ่งพาร์ท/ส่งแยก ไม่ต่อคลิป</div></div>
        <div class="opt"><div class="opt-label">จังหวะตัดภาพ</div><div class="chips" data-key="pace"></div>
          <div class="hint">เร็ว = ตัดภาพถี่ · ปกติ = ตัดทุก 2–3 วิ (ไม่เกี่ยวกับความเร็วพูด)</div></div>
        <div class="opt"><div class="opt-label">ความเร็วพูด</div><div class="chips" data-key="talk"></div>
          <div class="hint">เร็ว = พูดรัวต่อเนื่อง · ปกติ = พูดสบายๆ · ช้า = ช้าชัด บทสั้นลง (กระซิบ ASMR = ช้าเสมอ)</div></div>
        <div class="opt"><div class="opt-label">เพลง</div><div class="chips" data-key="music"></div>
          <div class="hint">ตามจังหวะ = จังหวะเร็วมีเพลงคลอ / ปกติไม่มี · เพลงเบาลงตอนพูดเสมอ</div></div>
        <div class="opt"><div class="opt-label">สไตล์</div><div class="chips" data-key="style"></div></div>
        <div class="opt"><div class="opt-label">ฉาก / สถานที่ (ไม่บังคับ)</div>
          <input type="text" id="scene" placeholder="เช่น โต๊ะไม้สีอ่อนริมหน้าต่าง แสงเช้า"><div class="warn" id="sceneWarn"></div></div>
        <div class="opt"><div class="opt-label">ลูกเล่นภาพ (เลือกได้หลายอัน)</div><div class="chips" data-key="vfx"></div></div>
        <div class="opt"><div class="opt-label">จำนวนซีน</div><div class="chips" data-key="scenes"></div><div class="hint" id="scenesHint"></div></div>
      </details>

      <details class="sec fold" data-fold="people">
        <summary>🧑 ผู้แสดง & เสียง <span class="sum" id="sumPeople"></span></summary>
        <div class="opt"><div class="opt-label">การเห็นผู้แสดง</div><div class="chips" data-key="view"></div></div>
        <div class="opt"><div class="opt-label">ผู้แสดง</div><div class="chips" data-key="presenter"></div><div class="hint" id="presenterHint"></div></div>
        <div class="opt" id="peopleOpt">
          <div class="opt-label">พรีเซนเตอร์ (เลือกแล้ว = ultra realistic + ล็อกหน้า + เสียงตามเพศ/อายุในรูป)</div>
          <div class="people" id="people"></div>
          <input type="text" id="presDesc" placeholder="ลักษณะหน้าที่ต้องตรง (ไม่บังคับ) เช่น smiling with teeth, long dark brown hair" style="margin-top:8px" hidden>
          <div class="newp" id="newp" hidden>
            <div id="newpImg"></div>
            <div><input type="text" id="newpName" placeholder="ชื่อ เช่น มิ้นท์"><input type="text" id="newpDesc" placeholder="คำบรรยาย เช่น ผู้หญิงไทย 25 ปี ผมยาวดำ" style="margin-top:6px"></div>
            <div class="full"><button class="btn" id="newpCancel">ยกเลิก</button><button class="btn dark" id="newpSave">บันทึก</button></div>
          </div>
        </div>
        <div class="opt"><div class="opt-label">เพศผู้แสดง / เสียง <span class="sub">ตามสินค้า = สินค้าผู้ชายใช้ผู้ชาย นอกนั้นผู้หญิง · มือ/คน กับเสียงเพศเดียวกันเสมอ</span></div><div class="chips" data-key="voiceSex"></div></div>
        <div class="opt"><div class="opt-label">โทนเสียง</div><div class="chips" data-key="tone"></div></div>
      </details>

      <details class="sec fold" data-fold="script">
        <summary>🗣 บทพูด <span class="sum" id="sumScript"></span></summary>
        <div class="opt"><div class="chips" data-key="scriptMode"></div><div class="hint" id="scriptHint"></div></div>
        <div class="opt" id="sameOpt">
          <textarea id="sameLine" rows="2" placeholder="บทพูดไทย ใช้กับทุกสินค้า (1 บรรทัด = 1 ช่วง) — ว่างไว้ = meta.ai คิดให้"></textarea><div class="warn" id="sameWarn"></div></div>
      </details>

      <details class="sec fold" data-fold="text">
        <summary>🔤 ตัวหนังสือบนจอ <span class="sum" id="sumText"></span></summary>
        <div class="opt"><div class="chips" data-key="text"></div></div>
        <div class="opt" id="fxOpt"><div class="opt-label">ลูกเล่นตัวหนังสือ</div><div class="chips" data-key="fx"></div>
          <input type="text" id="osText" placeholder="ข้อความเอง (ไม่บังคับ) เช่น เช็ดทีเดียวเกลี้ยง" style="margin-top:8px"><div class="warn" id="osWarn"></div>
          <div class="hint">AI อาจสะกดตัวหนังสือไทยเพี้ยน ใช้สั้นๆ จะชัดกว่า · ห้ามราคา/โปร/ส่วนลดเหมือนเดิม</div></div>
      </details>

      <details class="sec fold" data-fold="post">
        <summary>📤 การโพสต์ <span class="sum" id="sumPost"></span></summary>
        <div class="opt"><div class="opt-label">📷 รูปแนบคอมเมนต์ Reel <span class="sub">meta ทำรูปตามจำนวนนี้ตอนทำคลิป · ไม่แนบ = ไม่ทำรูป</span></div><div class="chips" data-key="fbCmtPhotos"></div>
          <div class="hint">Facebook = Reel + คอมเมนต์ลิงก์ตะกร้า + รูปในคอมเมนต์ (ตั้งเพจ/ตะกร้าเพิ่มได้ที่แท็บ 📘)</div></div>
        <div class="opt"><div class="opt-label">📝 แคปชันโพสต์ (.txt) <span class="sub">meta.ai เขียนแคปชันสั้นๆ + แฮชแท็ก + ลิงก์ affiliate · ใช้ทั้ง Facebook และ Shopee Video</span></div><div class="chips" data-key="post"></div></div>
        <div class="opt"><label class="opt-label chk"><input type="checkbox" id="autoClear"> 🧹 ลงครบ Facebook + Shopee Video แล้ว → เอาออกจากคิวเอง <span class="sub">ไฟล์ในเครื่องไม่ลบ · ป้าย “เคยทำ” ยังอยู่</span></label></div>
      </details>
      <details class="sec fold" data-fold="run">
        <summary>⚙️ การรันคิว & ไฟล์ <span class="sum" id="sumRun"></span></summary>
        <div class="opt"><div class="opt-label">คลิปต่อสินค้า</div><div class="chips" data-key="variants"></div></div>
        <div class="opt"><div class="opt-label">📁 โฟลเดอร์ไฟล์ของบัญชีนี้ (แยกตามเมล — หลาย Chrome profile ไม่ปนกัน)</div><input type="text" id="saveDir" placeholder="ว่าง = ใช้อีเมลของ Chrome profile นี้" autocomplete="off"><div class="hint" id="saveDirHint"></div></div>
        <div class="opt"><div class="opt-label">พักระหว่างสินค้าแต่ละตัว</div><div class="chips" data-key="gap"></div></div>
        <div class="opt"><div class="opt-label">เปิดแชตใหม่บน meta.ai — ทุกคลิป (แนะนำ) กัน meta.ai หยิบรูปสินค้า/คนจากข้อความก่อนๆ ในแชตเดียวกันมาปน · แชตยาวยังหน่วง/จับคลิปพลาดด้วย</div><div class="chips" data-key="newChat"></div>
          <div class="hint">ครบจำนวนคลิป → กดปุ่มแชตใหม่ของ meta.ai แล้วทำตัวต่อไปในแชตใหม่ · หาปุ่มไม่เจอ = โหลดหน้าแรก meta.ai ใหม่ (= แชตใหม่) แล้วทำคิวต่อเอง</div>
          <label class="opt-label chk"><input type="checkbox" id="delOldChat"> 🗑 เปิดแชตใหม่แล้วลบแชตเก่าทิ้ง (แถบซ้ายไม่รก · คลิป/รูปที่โหลดแล้วไม่หาย · ลบไม่ได้ = ข้าม ไม่หยุดคิว)</label></div>
        <div class="opt"><label class="opt-label" style="display:flex;gap:8px;align-items:center;cursor:pointer"><input type="checkbox" id="cleanOn"> ล้างไฟล์เก่าใน meta.ai อัตโนมัติ (พื้นที่ทำงานของ meta.ai จำกัด ~500MB)</label>
          <div class="chips" data-key="cleanEvery"></div>
          <div class="hint">ทำครบตามจำนวน → ส่งข้อความแยกสั่ง meta.ai ลบไฟล์เก่า (ไม่ทำวิดีโอ) แล้วรอให้ว่างก่อนทำตัวต่อไป · “ทุกคลิป” = สั่งล้างหลังทุกคลิป</div></div>
      </details>
    </main>
    <footer>
      <div class="prog" id="prog" hidden><i></i></div>
      <div class="runrow" id="runrow"></div>
      <div id="runlog" hidden></div>
      <div id="msg"></div>
    </footer>
    <input type="file" id="faceFile" accept="image/*" hidden>
    <input type="file" id="prodFile" accept="image/*" multiple hidden>
  </div>`;

  const $ = (id) => root.getElementById(id);
  const panel = $('panel');
  let uploadTarget = null;
  let draft = null; // พรีเซนเตอร์ที่กำลังเพิ่ม { image }

  function ensureMounted() { if (document.body && !host.isConnected) document.body.appendChild(host); }
  ensureMounted();
  new MutationObserver(() => { if (!host.isConnected) ensureMounted(); }).observe(document.documentElement, { childList: true, subtree: true });

  const store = {
    get: (k) => new Promise((r) => { try { chrome.storage.local.get(k, (v) => r(v || {})); } catch (e) { r({}); } }),
    set: (o) => { try { chrome.storage.local.set(o); } catch (e) { if (ctxGone()) ctxGoneNotice(); } },
    // ตอนเปิดหน้า: อ่านไม่สำเร็จ = null (ต่างจาก “ยังไม่มีข้อมูล” = {}) — เคยอ่านพลาดแล้วได้ {} → บันทึกรายการว่างทับของจริง
    load: (k) => new Promise((r) => { try { chrome.storage.local.get(k, (v) => r(chrome.runtime.lastError || !v ? null : v)); } catch (e) { r(null); } }),
  };
  let loaded = false; // โหลดรายการ/พรีเซนเตอร์/ตั้งค่าสำเร็จแล้ว — ก่อนหน้านั้นห้ามบันทึก (กันเขียนของว่างทับ)
  const mySaves = []; // สิ่งที่แท็บนี้บันทึกเอง (ไม่ต้องโหลดกลับ) — เก็บหลายรอบกันบันทึกซ้อนกัน
  const save = () => {
    if (!loaded) return;
    mySaves.push(JSON.stringify(products));
    if (mySaves.length > 20) mySaves.shift();
    store.set({ mah3: st, mah3Products: products, mah6Presenters: presenters });
  };
  let msgTimer = 0;
  function msg(text, cls) {
    $('msg').textContent = text; $('msg').className = cls || '';
    clearTimeout(msgTimer); // ข้อความทั่วไปหายเองใน 20 วิ (ไม่ค้างข้ามแท็บ) · ข้อผิดพลาดค้างไว้จนมีข้อความใหม่
    if (cls !== 'err' && text) msgTimer = setTimeout(() => { if ($('msg').textContent === text) { $('msg').textContent = ''; $('msg').className = ''; } }, 20000);
  }

  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  function thumb(img, onDel) {
    const d = el('div', 'thumb');
    d.innerHTML = '<img alt=""><button title="ลบ">×</button>';
    d.querySelector('img').src = img.dataUrl;
    d.querySelector('button').onclick = onDel;
    return d;
  }
  function addBtn(label, onClick) { const b = el('button', 'add', label); b.onclick = onClick; return b; }
  async function copy(text, okMsg) {
    try { await navigator.clipboard.writeText(text); msg(okMsg, 'ok'); } catch (e) { msg('คัดลอกไม่ได้', 'err'); }
  }

  const openImgs = new Set(); // การ์ดที่กางรูปอยู่
  const openCards = new Set(); // สินค้าที่กางแก้ไขอยู่ (ที่เหลือแสดงเป็นแถวย่อ — คิวยาวหลายสิบตัวเลื่อนดูง่าย)
  let qFind = ''; // หาชื่อในคิว
  let clearArm = false, clearTimer = 0; // ปุ่มเคลียร์ที่เสร็จ: กดครั้งแรก = ถามยืนยัน
  let fbClearArm = false, fbClearTimer = 0;
  let spreadArm = false, spreadTimer = 0; // 🔀 แบ่งคลิปค้างให้ทุกเพจ: กดครั้งแรก = ถามยืนยัน // แท็บ 📘 ปุ่มเคลียร์ตัวที่โพสต์แล้ว: กดครั้งแรก = ถามยืนยัน
  let fbWipeArm = false, fbWipeTimer = 0; // แท็บ 📘 ปุ่มลบทั้งหมด (เริ่มใหม่หมด): กดครั้งแรก = ถามยืนยัน
  let wipeArm = false, wipeTimer = 0; // ปุ่มลบทั้งหมด: กดครั้งแรก = ถามยืนยัน
  // รูปย่อ 96px ของรูปสินค้า (รูปเต็มใหญ่ วาดหลายสิบรูปทุกครั้งที่อัปเดตจะหน่วง)
  const smallImgs = new WeakMap();
  const shrinkUrl = (src, max) => new Promise((res, rej) => {
    const im = new Image();
    im.onload = () => {
      const k = Math.min(1, max / Math.max(im.width, im.height, 1));
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(im.width * k)); c.height = Math.max(1, Math.round(im.height * k));
      c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
      res(c.toDataURL('image/jpeg', 0.82));
    };
    im.onerror = rej;
    im.src = src;
  });
  function setSmall(imgEl, img) {
    if (!img || !img.dataUrl) return;
    let pr = smallImgs.get(img);
    if (!pr) { pr = shrinkUrl(img.dataUrl, 96); smallImgs.set(img, pr); }
    pr.then((s) => { imgEl.src = s; }, () => { imgEl.src = img.dataUrl; });
  }
  function coverOf(p) {
    const cov = el('div', 'cover');
    if (p.images.length) { const im = el('img'); im.alt = ''; setSmall(im, p.images[0]); cov.append(im); } else if (p.thumb) { const im = el('img'); im.alt = ''; im.src = p.thumb; cov.append(im); } else cov.textContent = 'ไม่มีรูป';
    return cov;
  }
  function removeProducts(gone) {
    const ids = new Set(gone.map((p) => p.id));
    gone.forEach((p) => { mediaFor.delete(p.id); openCards.delete(p.id); openImgs.delete(p.id); delete run.status[p.id]; });
    // 🧬 เอาตัวที่ลง Shopee ออก (ลงครบแล้ว / ลบเอง) → เวอร์ชันที่เหลือเป็นเฉพาะ FB (คลิปตัวนั้นอยู่ในโฟลเดอร์ Shopee แล้ว — ห้ามลงซ้ำ)
    gone.filter((p) => p.vg && p.svPick === true && (p.clipAt || p.done)).forEach((p) => products.forEach((x) => { if (x.vg === p.vg && !ids.has(x.id) && x.svPick === undefined) x.svPick = false; }));
    mediaDel(gone.map((p) => p.id));
    products = products.filter((p) => !ids.has(p.id));
    save(); renderAll();
  }
  // ตัวกรองคิวที่ใช้จริง: ปุ่มถูกซ่อน (ไม่ใช้เพจ FB / ไม่มีตัวลงครบแล้ว) = ดูทั้งหมด (เดิมรายการว่าง ไม่มีปุ่มไหนถูกเลือก)
  const qf = () => { const f = st.qFilter || 'all'; return (f === 'fbwait' && !fbPagesOn().length) || (f === 'posted' && !products.some(postedAll)) ? 'all' : f; };
  function renderQbar() {
    const box = $('qbar');
    const missing = todo().filter(needsScript).length;
    const sToday = stats.day === today() ? stats : { ok: 0, fail: 0, clips: 0, gemini: 0 };
    const nDone = products.filter((p) => p.done).length;
    // ตัวกรอง: รอทำ / เสร็จ / ทั้งหมด
    const f = qf();
    const nFb = products.filter((p) => p.done && !fbDone(p)).length, nSv = products.filter((p) => p.done && !p.svAt && svNeed(p)).length, nAll = products.filter(postedAll).length;
    $('qFilter').replaceChildren(...[['todo', `รอทำ ${products.length - nDone}`], ['done', `เสร็จ ${nDone}`], ...(fbPagesOn().length ? [['fbwait', `รอลง FB ${nFb}`]] : []), ['svwait', `รอลง Shopee ${nSv}`], ...(nAll ? [['posted', `ลงครบ ${nAll}`]] : []), ['all', `ทั้งหมด ${products.length}`]].map(([v, t]) => {
      const b = el('button', f === v ? 'on' : '', t);
      b.onclick = () => { st.qFilter = v; save(); renderProducts(); };
      return b;
    }));
    const items = [];
    const stat = el('span', 'stat', `วันนี้ ✅${sToday.ok} ❌${sToday.fail} · คลิป ${sToday.clips}${st.scriptMode === 'ai' ? ` · Gemini ${sToday.gemini} ครั้ง` : ''}`);
    stat.title = 'สถิติวันนี้: สินค้าที่ทำเสร็จ / ผิดพลาด · ไฟล์คลิปที่โหลด · จำนวนครั้งที่เรียก Gemini (รวมที่ลองใหม่)';
    if (st.scriptMode === 'ai') {
      const b = el('button', 'btn dark', writer.on ? (writer.stop ? 'กำลังหยุด...' : `⏹ หยุดเขียน (${writer.done}/${writer.total})`) : `✨ เขียนบททั้งหมด (${missing})`);
      b.disabled = run.on || (!writer.on && !missing);
      b.title = 'Gemini เขียนบทให้ทุกตัวที่ยังไม่มีบท หรือบทเดิมเขียนไว้สำหรับความยาว/จังหวะอื่น (บทที่แก้เองไม่ทับ) ทีละตัว เว้นระยะกัน rate limit';
      b.onclick = writeAll;
      items.push(b);
    }
    // สลับทำรูปแนบคอมเมนต์ Reel ได้จากหน้าคิวเลย (ตัวเดียวกับ 📷 ในหมวด 📤 การโพสต์)
    const fb = el('button', photosOn() ? 'btn dark' : 'btn', photosOn() ? `📷 รูปคอมเมนต์ ${photoN()} ภาพ: เปิด` : '📷 รูปคอมเมนต์: ปิด');
    fb.title = `สั่งใน prompt เดียวกับคลิป: รูปสี่เหลี่ยมจัตุรัส 1080x1080 ${photoN() || +st.cmtLast || 2} ภาพ ไว้แนบคอมเมนต์ Reel แล้วโหลดเก็บคู่คลิป (ชื่อสินค้า-photo-1…) · จำนวนรูปตั้งได้ที่หมวด 📤 การโพสต์`;
    fb.disabled = run.on;
    fb.onclick = () => { if (photosOn()) { st.cmtLast = st.fbCmtPhotos; st.fbCmtPhotos = '0'; } else st.fbCmtPhotos = st.cmtLast && st.cmtLast !== '0' ? st.cmtLast : '2'; save(); renderAll(); msg(photosOn() ? `เปิดทำรูปคอมเมนต์ ${photoN()} ภาพแล้ว ✓` : 'ปิดทำรูปคอมเมนต์แล้ว (Reel มีแค่คอมเมนต์ลิงก์)', 'ok'); };
    items.push(fb);
    // เคลียร์สินค้าที่ทำเสร็จออกจากคิว (ไฟล์ที่โหลดไว้ในเครื่องยังอยู่) · กด 2 ครั้งกันพลาด
    const gone = products.filter((p) => p.done && !fbBusy.has(p.id));
    if (gone.length) {
      const unposted = fbPagesOn().length ? gone.filter((p) => !(p.fbPosts || []).length).length : 0;
      const cb = el('button', clearArm ? 'btn danger' : 'btn', clearArm ? `กดอีกครั้งเพื่อลบ ${gone.length} ตัว${unposted ? ` (ยังไม่ได้โพสต์ FB ${unposted})` : ''}` : `🧹 เคลียร์ที่เสร็จ (${gone.length})`);
      cb.title = 'ลบสินค้าที่ทำเสร็จแล้วออกจากคิว — คลิป/รูป/.txt ที่โหลดไว้ในเครื่องยังอยู่';
      cb.onclick = () => {
        clearTimeout(clearTimer);
        if (!clearArm) { clearArm = true; clearTimer = setTimeout(() => { clearArm = false; renderQbar(); }, 5000); renderQbar(); return; }
        clearArm = false;
        removeProducts(gone);
        msg(`เคลียร์สินค้าที่ทำเสร็จแล้ว ${gone.length} ตัว ✓`, 'ok');
      };
      items.push(cb);
    }
    // ลบทุกตัวในคิว (รอทำ + เสร็จ) — ไฟล์ที่โหลดไว้ในเครื่องยังอยู่
    const every = products.filter((p) => !fbBusy.has(p.id));
    if (every.length) {
      const nTodo = every.filter((p) => !p.done).length;
      const wb = el('button', wipeArm ? 'btn danger' : 'btn danger-t', wipeArm ? `กดอีกครั้งเพื่อลบทั้งหมด ${every.length} ตัว${nTodo ? ` (ยังไม่ได้ทำ ${nTodo})` : ''}` : `🗑 ลบทั้งหมด (${every.length})`);
      wb.disabled = run.on || writer.on;
      wb.title = run.on || writer.on ? 'หยุดรันคิว/เขียนบทก่อน' : 'ลบสินค้าทุกตัวออกจากคิว (ทั้งรอทำและเสร็จ) — คลิป/รูป/.txt ที่โหลดไว้ในเครื่องยังอยู่ · ป้าย “เคยทำ” ยังจำไว้';
      wb.onclick = () => {
        clearTimeout(wipeTimer);
        if (!wipeArm) { wipeArm = true; wipeTimer = setTimeout(() => { wipeArm = false; renderQbar(); }, 5000); renderQbar(); return; }
        wipeArm = false;
        removeProducts(every);
        msg(`ลบสินค้าในคิวทั้งหมด ${every.length} ตัว ✓`, 'ok');
      };
      items.push(wb);
    }
    items.push(stat);
    box.replaceChildren(...items);
  }

  // ป้ายสถานะสี: กำลังทำ (ส้ม กะพริบ) · เสร็จ (เขียว) · ผิดพลาด (แดง) · รอ (เทา)
  const statusPill = (text) => el('span', `status ${/✅|✓|เสร็จ/.test(text) ? 'st-ok' : /❌|ผิดพลาด/.test(text) ? 'st-bad' : /รอคิว|⏸/.test(text) ? 'st-wait' : 'st-run'}`, text);
  // แถวย่อ: รูป · ลำดับ + ชื่อ · สถานะ/ค่าคอม/ป้าย — กดเพื่อกางแก้ไข
  function productRow(p, n) {
    const r = el('div', `card qrow${p.done ? ' done' : ''}${run.on && runItem === p ? ' active' : ''}`); // กรอบส้ม = ตัวที่กำลังทำอยู่ตัวเดียว
    r.dataset.id = p.id;
    const mid = el('div', 'mid');
    const meta = el('div', 'meta');
    if (run.status[p.id]) meta.append(statusPill(run.status[p.id]));
    else if (p.done) meta.append(statusPill('✓ เสร็จ'));
    if (p.vg) meta.append(verBadge(p));
    if (p.extra) meta.append(el('span', 'xtra', `Extra ${p.extra}`));
    if (p.commission) meta.append(el('span', '', `คอม ${p.commission}`));
    if (!p.link) { const nb = el('span', 'bad', 'ไม่มีลิงก์'); nb.title = p.linkError ? `เอาลิงก์ไม่ได้: ${p.linkError}` : 'ยังไม่มีลิงก์ affiliate — กดแถวแล้วกด 🔗 เอาลิงก์ หรือวางลิงก์เอง'; meta.append(nb); }
    if (!p.images.length && !p.thumb) meta.append(el('span', 'bad', 'ไม่มีรูป'));
    if (HAZARD_RE.test(p.name)) meta.append(hazardBadge());
    if (!p.done && p.redoWhy) meta.append(el('span', 'bad', `↺ ทำใหม่: แก้${(REDO.find(([k]) => k === p.redoWhy) || [, ''])[1]}`));
    if (MODEST_RE.test(p.name)) { const mb = el('span', '', '👗 ถ่ายสินค้าล้วน'); mb.title = 'ชุดชั้นใน/ชุดนอนเซ็กซี่/ชุดว่ายน้ำ — meta.ai ไม่ทำแบบมีคนใส่ → สั่งถ่ายสินค้าล้วน (แขวน พับ โคลสอัพผ้า) ไม่มีนางแบบ'; meta.append(mb); }
    const h = !p.done && !p.vg && histOf(p);
    if (h) meta.append(histBadge(h)); // เพิ่มสินค้าที่เคยทำแล้วเข้าคิวซ้ำ
    if ((p.script || '').trim() && st.scriptMode !== 'same') meta.append(el('span', '', '🗣 มีบท'));
    if (p.done) { // ผู้ใช้ขอ: บอกให้ชัดว่าตัวไหนลง Facebook / Shopee แล้ว
      const fbs = p.fbPosts || [], miss = fbMissed(p);
      if (fbs.length) { const b = el('span', miss ? 'bad' : 'good', miss ? '📘 ลงแล้ว · ตะกร้ายังไม่ติด' : '📘 ลง FB แล้ว'); b.title = 'ลงเพจ: ' + [...new Set(fbs.map((x) => x.page).filter(Boolean))].join(', '); meta.append(b); }
      else if (fbPagesOn().length) meta.append(el('span', 'wait', '📘 ยังไม่ลง'));
      meta.append(p.svAt ? el('span', 'good', '🛍 ลง Shopee แล้ว') : !svNeed(p) ? el('span', '', '🛍 ไม่ลง (เฉพาะ FB)') : el('span', 'wait', '🛍 ยังไม่ลง'));
    }
    mid.append(el('div', 'nm', `${n}. ${p.name.trim() || '(ยังไม่มีชื่อ)'}`), meta);
    const del = el('button', 'icon', '🗑'); del.title = 'ลบสินค้า';
    del.onclick = (e) => { e.stopPropagation(); removeProducts([p]); };
    const acts = el('div', 'qacts');
    if (canShop(p)) { // 🏪 ดึงสินค้าทั้งร้านของตัวนี้ (เห็นได้เลยไม่ต้องกางการ์ด)
      const sb = el('button', 'icon', '🏪'); sb.title = 'ดึงสินค้าทั้งร้านของสินค้านี้ (ไปแท็บ 🔎)';
      sb.onclick = (e) => { e.stopPropagation(); pullShopOf(p); };
      acts.append(sb);
    }
    if (fbPagesOn().length > 1 && verRoom(p)) { // 🧬 ทำเพิ่มเวอร์ชัน (กางการ์ดแล้วเปิดตัวเลือกจำนวน)
      const vb = el('button', 'icon', '🧬'); vb.title = `ทำเพิ่มเวอร์ชันของสินค้านี้ ลงเพจอื่นเพจละ 1 คลิป (ว่าง ${verRoom(p)} เพจ)`;
      vb.onclick = (e) => { e.stopPropagation(); openCards.add(p.id); verOpen.add(p.id); renderProducts(); };
      acts.append(vb);
    }
    acts.append(del);
    r.append(coverOf(p), mid, acts);
    r.title = 'กดเพื่อแก้ไข (ชื่อ บทพูด รูป รายละเอียด โพสต์)';
    r.onclick = () => { openCards.add(p.id); renderProducts(); };
    return r;
  }

  function productCard(p) {
    const c = el('div', 'card qcard' + (p.done ? ' done' : ''));
    c.dataset.id = p.id;
    // รูปปก: กดเพื่อกาง/พับรูปทั้งหมด
    const cover = el('div', 'cover' + (p.images.length || p.thumb ? '' : ' empty'));
    if (p.images.length) {
      const im = el('img'); setSmall(im, p.images[0]); cover.append(im);
      if (p.images.length > 1) cover.append(el('span', 'n', `${p.images.length}`));
    } else if (p.thumb) { const im = el('img'); im.src = p.thumb; cover.append(im); } else cover.textContent = '+ รูป';
    cover.title = p.images.length ? 'กดเพื่อดู/ลบ/เพิ่มรูป' : 'เพิ่มรูป';
    cover.onclick = () => {
      if (!p.images.length) { uploadTarget = p.id; $('prodFile').click(); return; }
      openImgs.has(p.id) ? openImgs.delete(p.id) : openImgs.add(p.id);
      renderProducts();
    };
    const row1 = el('div', 'row1');
    const name = el('input'); name.type = 'text'; name.placeholder = 'ชื่อสินค้า'; name.value = p.name;
    name.oninput = () => { p.name = name.value; save(); renderRun(); };
    const del = el('button', 'icon', '🗑'); del.title = 'ลบสินค้า';
    del.onclick = () => removeProducts([p]);
    const fold = el('button', 'icon', '▴'); fold.title = 'ย่อเป็นแถว';
    fold.onclick = () => { openCards.delete(p.id); openImgs.delete(p.id); renderProducts(); };
    row1.append(name, del, fold);
    c.append(cover, row1);
    // บทพูดรายสินค้า (ไม่บังคับ) · ว่าง = meta.ai คิดเอง / Gemini เขียนให้ตอนรัน
    const ai = st.scriptMode === 'ai';
    if (st.scriptMode !== 'same') {
      const t = el('textarea'); t.rows = 1; t.value = p.script || '';
      t.placeholder = `บทพูด (ไม่บังคับ · 1 บรรทัด = 1 ช่วง) — ว่างไว้ ${ai ? 'Gemini เขียนให้ตอนรัน' : 'meta.ai คิดให้จากชื่อ/รายละเอียด/รูป'}`;
      const fit = () => { if (!t.getClientRects().length) return; t.style.height = 'auto'; t.style.height = `${Math.min(t.scrollHeight + 2, 140)}px`; }; // ซ่อนอยู่ = วัดความสูงไม่ได้
      const stale = () => ((p.script || '').trim() && needsScript(p) ? `บทนี้เขียนไว้สำหรับคลิปความยาว/จังหวะอื่น — ${ai ? 'จะเขียนใหม่ตอนรัน (หรือกด ✨ เขียนใหม่)' : 'จะไม่ใช้ ให้ meta.ai คิดใหม่'}` : '');
      const errLine = p.scriptError ? `เขียนบทไม่ได้: ${p.scriptError}${(p.script || '').trim() ? ' — บทข้างบนเป็นร่าง แก้คำที่ติดแล้วใช้ได้เลย' : ''}` : '';
      const warn = el('div', 'warn', (errLine ? [errLine] : [...checkText(t.value), stale()]).filter(Boolean).join(' · '));
      t.oninput = () => {
        Object.assign(p, { script: t.value, scriptBy: 'user', scriptError: '' }); // แก้เอง = ไม่เขียนทับ
        save(); warn.textContent = checkText(t.value).join(' · '); fit(); renderQbar();
      };
      requestAnimationFrame(fit);
      c.append(t, warn);
    } else c.append(el('div'));
    const meta = el('div', 'meta');
    if (run.status[p.id]) meta.append(statusPill(run.status[p.id]));
    if (p.commission) meta.append(el('span', '', `คอม ${p.commission}`));
    if (p.extra) meta.append(el('span', 'xtra', `Extra ${p.extra}`));
    if (p.link) {
      const b = el('button', 'pill', '📋 ลิงก์');
      b.title = p.link;
      b.onclick = () => copy(p.link, `คัดลอกลิงก์แล้ว ✓ ${p.link}`);
      meta.append(b);
    }
    if (p.done && fbPagesOn().length) { // โพสต์ลงเพจ (กดเอง) · สลับเพจทีละสินค้า
      const next = pageFor(p); // เพจที่กำหนดตอนทำคลิป (หน้าพรีเซนเตอร์ตรงกับเพจ)
      const fbBtn = el('button', 'pill', fbBusy.has(p.id) ? 'กำลังโพสต์...' : `📘 โพสต์ → ${next.name.slice(0, 18)}`);
      fbBtn.title = `โพสต์ Reel ลงเพจ “${next.name}”${st.fbComment ? ' + ปักตะกร้าในคอมเมนต์' : ''}`;
      fbBtn.disabled = fbBusy.has(p.id);
      fbBtn.onclick = () => fbPublish(p);
      meta.append(fbBtn);
      if (p.fbPosts && p.fbPosts.length) meta.append(el('span', '', `✓ โพสต์แล้ว ${p.fbPosts.length} ครั้ง (ล่าสุด “${p.fbPosts[p.fbPosts.length - 1].page}”)`));
      if (fbMissed(p)) meta.append(recommentBtn(p));
    }
    if (p.caption) { // แคปชัน + แฮชแท็ก + ลิงก์ → วางโพสต์ Facebook ได้ทันที
      const pb = el('button', 'pill', '📋 โพสต์');
      pb.title = postText(p).replace(/^﻿/, '');
      pb.onclick = () => copy(postText(p).replace(/^﻿/, ''), 'คัดลอกโพสต์แล้ว ✓ วางใน Facebook ได้เลย');
      meta.append(pb);
    }
    const dBtn = el('button', 'pill', (p.desc || '').trim() ? '📝 รายละเอียด ✓' : '📝 รายละเอียด');
    dBtn.title = 'รูป + รายละเอียด/จุดเด่นสินค้า (ใช้คิดบทพูด)';
    dBtn.onclick = () => { openImgs.has(p.id) ? openImgs.delete(p.id) : openImgs.add(p.id); renderProducts(); };
    meta.append(dBtn);
    if (ai && !p.done) {
      const w = el('button', 'pill', p.script ? '✨ เขียนใหม่' : '✨ เขียนบท');
      w.disabled = writer.on;
      w.onclick = async () => {
        w.disabled = true; w.textContent = 'กำลังเขียน...';
        try { await writeScript(p); msg('เขียนบทแล้ว ✓', 'ok'); } catch (e) { p.scriptError = String(e.message || e); save(); msg(`เขียนบทไม่ได้: ${p.scriptError}`, 'err'); }
        renderProducts(); renderQbar();
      };
      meta.append(w);
    }
    if (canShop(p)) { // 🏪 ร้านนี้: ดึงสินค้าทั้งร้านของสินค้านี้ไปแท็บ 🔎
      const sb = el('button', 'pill', '🏪 ร้านนี้');
      sb.title = `ดึงสินค้าทั้งร้าน${p.shopName ? ` “${p.shopName}”` : ''} ของสินค้านี้ (แท็บ 🔎)`;
      sb.onclick = (e) => { e.stopPropagation(); pullShopOf(p); };
      meta.append(sb);
    }
    if (p.done) {
      const again = el('button', 'pill', redoOpen.has(p.id) ? '✕ ยกเลิก' : '👎 ไม่เวิค / ทำใหม่');
      again.title = 'คลิปที่ได้ไม่ดี → เลือกว่าเสียตรงไหน แล้วทำใหม่ตอนรันคิว (prompt รอบใหม่สั่งแก้จุดนั้น · ลบไฟล์เก่าในเครื่องให้ได้)';
      again.onclick = () => { if (redoOpen.has(p.id)) redoOpen.delete(p.id); else redoOpen.add(p.id); renderProducts(); };
      meta.append(again);
    }
    if (fbPagesOn().length > 1) { // 🧬 ทำเพิ่มเวอร์ชัน: คลิปใหม่ของสินค้านี้ ลงเพจอื่นเพจละคลิป
      const room = verRoom(p), open = verOpen.has(p.id);
      const vb = el('button', 'pill', open ? '✕ ยกเลิก' : `🧬 ทำเพิ่มเวอร์ชัน${room ? ` (ว่าง ${room} เพจ)` : ''}`);
      vb.title = room ? `meta.ai ทำคลิปใหม่ของสินค้านี้อีก ลงเพจอื่นเพจละ 1 คลิป · ลง Shopee Video แค่ตัวเดียว ตัวอื่นเก็บไฟล์ที่ ShopeeVideo/…/${VER_DIR} (โปรแกรมโพสต์ไม่หยิบ)` : 'ทุกเพจที่เปิดใช้มีสินค้านี้แล้ว (จองไว้ / โพสต์แล้ว / เคยโพสต์)';
      vb.disabled = !room && !open;
      vb.onclick = () => { if (open) verOpen.delete(p.id); else verOpen.add(p.id); renderProducts(); };
      meta.append(vb);
    }
    c.append(meta);
    if (p.done && redoOpen.has(p.id)) c.append(redoBox(p));
    if (verOpen.has(p.id)) c.append(verBox(p));
    if (!p.link) { // ไม่มีลิงก์ affiliate = ปักตะกร้า/ได้ค่าคอมไม่ได้ → เอาอัตโนมัติ หรือวางเอง
      const lr = el('div', 'linkrow');
      const li = el('input'); li.type = 'text'; li.placeholder = 'วางลิงก์ affiliate (https://s.shopee.co.th/…)';
      li.onchange = () => setLink(p, li.value);
      lr.append(li, linkBtn(p));
      c.append(lr);
    }
    if (openImgs.has(p.id)) {
      const imgs = el('div', 'imgs');
      imgs.append(...p.images.map((img, i) => thumb(img, () => { p.images.splice(i, 1); save(); renderAll(); })),
        addBtn('+ รูป', () => { uploadTarget = p.id; $('prodFile').click(); }));
      c.append(imgs);
      // รายละเอียดสินค้า (ใช้คิดบท: meta.ai / Gemini) + แคปชันที่จะใส่ในไฟล์โพสต์
      const more = el('div', 'more');
      const d = el('textarea'); d.rows = 2; d.placeholder = 'รายละเอียด/จุดเด่นสินค้า (ไม่บังคับ) — ใช้คิดบทพูด · ท่อนที่มีราคา/โปรจะถูกตัดออกก่อนส่ง'; d.value = p.desc || '';
      d.oninput = () => { p.desc = d.value; save(); };
      more.append(d);
      if (p.caption || (p.tags && p.tags.length)) more.append(el('div', 'cap', `แคปชันโพสต์: ${p.caption || '-'}\n${(p.tags || []).join(' ')}`));
      c.append(more);
    }
    return c;
  }

  function renderProducts() {
    const box = $('products');
    const all = [...products].sort((a, b) => a.done - b.done); // รอทำก่อน (ลำดับเดียวกับที่รัน) แล้วตามด้วยที่เสร็จ
    const f = qf(), q = qFind.trim().toLowerCase();
    const inF = (p) => (f === 'all' ? true : f === 'todo' ? !p.done : f === 'done' ? !!p.done : f === 'fbwait' ? p.done && !fbDone(p) : f === 'svwait' ? p.done && !p.svAt && svNeed(p) : f === 'posted' ? postedAll(p) : true);
    const list = all.map((p, i) => [p, i + 1]).filter(([p]) => inF(p) && (!q || p.name.toLowerCase().includes(q)));
    // กำลังพิมพ์ในการ์ดที่กางอยู่ (ชื่อ/บท/รายละเอียด) → วาดใหม่แล้วคืนเคอร์เซอร์ที่เดิม (สถานะรันคิวอัปเดตระหว่างพิมพ์ได้)
    const ae = root.activeElement, card = ae && ae.closest && ae.closest('#products [data-id]');
    const fields = (c) => [...c.querySelectorAll('input[type=text], textarea')];
    const keep = card && /^(INPUT|TEXTAREA)$/.test(ae.tagName) ? { id: card.dataset.id, i: fields(card).indexOf(ae), s: ae.selectionStart, e: ae.selectionEnd, top: box.parentElement.scrollTop } : null;
    box.replaceChildren(...(list.length ? list.map(([p, n]) => (openCards.has(p.id) ? productCard(p) : productRow(p, n)))
      : [products.length ? el('div', 'empty', 'ไม่มีสินค้าตามตัวกรองนี้') : onboard()]));
    if (keep) {
      const c = box.querySelector(`[data-id="${keep.id}"]`), fld = c && fields(c)[keep.i];
      if (fld) { fld.focus({ preventScroll: true }); try { fld.setSelectionRange(keep.s, keep.e); } catch (e) {} box.parentElement.scrollTop = keep.top; }
    }
    renderQbar();
    renderPostLists();
  }

  const linking = new Set(); // สินค้าที่กำลังเอาลิงก์อยู่
  const AFF_LINK_RE = /https:\/\/s\.shopee\.co\.th\/[A-Za-z0-9]+/;
  function setLink(p, text) { // วางลิงก์เอง: รับเฉพาะลิงก์ affiliate (ลิงก์สินค้าธรรมดาไม่ได้ค่าคอม)
    const m = String(text || '').match(AFF_LINK_RE);
    if (!m) { msg('ต้องเป็นลิงก์ affiliate แบบ https://s.shopee.co.th/… (ได้จากปุ่ม “เอา ลิงก์” บนหน้า Shopee Affiliate · ลิงก์สินค้าธรรมดาไม่ได้ค่าคอม)', 'err'); return; }
    p.link = m[0]; save(); renderAll();
    msg(`ใส่ลิงก์ affiliate แล้ว ✓ ${m[0]}`, 'ok');
  }
  function linkBtn(p) {
    const b = el('button', 'pill', linking.has(p.id) ? 'กำลังเอาลิงก์...' : '🔗 เอาลิงก์');
    b.title = 'ค้นชื่อสินค้านี้บนหน้า Shopee Affiliate (หรือ Open API) แล้วเอาลิงก์ affiliate มาใส่ให้';
    b.disabled = linking.has(p.id);
    b.onclick = (e) => { e.stopPropagation(); fetchLink(p); };
    return b;
  }
  async function fetchLink(p) {
    if (linking.has(p.id) || p.link) return;
    linking.add(p.id); renderAll();
    msg(`🔗 กำลังเอาลิงก์ affiliate: ${p.name.slice(0, 30)}...`, '');
    try {
      let link = '', err = '';
      if (useApi()) {
        const r = await bg({ type: 'shopeeSearch', ...spCreds, keyword: p.name.slice(0, 100), sortType: '1', page: 1, limit: 20 });
        const hit = r.ok && (r.nodes || []).find((n) => (p.itemId && String(n.itemId) === String(p.itemId)) || hKey(n.productName) === hKey(p.name));
        link = (hit && hit.offerLink) || '';
        if (!link) err = r.ok ? 'Open API ไม่เจอสินค้าชื่อนี้' : r.error;
      }
      if (!link) {
        const L = await bg({ type: 'affLink', name: p.name });
        link = (L.ok && L.link) || '';
        if (!link) err = L.error || err || 'Shopee ไม่ส่งลิงก์กลับมา';
      }
      if (link && products.includes(p)) { p.link = link; delete p.linkError; save(); } else if (!link) { p.linkError = err; save(); }
      msg(link ? `ได้ลิงก์ affiliate ✓ ${link}` : `เอาลิงก์ไม่ได้ (${err}) — วางลิงก์เองได้: แท็บคิว → กดแถวสินค้า → ช่องวางลิงก์`, link ? 'ok' : 'err');
    } finally {
      linking.delete(p.id); renderAll();
    }
  }
  // 🧬 ทำเพิ่มเวอร์ชัน: สินค้าที่ขายดี → คลิปใหม่อีก N คลิป (meta.ai ทำใหม่ทีละคลิปตามคิว) · เพจละ 1 คลิป ไม่ชนเพจที่มีสินค้านี้แล้ว
  const verOpen = new Set();
  function verBadge(p, page = true) {
    const pg = fbPageOf(p), b = el('span', '', `🧬 v${p.vn || 1}${page && pg ? ` → ${pg.name.slice(0, 16)}` : ''}`);
    b.title = `เวอร์ชันที่ ${p.vn || 1} ของสินค้านี้ (ในคิว ${1 + verSibs(p).length} เวอร์ชัน · คนละคลิป คนละเพจ) — ${p.svPick === true ? 'ตัวนี้ลง Shopee Video' : p.svPick === false ? `ไม่ลง Shopee (ลงเวอร์ชันเดียวพอ) · ไฟล์อยู่ ShopeeVideo/…/${VER_DIR}` : 'ตัวที่ได้ทำก่อนจะลง Shopee Video · ตัวอื่นลงแค่ FB'}`;
    return b;
  }
  function verBox(p) { // เลือกจำนวน (ไม่เกินเพจที่ว่าง)
    const box = el('div', 'redo'), room = verRoom(p);
    box.append(el('span', '', room ? 'ทำเพิ่มกี่เวอร์ชัน →' : 'ไม่มีเพจว่างแล้ว'));
    for (const n of [...new Set([1, 2, 3, 5].filter((x) => x < room).concat(room))].filter((x) => x > 0)) {
      const b = el('button', 'pill', n === room && n > 1 ? `+${n} (ครบทุกเพจ)` : `+${n}`);
      b.onclick = (e) => { e.stopPropagation(); addVersions(p, n); };
      box.append(b);
    }
    if (room) box.append(el('span', '', `เพจที่ว่าง: ${verFree(p).map((pg) => pg.name).join(', ')}`));
    return box;
  }
  function addVersions(p, n) {
    verOpen.delete(p.id);
    const free = verFree(p);
    if (!p.vg) Object.assign(p, { vg: p.id, vn: 1 });
    if (p.svPick === undefined && (p.done || p.clipAt || runItem === p)) p.svPick = true; // ตัวนี้มีคลิปในโฟลเดอร์ Shopee แล้ว / กำลังทำ = ตัวลง Shopee
    if (!fbPageOf(p) && !(p.fbPosts || []).length && free.length) p.fbPageId = free.shift().id; // ตัวนี้ยังไม่มีเพจ → จองก่อน (เวอร์ชันใหม่ไม่ชน)
    let vn = Math.max(...[p, ...verSibs(p)].map((x) => x.vn || 1));
    const add = free.slice(0, n).map((pg) => {
      const c = { ...p, id: uid(), vn: ++vn, fbPageId: pg.id, done: false, images: p.images.map((im) => ({ ...im })), clipFiles: [], photoFiles: [], fbMedia: null, fbPosts: [] };
      for (const k of Object.keys(c)) if (/^(clipAt|txtFile|svAt|svPick|caption|tags|redoWhy|linkError|script)/.test(k)) delete c[k]; // คลิป/แคปชัน/บทพูด = ของเวอร์ชันนี้เอง (meta.ai คิดใหม่)
      return c;
    });
    if (!add.length) { save(); renderAll(); msg('ไม่มีเพจว่างแล้ว — ทุกเพจที่เปิดใช้มีสินค้านี้แล้ว', 'err'); return; }
    products.push(...add);
    save(); renderAll();
    const names = add.map((x) => fbPageOf(x).name).join(', ');
    msg(`🧬 เพิ่ม ${add.length} เวอร์ชันของ “${p.name.slice(0, 30)}” เข้าคิวแล้ว → ${names} · กด ▶ รันคิว (ทำทีละคลิป) · ลง Shopee แค่ตัวเดียว`, 'ok');
    log(`🧬 ${safeName(p.name)}: เพิ่ม ${add.length} เวอร์ชัน → ${names}`, 'ok');
  }
  // 👎 ไม่เวิค / ทำใหม่: เลือกจุดที่เสีย → รอบหน้าสั่งแก้ · ลบคลิป/รูป/.txt เก่า (เฉพาะไฟล์ที่ส่วนเสริมโหลดเองในโฟลเดอร์ ShopeeVideo)
  const redoOpen = new Set();
  const REDO = [['face', 'หน้าเพี้ยน/ไม่เหมือน'], ['product', 'สินค้าไม่ตรง'], ['speech', 'เสียง/บทไม่ดี'], ['look', 'ภาพแปลก/ไม่สวย'], ['', 'ทำใหม่เฉยๆ']];
  function redoBox(p) {
    const box = el('div', 'redo');
    box.append(el('span', '', 'คลิปนี้เสียตรงไหน →'));
    const del = el('input'); del.type = 'checkbox'; del.checked = true;
    const lab = el('label', ''); lab.title = 'ลบไฟล์ที่ส่วนเสริมโหลดไว้ (คลิป/รูปโพสต์/.txt) — โปรแกรม Shopee Video จะไม่หยิบคลิปเสียไปโพสต์ · ไฟล์ใหม่ไม่ซ้ำชื่อเป็น (1)';
    lab.append(del, document.createTextNode(' ลบไฟล์เก่าในเครื่อง'));
    for (const [k, t] of REDO) { const b = el('button', 'pill', t); b.onclick = (e) => { e.stopPropagation(); redoProduct(p, k, del.checked); }; box.append(b); }
    const drop = el('button', 'pill drop', '🗑 เอาออก ไม่ทำแล้ว');
    drop.title = 'ไม่ทำสินค้านี้แล้ว — เอาออกจากคิว (+ ลบไฟล์เก่าถ้าติ๊กไว้) · ป้าย “เคยทำ” ในผลค้นหายังจำไว้';
    drop.onclick = (e) => { e.stopPropagation(); dropProduct(p, del.checked); };
    box.append(drop, lab);
    return box;
  }
  // ลบไฟล์เก่าของสินค้า (ทันที): ไฟล์ที่จำเลขไว้ + หาตามชื่อในประวัติดาวน์โหลด (คลิปที่ทำก่อนจำเลขไฟล์ได้) · คืนข้อความสรุป
  async function delOldFiles(p) {
    const ids = [...(p.clipFiles || []), ...(Number.isInteger(p.txtFile) ? [p.txtFile] : []), ...(p.photoFiles || [])].filter(Number.isInteger);
    const base = safeName(p.name);
    let removed = 0, missing = 0, found = 0, similar = [];
    const errs = [];
    if (ids.length) { const r = await bg({ type: 'removeFiles', ids }); if (r.ok) { removed += r.removed; missing += r.missing || 0; errs.push(...(r.errors || [])); } else errs.push(r.error); }
    const r2 = p.vg && p.svPick !== true ? { ok: true, removed: 0 } : await bg({ type: 'removeByName', base }); // 🧬 เวอร์ชันเฉพาะ FB: ลบตามเลขไฟล์เท่านั้น (ชื่อเดียวกัน = ไฟล์ของตัวที่ลง Shopee)
    if (r2.ok) { removed += r2.removed; missing += r2.missing || 0; found = r2.found || 0; similar = r2.similar || []; errs.push(...(r2.errors || [])); }
    else errs.push(/port closed|Receiving end|ไม่มีคำตอบ/i.test(r2.error || '') ? 'ส่วนเสริมยังเป็นรุ่นเก่า — กด Reload ส่วนเสริมแล้วรีเฟรชหน้านี้' : r2.error);
    const parts = [];
    if (removed) parts.push(`ลบไฟล์เก่าในโฟลเดอร์ ShopeeVideo แล้ว ${removed} ไฟล์`);
    if (missing) parts.push(`${missing} ไฟล์ไม่อยู่ที่เดิมแล้ว (ถูกย้าย/ลบไปก่อน)`);
    if (!removed && !missing && !ids.length && !found && r2.ok) parts.push(`ไม่เจอไฟล์ชื่อ “${base}” ในประวัติดาวน์โหลด${similar.length ? ` · ไฟล์ชื่อคล้าย: ${similar.slice(0, 3).join(', ')}` : ''} — ลบเองในโฟลเดอร์ ShopeeVideo (ปุ่ม 📂)`);
    if (errs.length) parts.push(`ลบไม่ได้: ${errs[0]}`);
    return parts.length ? ` · ${parts.join(' · ')}` : '';
  }
  async function dropProduct(p, delFiles) { // ไม่ทำสินค้านี้แล้ว: ลบไฟล์เก่า (ถ้าติ๊ก) แล้วเอาออกจากคิว
    redoOpen.delete(p.id);
    if (fbBusy.has(p.id)) { msg('สินค้านี้กำลังโพสต์อยู่ — รอให้เสร็จก่อน', 'err'); return; }
    const note = delFiles ? await delOldFiles(p) : '';
    removeProducts([p]);
    msg(`🗑 เอา “${p.name.slice(0, 30)}” ออกจากคิวแล้ว${note}`, 'ok');
  }
  async function redoProduct(p, why, delFiles) {
    redoOpen.delete(p.id);
    const note = delFiles ? await delOldFiles(p) : '';
    Object.assign(p, { done: false, redoWhy: why || '', clipFiles: [], photoFiles: [], fbMedia: null, fbPosts: [] }); // คลิปใหม่ = ต้องโพสต์ใหม่ (ประวัติว่าเคยโพสต์ยังอยู่ใน mahHistory)
    delete p.clipAt; delete p.txtFile; delete p.svAt; delete run.status[p.id];
    mediaFor.delete(p.id); mediaDel([p.id]);
    save(); renderAll();
    ensureImages(p).then(() => renderAll()); // รูปสินค้ากลับมา (ตัวที่เสร็จแล้วเก็บแค่รูปย่อ)
    msg(`↺ “${p.name.slice(0, 30)}” จะทำใหม่ตอนรันคิว${why ? ` · สั่งแก้: ${REDO.find(([k]) => k === why)[1]}` : ''}${note}`, 'ok');
  }
  // 🎬 ลง Reel: โพสต์รูปขึ้นแล้วแต่ Reel ไม่ขึ้น → ลงแค่ Reel ในเพจเดิม (ไม่โพสต์รูปซ้ำ) · ไม่มีคลิปแล้ว → 📁 เลือกไฟล์ .mp4 จาก ShopeeVideo
  // โพสต์รุ่นเก่า (ก่อนมีป้าย reelMissing): ขึ้นแค่รูป ไม่มี Reel ทั้งที่ตั้งโพสต์ “รูป + Reel” = Reel พลาด → ลงได้เหมือนกัน
  const reelLeft = (p) => { const last = (p.fbPosts || []).slice(-1)[0]; return last && last.pageId && (last.reelMissing || (st.fbPost === 'both' && /รูป/.test(last.what || '') && !/Reel/.test(last.what || ''))) ? last : null; };
  const reelPick = new Set(); // สินค้าที่ต้องเลือกไฟล์คลิปเอง
  function reelBtn(p) {
    const pick = reelPick.has(p.id);
    const b = el('button', 'pill', fbBusy.has(p.id) ? 'กำลังลง Reel...' : pick ? '📁 เลือกไฟล์คลิป' : '🎬 ลง Reel');
    b.title = pick ? 'เลือกไฟล์ .mp4 ของสินค้านี้จากโฟลเดอร์ Downloads/ShopeeVideo → ลง Reel ให้' : `รูปขึ้นแล้วแต่ Reel ยังไม่ขึ้น — ลงแค่ Reel ในเพจ “${reelLeft(p).page}” (ไม่โพสต์รูปซ้ำ)`;
    b.disabled = fbBusy.has(p.id);
    b.onclick = (e) => {
      e.stopPropagation();
      if (!pick) { fbReelOnly(p); return; }
      const inp = document.createElement('input'); // เปิดหน้าต่างเลือกไฟล์ทันที (ต้องอยู่ในจังหวะกดปุ่ม)
      inp.type = 'file'; inp.accept = 'video/*';
      inp.onchange = async () => {
        const file = inp.files && inp.files[0];
        if (!file) return;
        if (!okVideo(file)) { msg('ไฟล์นี้ไม่ใช่คลิปวิดีโอ — เลือกไฟล์ .mp4 ของสินค้านี้', 'err'); return; }
        mediaFor.set(p.id, { ...(mediaFor.get(p.id) || {}), video: { src: '', blob: file } });
        mediaPut(`clip:${p.id}`, file);
        reelPick.delete(p.id);
        fbReelOnly(p);
      };
      inp.click();
    };
    return b;
  }
  async function fbReelOnly(p) {
    const last = reelLeft(p), page = last && fb.pages.find((x) => x.id === last.pageId);
    if (!last || !page) { msg('หาเพจของโพสต์นี้ไม่เจอ — แท็บ 📘 → ดึงรายชื่อเพจใหม่', 'err'); return; }
    if (fbBusy.has(p.id)) return;
    fbBusy.add(p.id); renderAll();
    try {
      msg(`🎬 กำลังเตรียมคลิปของ “${(p.name || '').slice(0, 30)}”...`, '');
      const { video, photos } = await fbMediaFor(p);
      if (!video) { reelPick.add(p.id); msg('ไม่มีไฟล์คลิปในส่วนเสริมแล้ว (ลิงก์ meta.ai หมดอายุ) — กด 📁 เลือกไฟล์คลิป แล้วเลือก .mp4 ของสินค้านี้จากโฟลเดอร์ ShopeeVideo', 'err'); return; }
      const tags = (p.tags && p.tags.length ? p.tags : ['#รีวิว', '#ของดีบอกต่อ']).join(' ');
      const body = [(p.caption || promptName(p.name) || p.name || '').trim(), aiLine(), '', tags].filter((x, k) => x || k === 2).join('\n').trim();
      const comment = st.fbComment && p.link ? cartCommentFor(p, p.link) : '';
      msg(`🎬 กำลังลง Reel ในเพจ “${page.name}”...`, '');
      const r = await bg({ type: 'fbReel', pageId: page.id, token: page.token, video, description: reelText(body, p.link, comment), comment, cmtPhotos: reelPics(photos), aiGenerated: st.fbAiFlag !== false });
      if (!r.ok) { msg(`ลง Reel ไม่ได้: ${r.error}${fbHint(r.error)}`, 'err'); log(`❌ ${(p.name || '').slice(0, 30)}: ลง Reel ไม่ได้ — ${r.error}`, 'err'); return; }
      delete last.reelMissing;
      last.what = `${last.what} · Reel${comment ? (r.commented ? ' + ปักตะกร้า ✓' : ' (คอมเมนต์ไม่ได้ — กด 🛒 ปักตะกร้าใหม่)') : ''}${picNote(r)}`;
      const miss = missOf(r, 'Reel', comment);
      if (miss) last.missed = [...(last.missed || []), miss];
      save();
      fbRelease(p);
      log(`📘 ${(p.name || '').slice(0, 30)}: ลง Reel ในเพจ “${page.name}” แล้ว ✓`, 'ok');
      msg(`ลง Reel ในเพจ “${page.name}” แล้ว ✓`, 'ok');
    } catch (e) {
      msg(`ลง Reel ไม่ได้: ${e.message || e}`, 'err');
    } finally {
      fbBusy.delete(p.id); renderAll();
    }
  }
  function recommentBtn(p) { // โพสต์ขึ้นแล้วแต่คอมเมนต์ลิงก์ไม่ติด → ปักตะกร้าใหม่ (ไม่โพสต์ซ้ำ)
    const b = el('button', 'pill', fbBusy.has(p.id) ? 'กำลังปักตะกร้า...' : '🛒 ปักตะกร้าใหม่');
    const miss = fbMissed(p).missed, pend = miss.reduce((n, x) => n + Math.max(0, (x.pics || 0) - (x.picsDone || 0)), 0);
    b.title = `คอมเมนต์${miss.every((x) => x.linkDone) ? '' : 'ลิงก์'}${pend ? `${miss.every((x) => x.linkDone) ? '' : ' + '}รูป ${pend} รูป` : ''}ยังไม่ติดใน${miss.map((x) => x.what).join(' + ')} — กดเพื่อคอมเมนต์อีกครั้ง`;
    b.disabled = fbBusy.has(p.id);
    b.onclick = (e) => { e.stopPropagation(); fbRecomment(p); };
    return b;
  }
  // คิวว่าง: เริ่มใช้ 3 ขั้น (กดแล้วพาไปแท็บนั้น)
  // 📥 กู้รายการจากไฟล์สำรอง (เช่นไฟล์ที่ดึงจากที่เก็บข้อมูลของ Chrome) — เพิ่มสินค้า/พรีเซนเตอร์ที่ยังไม่มี · ตั้งค่าคลิปคืนให้ถ้าโดนล้างเป็นค่าเริ่มต้น
  function pickRestore() {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = '.json,application/json';
    inp.onchange = () => { const f = inp.files && inp.files[0]; if (f) restoreFrom(f); };
    inp.click();
  }
  async function restoreFrom(file) {
    if (!loaded) { msg('ยังโหลดรายการในเครื่องไม่เสร็จ — กด F5 แล้วลองใหม่', 'err'); return; }
    if (run.on) { msg('หยุดรันคิวก่อน แล้วค่อยกู้รายการ', 'err'); return; }
    msg('📥 กำลังอ่านไฟล์สำรอง...', '');
    let j;
    try { j = JSON.parse(await file.text()); } catch (e) { msg('อ่านไฟล์นี้ไม่ได้ — ไม่ใช่ไฟล์สำรองรายการ', 'err'); return; }
    const list = Array.isArray(j) ? j : (j && j.mah3Products) || [];
    if (!list.length) { msg('ไม่มีรายการสินค้าในไฟล์นี้', 'err'); return; }
    const have = new Set(products.map((p) => p.id));
    const add = list.filter((p) => p && p.id && !have.has(p.id)).map((p) => ({ ...newProduct(), ...p }));
    products.push(...add);
    msg(`📥 กำลังย่อรูปสินค้า ${add.length} ตัว...`, '');
    for (const p of add.filter((x) => !x.done)) { // ตัวที่ยังไม่ได้ทำ: ย่อรูปใหญ่เหลือ 1024px (รายการเบาลง · meta.ai ยังเห็นสินค้าชัด)
      for (const im of p.images || []) if ((im.dataUrl || '').length > 150000) { try { im.dataUrl = await shrinkUrl(im.dataUrl, 1024); im.type = 'image/jpeg'; } catch (e) {} }
    }
    const hp = new Set(presenters.map((x) => x.id));
    const addP = (Array.isArray(j.mah6Presenters) ? j.mah6Presenters : []).filter((x) => x && x.id && !hp.has(x.id));
    presenters.push(...addP);
    const setBack = !st.presenterId && j.mah3 && typeof j.mah3 === 'object'; // ตั้งค่าโดนล้าง (ไม่มีพรีเซนเตอร์ที่เลือก) → คืนตั้งค่าเดิม
    if (setBack) st = { ...st, ...j.mah3, theme: st.theme, folds: st.folds, panelW: st.panelW };
    loaded = true;
    save();
    await slimAll(); // ตัวที่ทำเสร็จเก็บแค่รูปย่อ
    save(); renderAll();
    msg(`📥 กู้รายการแล้ว: สินค้า ${add.length} ตัว${addP.length ? ` · พรีเซนเตอร์ ${addP.length} คน` : ''}${setBack ? ' · ตั้งค่าคลิปเดิม' : ''}${list.length - add.length ? ` · ข้าม ${list.length - add.length} ตัวที่มีอยู่แล้ว` : ''} ✓`, 'ok');
  }
  function onboard() {
    const box = el('div', 'onboard');
    box.append(el('div', 'ob-title', 'เริ่มทำคลิปใน 3 ขั้น'));
    for (const [n, title, desc, tab] of [
      ['1', 'หาสินค้า', 'แท็บ 🔎 → 🔥 แนะนำ / กดหมวด → กด “+ คิว” (ได้รูป ค่าคอม ลิงก์ affiliate)', 'search'],
      ['2', 'เลือกแนวคลิป', 'ตั้งค่าคลิป → ✨ แนวสำเร็จรูป กดทีเดียวตั้งให้ครบ (แก้ต่อได้)', 'settings'],
      ['3', 'กด ▶ รันคิวอัตโนมัติ', 'meta.ai ทำคลิป + รูปคอมเมนต์ + แคปชันให้ทีละตัว แล้วไปโพสต์ที่แท็บ 📘 / 🛍', ''],
    ]) {
      const b = el('button', 'ob-step');
      b.append(el('span', 'n', n), el('b', '', title), el('small', '', desc));
      b.onclick = () => { if (tab) root.querySelector(`.tabs [data-tab=${tab}]`).click(); else msg('เพิ่มสินค้าเข้าคิวก่อน แล้วกด ▶ ด้านล่าง', ''); };
      box.append(b);
    }
    const rb = el('button', 'pill', '📥 รายการหาย? กู้จากไฟล์สำรอง');
    rb.onclick = () => pickRestore();
    box.append(rb);
    return box;
  }
  // แท็บ 📘: คลิปที่ทำเสร็จ — ยังไม่โพสต์ขึ้นก่อน · กดโพสต์ทีละตัวจากตรงนี้
  function postRow(p, kind) {
    const r = el('div', 'card qrow');
    const mid = el('div', 'mid'), meta = el('div', 'meta');
    let b;
    if (kind === 'fb') {
      const posts = p.fbPosts || [], pg = pageFor(p);
      if (posts.length) meta.append(el('span', 'good', `✓ โพสต์แล้ว ${posts.length} ครั้ง (ล่าสุด “${posts[posts.length - 1].page}”)`));
      else if (pg) meta.append(el('span', '', `→ ${pg.name}`));
      if (p.vg) meta.append(verBadge(p, false));
      if (!p.link) meta.append(el('span', 'bad', 'ไม่มีลิงก์ตะกร้า'), linkBtn(p));
      if (fbMissed(p)) meta.append(recommentBtn(p));
      if (reelLeft(p)) meta.append(reelBtn(p));
      b = el('button', posts.length ? 'btn' : 'btn dark', fbBusy.has(p.id) ? 'กำลังโพสต์...' : posts.length ? '📘 อีกครั้ง' : '📘 โพสต์');
      b.disabled = fbBusy.has(p.id) || !pg || !p.link;
      b.title = !p.link ? 'ยังไม่มีลิงก์ affiliate — กด 🔗 เอาลิงก์ก่อน (โพสต์ไปก็ไม่ได้ค่าคอม)' : pg ? `โพสต์ Reel ลงเพจ “${pg.name}”${st.fbComment ? ' + ปักตะกร้าในคอมเมนต์' : ''}` : 'เลือกเพจด้านบนก่อน';
      b.onclick = () => fbPublish(p);

    }
    mid.append(el('div', 'nm', p.name.trim() || '-'), meta);
    r.append(coverOf(p), mid, b);
    return r;
  }
  const fbPostedDone = () => products.filter((p) => p.done && (p.fbPosts || []).length && !fbMissed(p) && !fbBusy.has(p.id));
  const fbDoneAll = () => products.filter((p) => p.done && !fbBusy.has(p.id));
  function renderPostLists() {
    const done = products.filter((p) => p.done);
    const nNoLink = done.filter((p) => !p.link && !(p.fbPosts || []).length).length;
    const nUn = fbUnposted().length, mins = fbBulk.nextAt ? Math.max(1, Math.ceil((fbBulk.nextAt - Date.now()) / 60000)) : 0;
    $('fbAll').hidden = !fbBulk.on && (!nUn || !fbPagesOn().length);
    $('fbAll').className = fbBulk.on ? 'btn danger' : 'btn dark';
    $('fbAll').textContent = fbBulk.on ? (fbBulk.stop ? 'กำลังหยุด...' : `⏹ หยุด · โพสต์แล้ว ${fbBulk.done}/${fbBulk.total}${mins ? ` · ตัวถัดไปอีก ${mins} นาที` : ''}`)
      : `📘 โพสต์ทั้งหมดที่ยังไม่โพสต์ (${nUn} ตัว) · ทยอยทุก ${(OPTIONS.fbGap.find(([v]) => v === st.fbGap) || [, '15 นาที'])[1]}${nNoLink ? ` · ข้าม ${nNoLink} ตัวที่ไม่มีลิงก์` : ''}`;
    // 🔀 คลิปค้างผูกเพจไว้ตั้งแต่ตอนทำคลิป → เพจที่เพิ่มทีหลังไม่ได้งาน · แบ่งไม่เท่ากัน = ขึ้นปุ่มเกลี่ย
    const pgOn = fbPagesOn(), perPage = new Map(pgOn.map((pg) => [pg.id, 0]));
    fbUnposted().forEach((p) => { const pg = fbPageOf(p); if (pg) perPage.set(pg.id, perPage.get(pg.id) + 1); else perPage.set('-', (perPage.get('-') || 0) + 1); });
    const cnts = pgOn.map((pg) => perPage.get(pg.id)), uneven = pgOn.length > 1 && nUn > 1 && (Math.max(...cnts) - Math.min(...cnts) > 1 || perPage.get('-') > 0);
    $('fbSpread').hidden = fbBulk.on || !uneven;
    $('fbSpread').className = spreadArm ? 'btn danger' : 'btn';
    $('fbSpread').textContent = spreadArm ? `กดอีกครั้งเพื่อแบ่ง ${nUn} คลิปให้ ${pgOn.length} เพจ` : `🔀 แบ่งคลิปค้างให้ทุกเพจ (${nUn} คลิป → เพจละ ~${Math.ceil(nUn / Math.max(1, pgOn.length))})`;
    $('fbSpread').title = `ตอนนี้: ${pgOn.map((pg) => `${pg.name} ${perPage.get(pg.id)}`).join(' · ')}${perPage.get('-') ? ` · ยังไม่กำหนดเพจ ${perPage.get('-')}` : ''} — กดแล้วแบ่งคลิปที่ยังไม่โพสต์ให้ทุกเพจที่เปิดใช้เท่าๆ กัน (ไม่สนหน้าพรีเซนเตอร์ในคลิป) · เพจเดียวกันยังห่างกันอย่างน้อย 1 ชม.`;
    $('fbAll').title = 'กดครั้งเดียว โพสต์ทีละตัวลงเพจของแต่ละสินค้า เว้นระยะตามที่ตั้ง (เปิดแท็บนี้ค้างไว้) · กดอีกครั้ง = หยุด';
    // 🧹 ตัวที่โพสต์ลงเพจแล้ว → ลบออกจากคิว (ปักตะกร้ายังไม่ติด / กำลังโพสต์ = ไม่ลบ)
    const nPosted = fbPostedDone().length;
    $('fbClear').hidden = !nPosted;
    $('fbClear').className = fbClearArm ? 'pill danger' : 'pill';
    $('fbClear').textContent = fbClearArm ? `กดอีกครั้งเพื่อลบ ${nPosted} ตัว` : `🧹 เคลียร์ตัวที่โพสต์แล้ว (${nPosted})`;
    $('fbClear').title = 'ลบสินค้าที่โพสต์ลงเพจแล้วออกจากคิว (แท็บคิวด้วย) — คลิป/รูป/.txt ในเครื่องยังอยู่ · ป้าย “เคยโพสต์” ในหน้าค้นหายังจำไว้ · ตัวที่ปักตะกร้ายังไม่ติดไม่ลบ';
    // 🗑 ลบทั้งหมด: คลิปที่ทำเสร็จทุกตัว (โพสต์แล้วหรือยังก็ลบ) — เริ่มใหม่หมด · กำลังโพสต์อยู่ไม่ลบ
    const all = fbDoneAll(), nUnposted = all.filter((p) => !(p.fbPosts || []).length).length;
    $('fbWipe').hidden = !all.length;
    $('fbWipe').className = fbWipeArm ? 'pill danger' : 'pill';
    $('fbWipe').textContent = fbWipeArm ? `กดอีกครั้งเพื่อลบทั้งหมด ${all.length} ตัว${nUnposted ? ` (ยังไม่ได้โพสต์ ${nUnposted})` : ''}` : `🗑 ลบทั้งหมด (${all.length})`;
    $('fbWipe').title = 'ลบคลิปที่ทำเสร็จทุกตัวออกจากรายการและคิว (ทั้งที่โพสต์แล้วและยังไม่โพสต์) — เริ่มใหม่หมด · ไฟล์คลิป/รูป/.txt ในเครื่องยังอยู่ · สินค้าที่รอทำในคิวไม่ลบ';
    for (const [kind, key, tab, label, ready] of [['fb', 'fbPosts', 'tabFb', '📘 เพจ FB', fbPagesOn().length > 0]]) {
      const posted = (p) => !!(p[key] || []).length;
      const left = done.filter((p) => !posted(p)).length;
      const settled = (p) => posted(p) && !(kind === 'fb' && fbMissed(p)); // ยังไม่โพสต์ / ปักตะกร้ายังไม่ติด → ขึ้นก่อน
      const list = [...done].sort((a, b) => settled(a) - settled(b));
      $(`${kind}List`).replaceChildren(...(list.length ? list.map((p) => postRow(p, kind)) : [el('div', 'empty', 'ยังไม่มีคลิปที่ทำเสร็จ — รันคิวในแท็บคิวสินค้า แล้วคลิปจะมาอยู่ตรงนี้')]));
      $(`${kind}ListSub`).textContent = done.length ? `${done.length} ตัว · ยังไม่${kind === 'fb' ? 'โพสต์' : 'อัปโหลด'} ${left}${ready ? '' : ' · เลือกเพจด้านบนก่อน'}` : '';
      $(tab).textContent = `${label}${ready && left ? ` (${left})` : ''}`;
    }
  }

  // ---------- แท็บ 🛍 Shopee Video: เชื่อมกับโปรแกรมโพสต์ในเครื่อง (shopee-poster · มือถือ Android) — ดูสถานะอย่างเดียว ----------
  // คลิปที่ทำเสร็จอยู่ใน Downloads/ShopeeVideo → โปรแกรมหยิบไปโพสต์ผ่านมือถือเอง · ส่วนเสริมไม่สั่งงานโปรแกรม (↗ เปิดโปรแกรมไปกดที่หน้านั้น)
  let sv = null, svSig = '', svAt = 0, svBusy = false;
  let saveSub = null; // โฟลเดอร์ย่อยของบัญชีนี้ใต้ Downloads/ShopeeVideo ('' = ชั้นบน · null = ยังไม่รู้)
  const SV_JOB = { idle: 'ยังไม่มีงาน', running: 'กำลังทำงาน', waiting: 'รอคุณตอบ', prepared: 'เตรียมแล้ว · ยังไม่เผยแพร่', done: 'จบการทำงาน', failed: 'มีปัญหา — ดูบันทึกในโปรแกรม', stopped: 'หยุดแล้ว' };
  const svOn = () => !!(sv && sv.ok && sv.on);
  // ลงครบ: Facebook (มีโพสต์ + ปักตะกร้าติดแล้ว — ไม่ได้ใช้เพจ FB = ไม่ต้อง) + Shopee Video
  const fbDone = (p) => !fbPagesOn().length || ((p.fbPosts || []).length > 0 && !fbMissed(p) && !((p.fbPosts || []).slice(-1)[0] || {}).reelMissing); // รูปขึ้นแต่ Reel ไม่ขึ้น (โหมดเก่า) = ยังไม่ครบ
  const postedAll = (p) => p.done && (!!p.svAt || !svNeed(p)) && fbDone(p); // 🧬 เวอร์ชันเฉพาะ FB = ลง FB ครบก็พอ
  function svMark(clips) { // คลิปที่โปรแกรมโพสต์บอกว่า "โพสต์แล้ว" → ติด 🛍 ✓ ที่สินค้า (ชื่อไฟล์ = ชื่อสินค้า)
    const byName = new Map(products.filter(svNeed).map((p) => [safeName(p.name), p])); // 🧬 ชื่อเดียวกันหลายเวอร์ชัน → ตัวที่ลง Shopee
    let n = 0;
    for (const c of clips || []) {
      const p = c.state === 'posted' && byName.get(String(c.name || '').replace(/-[AB]$/, '')); // คลิป A/B = สินค้าเดียวกัน
      if (p && !p.svAt) { p.svAt = Date.now(); histMark(p, 'sv'); n++; log(`🛍 ${(p.name || '').slice(0, 30)}: ลง Shopee Video แล้ว ✓`, 'ok'); }
    }
    if (n) { save(); renderAll(); }
    autoClear();
  }
  function autoClear() { // ลงครบทั้ง 2 ที่ → เอาออกจากคิวเอง (ไม่แตะตัวที่กำลังทำ/กำลังโพสต์)
    if (st.autoClear === false || !loaded) return;
    const gone = products.filter((p) => postedAll(p) && !fbBusy.has(p.id) && runItem !== p);
    if (!gone.length) return;
    removeProducts(gone);
    log(`🧹 ลงครบ Facebook + Shopee แล้ว → เอาออกจากคิว ${gone.length} ตัว (ประวัติ “เคยทำ” ยังอยู่)`, 'ok');
  }
  async function svCheck() {
    if (svBusy) return;
    svBusy = true;
    try { sv = await bg({ type: 'svStatus' }); } finally { svBusy = false; svAt = Date.now(); }
    if (sv && sv.ok && sv.on && loaded) svMark(sv.clips);
    const sig = JSON.stringify(sv);
    if (sig !== svSig) { svSig = sig; renderSv(); } // เหมือนเดิม = ไม่วาดใหม่ (เช็กทุก 5 วิ)
  }
  function svRow(c, byName) {
    const r = el('div', 'card qrow'), mid = el('div', 'mid'), meta = el('div', 'meta');
    const p = byName.get(c.name); // คลิปที่ส่วนเสริมทำ = ชื่อไฟล์จากชื่อสินค้า → ใช้รูปปกจากคิว
    meta.append(c.state === 'posted' ? el('span', 'good', '✓ โพสต์แล้ว') : c.state === 'skipped' ? el('span', 'wait', 'ข้ามแล้ว') : el('span', 'pend', '⏳ รอโพสต์'));
    if (c.mb) meta.append(el('span', '', `${c.mb} MB`));
    if (!c.link) meta.append(el('span', 'bad', 'ไม่มีลิงก์ตะกร้า (.txt)'));
    else if (!c.id && c.state === 'pending') meta.append(el('span', 'bad', 'ยังไม่ได้ตรวจรหัสสินค้า'));
    mid.append(el('div', 'nm', c.name || c.file), meta);
    mid.title = c.file;
    r.append(p ? coverOf(p) : el('div', 'cover', '🎬'), mid, el('span'));
    return r;
  }
  function renderSv() {
    const on = svOn(), s = sv || {};
    $('tabSv').textContent = `🛍 Shopee Video${on && s.pending ? ` (${s.pending})` : ''}`;
    $('svOpen').disabled = !on;
    $('svOpen').title = on ? `เปิดหน้าโปรแกรม ${s.url} — ตรวจมือถือ ตรวจรหัสสินค้า เริ่มเตรียมโพสต์` : 'เปิดโปรแกรมด้วย start.bat ก่อน';
    $('svState').className = 'svbadge' + (!sv ? '' : on ? ' on' : ' off');
    $('svState').textContent = !sv ? 'กำลังเชื่อม...' : on ? '● เชื่อมแล้ว' : '● ยังไม่ได้เปิดโปรแกรม';
    let noDir = false;
    const tile = (cls, k, v, sub) => { const t = el('div', `svtile ${cls}`); t.append(el('div', 'k', k), el('div', 'v', v)); if (sub) t.append(el('div', 's', sub)); return t; };
    const info = [], tiles = [];
    let next = '', nextCls = '';
    if (on) {
      const ph = s.phone, jb = s.job;
      const phOk = ph.state === 'device' && ph.checked;
      tiles.push(tile(phOk ? 'good' : 'bad', '📱 มือถือ', phOk ? 'พร้อม' : ph.state === 'device' ? 'ยังไม่ตรวจ' : 'ไม่พบ', ph.model || (ph.state === 'device' ? '' : 'เสียบสาย + USB debugging')));
      tiles.push(tile('', '📤 วันนี้โพสต์', `${s.today}${s.limit ? `/${s.limit}` : ''}`, s.autoPost ? 'โปรแกรมกดโพสต์ให้' : 'เตรียมให้ กดโพสต์เอง'));
      tiles.push(tile(s.pending ? '' : 'good', '📦 รอโพสต์', `${s.pending} คลิป`, jb.waiting ? '⚠ โปรแกรมรอคุณตอบ' : SV_JOB[jb.state] || jb.state));
      noDir = s.notes.some((n) => /ไม่เจอโฟลเดอร์/.test(n));
      // โปรแกรมดูโฟลเดอร์อื่น (ดูแค่ชั้นเดียว) → คลิปของบัญชีนี้ไม่ขึ้น/ไม่ได้โพสต์
      const want = saveSub == null ? '' : ['shopeevideo', saveSub].filter(Boolean).join('/').toLowerCase();
      const seg = String(s.folder || '').replace(/[\\/]+$/, '').split(/[\\/]/);
      const otherDir = !noDir && !!want && seg.slice(saveSub ? -2 : -1).join('/').toLowerCase() !== want;
      // ขั้นต่อไป: บอกสิ่งเดียวที่ต้องทำตอนนี้ (เรียงจากที่ติดก่อน)
      if (noDir) { next = '📂 โปรแกรมหาโฟลเดอร์คลิปไม่เจอ — ในโปรแกรมกด “คลิปดาวน์โหลด” ชี้ไปโฟลเดอร์คลิปของบัญชีนี้ แล้วบันทึก'; nextCls = 'bad'; }
      else if (otherDir) { next = `📂 โปรแกรมดูโฟลเดอร์ “…\\${seg.slice(-2).join('\\')}” แต่คลิปของบัญชีนี้บันทึกที่ Downloads\\ShopeeVideo${saveSub ? `\\${saveSub}` : ''} — คลิปของบัญชีนี้จึงไม่ขึ้นในโปรแกรม · จะโพสต์คลิปบัญชีนี้: ในโปรแกรมกด “คลิปดาวน์โหลด” เลือกโฟลเดอร์นี้`; nextCls = 'bad'; }
      else if (jb.waiting) { next = '⚠ โปรแกรมรอคุณตอบ — กด ↗ เปิดโปรแกรม'; nextCls = 'bad'; }
      else if (ph.state !== 'device') { next = '📱 เสียบสายมือถือ Android + เปิด USB debugging แล้วกด “อนุญาต” บนมือถือ'; nextCls = 'bad'; }
      else if (!ph.checked) next = '📱 กด ↗ เปิดโปรแกรม → “ตรวจมือถือที่เลือก”';
      else if (s.pending && !s.productsReady) next = '🔎 กด ↗ เปิดโปรแกรม → “ตรวจรหัสจากลิงก์ทั้งหมด” ก่อนโพสต์';
      else if (jb.running) next = `⚙️ กำลังโพสต์อยู่${jb.last ? ` · ${jb.last.slice(0, 70)}` : ''}`;
      else if (s.pending) { next = `✅ พร้อมโพสต์ ${s.pending} คลิป — กด ↗ เปิดโปรแกรม แล้วกดเริ่ม`; nextCls = 'ok'; }
      else { next = '✅ โพสต์ครบแล้ว — รันคิวทำคลิปเพิ่ม แล้วคลิปใหม่จะขึ้นที่นี่เอง'; nextCls = 'ok'; }
      const dir = el('div', 'hint', `📂 โฟลเดอร์คลิป: …${String(s.folder || '').split(/[\\/]/).slice(-2).join('\\')}`); dir.title = s.folder || ''; info.push(dir);
    } else {
      const steps = el('ol', 'svsteps');
      for (const t of ['ดับเบิลคลิก start.bat ในโฟลเดอร์ shopee-poster', 'เสียบมือถือ Android + เปิด USB debugging', 'กด 🔄 เชื่อมใหม่ (เปิดแท็บนี้ค้างไว้ = เช็กให้เองทุก 5 วิ)']) steps.append(el('li', '', t));
      info.push(steps);
      if (sv && sv.ok && sv.error) info.push(el('div', 'warn', `เชื่อมไม่ได้: ${sv.error}`));
    }
    $('svTiles').replaceChildren(...tiles);
    $('svNext').className = `svnext ${nextCls}`; $('svNext').textContent = next;
    $('svHint').textContent = on ? 'คลิปที่ทำเสร็จ → โปรแกรมหยิบไปโพสต์ผ่านมือถือ (แคปชัน + ปักตะกร้าจาก .txt) · โพสต์แล้วติด 🛍 ✓ ในคิวให้เอง' : '';
    $('svInfo').replaceChildren(...info);
    const all = on ? s.clips : [];
    const byName = new Map(products.filter(svNeed).map((p) => [safeName(p.name), p]));
    const bad = (c) => c.state === 'pending' && (!c.link || !c.id); // ติดปัญหา: ไม่มีลิงก์ / ยังไม่ตรวจรหัส
    const groups = [['⏳ รอโพสต์', all.filter((c) => c.state === 'pending' && !bad(c))], ['⚠ ต้องแก้ก่อนโพสต์', all.filter(bad)], ['✓ โพสต์แล้ว / ข้ามแล้ว', all.filter((c) => c.state !== 'pending')]];
    const rows = [];
    for (const [t, list] of groups) if (list.length) { const h = el('div', 'svgroup', t); h.append(el('span', 'sub', ` · ${list.length}`)); rows.push(h, ...list.slice(0, 300).map((c) => svRow(c, byName))); }
    $('svList').replaceChildren(...(rows.length ? rows
      : [el('div', 'empty', noDir ? 'โปรแกรมหาโฟลเดอร์คลิปไม่เจอ — แก้ตามแถบด้านบน แล้วคลิปจะขึ้นตรงนี้' : on ? 'ยังไม่มีคลิปในโฟลเดอร์ — รันคิวทำคลิปก่อน แล้วคลิปจะขึ้นตรงนี้' : 'เปิดโปรแกรมแล้ว รายการคลิปของโปรแกรมจะขึ้นตรงนี้')]));
    $('svListSub').textContent = on && all.length ? `${all.length} คลิป · รอโพสต์ ${s.pending}` : '';
  }

  function renderPeople() {
    const box = $('people');
    const none = el('div', 'person none' + (st.presenterId ? '' : ' on'), 'ไม่ใช้รูป');
    none.onclick = () => { st.presenterId = ''; save(); renderAll(); };
    const cards = presenters.map((p) => {
      const d = el('div', 'person' + (p.id === st.presenterId ? ' on' : ''));
      d.title = p.desc || p.name;
      const img = el('img');
      img.src = p.image.dataUrl;
      const x = el('button', 'x', '×');
      x.title = 'ลบพรีเซนเตอร์';
      x.onclick = (e) => {
        e.stopPropagation();
        presenters = presenters.filter((q) => q.id !== p.id);
        if (st.presenterId === p.id) st.presenterId = '';
        save(); renderAll();
      };
      d.append(img, el('div', 'nm', p.name || 'ไม่มีชื่อ'), x);
      d.onclick = () => { st.presenterId = p.id; save(); renderAll(); };
      return d;
    });
    const add = el('div', 'person none', '+ เพิ่ม');
    add.onclick = () => $('faceFile').click();
    box.replaceChildren(none, ...cards, add);
    $('newp').hidden = !draft;
    // แก้คำบรรยายของพรีเซนเตอร์ที่เลือกอยู่ (ใส่ใน prompt ว่า face must match exactly)
    const sel = presenter();
    $('presDesc').hidden = !sel;
    if (sel && root.activeElement !== $('presDesc')) $('presDesc').value = sel.desc || '';
    if (draft) $('newpImg').replaceChildren(thumb(draft.image, () => { draft = null; renderPeople(); }));
  }

  function renderChips() {
    const m = mode();
    root.querySelectorAll('.chips[data-key]').forEach((box) => {
      const key = box.dataset.key;
      box.replaceChildren(...OPTIONS[key].map(([val, label]) => {
        const b = el('button', '', label);
        const on = key === 'presenter' ? (m === 'hands' ? val === 'human' : m === 'none' ? false : st.presenter === val)
          : key === 'scenes' && st.style === 'ugc' ? val === '1' // แนว UGC = 1 ซีนเสมอ
          : MULTI.has(key) ? st[key].includes(val) : st[key] === val;
        b.className = on ? 'on' : '';
        b.disabled = (key === 'presenter' && (m === 'hands' || m === 'none')) || (key === 'scenes' && st.style === 'ugc');
        b.onclick = () => {
          if (MULTI.has(key)) { // อัตโนมัติ/ไม่ใส่ = เลือกได้อันเดียว · อย่างอื่นกดสลับเปิด/ปิด
            const solo = ['auto', 'none'];
            let a = solo.includes(val) ? [val] : st[key].filter((x) => !solo.includes(x));
            if (!solo.includes(val)) a = a.includes(val) ? a.filter((x) => x !== val) : [...a, val];
            st[key] = a.length ? a : ['auto'];
          } else st[key] = val;
          save(); renderAll();
          if (key === 'spSort' && spActive()) spSearch(false, spPick()); // เปลี่ยนการเรียง → ค้นใหม่
        };
        return b;
      }));
    });
    $('presenterHint').textContent = m === 'hands' ? 'เห็นแค่มือ = มือคนจริง + เสียงบรรยาย' : m === 'none' ? 'ไม่เห็นคน = ถ่ายสินค้าล้วน + เสียงบรรยาย' : '';
    $('peopleOpt').hidden = !(m === 'person' || m === 'auto');
    $('fxOpt').hidden = st.text === 'none';
    $('scenesHint').textContent = st.style === 'ugc' ? 'แนว UGC = 1 ซีนเทคเดียวเสมอ (กล้องนิ่ง ไม่ตัดภาพ)' : '1 ซีน = เทคเดียวต่อเนื่อง ไม่ตัดภาพ ไม่เปลี่ยนฉาก (กล้องขยับช้าๆ ได้)';
    $('sameOpt').hidden = st.scriptMode !== 'same';
    $('scriptHint').textContent = {
      meta: 'meta.ai คิดบทไทยเองตอนสร้างคลิป จากชื่อ + รายละเอียด + รูปสินค้า (ไม่ต้องใช้ key) · พิมพ์บทเองได้ (แท็บคิว → กดแถวสินค้า) ถ้ามีจะใช้บทนั้นแทน',
      ai: 'Gemini เขียนบทก่อนส่ง + ตรวจคำต้องห้าม + ได้แคปชันโพสต์ · ไม่มี key หรือเขียนไม่ได้ → ให้ meta.ai คิดบทเองแทน',
      same: 'ใช้บทเดียวกันทุกสินค้า',
    }[st.scriptMode] || '';
    $('cleanOn').checked = !!st.cleanOn;
    $('delOldChat').checked = st.delOldChat !== false;
    $('outroOpt').hidden = st.duration !== '15';
    $('outro').checked = !!st.outro;
    root.querySelector('.chips[data-key=cleanEvery]').style.opacity = st.cleanOn ? '' : '.4';
    // หัวข้อหมวดที่พับไว้: โชว์ค่าที่เลือกอยู่ (ไม่ต้องกางดู)
    const lab = (k) => (((OPTIONS[k] || []).find(([v]) => v === st[k]) || [])[1] || '').replace(/\s*\(.*\)\s*$/, '');
    const pr = presenters.find((x) => x.id === st.presenterId);
    $('sumClip').textContent = [lab('duration'), `จังหวะ${lab('pace')}`, `พูด${lab('talk')}`, `เพลง${lab('music')}`].filter(Boolean).join(' · ');
    $('sumPeople').textContent = [m === 'none' ? 'ไม่เห็นคน' : m === 'hands' ? 'เห็นแค่มือ' : m === 'animal' ? 'สัตว์' : pr ? `หน้า: ${pr.name}` : 'ไม่ใช้รูปหน้า', `เสียง${lab('tone')}`].join(' · ');
    $('sumScript').textContent = lab('scriptMode').replace(/^\S+\s/, '');
    $('sumText').textContent = st.text === 'none' ? 'ไม่มี' : [lab('text'), st.fx !== 'auto' ? lab('fx') : ''].filter(Boolean).join(' · ');
    $('sumPost').textContent = [photosOn() ? `📷 รูปคอมเมนต์ ${photoN()} ภาพ` : '📷 ไม่ทำรูป', st.post === 'off' ? 'ไม่ทำ .txt' : 'ทำ .txt', st.autoClear !== false ? 'ลงครบแล้วเอาออกเอง' : ''].filter(Boolean).join(' · ');
    $('sumRun').textContent = [lab('variants'), st.gap === '0' ? 'ไม่พัก' : `พัก ${lab('gap')}`, +st.newChat ? `แชตใหม่${lab('newChat')}` : ''].filter(Boolean).join(' · ');
  }

  // ---------- ประวัติสินค้าที่เคยทำ (อยู่ต่อแม้เคลียร์คิว) — ป้าย “เคยทำแล้ว” ในผลค้นหา/คิว ----------
  // history[ชื่อ] = { name, itemId, at (ทำเสร็จล่าสุด), fb: [เพจที่เคยโพสต์], tt: [บัญชี TikTok — ข้อมูลเก่า ไม่ได้ใช้แล้ว (TikTok ย้ายไป tiktok-helper)] }
  let history = {}, histById = new Map();
  const hKey = (s) => String(s || '').replace(/\s+/g, ' ').trim().toLowerCase().slice(0, 120);
  const indexHist = () => { histById = new Map(Object.values(history).filter((r) => r.itemId).map((r) => [String(r.itemId), r])); };
  const histOf = (it) => (it && ((it.itemId && histById.get(String(it.itemId))) || history[hKey(it.name)])) || null;
  function histMark(p, kind, where) {
    const k = hKey(p && p.name);
    if (!k) return;
    const r = history[k] || (history[k] = { name: p.name.trim().slice(0, 120), itemId: '', at: Date.now(), fb: [], tt: [] });
    if (p.itemId) r.itemId = String(p.itemId);
    if (kind === 'made') r.at = Date.now();
    if (kind === 'sv') r.sv = Date.now(); // เคยลง Shopee Video
    const list = kind === 'fb' ? r.fb : kind === 'tt' ? r.tt : null;
    if (list && where && !list.includes(where)) list.push(where);
    const keys = Object.keys(history);
    if (keys.length > 3000) keys.sort((a, b) => history[a].at - history[b].at).slice(0, keys.length - 3000).forEach((x) => delete history[x]); // เก็บล่าสุด 3000 ตัว
    indexHist();
    store.set({ mahHistory: history });
  }
  const histDate = (r) => { const d = new Date(r.at); return `${d.getDate()}/${d.getMonth() + 1}`; };
  // 📜 รายการประวัติ (แท็บ 🔎): วาดเฉพาะตอนกางอยู่ · ล่าสุดก่อน · โชว์ 200 แถวแรก
  let histArm = false, histTimer = 0;
  function saveHist() { indexHist(); store.set({ mahHistory: history }); } // ล้างหมด = เก็บ {} (ถ้าลบทิ้ง ตอนเปิดครั้งหน้าจะดึงตัวที่เสร็จในคิวกลับเข้าประวัติ)
  function renderHist() {
    const all = Object.entries(history);
    $('histSum').textContent = `📜 ประวัติที่เคยทำ (${all.length})`;
    $('histClear').hidden = !all.length;
    $('histClear').className = histArm ? 'btn danger' : 'btn';
    $('histClear').textContent = histArm ? `กดอีกครั้งเพื่อล้างประวัติทั้งหมด ${all.length} ตัว` : '🗑 ล้างประวัติทั้งหมด';
    if (!$('histBox').open) return;
    const q = hKey($('histFind').value);
    const list = all.filter(([k]) => !q || k.includes(q)).sort((a, b) => b[1].at - a[1].at);
    $('histList').replaceChildren(...list.slice(0, 200).map(([k, r]) => {
      const row = el('div', 'hrow'), x = el('button', 'icon', '✕');
      const nm = el('span', 'nm', r.name);
      nm.title = r.name;
      x.title = 'ลบตัวนี้ออกจากประวัติ (ป้าย “เคยทำ” ในผลค้นหาจะหาย)';
      x.onclick = () => { delete history[k]; saveHist(); renderHist(); renderSearch(); };
      row.append(nm, el('span', 'when', `ทำ ${histDate(r)}${r.fb.length ? ` · 📘 ${r.fb.join(', ')}` : ''}`), x);
      return row;
    }), ...(list.length > 200 ? [el('div', 'empty', `แสดง 200 จาก ${list.length} ตัว — พิมพ์ชื่อเพื่อหา`)] : !list.length ? [el('div', 'empty', all.length ? 'ไม่เจอชื่อนี้ในประวัติ' : 'ยังไม่มีประวัติ')] : []));
  }
  function histBadge(r) { // ป้ายสั้น + รายละเอียดตอนชี้
    const b = el('span', 'hist', `✓ เคยทำ ${histDate(r)}${r.fb.length ? ' · 📘' : ''}${r.sv ? ' · 🛍' : ''}`);
    b.title = `เคยทำคลิปแล้ว (ล่าสุด ${histDate(r)})${r.fb.length ? ` · เคยโพสต์เพจ: ${r.fb.join(', ')}` : ' · ยังไม่เคยโพสต์เพจ'}${r.sv ? ' · เคยลง Shopee Video' : ''}`;
    return b;
  }

  // ---------- ค้นหาสินค้าจาก Shopee — ไม่ต้องเปิดหน้า Shopee เอง ----------
  // ไม่ได้ใส่ AppID/Secret = ค้นผ่านหน้าเว็บ Affiliate ที่ล็อกอินไว้ (แท็บเบื้องหลัง) · ใส่แล้ว = Open API (เร็วกว่า เรียงได้ ได้ลิงก์ทันที)
  let spCreds = { appId: '', secret: '' };
  // all = ทุกรายการที่โหลดมา (กันซ้ำด้วย seen) · ที่แสดง = กรอง Extra Comm ตอนวาด → ติ๊ก/เอาติ๊กออกไม่ต้องค้นใหม่ (หน้าเว็บ)
  // home = สินค้าแนะนำ (ไม่มีคำค้น) · cat = หมวดที่กดอยู่ (ค้นด้วยคำในหมวด)
  // shop = ร้านที่ดึงทั้งร้านอยู่ { id, name } · shops = ร้านที่เจอจากชื่อ (ให้กดเลือก)
  const sp = { kw: '', home: false, cat: null, shop: null, shops: [], page: 0, all: [], seen: new Set(), more: false, busy: false, err: '', api: false, autoTried: false };
  // "1.2พัน" "3หมื่น" "10k" "1,234" → ตัวเลข (ไม่มียอดขาย = ไว้ท้าย)
  const soldNum = (v) => { const m = String(v || '').replace(/,/g, '').match(/(\d+(?:\.\d+)?)\s*(พัน|หมื่น|แสน|ล้าน|k|m)?/i); return m ? parseFloat(m[1]) * ({ พัน: 1e3, หมื่น: 1e4, แสน: 1e5, ล้าน: 1e6, k: 1e3, m: 1e6 }[(m[2] || '').toLowerCase()] || 1) : -1; };
  const SOLD_MIN = 100; // ตัวกรอง “ขายได้มากกว่า 100 ชิ้น” (ผู้ใช้สั่ง)
  const soldOk = (v) => { const n = soldNum(v); return n > SOLD_MIN || (n === SOLD_MIN && /\+/.test(String(v))); }; // “100+” = เกิน 100 แล้ว
  // sold = false → ไม่ดูยอดขาย (นับว่าซ่อนเพราะยอดขายกี่ตัว)
  const spPass = (x, sold = true) => (!st.spXtra || sp.shop || x.isExtra) && !(st.spHideMade && histOf(x)) && (!sold || !st.spSold || soldOk(x.sold)); // ทั้งร้าน = ไม่กรอง Extra (เอาทุกตัวของร้าน)
  const spShown = () => { // ตัวกรอง Extra Comm + ซ่อนตัวที่เคยทำแล้ว + ขายได้มากกว่า 100 ชิ้น · 📈 ขายดี = เรียงยอดขายมากไปน้อย
    const list = sp.all.filter((x) => spPass(x));
    return st.spSort === '2' ? list.sort((a, b) => soldNum(b.sold) - soldNum(a.sold)) : list;
  };
  const spActive = () => sp.home || !!sp.kw || !!sp.shop; // ค้น/เปิดหมวด/ดึงร้านไปแล้ว
  const spPick = () => (sp.shop ? { shop: sp.shop } : sp.home ? { home: true } : { kw: sp.kw, cat: sp.cat }); // ค้นชุดเดิมใหม่ (เปลี่ยนการเรียง/ตัวกรอง)
  // ข้อความในช่องค้นหา → ร้าน: ลิงก์ร้าน /shop/<id> · ลิงก์สินค้า (-i.<ร้าน>.<สินค้า> หรือ /product/<ร้าน>/<สินค้า>) · ลิงก์สั้น · ลิงก์ชื่อร้าน · ไม่ใช่ลิงก์ = ชื่อร้าน
  const SHOP_PATHS = /^(search|product|shop|cart|user|mall|daily_discover|flash_sale|buyer|checkout|verify|m|universal-link|api)$/i;
  const shopFrom = (t) => {
    const s = String(t || '').trim();
    let m;
    if ((m = s.match(/shopee\.co\.th\/shop\/(\d+)/i))) return { id: m[1] };
    if ((m = s.match(/-i\.(\d+)\.\d+/)) || (m = s.match(/shopee\.co\.th\/[^/?#\s]+\/(\d+)\/\d+/i))) return { id: m[1] };
    if ((m = s.match(/https?:\/\/(?:s\.shopee\.co\.th|shp\.ee)\/\S+/i))) return { short: m[0] }; // ลิงก์สั้น (เว็บ / แอป Shopee)
    if ((m = s.match(/shopee\.co\.th\/([\w.-]{2,40})\/?(?:[?#\s]|$)/i)) && !SHOP_PATHS.test(m[1])) return { username: m[1] };
    return /^https?:|shopee\.|shp\.ee/i.test(s) ? {} : { name: s };
  };
  // หมวดสินค้า → คำค้นยอดนิยมในหมวด (กดหมวด = ค้นคำแรกให้เลย · กดคำอื่นในหมวดได้)
  const SP_CATS = [
    ['👗 แฟชั่นหญิง', ['เสื้อผู้หญิง', 'เดรส', 'กระโปรง', 'กางเกงผู้หญิง', 'ชุดนอน', 'เสื้อครอป', 'ชุดเซ็ท', 'กางเกงยีนส์ผู้หญิง', 'เสื้อคลุม', 'เสื้อสายเดี่ยว']],
    ['👕 แฟชั่นชาย', ['เสื้อยืดผู้ชาย', 'เสื้อเชิ้ตผู้ชาย', 'กางเกงผู้ชาย', 'กางเกงยีนส์ผู้ชาย', 'เสื้อโปโล', 'กางเกงขาสั้นผู้ชาย', 'เสื้อแจ็คเก็ต', 'เสื้อฮู้ด']],
    ['👜 กระเป๋า/รองเท้า', ['กระเป๋าสะพาย', 'กระเป๋าเป้', 'รองเท้าผ้าใบ', 'รองเท้าแตะ', 'กระเป๋าสตางค์', 'กระเป๋าถือ', 'รองเท้าวิ่ง', 'รองเท้าส้นสูง', 'กระเป๋าคาดอก']],
    ['💄 ความงาม', ['เซรั่ม', 'ครีมกันแดด', 'ลิปสติก', 'คุชชั่น', 'โฟมล้างหน้า', 'มาส์กหน้า', 'ครีมบำรุงผิว', 'อายแชโดว์', 'น้ำหอม', 'แชมพู', 'โลชั่นทาผิว']],
    ['💊 สุขภาพ', ['วิตามินซี', 'คอลลาเจน', 'เวย์โปรตีน', 'ไฟเบอร์', 'น้ำมันปลา', 'เครื่องวัดความดัน', 'หน้ากากอนามัย']],
    ['🏠 ของใช้ในบ้าน', ['กล่องเก็บของ', 'ชั้นวางของ', 'ผ้าปูที่นอน', 'ไม้ถูพื้น', 'ไม้แขวนเสื้อ', 'ตะกร้าผ้า', 'ผ้าม่าน', 'พรมเช็ดเท้า', 'โคมไฟ', 'หมอน']],
    ['🍳 ครัว', ['กระทะ', 'หม้อทอดไร้น้ำมัน', 'เครื่องปั่น', 'กล่องข้าว', 'หม้อหุงข้าว', 'กระติกน้ำ', 'มีดทำครัว', 'เขียง', 'แก้วเก็บความเย็น', 'กล่องถนอมอาหาร']],
    ['🔌 เครื่องใช้ไฟฟ้า', ['พัดลม', 'เครื่องดูดฝุ่น', 'ไดร์เป่าผม', 'เตารีดไอน้ำ', 'เครื่องฟอกอากาศ', 'กาต้มน้ำไฟฟ้า', 'หม้อสุกี้ไฟฟ้า', 'เครื่องหนีบผม', 'พัดลมพกพา']],
    ['🎧 มือถือ/แกดเจ็ต', ['หูฟังบลูทูธ', 'เคสมือถือ', 'พาวเวอร์แบงค์', 'สายชาร์จ', 'ฟิล์มกระจก', 'ลำโพงบลูทูธ', 'สมาร์ทวอทช์', 'ขาตั้งมือถือ', 'ไฟริงไลท์', 'หัวชาร์จ']],
    ['🧸 แม่และเด็ก', ['ของเล่นเด็ก', 'ผ้าอ้อม', 'เสื้อผ้าเด็ก', 'ขวดนม', 'ทิชชู่เปียก', 'รถเข็นเด็ก']],
    ['🐱 สัตว์เลี้ยง', ['อาหารแมว', 'ทรายแมว', 'ของเล่นแมว', 'อาหารสุนัข', 'ขนมแมว', 'ที่นอนสัตว์เลี้ยง', 'คอนโดแมว', 'ที่ลับเล็บแมว']],
    ['🍪 อาหาร/ขนม', ['ขนม', 'กาแฟ', 'เครื่องปรุง', 'ขนมขบเคี้ยว', 'บะหมี่กึ่งสำเร็จรูป', 'น้ำพริก', 'ผลไม้อบแห้ง', 'ชาไทย']],
    ['🏃 กีฬา', ['ชุดออกกำลังกาย', 'ดัมเบล', 'เสื่อโยคะ', 'ยางยืดออกกำลังกาย', 'ขวดน้ำกีฬา', 'เชือกกระโดด', 'ถุงเท้ากีฬา']],
    ['🚗 รถยนต์', ['ที่วางมือถือในรถ', 'น้ำหอมรถยนต์', 'กล้องติดรถยนต์', 'ที่ชาร์จในรถ', 'อุปกรณ์ล้างรถ', 'ผ้าคลุมรถ']],
    // หมวดใหม่ (ต่อท้าย — ลำดับหมวดเดิมไม่เปลี่ยน)
    ['🧹 ทำความสะอาด', ['น้ำยาล้างจาน', 'ผงซักฟอก', 'น้ำยาทำความสะอาด', 'ฟองน้ำล้างจาน', 'ถุงขยะ', 'ทิชชู่', 'น้ำยาปรับผ้านุ่ม']],
    ['🛁 ห้องน้ำ', ['ชั้นวางของในห้องน้ำ', 'ฝักบัว', 'ผ้าเช็ดตัว', 'พรมกันลื่น', 'ที่ใส่สบู่', 'แปรงขัดห้องน้ำ']],
    ['💻 คอมพิวเตอร์', ['เมาส์ไร้สาย', 'คีย์บอร์ด', 'แฟลชไดร์ฟ', 'ที่วางโน้ตบุ๊ค', 'หูฟังเกมมิ่ง', 'เว็บแคม']],
    ['⌚ เครื่องประดับ', ['นาฬิกาข้อมือ', 'ต่างหู', 'สร้อยคอ', 'แหวน', 'กิ๊บติดผม', 'แว่นกันแดด']],
    ['🌿 สวน/ต้นไม้', ['กระถางต้นไม้', 'ต้นไม้ปลอม', 'บัวรดน้ำ', 'ดินปลูก', 'ไฟโซล่าเซลล์']],
    ['✏️ เครื่องเขียน', ['ปากกา', 'สมุดโน้ต', 'กล่องดินสอ', 'สติกเกอร์', 'ปากกาไฮไลท์']],
    ['🎮 เกม/ของสะสม', ['จอยเกม', 'โมเดลฟิกเกอร์', 'กล่องสุ่ม', 'ตุ๊กตา', 'ตัวต่อ']],
    ['🏕️ เที่ยว/แคมป์', ['กระเป๋าเดินทาง', 'เต็นท์', 'เก้าอี้พับ', 'ไฟฉาย', 'หมอนรองคอ']],
    ['🔧 เครื่องมือช่าง', ['สว่านไร้สาย', 'ชุดไขควง', 'ปลั๊กพ่วง', 'หลอดไฟ LED', 'เทปกาว']],
  ];
  function renderCats() {
    const hot = el('button', sp.home ? 'on' : '', '🔥 แนะนำ');
    hot.title = 'สินค้าแนะนำของ Shopee Affiliate (ไม่ต้องพิมพ์ค้นหา)';
    hot.onclick = () => spSearch(false, { home: true });
    const best = el('button', st.spSort === '2' ? 'on' : '', '📈 ขายดี');
    best.title = st.spSort === '2' ? 'เรียงขายดีอยู่ — กดอีกครั้ง = เลิกเรียง' : 'เรียงสินค้าขายดีก่อน (ใช้กับแนะนำ / หมวด / คำค้น) · ยังไม่ได้ค้น = โชว์สินค้าขายดีเลย';
    best.onclick = () => {
      st.spSort = st.spSort === '2' ? '1' : '2';
      save(); renderChips(); renderCats();
      if (spActive()) spSearch(false, spPick()); else if (st.spSort === '2') spSearch(false, { home: true });
    };
    $('spCats').replaceChildren(hot, best, ...SP_CATS.map(([label, kws], i) => {
      const b = el('button', sp.cat === i ? 'on' : '', label);
      b.title = kws.join(' · ');
      b.onclick = () => spSearch(false, { kw: kws[0], cat: i });
      return b;
    }));
    const cat = SP_CATS[sp.cat];
    $('spSubs').hidden = !cat;
    if (cat) $('spSubs').replaceChildren(...cat[1].map((kw) => {
      const b = el('button', sp.kw === kw ? 'on' : '', kw);
      b.onclick = () => spSearch(false, { kw, cat: sp.cat });
      return b;
    }));
    root.querySelectorAll('#spCats button, #spSubs button').forEach((b) => { b.disabled = sp.busy; });
    for (const box of [$('spCats'), $('spSubs')]) { const on = box.querySelector('button.on'); if (on && !box.hidden) box.scrollLeft = Math.max(0, on.offsetLeft - box.offsetLeft - 40); } // หมวดที่เลือกอยู่ให้เห็น
  }
  const spThumbs = new Map(); // imageUrl → รูปย่อ (dataUrl)
  const pct = (s) => { const n = parseFloat(s); return n > 0 ? `${+(n > 1 ? n : n * 100).toFixed(1)}%` : ''; }; // API ส่ง 0.1 = 10%
  const baht = (s) => { const n = parseFloat(s); return n > 0 ? `฿${n.toLocaleString('th-TH', { maximumFractionDigits: 2 })}` : ''; };
  const bgRaw = (m) => new Promise((res) => {
    try { chrome.runtime.sendMessage(m, (r) => res(chrome.runtime.lastError ? { ok: false, error: chrome.runtime.lastError.message } : r || { ok: false, error: 'ไม่มีคำตอบ' })); }
    catch (e) { if (ctxGone()) ctxGoneNotice(); res({ ok: false, error: String(e.message || e) }); }
  });
  // ข้อความถึงส่วนเสริมใหญ่ได้ไม่เกิน 64 MiB → คลิปใหญ่ (data URL) ส่งเป็นท่อนละ 16 MB ทั้งไปและกลับ
  const BIG_PART = 16 * 1024 * 1024, BIG_AT = 40 * 1024 * 1024;
  async function bigPut(s) {
    const id = `i${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`, n = Math.ceil(s.length / BIG_PART);
    for (let i = 0; i < n; i++) {
      const r = await bgRaw({ type: 'bigPut', id, i, n, s: s.slice(i * BIG_PART, (i + 1) * BIG_PART) });
      if (!r.ok) throw new Error(r.error || 'ส่งไฟล์ให้ส่วนเสริมไม่ได้');
    }
    return `big:${id}`;
  }
  async function bigGet(r) {
    if (!r || !r.bigId) return r;
    const parts = [];
    for (let i = 0; i < r.n; i++) { const x = await bgRaw({ type: 'bigGet', id: r.bigId, i }); if (!x.ok) return { ok: false, error: x.error }; parts.push(x.s); }
    const { bigId, n, ...rest } = r;
    return { ...rest, dataUrl: parts.join('') };
  }
  const bg = async (m) => {
    try {
      if (m && typeof m.url === 'string' && m.url.length > BIG_AT) m = { ...m, url: await bigPut(m.url) };
      if (m && m.video && typeof m.video.dataUrl === 'string' && m.video.dataUrl.length > BIG_AT) m = { ...m, video: { ...m.video, dataUrl: await bigPut(m.video.dataUrl) } };
    } catch (e) { return { ok: false, error: String(e.message || e) }; }
    return bigGet(await bgRaw(m));
  };
  const useApi = () => !!(spCreds.appId && spCreds.secret);
  // ผลจาก 2 ทาง → รูปแบบเดียวกัน
  const fromApi = (n) => ({ key: `i${n.itemId}`, itemId: String(n.itemId || ''), name: (n.productName || '').trim(), image: n.imageUrl || '', price: baht(n.priceMin),
    sold: +n.sales ? Number(n.sales).toLocaleString('th-TH') : '', com: pct(n.commissionRate), extra: pct(n.sellerCommissionRate),
    isExtra: parseFloat(n.sellerCommissionRate) > 0, link: n.offerLink || '', productUrl: n.productLink || '', shopId: String(n.shopId || ''), shopName: n.shopName || '' });
  const fromWeb = (x) => ({ key: x.itemId ? `i${x.itemId}` : `n${x.name}`, itemId: x.itemId || '', shopId: x.shopId || '', shopName: x.shopName || '', name: x.name, image: x.image, price: x.price, sold: x.sold, com: x.commission,
    extra: x.extra, isExtra: x.isExtra, link: '', productUrl: x.productUrl, web: true, tags: x.tags || [] });
  const inQueue = (it) => products.some((p) => (it.itemId && p.itemId === it.itemId) || p.name.trim() === it.name);

  // pick: { home: true } = สินค้าแนะนำ · { kw, cat } = จากชิปหมวด · ไม่ส่ง = คำที่พิมพ์ในช่องค้นหา
  async function spSearch(more, pick) {
    const home = !!(pick && pick.home);
    const shop = (pick && pick.shop) || null;
    const kw = home || shop ? '' : pick ? pick.kw : $('spKw').value.trim();
    if (!more && !kw && !home && !shop) { msg('พิมพ์คำค้นก่อน — หรือกดหมวดด้านล่าง', 'err'); return; }
    if (sp.busy) { msg('กำลังค้นอยู่ — รอให้เสร็จก่อนแล้วค่อยกดใหม่', ''); return; }
    const api = more ? sp.api : useApi(); // โหลดเพิ่มใช้ทางเดิมของรอบค้นนี้
    if (!more) {
      Object.assign(sp, { kw, home, shop, cat: pick && pick.cat != null ? pick.cat : null, page: 0, all: [], seen: new Set(), more: false, api, sort: st.spSort === '2' ? 'sales' : '' });
      if (!shop) { $('spKw').value = kw; sp.shops = []; } // ดึงร้าน = เก็บลิงก์/ชื่อร้านในช่องไว้
    }
    // ดูหมวด/แนะนำ (ไม่ได้พิมพ์ค้นเอง) + เรียง "เกี่ยวข้อง" → เรียงขายดีแทน
    const sortType = (sp.home || sp.shop || sp.cat != null) && st.spSort === '1' ? '2' : st.spSort;
    sp.busy = true; sp.err = '';
    let sortMiss = false;
    try { // วาดหน้าพังกลางทาง = ไม่ให้ค้าง “กำลังค้น” ถาวร
    // เฉพาะ Extra Comm: หน้าเว็บกรองหลังโหลด → ได้น้อยก็โหลดหน้าถัดไปให้เองจนได้เพิ่ม ≥ 20 รายการ (สูงสุด 5 หน้าต่อครั้ง)
    const want = spShown().length + 20;
    for (let n = 0; n < 5; n++) {
      const next = !!more || n > 0;
      sp.page++;
      renderSearch();
      if (!api) msg(n ? `หาสินค้า Extra Comm เพิ่ม... (หน้า ${sp.page})` : `${sp.home ? 'โหลดสินค้าแนะนำ' : 'ค้น'}ผ่านหน้า Shopee Affiliate (แท็บเบื้องหลัง) — ครั้งแรกรอสักครู่...`, '');
      if (sp.shop && !api) msg(`🏪 เปิดหน้าร้านในแท็บเบื้องหลัง (หน้า ${sp.page}) — รอสักครู่...`, '');
      const r = sp.shop && !api ? await bg({ type: 'shopWeb', shopId: sp.shop.id, page: sp.page - 1, sort: { 2: 'sales', 4: 'price' }[st.spSort] || 'sales' }) // ไม่มี Open API = อ่านจากหน้าร้าน
        : api ? await bg({ type: 'shopeeSearch', ...spCreds, keyword: sp.kw, sortType, page: sp.page, limit: 20, xtra: st.spXtra && !sp.shop, shopId: sp.shop ? sp.shop.id : '' })
        : await bg({ type: 'affSearch', keyword: sp.kw, more: next, home: sp.home && !next, page: sp.page, quiet: !!(pick && pick.quiet), sort: sp.sort || '' });
      if (!r.ok) { sp.err = r.error; sp.page--; break; }
      if (!api && r.sorted === false) sortMiss = true;
      // กันซ้ำกับทุกรายการที่เคยเห็น (หน้าเว็บแบบเลื่อนโหลดส่งรายการเดิมกลับมาด้วย)
      const fresh = (api ? r.nodes.map(fromApi) : r.items.map((x) => fromWeb(sp.shop ? { ...x, shopId: sp.shop.id, shopName: sp.shop.name || r.shopName || '' } : x))).filter((x) => x.name && !sp.seen.has(x.key));
      fresh.forEach((x) => { sp.seen.add(x.key); x.page = sp.page; }); // จำหน้าที่โหลดมา (เอาลิงก์: กลับไปหน้านั้น)
      sp.all.push(...fresh);
      if (sp.shop && !sp.shop.name) sp.shop.name = (r.nodes && r.nodes[0] && r.nodes[0].shopName) || r.shopName || ''; // ชื่อร้านจากสินค้าตัวแรก / หน้าร้าน
      if (!api) msg(`หน้า ${sp.page}: ได้สินค้าใหม่ ${fresh.length} ตัว${st.spXtra ? ` (เป็น Extra Comm ${fresh.filter((x) => x.isExtra).length})` : ''}${st.spSold ? ` · ขายได้มากกว่า ${SOLD_MIN} ชิ้น ${fresh.filter((x) => soldOk(x.sold)).length} ตัว` : ''}${r.why ? ` · ไปหน้าถัดไปไม่ได้: ${r.why}` : ''}`, r.why ? 'err' : '');
      sp.more = api ? r.hasNextPage : !!r.more && (!next || fresh.length > 0); // หน้าเว็บ: โหลดเพิ่มแล้วไม่มีของใหม่ = หมด
      if (!(st.spXtra || st.spSold) || sp.shop || !sp.more || spShown().length >= want) break;
    }
    } finally { sp.busy = false; }
    if (!api && sortMiss) msg('หน้า Affiliate หาปุ่มเรียงขายดีไม่เจอ — เรียงตามยอดขายจากสินค้าที่โหลดมาให้แทน', ''); // ไม่ล้างข้อความ “หน้า N: ได้ … ตัว”
    renderSearch();
  }

  // 🏪 ร้านนี้: ร้านของสินค้าอ้างอิง (ผลค้นหา / คิว / หน้าสินค้า Shopee) → สินค้าทั้งร้านในแท็บ 🔎
  const shopOf = (x) => String((x && x.shopId) || shopFrom((x && x.productUrl) || '').id || '');
  const canShop = (x) => !!(shopOf(x) || (x && (x.link || x.web))); // หาร้านได้: รู้รหัสร้าน / มีลิงก์ affiliate / ผลค้นหาหน้าเว็บ (เอาลิงก์ก่อน)
  async function shopIdOf(x) { // ไม่รู้ร้าน → ลิงก์ affiliate → ตามไปหน้าสินค้า → รหัสร้าน (จำไว้ใน x.shopId)
    let link = x.link || '';
    if (!link && x.web && x.name) {
      msg('🏪 กำลังหาร้าน: เอาลิงก์สินค้าจากหน้า Affiliate...', '');
      const L = await bg(linkReq(x));
      if (!(L.ok && L.link)) throw new Error(L.error || 'เอาลิงก์ไม่ได้');
      link = x.link = L.link;
    }
    if (!link) return '';
    msg('🏪 กำลังหาร้าน: เปิดลิงก์สินค้า...', '');
    const r = await bg({ type: 'shopLink', url: link });
    if (!r.ok) throw new Error(r.error || 'เปิดลิงก์ไม่ได้');
    const id = String(r.shopId || shopFrom(r.url).id || '');
    if (id) { x.shopId = id; if (products.includes(x)) save(); }
    return id;
  }
  async function pullShopOf(x) {
    if (sp.busy || bulk.on) { msg('กำลังค้น/ลงคิวอยู่ — รอให้เสร็จก่อนแล้วค่อยกด 🏪', ''); return; }
    let id = shopOf(x), why = '';
    if (!id) {
      sp.busy = true; renderSearch();
      try { id = await shopIdOf(x); } catch (e) { why = e.message || String(e); } finally { sp.busy = false; renderSearch(); }
    }
    if (!id) { msg(`หาร้านของสินค้านี้ไม่ได้${why ? ` (${why})` : ''} — วางลิงก์ร้านหรือลิงก์หน้าสินค้าในแท็บ 🔎 แล้วกด 🏪 ทั้งร้านแทน`, 'err'); return; }
    $('spKw').value = `https://shopee.co.th/shop/${id}`;
    sp.shops = [];
    spSearch(false, { shop: { id, name: (x && x.shopName) || '' } }); // ตั้งร้านก่อนสลับแท็บ (แท็บ 🔎 จะได้ไม่โหลด 🔥 แนะนำเองทับ)
    root.querySelector('.tabs [data-tab=search]').click();
    $('spList').scrollIntoView({ block: 'nearest' });
  }
  // 🏪 ทั้งร้าน: ช่องค้นหา → รหัสร้าน → สินค้าทั้งร้าน (ชื่อร้านเจอหลายร้าน = ขึ้นปุ่มให้เลือก)
  async function shopPull() {
    const text = $('spKw').value.trim();
    if (!text) { msg('วางลิงก์ร้าน / ลิงก์สินค้าของร้านนั้น หรือพิมพ์ชื่อร้านในช่องค้นหา แล้วกด 🏪 ทั้งร้าน', 'err'); return; }
    if (sp.busy) { msg('กำลังค้นอยู่ — รอให้เสร็จก่อนแล้วค่อยกดใหม่', ''); return; }
    sp.busy = true; sp.shops = []; renderSearch(); // ปุ่มร้านจากการหาครั้งก่อนไม่ค้าง
    let s = shopFrom(text), why = '';
    try {
      if (s.short) { msg('กำลังเปิดลิงก์สั้นหาร้าน...', ''); const r = await bg({ type: 'shopLink', url: s.short }); s = r.ok ? (r.shopId ? { id: r.shopId } : shopFrom(r.url)) : {}; if (!r.ok) why = r.error; }
      if (s.username) {
        const u = s.username;
        let r = await bg({ type: 'shopLink', username: u });
        if (!(r.ok && r.shopId)) { msg(`🏪 เปิดหน้าร้าน “${u}” หาเลขร้าน...`, ''); const w = await bg({ type: 'shopWeb', username: u }); if (w.ok && w.shopId) r = { ok: true, shopId: w.shopId, name: w.shopName }; else if (!useApi()) why = `เปิด shopee.co.th/${u} แล้ว${w.error ? `: ${w.error}` : 'ไม่เจอร้าน'}`; } // ไม่มี API / API หน้าร้านไม่ตอบ
        s = r.ok && r.shopId ? { id: r.shopId, name: r.name } : why ? {} : { name: u }; // หาไม่ได้ = ลองหาจากชื่อ (ต้องมี Open API)
      }
      if (!s.id && s.name && !useApi()) why = 'หาร้านจากชื่อต้องใช้ Shopee Open API — วางลิงก์ร้าน/ลิงก์สินค้าของร้าน หรือกด 🏪 ที่สินค้าแทน';
      else if (!s.id && s.name) {
        msg(`กำลังหาร้าน “${s.name}”...`, '');
        const r = await bg({ type: 'shopeeShops', ...spCreds, keyword: s.name });
        if (!r.ok) why = r.error;
        else if (r.shops.length === 1) s = r.shops[0];
        else if (r.shops.length) { sp.shops = r.shops; s = {}; why = 'pick'; }
      }
    } finally { sp.busy = false; }
    if (s.id) { msg(`🏪 ดึงสินค้าทั้งร้าน${s.name ? ` “${s.name}”` : ''}...`, ''); spSearch(false, { shop: { id: String(s.id), name: s.name || '' } }); return; }
    renderSearch();
    msg(why === 'pick' ? `เจอ ${sp.shops.length} ร้าน — กดเลือกร้านด้านล่าง` : `หาร้านไม่เจอ${why ? ` (${why})` : ''} — ลองวางลิงก์ร้าน (shopee.co.th/shop/…) หรือลิงก์สินค้าของร้านนั้นแทน`, why === 'pick' ? '' : 'err');
  }

  function spRow(it) {
    const c = el('div', 'card sp');
    const img = el('img'); img.alt = ''; img.dataset.u = it.image;
    if (spThumbs.get(it.image)) img.src = spThumbs.get(it.image);
    else if (it.image && !spThumbs.has(it.image)) { // โหลดรูปย่อผ่านเบื้องหลัง (หน้า meta.ai โหลดรูปข้ามเว็บตรงๆ ไม่ได้)
      spThumbs.set(it.image, '');
      bg({ type: 'fetchImage', url: it.image, max: 160 }).then((r) => {
        if (!r.ok) return;
        spThumbs.set(it.image, r.dataUrl);
        root.querySelectorAll('#spList img').forEach((x) => { if (x.dataset.u === it.image) x.src = r.dataUrl; });
      });
    }
    const info = el('div');
    const m = el('div', 'meta');
    if (it.price) m.append(el('span', '', it.price));
    if (it.sold) m.append(el('span', '', `ขายแล้ว ${it.sold}`));
    if (it.com) m.append(el('span', 'com', `คอม ${it.com}`));
    if (it.isExtra) m.append(el('span', 'xtra', `Extra${it.extra ? ` ${it.extra}` : ''}`));
    if (HAZARD_RE.test(it.name)) m.append(hazardBadge());
    const h = histOf(it);
    if (h) m.append(histBadge(h));
    info.append(el('div', 'nm', it.name || '-'), m);
    const q = inQueue(it);
    const b = el('button', q ? 'btn' : 'btn dark', q ? '✓ ในคิว' : it.adding ? 'กำลังเพิ่ม...' : '+ คิว'); // อยู่ในคิวแล้ว = ✓ แม้ยังเอาลิงก์อยู่ (เดิมค้างคำว่า กำลังเพิ่ม)
    b.disabled = q || !!it.adding;
    b.onclick = () => addFromSearch(it, b);
    const btns = el('div', 'spbtns');
    btns.append(b);
    if (canShop(it) && !(sp.shop && sp.shop.id === shopOf(it))) { // ดูร้านนี้อยู่แล้ว = ไม่ต้องมีปุ่ม
      const sb = el('button', 'btn', '🏪 ร้านนี้');
      sb.title = `ดึงสินค้าทั้งร้าน${it.shopName ? ` “${it.shopName}”` : ''} ของสินค้านี้`;
      sb.disabled = sp.busy;
      sb.onclick = () => pullShopOf(it);
      btns.append(sb);
    }
    c.append(img, info, btns);
    return c;
  }

  function renderSearch() {
    $('spState').textContent = useApi() ? '✓ ใช้ Open API' : 'ไม่ได้ใส่ — ค้นผ่านหน้าเว็บ Affiliate';
    root.querySelector('.chips[data-key=spSort]').parentElement.hidden = !useApi(); // เรียงลำดับได้เฉพาะ Open API
    $('spXtra').checked = !!st.spXtra;
    $('spHideMade').checked = !!st.spHideMade;
    $('spSold').checked = !!st.spSold;
    $('spGo').disabled = sp.busy;
    $('spGo').textContent = sp.busy && sp.page === 1 ? 'กำลังค้น...' : 'ค้นหา';
    $('spShop').disabled = sp.busy;
    renderCats();
    $('spShops').hidden = !sp.shops.length;
    $('spShops').replaceChildren(...sp.shops.map((s) => {
      const b = el('button', sp.shop && sp.shop.id === s.id ? 'on' : '', `🏪 ${s.name || s.id}`);
      b.title = `รหัสร้าน ${s.id}${s.com ? ` · คอมร้าน ${pct(s.com)}` : ''}`;
      b.disabled = sp.busy;
      b.onclick = () => spSearch(false, { shop: { id: s.id, name: s.name } });
      return b;
    }));
    const shown = spShown();
    // ＋ ลงคิวทั้งหมด (ตัวที่แสดงอยู่และยังไม่อยู่ในคิว) · ระหว่างเพิ่ม = ปุ่มหยุด
    const addable = shown.filter((it) => !inQueue(it)).length;
    $('spAll').hidden = !bulk.on && !addable;
    $('spAll').className = bulk.on ? 'btn danger' : 'btn dark';
    $('spAll').textContent = bulk.on ? (bulk.stop ? 'กำลังหยุด...' : bulk.ltotal ? `⏹ หยุด · ลงคิวแล้ว ${bulk.done}/${bulk.total} · เอาลิงก์ ${bulk.ldone}/${bulk.ltotal}` : `⏹ หยุด · ลงคิวแล้ว ${bulk.done}/${bulk.total}`) : `＋ ลงคิวทั้งหมด (${addable} ตัว${st.spXtra ? ' · Extra Comm' : ''}${st.spSold ? ` · ขาย ${SOLD_MIN}+` : ''})`;
    $('spAll').title = 'เพิ่มทุกตัวที่แสดงอยู่ที่ยังไม่อยู่ในคิว ทีละตัว พร้อมเอาลิงก์ affiliate ให้ (กดอีกครั้งเพื่อหยุด)';
    const rows = shown.map(spRow);
    if (sp.shop && !sp.err) rows.unshift(el('div', 'hint', `🏪 สินค้าทั้งร้าน${sp.shop.name ? ` “${sp.shop.name}”` : ''} (รหัสร้าน ${sp.shop.id}) · โหลดแล้ว ${sp.all.length} ตัว${sp.more ? ' — กด โหลดเพิ่ม ด้านล่างเพื่อดูต่อ' : ' (ครบทั้งร้านแล้ว)'} · ไม่กรอง Extra Comm`));
    const why = /10035|not have access/i.test(sp.err) ? 'บัญชีนี้ยังไม่มีสิทธิ์ใช้ Open API — ขอสิทธิ์ที่ affiliate.shopee.co.th → Open API (ระหว่างนี้ใช้ปุ่ม “＋ คิวคลิป” บนหน้า Affiliate ได้)'
      : /sign|credential|auth|appid|1002\d/i.test(sp.err) ? 'เช็ก AppID / Secret' : '';
    if (sp.err) rows.push(el('div', 'warn', `ค้นหาไม่ได้: ${why || sp.err}${why ? ` (${sp.err.split(':')[0]})` : ''}`));
    else if (!spActive()) rows.push(el('div', 'empty', useApi() ? 'กด 🔥 แนะนำ / หมวดสินค้า หรือพิมพ์คำค้นแล้วกด ค้นหา → กด “+ คิว” ส่งเข้าคิวทำคลิป (ได้ชื่อ รูป ค่าคอม ลิงก์ affiliate)'
      : 'กด 🔥 แนะนำ / หมวดสินค้า หรือพิมพ์คำค้นแล้วกด ค้นหา — ค้นผ่านหน้า Shopee Affiliate ที่ล็อกอินไว้ในเบราว์เซอร์นี้ (เปิดแท็บเบื้องหลังให้เอง ไม่ต้องใช้ API) → กด “+ คิว” ได้ชื่อ รูป ค่าคอม และลิงก์ affiliate'));
    else if (sp.busy && !shown.length) rows.push(el('div', 'empty', sp.shop ? 'กำลังโหลดสินค้าของร้าน...' : sp.home ? 'กำลังโหลดสินค้าแนะนำ...' : sp.kw ? `กำลังค้น “${sp.kw}”...` : 'กำลังหาร้าน...'));
    else if (!sp.busy && !shown.length) {
      // หน้าเว็บ: บอกป้ายที่เห็นบนการ์ด เผื่อหน้า Affiliate เปลี่ยนคำบนป้าย Extra จนจับไม่ได้
      const tags = sp.api ? [] : [...new Set(sp.all.flatMap((x) => x.tags || []))].slice(0, 8);
      const madeHidden = st.spHideMade ? sp.all.filter((x) => histOf(x)).length : 0; // ซ่อนตัวที่เคยทำไว้
      const soldHidden = sp.all.filter((x) => spPass(x, false)).length; // ผ่านตัวกรองอื่นแต่ขายไม่ถึง 100 (ตอนนี้ไม่มีตัวไหนผ่าน = ทุกตัวนี้ถูกซ่อนเพราะยอดขาย)
      if (madeHidden && madeHidden === sp.all.length) rows.push(el('div', 'empty', `ทุกตัวที่โหลดมา (${madeHidden} ตัว) เคยทำแล้ว — ซ่อนไว้อยู่${sp.more ? ' · กด โหลดเพิ่ม เพื่อหาตัวใหม่' : ''} หรือเอาติ๊ก “ซ่อนตัวที่เคยทำ” ออก`));
      else if (st.spSold && soldHidden) rows.push(el('div', 'empty', `สินค้าที่โหลดมา ${soldHidden} ตัวขายได้ไม่ถึง ${SOLD_MIN} ชิ้น — ซ่อนไว้อยู่${sp.more ? ' · กด โหลดเพิ่ม เพื่อหาตัวที่ขายดีกว่านี้' : ''} หรือเอาติ๊ก “ขายได้มากกว่า ${SOLD_MIN} ชิ้น” ออก`));
      else if (sp.shop) rows.push(el('div', 'empty', 'ร้านนี้ไม่มีสินค้าที่เข้าร่วม Affiliate (หรือรหัสร้านไม่ถูก) — ลองวางลิงก์สินค้าตัวอื่นของร้านนี้'));
      else rows.push(el('div', 'empty', !st.spXtra ? 'ไม่เจอสินค้า ลองคำอื่น'
        : `ไม่เจอสินค้า Extra Comm${sp.all.length ? ` ในสินค้า ${sp.all.length} รายการที่ดู` : ''} — ลองคำอื่น${sp.more ? ' / กด โหลดเพิ่ม' : ''} หรือเอาติ๊ก “เฉพาะ Extra Comm” ออก`
          + (tags.length ? ` · ป้ายบนการ์ดที่เห็น: ${tags.map((t) => `“${t}”`).join(', ')} (ถ้าป้าย Extra ใช้คำอื่น ส่งข้อความนี้มาให้ปรับได้)` : '')));
    } else if (st.spXtra && !sp.api && !sp.shop && sp.all.some((x) => !x.isExtra)) rows.push(el('div', 'hint', `แสดงเฉพาะ Extra Comm ${shown.length} ตัว จากที่โหลดมา ${sp.all.length} ตัว${sp.busy ? ' — กำลังหาเพิ่ม...' : ` · ที่ไม่ใช่ Extra ${sp.all.filter((x) => !x.isExtra).length} ตัวซ่อนไว้ (เอาติ๊ก “เฉพาะ Extra Comm” ออกถ้าอยากเห็นทั้งหมด · กด โหลดเพิ่ม = หา Extra อีก)`}`));
    const soldOut = st.spSold && shown.length ? sp.all.filter((x) => spPass(x, false) && !soldOk(x.sold)).length : 0;
    if (soldOut) rows.push(el('div', 'hint', `ซ่อนตัวที่ขายได้ไม่ถึง ${SOLD_MIN} ชิ้น ${soldOut} ตัว (เอาติ๊ก “ขายได้มากกว่า ${SOLD_MIN} ชิ้น” ออกถ้าอยากเห็น)`));
    $('spList').replaceChildren(...rows);
    $('spMore').hidden = !sp.more || !!sp.err;
    $('spMore').disabled = sp.busy;
    $('spMore').textContent = sp.busy ? 'กำลังโหลด...' : 'โหลดเพิ่ม';
  }

  // b = ปุ่ม "+ คิว" ของแถวนั้น (ไม่มี = เพิ่มจากปุ่มลงคิวทั้งหมด) · คืน { noLink } ไว้สรุปตอนเพิ่มทีละหลายตัว
  const linkReq = (it) => ({ type: 'affLink', name: it.name, ...(sp.all.includes(it) && !sp.shop ? { kw: sp.kw, page: it.page || 1, sort: sp.sort || '' } : {}) }); // ทั้งร้าน = ค้นชื่อบนหน้า Affiliate ตรงๆ
  async function addFromSearch(it, b = {}, opt = {}) {
    if (inQueue(it) || it.adding) return null; // กำลังเพิ่มอยู่ (ลงคิวทั้งหมด + กด + คิว ตัวเดียวกัน) → ไม่เพิ่มซ้ำ
    it.adding = true;
    try { return await addOne(it, b, opt); } finally { it.adding = false; renderSearch(); } // วาดปุ่มใหม่ (ปุ่มเดิมถูกแทนไปแล้วตอนวาดระหว่างเพิ่ม)
  }
  async function addOne(it, b, opt = {}) {
    b.disabled = true; b.textContent = 'กำลังเพิ่ม...';
    const r = it.image ? await bg({ type: 'fetchImage', url: it.image }) : { ok: false };
    const p = {
      ...newProduct(), name: it.name || `สินค้า ${it.itemId}`, itemId: it.itemId,
      images: r.ok ? [{ name: 'product-1.jpg', type: 'image/jpeg', dataUrl: r.dataUrl }] : [], imageUrls: it.image ? [it.image] : [],
      link: it.link, productUrl: it.productUrl, commission: it.com, extra: it.extra || (it.isExtra ? '✓' : ''), price: it.price,
      ...(shopOf(it) ? { shopId: shopOf(it), shopName: it.shopName || '' } : {}), // ร้านของสินค้า (ปุ่ม 🏪 ร้านนี้)
    };
    products.push(p);
    save(); renderAll();
    msg(`เพิ่มเข้าคิวแล้ว: ${p.name.slice(0, 40)}${r.ok ? '' : ' (โหลดรูปไม่ได้ — เพิ่มรูปเอง: แท็บคิว → กดแถวสินค้า → รูปปก)'}`, r.ok ? 'ok' : 'err');
    let linkError = '';
    if (it.web && !p.link && !opt.later) { // ค้นผ่านหน้าเว็บ: กด "เอา ลิงก์" ในแท็บ Affiliate ให้ (ลงคิวทั้งหมด = เอาทีหลังทีละหน้า)
      msg(`เพิ่มเข้าคิวแล้ว — กำลังเอาลิงก์ affiliate: ${p.name.slice(0, 30)}...`, '');
      const L = await bg(linkReq(it));
      if (!L.ok) { linkError = L.error || ''; p.linkError = linkError; save(); }
      if (L.ok && L.link) { p.link = L.link; save(); renderProducts(); }
      msg(L.ok ? `เพิ่มเข้าคิว + ได้ลิงก์ affiliate ✓ ${L.link}` : `เพิ่มเข้าคิวแล้ว แต่เอาลิงก์ไม่ได้ (${L.error}) — กด “เอา ลิงก์” บนหน้า Affiliate เองได้`, L.ok ? 'ok' : 'err');
    }
    // รายละเอียดสินค้า (ใช้คิดบท) โหลดตามหลัง ไม่ได้ก็ไม่เป็นไร
    if (p.productUrl) bg({ type: 'productDesc', url: p.productUrl }).then((d) => {
      if (d.ok && d.desc && !p.desc) { p.desc = d.desc.replace(/\s+/g, ' ').trim().slice(0, 600); save(); renderProducts(); }
    });
    return { p, noLink: !p.link, linkError };
  }
  // ＋ ลงคิวทั้งหมด: ทุกตัวที่แสดงอยู่ (ตามตัวกรอง Extra Comm) ที่ยังไม่อยู่ในคิว — ทีละตัว พร้อมเอาลิงก์ affiliate · กดอีกครั้ง = หยุด
  const bulk = { on: false, stop: false, done: 0, total: 0, ldone: 0, ltotal: 0 };
  async function addAllFromSearch() {
    if (bulk.on) { bulk.stop = true; renderSearch(); return; }
    const list = spShown().filter((it) => !inQueue(it));
    if (!list.length) return;
    Object.assign(bulk, { on: true, stop: false, done: 0, total: list.length, ldone: 0, ltotal: 0 });
    renderSearch();
    let noLink = 0, why = ''; // why = เหตุที่หยุดเอง (บอกในข้อความสรุป)
    try {
      // 1) ลงคิวทุกตัวตามลำดับที่แสดง (ยังไม่เอาลิงก์)
      const added = [];
      for (const it of list) {
        if (bulk.stop) break;
        msg(`ลงคิวทั้งหมด ${bulk.done + 1}/${bulk.total}: ${it.name.slice(0, 30)}...`, '');
        const r = await addFromSearch(it, {}, { later: true });
        if (r && r.p) added.push([it, r.p]);
        bulk.done++;
        renderSearch();
      }
      // 2) เอาลิงก์ทีหลัง เรียงตามหน้าที่โหลดมา → หน้า Affiliate เดินหน้าทีละหน้า ไม่กระโดดไปมา (ขายดีเรียงปนหลายหน้า)
      const need = added.filter(([it, p]) => it.web && !p.link).sort(([a], [b]) => (a.page || 0) - (b.page || 0));
      bulk.ltotal = need.length;
      for (const [i, [it, p]] of need.entries()) {
        if (bulk.stop) break;
        bulk.ldone = i; renderSearch();
        msg(`เอาลิงก์ affiliate ${i + 1}/${need.length}: ${it.name.slice(0, 30)}...`, '');
        const L = await bg(linkReq(it));
        if (L.ok && L.link && products.includes(p)) { p.link = L.link; delete p.linkError; save(); renderProducts(); }
        else { p.linkError = L.error || 'Shopee ไม่ส่งลิงก์กลับมา'; save(); }
        if (/เข้าสู่ระบบ/.test(L.error || '')) { // ยังไม่ล็อกอิน Affiliate → ตัวที่เหลือก็ไม่ได้ หยุดก่อน (ไม่สลับแท็บซ้ำทุกตัว)
          bulk.stop = true;
          why = 'ยังไม่ได้เข้าสู่ระบบ Shopee Affiliate — ล็อกอินในแท็บที่เปิดให้ แล้วกด 🔗 เอาลิงก์ ที่ตัวที่ไม่มีลิงก์';
        }
      }
      bulk.ldone = bulk.ltotal;
      noLink = added.filter(([, p]) => !p.link).length;
    } catch (e) {
      why = `สะดุด: ${e.message || e}`;
    } finally {
      const stopped = bulk.stop;
      Object.assign(bulk, { on: false, stop: false, ldone: 0, ltotal: 0 });
      renderSearch();
      msg(`${why ? `${why} · ` : stopped ? 'หยุดแล้ว · ' : ''}ลงคิวแล้ว ${bulk.done}/${bulk.total} ตัว${noLink ? ` · เอาลิงก์ไม่ได้ ${noLink} ตัว (ดูป้าย “ไม่มีลิงก์” ในคิว)` : ' ✓'}`, noLink || why ? 'err' : 'ok');
    }
  }

  // ---------- โพสต์ Facebook Page (Graph API · ฟรี) — กดปุ่ม 📘 บนการ์ดสินค้าที่ทำเสร็จ ----------
  // สลับทีละเพจต่อสินค้า · ปักตะกร้า = ลิงก์ affiliate ในคอมเมนต์แรก (คอมเมนต์ในนามเพจ)
  let fb = { userToken: '', pages: [], next: 0 }; // pages: [{ id, name, token, on }]
  const saveFb = () => { if (loaded) store.set({ mahFb: fb }); };
  const fbPagesOn = () => fb.pages.filter((x) => x.on);
  const fbNextPage = () => { const on = fbPagesOn(); return on.length ? on[(fb.next || 0) % on.length] : null; };
  // เพจที่สินค้านี้จะโพสต์ (กำหนดตอนทำคลิป) — ยังเปิดใช้อยู่เท่านั้น
  const fbPageOf = (p) => (p && p.fbPageId ? fbPagesOn().find((x) => x.id === p.fbPageId) || null : null);
  // 🧬 หลายเวอร์ชัน (ผู้ใช้สั่ง): สินค้าเดียวกันทำหลายคลิป คนละเพจ · p.vg = กลุ่ม (id ตัวแรก) · p.vn = เวอร์ชันที่
  // ลง Shopee Video ตัวเดียว: p.svPick true = ตัวที่ลง · false = เฉพาะ FB (ไฟล์อยู่ ShopeeVideo/…/FB-only — โปรแกรมโพสต์อ่านแค่ชั้นบน) · ไม่มีค่า = ตัวที่ได้ทำก่อนได้ลง
  const VER_DIR = 'FB-only';
  const verSibs = (p) => (p && p.vg ? products.filter((x) => x !== p && x.vg === p.vg) : []);
  const verPages = (p) => { const s = new Set(); for (const x of [p, ...verSibs(p)]) { if (x.fbPageId) s.add(x.fbPageId); (x.fbPosts || []).forEach((y) => y.pageId && s.add(y.pageId)); } return s; }; // เพจที่สินค้านี้ (ทุกเวอร์ชัน) จองไว้/โพสต์แล้ว
  const freePage = (p) => { // เพจถัดไปที่ยังไม่มีเวอร์ชันอื่นของสินค้านี้ · สินค้าธรรมดา = สลับเพจตามปกติ
    const on = fbPagesOn(), used = p && p.vg ? verPages(p) : null;
    if (used) for (let k = 0; k < on.length; k++) { const pg = on[((fb.next || 0) + k) % on.length]; if (!used.has(pg.id)) return pg; }
    return fbNextPage();
  };
  const pageFor = (p) => fbPageOf(p) || freePage(p);
  const pageLoad = (id) => products.filter((x) => x.fbPageId === id && !(x.fbPosts || []).length).length; // คลิปที่ยังไม่ได้โพสต์ของเพจนี้
  const verFree = (p) => { // เพจที่เปิดใช้และยังไม่มีสินค้านี้ (ไม่มีเวอร์ชันไหนจอง/โพสต์ · ไม่เคยโพสต์มาก่อน) — งานค้างน้อยก่อน
    const used = verPages(p), past = new Set((histOf(p) || {}).fb || []);
    return fbPagesOn().filter((pg) => !used.has(pg.id) && !past.has(pg.name)).sort((a, b) => pageLoad(a.id) - pageLoad(b.id));
  };
  const verRoom = (p) => Math.max(0, verFree(p).length - (!fbPageOf(p) && !(p.fbPosts || []).length ? 1 : 0)); // ตัวนี้ยังไม่มีเพจ = จองให้ก่อน 1 เพจ
  const fileBase = (p, name) => (p.vg && p.svPick === false ? `${VER_DIR}/${name}-v${p.vn || 2}` : name); // ชื่อไฟล์ใต้ ShopeeVideo/
  const svNeed = (p) => p.svPick !== false; // เวอร์ชันที่ไม่ลง Shopee = ไม่ต้องรอ 🛍
  function svClaim(p) { // เริ่มทำคลิป: ตัวแรกของกลุ่มที่ได้ทำ = ตัวลง Shopee · กลุ่มมีตัวลงแล้ว / สินค้านี้เคยลง Shopee มาก่อน = เฉพาะ FB (ห้ามลงซ้ำ)
    if (!p.vg || p.svPick !== undefined) return;
    p.svPick = !(verSibs(p).some((x) => x.svPick === true) || (histOf(p) || {}).sv);
    save();
  }
  // ตอนทำคลิป: กำหนดเพจปลายทาง (สลับทีละเพจ · ทำใหม่ ↺ ใช้เพจเดิม) เพื่อเลือกพรีเซนเตอร์ประจำเพจ
  function assignFbPage(p) {
    if (!fbPagesOn().length) return null;
    let pg = fbPageOf(p);
    if (!pg) { pg = freePage(p); fb.next = (fb.next || 0) + 1; saveFb(); p.fbPageId = pg.id; }
    return pg;
  }
  // พรีเซนเตอร์ประจำเพจ → ค่าของ presenterOverride
  function pageFace(pg) {
    if (!pg || !pg.presenterId) return undefined; // ตามที่เลือกในตั้งค่า
    if (pg.presenterId === 'none') return null; // เพจนี้ไม่ใช้รูปหน้า
    return presenters.find((x) => x.id === pg.presenterId) || undefined; // พรีเซนเตอร์ถูกลบ = กลับไปใช้ตัวในตั้งค่า
  }
  const fbBusy = new Set(); // สินค้าที่กำลังโพสต์
  // สื่อของสินค้าที่ทำในรอบนี้ (คลิป/รูป อยู่ในหน่วยความจำ) + ลิงก์ https เก็บไว้กับสินค้า (ใช้ได้หลังรีเฟรช ถ้าลิงก์ยังไม่หมดอายุ)
  const mediaFor = new Map();
  // คลิป/รูปโพสต์ของสินค้า → เก็บในเครื่องด้วย (IndexedDB ของหน้านี้): รีเฟรชหน้า/ลบแชตเก่าแล้ว ลิงก์ของ meta.ai ใช้ไม่ได้ → ยังโพสต์ Reel/รูปลงเพจได้
  // key = clip:<id> (Blob) · photos:<id> (data URL[]) · ลบตอนสินค้าออกจากคิว / ทำใหม่ · เปิดหน้า = ล้างของสินค้าที่ไม่อยู่ในคิวแล้ว
  let mediaDbP = null;
  const mediaDb = () => mediaDbP || (mediaDbP = new Promise((res, rej) => { const r = indexedDB.open('mahMedia', 1); r.onupgradeneeded = () => r.result.createObjectStore('m'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }));
  const mediaReq = async (mode, fn) => { const db = await mediaDb(); return new Promise((res, rej) => { const t = db.transaction('m', mode); const q = fn(t.objectStore('m')); t.oncomplete = () => res(q && q.result); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error); }); };
  const mediaPut = (key, val) => mediaReq('readwrite', (o) => o.put(val, key)).catch((e) => log(`⚠ เก็บไฟล์ไว้โพสต์ FB ในเครื่องไม่ได้ (${e && e.message || e}) — รีเฟรชหน้าแล้วอาจโพสต์ Reel/รูปไม่ได้`, 'warn'));
  const mediaGet = (key) => Promise.race([mediaReq('readonly', (o) => o.get(key)).catch(() => undefined), sleep(4000).then(() => undefined)]); // อ่านไม่ได้ใน 4 วิ = ข้าม (ไม่ให้ปุ่มโพสต์ค้าง)
  const mediaDel = (ids) => mediaReq('readwrite', (o) => { ids.forEach((id) => { o.delete(`clip:${id}`); o.delete(`photos:${id}`); }); }).catch(() => {});
  // โพสต์ FB สำเร็จแล้ว → ลบสำเนาคลิป/รูปใน Chrome (ผู้ใช้สั่ง: กินที่หลาย GB) · รูปที่ยังรอ 🛒 ปักตะกร้าใหม่ = เก็บไว้จนติด · Reel ยังไม่ขึ้น = เก็บคลิป
  // โพสต์ซ้ำ (📘 อีกครั้ง) ทีหลัง = ใช้ลิงก์คลิปของ meta.ai แทน (หมดอายุแล้ว = เลือกไฟล์ .mp4 เอง)
  function fbRelease(p) {
    const last = (p.fbPosts || []).slice(-1)[0];
    if (!last || last.reelMissing) return;
    const picsWait = (last.missed || []).some((x) => x.pics > (x.picsDone || 0));
    const m = mediaFor.get(p.id);
    if (m) { if (picsWait) mediaFor.set(p.id, { ...m, video: undefined }); else mediaFor.delete(p.id); }
    mediaReq('readwrite', (o) => { o.delete(`clip:${p.id}`); if (!picsWait) o.delete(`photos:${p.id}`); }).catch(() => {});
  }
  async function mediaGc() { // ของสินค้าที่ไม่อยู่ในคิวแล้ว (ลบจากแท็บอื่น / รุ่นก่อน) + ตัวที่โพสต์ FB แล้ว
    if (!loaded || !products.length) return; // รายการว่าง/โหลดไม่ขึ้น = ห้ามล้าง (เคยล้างคลิป/รูปทั้งหมดหลังรายการหาย)
    const keys = await mediaReq('readonly', (o) => o.getAllKeys()).catch(() => []);
    const ids = new Set(products.map((p) => p.id)), fills = new Set((fb.fillers || []).map((x) => x.id));
    const gone = [...new Set((keys || []).filter((k) => !String(k).startsWith('fill:')).map((k) => String(k).split(':')[1]).filter((id) => id && !ids.has(id)))];
    if (gone.length) mediaDel(gone);
    products.forEach((p) => { if ((p.fbPosts || []).length && !fbBusy.has(p.id)) fbRelease(p); }); // โพสต์ FB ไปแล้ว (ก่อนมีการลบหลังโพสต์)
    const oldFill = (keys || []).filter((k) => String(k).startsWith('fill:') && !fills.has(String(k).slice(5))); // รูปโพสต์คั่นที่โพสต์/ลบไปแล้ว
    if (oldFill.length) mediaReq('readwrite', (o) => { oldFill.forEach((k) => o.delete(k)); }).catch(() => {});
  }
  // ตัวที่ทำเสร็จ: เก็บแค่รูปย่อ (p.thumb) — รูปเต็มโหลดใหม่จากลิงก์รูป Shopee ตอนกดทำใหม่ · ตัวที่ไม่มีลิงก์รูป (อัปโหลดเอง) เก็บรูปเต็มไว้
  // (รายการเคยหนัก 33 MB เพราะรูปของตัวที่เสร็จแล้ว → เปิดเครื่องใหม่โหลดไม่ขึ้น)
  async function slimDone(p) {
    if (!p.done || !p.images.length || !(p.imageUrls || []).length) return false;
    try { p.thumb = await shrinkUrl(p.images[0].dataUrl, 96); } catch (e) {}
    p.images = [];
    return true;
  }
  async function slimAll() {
    let n = 0;
    for (const p of products.slice()) if (await slimDone(p)) n++;
    if (n) { save(); renderAll(); }
  }
  // ต้องใช้รูปแต่ไม่มีแล้ว (ตัวที่ทำเสร็จแล้วกดทำใหม่) → โหลดจากลิงก์รูป Shopee ที่จำไว้
  async function ensureImages(p) {
    if (p.images.length || !(p.imageUrls || []).length) return;
    for (const u of p.imageUrls.slice(0, 4)) {
      const r = await bg({ type: 'fetchImage', url: u });
      if (r.ok) p.images.push({ name: `product-${p.images.length + 1}.jpg`, type: 'image/jpeg', dataUrl: r.dataUrl });
    }
    if (p.images.length) { delete p.thumb; save(); }
  }
  function rememberMedia(p, part) {
    const m = { ...(mediaFor.get(p.id) || {}), ...part };
    mediaFor.set(p.id, m);
    if (part.video && part.video.blob) mediaPut(`clip:${p.id}`, part.video.blob);
    const https = (s) => (/^https:/.test(s || '') ? s : '');
    p.fbMedia = { video: https(m.video && m.video.src) || (p.fbMedia && p.fbMedia.video) || '', photos: (m.photos || []).map(https).filter(Boolean) };
  }
  async function toJpegDataUrl(src) { // รูปจาก meta.ai เป็น webp → แปลงเป็น JPEG ให้ Facebook รับแน่นอน
    const bmp = await createImageBitmap(await (await fetch(src)).blob());
    const k = Math.min(1, 2048 / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.92);
  }
  async function fbMediaFor(p) {
    let m = mediaFor.get(p.id) || {};
    const s = p.fbMedia || {};
    // รีเฟรชหน้าแล้ว (หน่วยความจำว่าง) → ใช้ที่เก็บไว้ในเครื่อง ก่อนลิงก์ของ meta.ai (แชตอาจถูกลบไปแล้ว)
    if (!(m.video && okVideo(m.video.blob))) { const blob = await mediaGet(`clip:${p.id}`); if (okVideo(blob)) m = { ...m, video: { ...(m.video || {}), blob } }; }
    if (!(m.photoData && m.photoData.length)) { const pd = await mediaGet(`photos:${p.id}`); if (pd && pd.length) m = { ...m, photoData: pd }; }
    const photos = [];
    const linkGone = (u) => { const x = /[?&]oe=([0-9a-f]{6,10})/i.exec(u || ''); return !!x && parseInt(x[1], 16) * 1000 < Date.now(); }; // ลิงก์ไฟล์ของ Meta มีวันหมดอายุใน oe=
    for (const src of (m.photoData && m.photoData.length ? m.photoData : m.photos && m.photos.length ? m.photos : s.photos) || []) { // สำเนาในหน่วยความจำก่อน (แชตอาจถูกลบไปแล้ว)
      if (/^https:/.test(src) && linkGone(src)) continue; // ลิงก์รูปหมดอายุ = ข้าม (เดิมส่งให้ Facebook ไปโหลดเอง → An unknown error · รูป 0/2 + ปุ่มปักตะกร้าใหม่ค้าง)
      try { photos.push({ dataUrl: await toJpegDataUrl(src) }); } catch (e) {
        if (/^https:/.test(src)) { const r = await bg({ type: 'fetchImage', url: src, max: 2048 }); if (r.ok) photos.push({ dataUrl: r.dataUrl }); } // หน้าเว็บโหลดข้ามโดเมนไม่ได้ → ส่วนเสริมโหลดให้แล้วอัปเป็นไฟล์ · โหลดไม่ได้ = ข้าม
      }
    }
    let video = null;
    if (m.video && okVideo(m.video.blob)) video = { dataUrl: await blobToDataUrl(m.video.blob) };
    else {
      const src = (m.video && m.video.src) || s.video;
      // ลิงก์ตาย (ได้ error แทนวิดีโอ) = ไม่มีคลิป · โหลดในหน้าไม่ได้เพราะข้ามโดเมน = ให้ Facebook ไปโหลดเอง
      if (src) {
        try { video = { dataUrl: await blobToDataUrl(await fetchVideo(src)) }; } catch (e) {
          if (!e.dead && /^https:/.test(src)) { const r = await bg({ type: 'fetchMedia', url: src }); video = r.ok ? { dataUrl: r.dataUrl } : /HTTP 4\d\d|ไม่ได้ส่งไฟล์/.test(r.error || '') ? null : { url: src }; } // ส่วนเสริมโหลดแทน · ลิงก์ตาย = ไม่มีคลิป
        }
      }
    }
    return { photos, video };
  }
  const AI_LINE = '🤖 ภาพและวิดีโอสร้างด้วย AI';
  const aiLine = () => (st.aiLabel ? AI_LINE : ''); // ค่าเริ่มต้นปิด (ผู้ใช้ไม่เอาบรรทัดนี้ในแคปชัน) — เปิดเองได้ที่แท็บ 📘 // กฎ Meta: คอนเทนต์เหมือนจริงที่ทำด้วย AI ต้องบอก (รูปที่แปลงเป็น JPEG ไม่มีข้อมูลฝังแล้ว)
  const cartComment = (link) => `🛒 พิกัด 👉 ${link}`; // ปักตะกร้า (คอมเมนต์แรกในนามเพจ) · แคปชัน Reel / .txt ใช้แบบนี้
  // คอมเมนต์ปักตะกร้า: สุ่มประโยค + ชื่อสินค้าสั้น (ผู้ใช้สั่ง — ข้อความเดียวกันทุกโพสต์ทุกเพจ Facebook มองเป็นสแปมง่าย) · ตั้งชื่อสั้นไม่ได้ = แบบเดิม
  const thSeg = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter('th', { granularity: 'word' }) : null;
  const NAME_TAIL = /^(และ|กับ|ที่|ของ|สำหรับ|แบบ|ใน|บน|ใต้|ติด|ทรง|เพื่อ|จาก|ให้|มี|หรือ|รุ่น|ขนาด|สี)$/;
  function shortName(name) { // ล้างคำโปร/วงเล็บ → ท่อนแรก → เอาทีละวลีตามช่องว่างที่ร้านเว้นไว้ (ไม่เกิน ~30 ตัว) · ชื่อติดกันยาวไม่มีวรรค = ตัดที่ขอบคำ · ไม่จบด้วยคำเชื่อม
    let s0 = promptName(name).replace(/^(\s*[([【{][^)\]】}]*[)\]】}]\s*)+/, '').split(/\s*[,|]\s*|\s+\/\s+|(?<!\d)\/(?!\d)|\s+[-–]\s+/)[0] // “3/4/5ชั้น” ไม่ตัด
      .replace(/\s*[([【{][^)\]】}]*[)\]】}]/g, ' ').replace(/\s*[([【{].*$/, '').replace(/ํา/g, 'ำ').replace(/\s+/g, ' ').trim(); // วงเล็บ (ขนาด/รายละเอียด) ไม่เอา · “ํา” พิมพ์ผิด → “ำ” (ตัดคำได้ถูก)
    for (let k = 0; k < 4; k++) s0 = s0.replace(/^[^\p{L}\p{N}]+/u, '').replace(/^(cod|ส่งจากไทย|ส่งฟรี|ขายดี|พร้อมส่ง|ถูกที่สุด|ของแท้|new|ใหม่)(?=[\s\p{L}]|$)\s*/iu, ''); // อีโมจิ/คำโปรหน้าชื่อ
    let n = '';
    for (const w of s0.split(' ')) { const t = n ? `${n} ${w}` : w; if (t.length > 30) break; n = t; }
    if ((n.length < 10 || (!/[฀-๿]/.test(n) && n.length < 12)) && thSeg) { // วลีแรกสั้น / ยี่ห้อสั้นล้วน / ยาวติดกันไม่มีวรรค → เติมจนเกือบ 30 ตัว ตัดที่ขอบคำ
      const out = [];
      for (const { segment } of thSeg.segment(s0)) { if ((out.join('') + segment).length > 30) break; out.push(segment); }
      while (out.length > 1 && (NAME_TAIL.test(out[out.length - 1].trim()) || !out[out.length - 1].trim() || out[out.length - 1].trim().length < 2)) out.pop();
      const m = out.join('').trim();
      if (m.length > n.length) n = m;
    }
    n = n.replace(/[\s\-–:,+&]+$/, '').replace(/\s+\d+$/, '').replace(/\s+(รุ่น|ขนาด|สี|แบบ|เบอร์)$/, '').trim(); // เลขค้างท้าย (“ชั้นวางของ 3”) · “รุ่น 53” เหลือ “รุ่น”
    return n.length >= 3 ? n : '';
  }
  const CMT_T = [
    (n, l) => `🛒 ${n} ตัวในคลิป อยู่ตรงนี้เลย 👉 ${l}`,
    (n, l) => `พิกัด ${n} 👉 ${l}`,
    (n, l) => `ใครถามหา ${n} กดดูตรงนี้ได้เลย 🛒 ${l}`,
    (n, l) => `${n} ที่ใช้ในคลิป 👉 ${l}`,
    (n, l) => `กดดูราคาล่าสุดของ ${n} ตรงนี้ 🛒 ${l}`,
  ];
  const cartCommentFor = (p, link) => { const n = shortName(p && p.name); return n ? CMT_T[Math.floor(Math.random() * CMT_T.length)](n, link) : cartComment(link); };
  // แคปชัน Reel: Facebook จับลิงก์ affiliate ในแคปชันแล้วขึ้นตะกร้าบนคลิปเอง (Graph API ไม่มีช่องติดสินค้าใน Reel) → ใส่ลิงก์ด้วยแม้ปักในคอมเมนต์แล้ว
  // รูปที่แนบในคอมเมนต์ Reel (ตัวเลือก 0/1/2 รูป) · ไม่มีรูปโพสต์ = ไม่แนบ
  const reelPics = (photos) => (photos || []).slice(0, +(st.fbCmtPhotos || 0) || 0);
  const picsLeft = (r) => (r.photosWanted && r.photosCommented < r.photosWanted ? { pics: r.photosWanted, picsDone: r.photosCommented || 0 } : {}); // รูปที่ยังไม่ติด (ปักตะกร้าใหม่ทำต่อ)
  // ค้างทำต่อ (ปุ่ม 🛒 ปักตะกร้าใหม่): ลิงก์ไม่ติด หรือ รูปในคอมเมนต์ไม่ครบ — ลิงก์ติดแล้ว/ไม่ได้ใช้คอมเมนต์ลิงก์ = linkDone (ครั้งหน้าคอมเมนต์แค่รูป) · เดิมเก็บเฉพาะลิงก์ไม่ติด → รูปไม่ติดแล้วหายถาวร
  const missOf = (r, what, comment) => { const id = r.videoId || r.postId, pics = picsLeft(r), linkOk = !comment || r.commented; return id && (!linkOk || pics.pics) ? { id, what, ...pics, ...(linkOk ? { linkDone: true } : {}) } : null; };
  const picNote = (r) => (r.photosWanted ? ` + รูปในคอมเมนต์ ${r.photosCommented}/${r.photosWanted}${r.photosCommented < r.photosWanted ? ` (${(r.photoCommentError || '').slice(0, 60)})` : ''}` : '');
  const reelText = (body, link, comment) => (link && (!comment || st.fbReelLink !== false) ? `${body}\n\n${cartComment(link)}` : body);
  // error ที่เจอบ่อยของ Graph API → บอกว่าต้องทำอะไร
  // Facebook มองว่าสแปม/ผิดกฎ: #368 "deemed abusive" / บล็อกชั่วคราว / ลิงก์โดนบล็อก — โพสต์ต่อ = โดนหนักขึ้น
  const FB_BLOCK_RE = /(^|\s)368(\/\d+)?:|deemed abusive|temporarily blocked|blocked from|spam/i;
  const FB_BLOCK_TIP = 'Facebook บล็อกชั่วคราว (มองว่าสแปม/ผิดกฎ): หยุดโพสต์เพจนี้ 1–2 วัน แล้วเช็ก “สถานะเพจ (Page status)” ในแดชบอร์ดมืออาชีพ';
  let fbBlocked = ''; // ชื่อเพจที่เพิ่งโดนบล็อก (โพสต์ทั้งหมด → หยุด)
  const fbHint = (err) => (FB_BLOCK_RE.test(err || '') ? ` — ${FB_BLOCK_TIP}` : /^190\b|expired|session has|validating access token/i.test(err || '') ? ' — token หมดอายุ: ขอ User Token ใหม่ → Access Token Debugger → Extend Access Token → คัดลอก token ตัวใหม่ที่ขึ้นมา (ไม่ใช่ตัวเดิม · ใช้ได้ ~60 วัน) → แท็บ 📘 เพจ FB → วาง → ดึงรายชื่อเพจ'
    : /^(10|2\d\d)\b|permission/i.test(err || '') ? ' — token ไม่มีสิทธิ์: สร้าง token ใหม่ติ๊ก pages_manage_posts, pages_manage_engagement' : '');
  // คอมเมนต์ไม่ติดเพราะ token ไม่มีสิทธิ์คอมเมนต์ในนามเพจ (ไม่ใช่ Reel ยังประมวลผล) — ข้อความจาก graph(): "200: (#200) ..."
  // อัปโหลดคลิปแล้ว Facebook ตอบ 422 = ไฟล์ใช้ไม่ได้ (ลิงก์คลิปหมดอายุ ได้หน้า error มาแทน)
  const fbHint422 = (err) => (/HTTP 422|422/.test(err || '') ? ' — ไฟล์คลิปใช้ไม่ได้ (ลิงก์ meta.ai หมดอายุ) · กด 🎬 ลง Reel → 📁 เลือกไฟล์ .mp4 จากโฟลเดอร์ ShopeeVideo' : '');
  const noCmtPerm = (err) => /(^|\s)(10|2\d\d)(\/\d+)?:|permission|pages_manage_engagement/i.test(err || '');
  const CMT_PERM = 'token ไม่มีสิทธิ์คอมเมนต์ในนามเพจ (pages_manage_engagement): ขอ token ใหม่ที่มีสิทธิ์นี้ → ดึงรายชื่อเพจ → กด 🛒 ปักตะกร้าใหม่ (ไม่ต้องโพสต์ซ้ำ)';
  const fbMissed = (p) => { const last = (p.fbPosts || []).slice(-1)[0]; return last && last.missed && last.missed.length ? last : null; };
  // ปักตะกร้าซ้ำเฉพาะโพสต์ที่คอมเมนต์ไม่ติด (Reel ประมวลผลนาน) — ไม่โพสต์ใหม่
  async function fbRecomment(p) {
    const last = fbMissed(p), page = last && fb.pages.find((x) => x.id === last.pageId);
    const link = p.link || '';
    if (!last || !page || !link) { msg(!link ? 'สินค้านี้ไม่มีลิงก์ให้ปักตะกร้า' : 'หาเพจของโพสต์นี้ไม่เจอ — แท็บ 📘 เพจ FB → ดึงรายชื่อเพจใหม่', 'err'); return; }
    if (fbBusy.has(p.id)) return;
    fbBusy.add(p.id); renderProducts();
    try {
      const left = [], errs = [], skipped = []; // skipped = รูปที่เลิกลองแล้ว (บอกในข้อความ)
      let photos = null, picsAll = false; // picsAll = รูปที่ค้างติดครบแล้ว → ลบไฟล์รูปในเครื่องเหมือนโพสต์ครั้งแรก
      for (const x of last.missed) {
        msg(`🛒 กำลังปักตะกร้าใน${x.what}ของ “${(p.name || '').slice(0, 30)}”...`, '');
        if (x.pics > (x.picsDone || 0) && !photos) photos = (await fbMediaFor(p)).photos; // รูปที่ค้างจากตอนโพสต์
        const cmtPhotos = x.pics > (x.picsDone || 0) ? (photos || []).slice(x.picsDone || 0, x.pics) : [];
        const r = await bg({ type: 'fbRecomment', objectId: x.id, token: page.token, message: x.linkDone ? '' : cartCommentFor(p, link), cmtPhotos });
        if (!(r.ok && r.commented)) { left.push(x); errs.push(`${x.what}: ${r.error || r.commentError || '-'}`); continue; }
        x.linkDone = true;
        if (r.photosWanted && r.photosCommented < r.photosWanted) { // ลิงก์ติดแล้ว ครั้งหน้าคอมเมนต์แค่รูป
          x.picsDone = (x.picsDone || 0) + r.photosCommented; x.picTries = (x.picTries || 0) + 1;
          if (x.picTries < 2) { left.push(x); errs.push(`${x.what}: รูปในคอมเมนต์ยังไม่ติด (${r.photoCommentError || '-'})`); }
          else skipped.push(`รูปในคอมเมนต์${x.what}ไม่ติด 2 รอบ (${r.photoCommentError || '-'}) — ข้ามรูป`); // ไม่ค้างคิวตลอดไป
        }
        else if (x.pics > (x.picsDone || 0) && !cmtPhotos.length) errs.push(`${x.what}: ไม่มีรูปโพสต์ในเครื่องแล้ว (ข้ามรูป)`); // รูปหาย = ข้าม ไม่ค้างตลอดไป
        else if (r.photosWanted) picsAll = true;
      }
      last.missed = left;
      save();
      fbRelease(p); // รูปที่รอติดครบ/ข้ามแล้ว → ลบสำเนาใน Chrome
      if (picsAll && !left.some((x) => x.pics > (x.picsDone || 0)) && st.fbDelPhotos !== false && (p.photoFiles || []).length) {
        const rm = await bg({ type: 'removeFiles', ids: p.photoFiles });
        if (rm.ok) { p.photoFiles = []; save(); log(`🗑 ${(p.name || '').slice(0, 30)}: ลบไฟล์รูปโพสต์ในเครื่องแล้ว ${rm.removed} ไฟล์`, 'ok'); }
      }
      const skipNote = skipped.length ? ` · ${skipped.join(' · ')}` : '';
      log(`🛒 ${(p.name || '').slice(0, 30)}: ${left.length ? `ปักตะกร้ายังไม่ได้ (${errs.join(' · ')})` : `ปักตะกร้าในเพจ “${page.name}” แล้ว ✓`}${skipNote}`, left.length || skipped.length ? 'warn' : 'ok');
      msg(left.length ? `ยังปักตะกร้าไม่ได้: ${errs.join(' · ')} — ${noCmtPerm(errs.join(' ')) ? CMT_PERM : 'Reel อาจยังประมวลผลไม่เสร็จ รอสักครู่แล้วกดใหม่'}` : `ปักตะกร้าแล้ว ✓${skipNote}`, left.length || skipped.length ? 'err' : 'ok');
    } finally {
      fbBusy.delete(p.id); renderAll();
    }
  }
  // 📘 โพสต์ทั้งหมดที่ยังไม่โพสต์: ทีละตัว (เพจตามที่กำหนดของแต่ละสินค้า) เว้น st.fbGap นาทีระหว่างโพสต์ · กดอีกครั้ง = หยุด
  // ต้องเปิดแท็บ meta.ai ค้างไว้ (นับเวลาในหน้านี้)
  const fbBulk = { on: false, stop: false, done: 0, total: 0, nextAt: 0 };
  const fbUnposted = () => products.filter((p) => p.done && p.link && !(p.fbPosts || []).length && !fbBusy.has(p.id)); // ไม่มีลิงก์ affiliate = ไม่โพสต์ (ไม่ได้ค่าคอม)
  // ---------- 🧩 โพสต์คั่น (ไม่ขายของ · ปั้นเพจ): meta.ai เขียนโพสต์ + รูป 1 ภาพตามแนวเพจ → แทรกในปุ่มโพสต์ทั้งหมด ----------
  // fb.fillers = [{ id, pageId, text, thumb, at }] · รูปเต็มอยู่ใน IndexedDB (fill:<id>) · เพจที่ขายแต่ลิงก์ = Facebook ลดการเข้าถึง/มองเป็นสแปม
  const fill = { on: false, done: 0, total: 0, fails: 0 };
  const FILL_KEEP = 2; // เตรียมไว้เพจละกี่โพสต์
  const fillReady = (pageId) => (fb.fillers || []).filter((x) => x.pageId === pageId);
  const fillNeed = () => (+st.fillEvery ? fbPagesOn().filter((pg) => fillReady(pg.id).length < FILL_KEEP) : []);
  // ห้ามเขียนคำว่า Facebook ใน prompt (meta.ai แปลงเป็นวิดเจ็ต) · ไม่มีคำแสลงไทย · เรื่องที่เพจนี้เคยโพสต์ไปแล้ว = ห้ามซ้ำ
  const fillRules = (pg) => {
    const past = ((fb.fillHist || {})[pg.id] || []).slice(-8);
    return [
      `Write one short social media post for a Thai page about ${(pg.niche || '').trim() || `the topic that fits the page name "${pg.name}"`} — not selling anything: mostly a handy everyday tip or life hack people can try right away (sometimes a relatable moment or a question instead). Pick a fresh idea.`,
      'Very casual, friendly everyday Thai, like a friend casually sharing it — simple spoken words, not formal or textbook. 2–4 short lines, 1–2 emoji, end with an easy question for followers. Use เรา; never ผม, ดิฉัน, ครับ, ค่ะ or คะ. Avoid ending sentences with นะ or เลยนะ.',
      'No links, prices, product or brand names, promotions or shopping; no exaggerated or health claims; never mention children or babies.',
      past.length ? `This page already posted these — choose a different topic: ${past.map((x) => `"${x}"`).join(', ')}` : '',
    ].filter(Boolean);
  };
  function readBlock(head) { // ข้อความในกล่องโค้ดล่าสุดหลังข้อความของเรา (meta.ai)
    const anchor = findAnchor(head);
    if (!anchor) return '';
    const after = (x) => !isOurs(x) && !x.closest('[contenteditable], textarea') && anchor.compareDocumentPosition(x) & Node.DOCUMENT_POSITION_FOLLOWING;
    const b = [...document.querySelectorAll('pre')].filter(after).pop() || [...document.querySelectorAll('code')].filter(after).pop();
    return b ? b.innerText.trim() : '';
  }
  const cleanFill = (t) => String(t || '').replace(/[*_`]+/g, '').replace(URL_RE, '').split('\n').map((l) => l.trim()).filter((l) => l && !checkText(l).length).join('\n').slice(0, 600);
  async function fillTextMeta(pg) { // ไม่มี Gemini key: พิมพ์ในแชต meta.ai (ข้อความล้วน) → อ่านกล่องโค้ด
    const pause = (ms) => (run.on ? nap(ms) : sleep(ms));
    if (!run.on) run.stop = false; // ปุ่มหยุดของคิวรอบก่อนค้างไว้
    const first = `Page post for: "${pg.name}"`, head = first.slice(0, 60);
    for (let t = 0; t < 150 && isBusy(); t++) await pause(2000);
    let input = null;
    for (let t = 0; t < 30 && !(input = findInput()); t++) await pause(1000);
    if (!input || !(await insertInto(input, [first, ...fillRules(pg), 'Text only — no image. Put only the post text in one code block.'].join('\n')))) throw new Error('ใส่ข้อความในช่องพิมพ์ meta.ai ไม่ได้');
    await pause(600);
    await submit(findInput() || input);
    if (+st.newChat) { chatCount.n = Math.max(chatCount.n || 0, +st.newChat); saveChat(); } // แชตนี้มีโพสต์คั่นแล้ว → สินค้าถัดไปเปิดแชตใหม่ (ไม่ปนกับคลิป)
    let text = '', prev = '';
    for (let t = 0, idle = 0; t < 60; t++) { await pause(1500); text = cleanFill(readBlock(head)); if (text && text === prev && !isBusy()) break; idle = !text && !isBusy() && t > 10 ? idle + 1 : 0; if (idle >= 6) break; prev = text; } // ตอบจบแล้วไม่มีกล่องข้อความ = เลิกรอ
    return text;
  }
  async function fillTextGemini(pg) {
    const t = await askGemini([...fillRules(pg), 'Return JSON only: {"post": "<the post text, use \\n between lines>"}'].join('\n'), []);
    let j = null;
    try { j = JSON.parse(String(t).replace(/^```(json)?|```$/g, '').trim()); } catch (e) {}
    return cleanFill(j && j.post ? String(j.post) : t);
  }
  async function makeFiller(pg) { // เขียนโพสต์คั่น 1 โพสต์ (ข้อความล้วน) → เก็บไว้รอโพสต์
    const text = gemini.key ? await fillTextGemini(pg) : await fillTextMeta(pg);
    if (!text) throw new Error(gemini.key ? 'Gemini ไม่ได้ส่งข้อความกลับมา' : 'meta.ai ไม่ได้ส่งข้อความโพสต์มาในกล่องโค้ด');
    const x = { id: uid(), pageId: pg.id, text, at: Date.now() };
    fb.fillers = [...(fb.fillers || []), x];
    saveFb();
    return x;
  }
  async function fillMakeAll() { // ปุ่ม: ทำให้ทุกเพจที่ใช้อยู่ ครบเพจละ 2
    if (fill.on) { fill.on = false; renderFill(); return; } // กดซ้ำ = หยุดหลังตัวที่ทำอยู่
    if (!gemini.key && run.on) return;
    const need = [];
    for (const pg of fbPagesOn()) for (let k = fillReady(pg.id).length; k < FILL_KEEP; k++) need.push(pg);
    if (!need.length) { msg('ทุกเพจมีโพสต์คั่นพร้อมแล้ว ✓', 'ok'); return; }
    Object.assign(fill, { on: true, done: 0, total: need.length, fails: 0 });
    renderFill(); if (!gemini.key) renderRun();
    let ok = 0;
    try {
      for (const pg of need) {
        if (!fill.on) break;
        msg(`🧩 ให้${gemini.key ? ' Gemini' : ' meta.ai'} เขียนโพสต์คั่นของเพจ “${pg.name}” (${fill.done + 1}/${fill.total})...`, '');
        try { await makeFiller(pg); ok++; } catch (e) { log(`⚠ ทำโพสต์คั่นของเพจ “${pg.name}” ไม่ได้: ${e.message || e}`, 'warn'); }
        fill.done++; renderFill();
      }
    } finally {
      fill.on = false; renderFill(); renderRun();
      msg(`🧩 ได้โพสต์คั่น ${ok}/${fill.total} โพสต์`, ok ? 'ok' : 'err');
    }
  }
  async function fillBetween(nx) { // รันคิว: พักระหว่างสินค้า → ทำโพสต์คั่น 1 โพสต์ให้เพจที่ยังไม่ครบ (พลาด 2 ครั้งติด = พักไว้ทั้งรอบ) · nx = สินค้าตัวถัดไป (เดิมเรียก nextItem ที่อยู่ใน runQueue → ReferenceError คิวหยุดหลังตัวแรก)
    const pg = !gemini.key && fill.fails < 2 && !fill.on && fillNeed()[0]; // มี Gemini = เขียนให้ตอนโพสต์ทั้งหมดเลย ไม่ต้องใช้แชต
    if (!pg) return;
    if (nx) setStatus(nx, '🧩 รอ meta.ai เขียนโพสต์คั่นก่อน');
    log(`🧩 ระหว่างพัก: ให้ meta.ai เขียนโพสต์คั่นของเพจ “${pg.name}” — คิวรอสักครู่ (ใส่ Gemini key ในหมวด 🧩 = ไม่ต้องรอ)`);
    fill.on = true; renderFill();
    try { await makeFiller(pg); fill.fails = 0; log(`🧩 ได้โพสต์คั่นของเพจ “${pg.name}” แล้ว`, 'ok'); }
    catch (e) { if (e instanceof Stopped) throw e; fill.fails++; log(`⚠ ทำโพสต์คั่นไม่ได้: ${e.message || e}${fill.fails >= 2 ? ' — พักการทำโพสต์คั่นระหว่างคิวไว้ก่อน (กดปุ่มทำเองที่แท็บ 📘 ได้)' : ''}`, 'warn'); }
    finally { fill.on = false; renderFill(); }
  }
  function removeFiller(x) {
    fb.fillers = (fb.fillers || []).filter((y) => y.id !== x.id);
    mediaReq('readwrite', (o) => o.delete(`fill:${x.id}`)).catch(() => {});
    saveFb(); renderFill();
  }
  async function postFiller(x) { // โพสต์ข้อความล้วน ไม่มีรูป ไม่มีคอมเมนต์ลิงก์
    const page = fb.pages.find((pg) => pg.id === x.pageId);
    if (!page) return false;
    const r = await bg({ type: 'fbText', pageId: page.id, token: page.token, message: [x.text, aiLine()].filter(Boolean).join('\n\n') });
    if (!r.ok) { log(`⚠ โพสต์คั่นลงเพจ “${page.name}” ไม่ได้: ${r.error}${fbHint(r.error)}`, 'warn'); if (FB_BLOCK_RE.test(r.error || '')) fbBlocked = page.name; return false; }
    fb.fillHist = { ...(fb.fillHist || {}), [page.id]: [...((fb.fillHist || {})[page.id] || []), x.text.split('\n')[0].slice(0, 80)].slice(-20) }; // กันเขียนเรื่องซ้ำ
    removeFiller(x);
    log(`🧩 โพสต์คั่นลงเพจ “${page.name}” แล้ว ✓`, 'ok');
    return true;
  }
  function renderFill() {
    const all = fb.fillers || [];
    $('gKeySum').textContent = gemini.key ? 'Gemini ✓ (เขียนเบื้องหลัง คิวไม่ต้องรอ)' : 'meta.ai เขียนในแชต (คิวรอตอนพักระหว่างสินค้า)';
    $('fillHint').textContent = gemini.key ? 'Gemini เขียนโพสต์ไม่ขายของ (ทริค / ชวนคุย / คำถาม) ตาม “แนวเพจ” · ข้อความล้วน ไม่มีรูป ไม่มีลิงก์ · ไม่ซ้ำเรื่องเดิม — ถึงรอบแล้วยังไม่มี = เขียนให้ตอนนั้นเลย'
      : 'ยังไม่ใส่ Gemini key — meta.ai เขียนในแชตแทน ตอนพักระหว่างสินค้าในคิว หรือกดปุ่มด้านล่าง · ข้อความล้วน ไม่มีรูป ไม่มีลิงก์';
    $('fillSum').textContent = +st.fillEvery ? `พร้อมโพสต์ ${all.length}${fill.on ? ' · กำลังทำ...' : ''}` : 'ปิดอยู่';
    $('fillMake').textContent = fill.on && (gemini.key || !run.on) ? `⏹ หยุดทำโพสต์คั่น (${fill.done}/${fill.total})` : `✍ ทำโพสต์คั่นให้ทุกเพจ (เพจละ ${FILL_KEEP})`;
    $('fillMake').disabled = (!gemini.key && run.on) || (!fill.on && !fbPagesOn().length);
    $('fillMake').title = gemini.key ? 'Gemini เขียนเตรียมไว้ (ดูก่อนโพสต์ได้) — ไม่กดก็ได้ ตอนโพสต์ทั้งหมดเขียนให้เอง' : run.on ? 'กำลังรันคิว — ส่วนเสริมทำให้เองตอนพักระหว่างสินค้า' : 'ให้ meta.ai เขียนในแชตนี้ ทีละโพสต์ — ระหว่างนี้ปุ่ม ▶ รอก่อน';
    $('fillList').replaceChildren(...all.map((x) => {
      const r = el('div', 'card qrow'), mid = el('div', 'mid'), btns = el('span', 'gbtns'), cov = el('div', 'cover');
      cov.textContent = '🧩';
      const pg = fb.pages.find((p) => p.id === x.pageId);
      const t = el('div', 'gpitch', x.text); t.title = x.text;
      mid.append(el('div', 'nm', `📘 ${pg ? pg.name : 'เพจที่ไม่ได้ใช้แล้ว'}`), t);
      const del = el('button', 'icon', '🗑'); del.title = 'ลบโพสต์คั่นนี้'; del.onclick = () => removeFiller(x);
      const post = el('button', 'btn', '📘 โพสต์'); post.title = 'โพสต์ลงเพจตอนนี้เลย (ไม่มีลิงก์)'; post.disabled = !pg || fbBulk.on;
      post.onclick = async () => { post.disabled = true; post.textContent = 'กำลังโพสต์...'; const ok = await postFiller(x); msg(ok ? 'โพสต์คั่นลงเพจแล้ว ✓' : 'โพสต์คั่นไม่ได้ — ดูบันทึกด้านล่าง', ok ? 'ok' : 'err'); renderFill(); };
      btns.append(del, post);
      r.append(cov, mid, btns);
      return r;
    }));
  }
  const FB_PAGE_GAP = 60 * 60000; // เพจเดียวกันโพสต์ห่างกันอย่างน้อย 1 ชม. (ปุ่มโพสต์ทั้งหมด)
  async function fbPostAll() {
    if (fbBulk.on) { fbBulk.stop = true; renderPostLists(); return; }
    const list = fbUnposted();
    if (!list.length || !fbPagesOn().length) return;
    Object.assign(fbBulk, { on: true, stop: false, done: 0, total: list.length, nextAt: 0 });
    renderPostLists();
    let ok = 0, blocked = '';
    fbBlocked = '';
    // สลับเพจ: ตัวถัดไป = ของเพจที่โพสต์ไปนานสุด · เพจเดียวกันห่างกันอย่างน้อย 1 ชม. (เดิมโพสต์ตามลำดับคิว → เพจเดียวอาจโดนติดกันทุก 15 นาที)
    const lastAt = new Map(); // เพจ → โพสต์ล่าสุดเมื่อไหร่ (รวมที่โพสต์ก่อนกดปุ่มนี้)
    for (const p of products) for (const x of p.fbPosts || []) if (x.pageId && x.at > (lastAt.get(x.pageId) || 0)) lastAt.set(x.pageId, x.at);
    const pageKey = (p) => (pageFor(p) || {}).id || '';
    const waitUntil = async (t) => { fbBulk.nextAt = t; while (Date.now() < fbBulk.nextAt && !fbBulk.stop) { renderPostLists(); await sleep(Math.min(20000, fbBulk.nextAt - Date.now())); } fbBulk.nextAt = 0; };
    const left = [...list], sinceFill = new Map(); // เพจ → โพสต์ขายไปกี่โพสต์แล้วตั้งแต่โพสต์คั่นล่าสุด
    try {
      while (!fbBulk.stop) {
        for (let k = left.length - 1; k >= 0; k--) if (!products.includes(left[k]) || (left[k].fbPosts || []).length) { left.splice(k, 1); fbBulk.done++; } // ระหว่างรอ ถูกลบ/กดโพสต์เองไปแล้ว
        if (!left.length) break;
        const next = left.reduce((a, b) => ((lastAt.get(pageKey(b)) || 0) < (lastAt.get(pageKey(a)) || 0) ? b : a)); // เพจที่โพสต์ไปนานสุด (เท่ากัน = ตามลำดับคิว)
        const due = (lastAt.get(pageKey(next)) || 0) + FB_PAGE_GAP;
        if (due > Date.now()) { await waitUntil(due); continue; } // เหลือแต่เพจที่เพิ่งโพสต์ → รอให้ครบ 1 ชม.
        const fe = +st.fillEvery || 0, fk = pageKey(next), due2 = fe && (sinceFill.get(fk) || 0) >= fe;
        let fx = due2 && fillReady(fk)[0];
        if (due2 && !fx && gemini.key) { const pg = fb.pages.find((x) => x.id === fk); if (pg) fx = await makeFiller(pg).catch((e) => { log(`⚠ Gemini เขียนโพสต์คั่นไม่ได้: ${e.message || e}`, 'warn'); return null; }); } // ยังไม่มีที่เตรียมไว้ → เขียนตอนนี้
        if (fx) { // ถึงรอบโพสต์คั่นของเพจนี้
          sinceFill.set(fk, 0);
          if (await postFiller(fx)) { lastAt.set(fk, Date.now()); if (fbBlocked) { blocked = fbBlocked; fbBulk.stop = true; } else await waitUntil(Date.now() + (+st.fbGap || 15) * 60000); }
          continue;
        }
        left.splice(left.indexOf(next), 1);
        const key = pageKey(next);
        await fbPublish(next);
        if ((next.fbPosts || []).length) { ok++; lastAt.set(key, Date.now()); sinceFill.set(key, (sinceFill.get(key) || 0) + 1); }
        if (fbBlocked) { blocked = fbBlocked; fbBulk.stop = true; } // โดนบล็อก → ไม่โพสต์ต่อ (โพสต์ต่อ = โดนหนักขึ้น)
        fbBulk.done++;
        if (left.length && !fbBulk.stop) await waitUntil(Date.now() + (+st.fbGap || 15) * 60000); // เว้นระยะก่อนโพสต์ตัวถัดไป (คนละเพจ)
      }
    } finally {
      const stopped = fbBulk.stop;
      Object.assign(fbBulk, { on: false, stop: false, nextAt: 0 });
      renderPostLists();
      const why = blocked ? `หยุดเพราะเพจ “${blocked}” โดน ${FB_BLOCK_TIP} · ` : stopped ? 'หยุดแล้ว · ' : '';
      msg(`${why}โพสต์ทั้งหมด: สำเร็จ ${ok}/${fbBulk.total} ตัว`, ok && !blocked ? 'ok' : 'err');
      log(`📘 โพสต์ทั้งหมด${blocked ? ` (หยุด: เพจ “${blocked}” โดนบล็อกชั่วคราว)` : stopped ? ' (หยุดกลางทาง)' : ''}: สำเร็จ ${ok}/${fbBulk.total}`, ok && !blocked ? 'ok' : 'warn');
    }
  }
  async function fbPublish(p) {
    const assigned = fbPageOf(p); // เพจที่กำหนดตอนทำคลิป (หน้าพรีเซนเตอร์ตรงกับเพจ)
    const page = assigned || freePage(p); // สินค้าเก่าที่ยังไม่มีเพจ → สลับเพจตอนโพสต์แบบเดิม (🧬 เวอร์ชัน = เพจที่เวอร์ชันอื่นไม่ได้ลง)
    if (!page) { msg('ยังไม่ได้เลือกเพจ — แท็บ 📘 เพจ FB', 'err'); return; }
    if (!p.link) { msg('สินค้านี้ยังไม่มีลิงก์ affiliate — โพสต์ไปก็ไม่ได้ค่าคอม · กด 🔗 เอาลิงก์ก่อน', 'err'); return; }
    if (fbBusy.has(p.id)) return;
    fbBusy.add(p.id); renderProducts();
    const name = (p.name || '').slice(0, 30);
    try {
      msg(`📘 กำลังเตรียมคลิป/รูปของ “${name}”...`, '');
      const { photos, video } = await fbMediaFor(p);
      const link = p.link; // ลิงก์ affiliate (ไม่มี = ไม่ให้โพสต์ ด้านบน)
      const tags = (p.tags && p.tags.length ? p.tags : ['#รีวิว', '#ของดีบอกต่อ']).join(' ');
      const body = [(p.caption || promptName(p.name) || p.name || '').trim(), aiLine(), '', tags].filter((x, k) => x || k === 2).join('\n').trim(); // แคปชัน · 🤖 บอกว่าใช้ AI · แฮชแท็ก
      const comment = st.fbComment && link ? cartCommentFor(p, link) : '';
      const message = comment || !link ? body : `${body}\n\n${cartComment(link)}`;
      const wantPhotos = false, wantReel = true; // ผู้ใช้เอาโพสต์รูป 4 ภาพออก → Reel + คอมเมนต์ลิงก์ + รูปในคอมเมนต์
      const done = [], fails = [], missed = []; // missed = โพสต์ขึ้นแล้วแต่คอมเมนต์ลิงก์ไม่ติด → กด 🛒 ปักตะกร้าใหม่ได้ (ไม่ต้องโพสต์ซ้ำ)
      let photosPosted = false, photoPost = '';
      const run1 = async (label, ok, req) => {
        if (!ok) { fails.push(label === 'รูป' ? `รูป: ไม่มีรูปโพสต์ของตัวนี้ (ตอนทำคลิปปิด 📷 รูป Facebook 4 ภาพไว้ / meta.ai ไม่ได้ทำรูป / รีเฟรชหน้าแล้วรูปในหน่วยความจำหาย)` : `${label}: ไม่มีไฟล์คลิปในส่วนเสริมแล้ว (ลิงก์คลิปของ meta.ai หมดอายุ/แชตถูกลบ) — กด 🎬 ลง Reel → 📁 เลือกไฟล์ .mp4 จากโฟลเดอร์ ShopeeVideo`); return; }
        msg(`📘 กำลังโพสต์${label}ลงเพจ “${page.name}”...`, '');
        const r = await bg({ ...req, pageId: page.id, token: page.token, comment });
        if (!r.ok) { fails.push(`${label}: ${r.error}${fbHint(r.error) || fbHint422(r.error)}`); if (FB_BLOCK_RE.test(r.error || '')) fbBlocked = page.name; return; }
        if (req.type === 'fbPhotos') { photosPosted = true; photoPost = r.postId || ''; }
        const miss = missOf(r, label, comment);
        if (miss) missed.push(miss);
        if (r.photosWanted && r.photosCommented === r.photosWanted) photosPosted = true; // รูปในคอมเมนต์ติดครบ = ใช้รูปแล้ว (ลบไฟล์รูปในเครื่องตามตัวเลือก)
        if (comment && !r.commented && FB_BLOCK_RE.test(r.commentError || '')) fbBlocked = page.name;
        done.push(`${label}${comment ? (r.commented ? ' + ปักตะกร้า ✓' : ` (คอมเมนต์ไม่ได้: ${r.commentError || '-'} — ${FB_BLOCK_RE.test(r.commentError || '') ? `${FB_BLOCK_TIP} (อย่าเพิ่งกดปักตะกร้าซ้ำ)` : noCmtPerm(r.commentError) ? CMT_PERM : 'กด 🛒 ปักตะกร้าใหม่'})`) : ''}${picNote(r)}`);
      };
      const skipPhotos = wantPhotos && !photos.length && wantReel && !!video;
      if (wantPhotos && !skipPhotos) await run1('รูป', photos.length, { type: 'fbPhotos', photos, message });
      if (wantReel) await run1('Reel', !!video, { type: 'fbReel', video, description: reelText(body, link, comment), cmtPhotos: reelPics(photos), aiGenerated: st.fbAiFlag !== false });
      if (skipPhotos && done.length) done.push('ข้ามรูป (ไม่มีรูปโพสต์ของตัวนี้ — โพสต์ Reel อย่างเดียว)'); // ไม่นับว่าพลาด
      if (done.length) {
        const reelMissing = wantReel && !done.some((d) => d.startsWith('Reel')); // รูปขึ้นแต่ Reel ไม่ขึ้น → ปุ่ม 🎬 ลง Reel (ไม่โพสต์รูปซ้ำ)
        p.fbPosts = [...(p.fbPosts || []), { page: page.name, pageId: page.id, at: Date.now(), what: done.join(' · '), missed, ...(photoPost ? { photoPost } : {}), ...(reelMissing ? { reelMissing } : {}) }];
        histMark(p, 'fb', page.name);
        if (!assigned) { fb.next = (fb.next || 0) + 1; p.fbPageId = page.id; saveFb(); } // สินค้าตัวถัดไปลงเพจถัดไป
        save();
        fbRelease(p); // ลบสำเนาคลิป/รูปใน Chrome (เก็บรูปไว้ถ้ายังรอปักตะกร้าใหม่)
        log(`📘 ${name}: โพสต์ลงเพจ “${page.name}” — ${done.join(' · ')}${fails.length ? ` · ไม่ได้: ${fails.join(' · ')}` : ''}`, fails.length ? 'warn' : 'ok');
        // โพสต์รูปลงเพจสำเร็จ → ลบไฟล์รูปโพสต์ในเครื่อง (ประหยัดพื้นที่ · โพสต์ซ้ำยังใช้รูปจาก meta.ai ได้ · คลิป/.txt ไม่ลบ)
        if (photosPosted && st.fbDelPhotos !== false && (p.photoFiles || []).length) {
          const rm = await bg({ type: 'removeFiles', ids: p.photoFiles });
          if (rm.ok) { p.photoFiles = []; save(); log(`🗑 ${name}: ลบไฟล์รูปโพสต์ในเครื่องแล้ว ${rm.removed} ไฟล์${rm.errors && rm.errors.length ? ` (ลบไม่ได้ ${rm.errors.length}: ${rm.errors[0]})` : ''}`, 'ok'); }
          else log(`⚠ ${name}: ลบไฟล์รูปในเครื่องไม่ได้ (${rm.error})`, 'warn');
        }
      } else log(`❌ ${name}: โพสต์ Facebook ไม่ได้ — ${fails.join(' · ')}`, 'err');
      msg(done.length ? `โพสต์ลงเพจ “${page.name}” แล้ว ✓ ${done.join(' · ')}${fails.length ? ` · ไม่ได้: ${fails.join(' · ')}` : ''}` : `โพสต์ไม่ได้: ${fails.join(' · ')}`, done.length && !fails.length ? 'ok' : 'err');
    } catch (e) {
      msg(`โพสต์ Facebook ไม่ได้: ${e.message || e}`, 'err');
    } finally {
      fbBusy.delete(p.id); renderAll();
      autoClear(); // ลงครบ 2 ที่แล้ว → เอาออกจากคิว
    }
  }
  let fbOffOpen = false; // กางรายการเพจที่ไม่ใช้ค้างไว้
  const fbExp = (t) => { const d = new Date(t * 1000); return `${d.getDate()}/${d.getMonth() + 1}`; };
  function tokenWarn(r) { // หลังดึงรายชื่อเพจ: token ยังไม่ได้ Extend (อายุไม่ถึง 2 วัน) / ไม่มีสิทธิ์คอมเมนต์
    const out = [];
    const left = r.expiresAt > 0 ? r.expiresAt * 1000 - Date.now() : Infinity;
    if (left < 2 * 86400000) out.push(`⚠ token นี้ใช้ได้อีกแค่ ~${Math.max(1, Math.round(left / 3600000))} ชม. (ยังไม่ได้ Extend) — Access Token Debugger → Extend Access Token → คัดลอก token ตัวใหม่ที่ขึ้นมา → วางแทน → ดึงรายชื่อเพจอีกครั้ง`);
    if (r.scopes && !r.scopes.includes('pages_manage_engagement')) out.push('⚠ token ไม่มีสิทธิ์คอมเมนต์ (pages_manage_engagement) — โพสต์ได้แต่ปักตะกร้าไม่ได้');
    return out.join(' · ');
  }
  function renderFb() {
    const on = fbPagesOn(), next = fbNextPage();
    const exp = fb.expiresAt > 0 ? (fb.expiresAt * 1000 < Date.now() ? ' · ⚠ token หมดอายุแล้ว' : fb.expiresAt * 1000 - Date.now() < 3 * 86400000 ? ` · ⚠ token หมด ${fbExp(fb.expiresAt)} ขอใหม่ได้แล้ว` : ` · token ใช้ได้ถึง ${fbExp(fb.expiresAt)}`) : '';
    $('fbState').textContent = fb.pages.length ? `เลือก ${on.length}/${fb.pages.length} เพจ${next ? ` · ตัวถัดไปลง “${next.name}”` : ''}${exp}` : 'ยังไม่ได้เชื่อม';
    $('fbComment').checked = st.fbComment !== false;
    $('fbReelLink').checked = st.fbReelLink !== false;
    $('autoClear').checked = st.autoClear !== false;
    $('fbPhotoHint').hidden = true; // รูปทำตามจำนวนรูปในคอมเมนต์เอง ไม่มีติ๊กแยกแล้ว
    $('fbDelPhotos').checked = st.fbDelPhotos !== false;
    $('aiLabel').checked = !!st.aiLabel;
    $('fbAiFlag').checked = st.fbAiFlag !== false;
    // แถวละเพจ: ปุ่มเปิด/ปิดเพจ + พรีเซนเตอร์ประจำเพจ (หน้าในคลิป/รูปของสินค้าที่ลงเพจนี้)
    const rowOf = (pg) => {
      const row = el('div', 'fbrow');
      const b = el('button', pg.on ? 'on' : '', `${pg.on && next && pg.id === next.id ? '👉 ' : ''}${pg.name}`);
      b.title = pg.on ? 'กดเพื่อไม่ใช้เพจนี้' : 'กดเพื่อใช้เพจนี้';
      b.onclick = () => { pg.on = !pg.on; saveFb(); renderAll(); };
      const sel = el('select');
      sel.title = 'พรีเซนเตอร์ประจำเพจนี้';
      for (const [v, t] of [['', 'หน้า: ตามที่เลือกในตั้งค่า'], ['none', 'หน้า: ไม่ใช้รูปหน้า'], ...presenters.map((x) => [x.id, `หน้า: ${x.name || 'ไม่มีชื่อ'}`])]) {
        const o = el('option', '', t); o.value = v; sel.append(o);
      }
      sel.value = pg.presenterId && (pg.presenterId === 'none' || presenters.some((x) => x.id === pg.presenterId)) ? pg.presenterId : '';
      sel.disabled = !pg.on;
      sel.onchange = () => { pg.presenterId = sel.value; saveFb(); };
      const ni = el('input', 'pgniche'); ni.type = 'text'; ni.value = pg.niche || ''; ni.placeholder = 'แนวเพจ เช่น ของใช้ในบ้าน ครัว'; ni.dataset.id = pg.id;
      ni.title = 'แนวของเพจนี้ — ใช้คิดโพสต์คั่น (🧩) ให้ตรงแนว · ว่าง = เดาจากชื่อเพจ';
      ni.oninput = () => { pg.niche = ni.value; saveFb(); };
      row.append(b, ...(pg.on ? [sel, ni] : [])); // เพจที่ไม่ใช้ = แค่ชื่อ (เลือกหน้าตอนเปิดใช้)
      return row;
    };
    // เพจที่ใช้อยู่ขึ้นก่อน · เพจที่ไม่ใช้พับเก็บ (token แบบ "ทุกเพจ" ดึงมาทุกเพจที่บัญชีดูแล) · ยังไม่ได้เลือกสักเพจ = กางให้เลือก
    const used = fb.pages.filter((pg) => pg.on), unused = fb.pages.filter((pg) => !pg.on), items = used.map(rowOf);
    if (used.length > 1) {
      const off = el('button', 'pill', 'ไม่ใช้ทุกเพจ');
      off.title = 'ปิดทุกเพจ แล้วค่อยกดเลือกเฉพาะเพจที่จะใช้';
      off.onclick = () => { fb.pages.forEach((pg) => { pg.on = false; }); fbOffOpen = true; saveFb(); renderAll(); };
      items.push(off);
    }
    if (unused.length) {
      const d = el('details', 'adv');
      d.open = fbOffOpen || !used.length;
      d.addEventListener('toggle', () => { fbOffOpen = d.open; });
      d.append(el('summary', '', `เพจที่ไม่ใช้ (${unused.length}) — กดชื่อเพจเพื่อเปิดใช้`), ...unused.map(rowOf));
      items.push(d);
    }
    const typing = root.activeElement && root.activeElement.classList && root.activeElement.classList.contains('pgniche');
    if (!typing) $('fbPages').replaceChildren(...(fb.pages.length ? items : [el('div', 'empty', 'ยังไม่มีเพจ — ใส่ User Token ด้านล่างแล้วกด “ดึงรายชื่อเพจ”')]));
  }

  function renderRun() {
    const left = todo().length;
    // ความคืบหน้ารอบนี้: เสร็จ/พลาดแล้วกี่ตัว จากที่อยู่ในรอบ (ตัวที่ลบออกไม่นับ)
    const ids = Object.keys(run.status).filter((id) => run.status[id] && products.some((p) => p.id === id));
    const fin = ids.filter((id) => /เสร็จ|ผิดพลาด/.test(run.status[id])).length;
    $('prog').hidden = !run.on || !ids.length;
    $('prog').firstElementChild.style.width = `${ids.length ? Math.round((fin / ids.length) * 100) : 0}%`;
    $('fab').textContent = `🎬 Shopee Video${left ? ` · ${left}` : ''}`;
    const metaWriting = !run.on && fill.on && !gemini.key; // meta.ai กำลังเขียนโพสต์คั่นในแชต (แท็บ 📘)
    const go = el('button', 'run', metaWriting ? '⏳ รอ meta.ai เขียนข้อความให้เสร็จก่อน...' : run.on ? `⏳ กำลังรันคิว ${fin}/${ids.length}` : `▶ รันคิวอัตโนมัติ (${left} สินค้า)`);
    go.disabled = run.on || !left || writer.on || metaWriting; // Gemini เขียนเบื้องหลัง = ไม่ต้องรอ
    go.title = metaWriting ? 'meta.ai กำลังเขียนโพสต์คั่น (แท็บ 📘) — รอสักครู่' : 'ใส่ prompt + รูป → กดส่ง → รอคลิป → ดาวน์โหลด ทีละสินค้า จนหมดคิว';
    go.onclick = () => runQueue();
    const items = [go];
    if (run.resume) {
      const cancel = el('button', 'stop', '⏹ ยกเลิกการทำต่อ');
      cancel.onclick = () => { run.resume = false; setRunFlag(false); log('ยกเลิกการทำต่อแล้ว', 'warn'); renderRun(); };
      items.push(cancel);
    }
    if (run.on) {
      const stop = el('button', 'stop', run.stop ? 'กำลังหยุด...' : '⏹ หยุด');
      stop.onclick = () => { run.stop = true; renderRun(); };
      items.push(stop);
    }
    const diag = el('button', 'stop subtle icon', '🔍'); diag.dataset.lb = 'ตรวจหน้า';
    diag.title = 'คัดลอกข้อมูลหน้าเว็บ meta.ai (ชื่อ/ตำแหน่งปุ่ม จำนวนวิดีโอ — ไม่มีข้อความแชต) ไว้ส่งให้ผู้พัฒนาปรับตัวจับปุ่ม';
    diag.onclick = () => copy(pageDiag(), 'คัดลอกข้อมูลหน้าเว็บแล้ว ✓ วางส่งในแชตได้เลย');
    const restore = el('button', 'stop subtle icon', '📥'); restore.dataset.lb = 'กู้คืน';
    restore.title = 'กู้รายการสินค้าจากไฟล์สำรอง (.json) — เพิ่มตัวที่ยังไม่มี ไม่ลบของที่มีอยู่';
    restore.onclick = () => pickRestore();
    const folder = el('button', 'stop subtle icon', '📂'); folder.dataset.lb = 'โฟลเดอร์';
    folder.title = 'เปิดโฟลเดอร์ที่เก็บคลิป (Downloads/ShopeeVideo)';
    folder.onclick = () => { try { chrome.runtime.sendMessage({ type: 'showFolder' }, () => {}); } catch (e) { msg('เปิดโฟลเดอร์ไม่ได้ — ดูที่ Downloads/ShopeeVideo', 'err'); } };
    items.push(folder, restore, diag);
    $('runrow').replaceChildren(...items);
    $('tabQueue').textContent = `📋 คิวสินค้า (${left})`;
    const box = $('runlog');
    box.hidden = !run.log.length;
    box.replaceChildren(...run.log.map((l) => el('div', l.cls, l.text)));
    box.scrollTop = box.scrollHeight;
  }

  function renderPresets() {
    let onDesc = '';
    $('presets').replaceChildren(...PRESETS.map((pr) => {
      const on = Object.entries(pr.set).every(([k, v]) => JSON.stringify(st[k]) === JSON.stringify(v)); // vfx เป็น array
      if (on) onDesc = `${pr.label}: ${pr.desc || ''}`;
      const b = el('button', on ? 'on' : '', pr.label);
      b.title = pr.desc || ''; // ชื่อสั้น · คำอธิบายเต็มตอนชี้
      b.onclick = () => {
        Object.assign(st, pr.set);
        $('scene').value = st.scene;
        $('sceneWarn').textContent = checkText(st.scene).join(' · ');
        save(); renderAll(); msg(`ตั้งค่าแนว “${pr.label}” แล้ว ✓`, 'ok');
      };
      return b;
    }));
    $('presetDesc').textContent = onDesc || 'ตั้งค่าเองอยู่ (ไม่ตรงแนวไหน) — กดแนวด้านบนเพื่อตั้งทีเดียว'; // แนวที่เลือกอยู่ทำอะไร
  }

  function renderAll() { renderPresets(); renderProducts(); renderChips(); renderPeople(); renderSearch(); renderHist(); renderFb(); renderFill(); renderSv(); renderRun(); }

  (async () => {
    const r = await store.load(['mahHistory', 'mah3', 'mah3Face', 'mah3Products', 'mah6Presenters', 'mahGemini', 'mahStats', 'mahRun', 'mahSeenClips', 'mahCleanCount', 'mahHookIdx', 'mahBadButtons', 'mahBadV', 'mahShopeeApi', 'mahFb', 'mahShopReq', 'mahLog']);
    if (!r) { // อ่านไม่สำเร็จ → ไม่ทำอะไรต่อ ไม่บันทึกทับ (ของเดิมยังอยู่ในเครื่อง)
      msg('⚠ อ่านรายการในเครื่องไม่สำเร็จ — กด F5 รีเฟรชหน้า (ยังไม่บันทึกอะไรทับ รายการเดิมยังอยู่)', 'err');
      log('⚠ อ่านรายการสินค้า/ตั้งค่าในเครื่องไม่สำเร็จ — ไม่บันทึกทับ · กด F5 รีเฟรชหน้า', 'err');
      return;
    }
    fb = { ...fb, ...(r.mahFb || {}) };
    if (fb.groups || fb.gPosts || fb.gLog) { delete fb.groups; delete fb.gPosts; delete fb.gLog; saveFb(); } // ข้อมูลแท็บ 👥 กลุ่ม (เอาออกแล้ว — แชร์จากแอปมือถือเอง)
    $('fbToken').value = fb.userToken || '';
    spCreds = { appId: '', secret: '', ...(r.mahShopeeApi || {}) };
    $('spApp').value = spCreds.appId;
    $('spSecret').value = spCreds.secret;
    badButtons = new Set(r.mahBadV === 2 ? r.mahBadButtons || [] : []); // ล้างครั้งเดียว: ความจำเก่าอาจมีปุ่มส่งจริงอยู่
    if (r.mahBadV !== 2) store.set({ mahBadButtons: [], mahBadV: 2 });
    hookIdx = +r.mahHookIdx || 0;
    seenClips = new Set(r.mahSeenClips || []);
    if (Array.isArray(r.mahLog) && !run.log.length) { run.log = r.mahLog.slice(-200); renderRun(); } // บันทึกรอบก่อน (หน้าโหลดใหม่แล้วไม่หาย)
    if (r.mahStats && r.mahStats.day === today()) stats = { ...stats, ...r.mahStats };
    gemini = { ...gemini, ...(r.mahGemini || {}) };
    $('gKey').value = gemini.key || '';
    if (gemini.model === 'gemini-flash-latest') gemini.model = ''; // ค่าเริ่มต้นเดิม → อัตโนมัติ
    $('gModel').value = gemini.model || '';
    st = { ...DEFAULTS, ...(r.mah3 || {}) };
    if (!st.lines || typeof st.lines !== 'object') st.lines = {};
    if (!Array.isArray(st.vfx) || !st.vfx.length) st.vfx = ['auto'];
    if (st.cleanup === 'off') { st.cleanOn = false; delete st.cleanup; } else if (st.cleanup) delete st.cleanup; // ตั้งค่าเดิม v0.20
    if (!st.gap15) { if (st.gap === '5') st.gap = '15'; st.gap15 = true; } // ค่าเริ่มต้นเดิม 5 วิ → 15 วิ (ครั้งเดียว)
    if (st.scriptMode === 'ai' && !gemini.key) st.scriptMode = 'meta'; // เดิมค่าเริ่มต้นเป็น Gemini แต่ยังไม่ได้ใส่ key → ให้ meta.ai คิดบท
    cleanCount = +r.mahCleanCount || 0;
    products = (r.mah3Products || []).map((p) => ({ ...newProduct(), ...p }));
    let migrated = false;
    if (!st.noGemScript) { // เอา “✨ Gemini เขียนก่อน” ออกแล้ว
      if (st.scriptMode === 'ai') st.scriptMode = 'meta';
      products.forEach((p) => { if (p.scriptBy !== 'user') { p.script = ''; delete p.scriptBy; delete p.scriptFor; delete p.scriptError; } });
      st.noGemScript = true; migrated = true; // บันทึกหลังโหลดพรีเซนเตอร์แล้ว (เดิมบันทึกตรงนี้ = พรีเซนเตอร์ว่างทับ)
    }
    history = r.mahHistory || {};
    indexHist();
    if (!r.mahHistory) { // ครั้งแรก: เก็บตัวที่ทำเสร็จในคิวตอนนี้เข้าประวัติ
      for (const p of products.filter((x) => x.done)) {
        histMark(p, 'made');
        (p.fbPosts || []).forEach((x) => histMark(p, 'fb', x.page));
      }
    }
    presenters = r.mah6Presenters || [];
    loaded = true; // ข้อมูลครบแล้ว — บันทึกได้
    const rq = r.mahShopReq; // กด 🏪 บนหน้าสินค้า Shopee ก่อนเปิดหน้านี้ (ไม่เกิน 2 นาที) → ดึงร้านให้เลย
    if (rq && Date.now() - (rq.at || 0) < 120000) setTimeout(() => { panel.hidden = false; $('fab').hidden = true; pullShopOf({ shopId: rq.id, productUrl: rq.url }); store.set({ mahShopReq: null }); }, 300);
    if (migrated) save();
    if (!r.mah6Presenters && r.mah3Face) { // ย้ายรูปหน้าจาก v0.5 เป็นพรีเซนเตอร์คนแรก
      presenters = [{ id: uid(), name: 'พรีเซนเตอร์ 1', desc: '', image: r.mah3Face }];
      st.presenterId = presenters[0].id;
      save();
    }
    // (ต้องอยู่หลังโหลดสินค้า/พรีเซนเตอร์ ไม่งั้น save() จะเขียนคิวว่างทับ)
    const old = OLD_PRESET_SCENES.findIndex((list) => list.includes(st.scene)); // เคยกดแนวรุ่นเก่า → ใช้ค่าแนวรุ่นใหม่
    if (old >= 0) { Object.assign(st, PRESETS[old].set); save(); }
    const ugcSet = PRESETS.find((pr) => pr.set.style === 'ugc').set; // เคยกดแนว 🤳 UGC รุ่นก่อน (เสียงเป็นกันเอง) → เสียงป้ายยา (ครั้งเดียว · เลือกเองทีหลังได้)
    if (!st.spBest) { if (st.spSort === '1') st.spSort = '2'; st.spBest = true; save(); }
    if (!st.chat1) { if (st.newChat === '10') st.newChat = '1'; st.chat1 = true; save(); } // ค่าเริ่มต้นเดิม (ทุก 10) → ทุกคลิป: แชตเดียวหลายสินค้า meta.ai หยิบรูปสินค้าเก่ามาปน
    if (!st.ugcHype) { if (Object.entries(ugcSet).every(([k, v]) => (k === 'tone' ? st.tone === 'casual' : JSON.stringify(st[k]) === JSON.stringify(v)))) st.tone = 'hype'; st.ugcHype = true; save(); }
    // ผู้ใช้สั่ง: 15 วิ + 5 วิท้ายโชว์สินค้าเป็นค่าเริ่มต้น (meta ทำได้ทีละ 10 วิ → 20 วิ เสียงท่อน 2 เพี้ยน · พูดท่อนเดียว = เสียงเดียว) — ปรับครั้งเดียว เลือก 10/20 เองได้
    if (st.fbPost !== 'reel') { st.fbPost = 'reel'; save(); } // ผู้ใช้เอาโพสต์รูป 4 ภาพออก → Reel เสมอ
    if (!st.outro15) { st.duration = '15'; st.outro = true; st.outro15 = true; save(); }
    if (!st.ugcDefault) { Object.assign(st, ugcSet); st.ugcDefault = true; save(); } // ผู้ใช้สั่ง: แนว UGC พูดแบบแม่ค้าเป็นค่าหลัก — ปรับตั้งค่าเดิมครั้งเดียว (ความยาว/พรีเซนเตอร์/รูป/แคปชันไม่แตะ)
    $('scene').value = st.scene || '';
    $('sceneWarn').textContent = checkText(st.scene).join(' · ');
    $('osText').value = st.osText || '';
    $('osWarn').textContent = checkText(st.osText).join(' · ');
    applyTheme(); // ธีมที่เลือกไว้
    applyFolds(); // หมวดตั้งค่าที่กาง/พับไว้
    applyPanelW(); // ความกว้างแผงที่ลากไว้
    $('sameLine').value = st.lines[1] || '';
    $('sameWarn').textContent = checkText(st.lines[1]).join(' · ');
    renderAll();
    if (r.mahRun && r.mahRun.on && Date.now() - r.mahRun.at < 30 * 60000 && todo().length) scheduleResume(r.mahRun);
    setTimeout(mediaGc, 5000); // ล้างคลิป/รูปที่เก็บไว้ของสินค้าที่ไม่อยู่ในคิวแล้ว
    slimAll(); // ตัวที่ทำเสร็จ: เก็บแค่รูปย่อ (รายการเบา โหลดขึ้นแน่นอน)
  })();
  // สินค้าที่เพิ่มจากแท็บ Shopee โผล่ทันที
  try {
    chrome.storage.onChanged.addListener((ch) => {
      const rq = ch.mahShopReq && ch.mahShopReq.newValue; // ปุ่ม 🏪 บนหน้าสินค้า Shopee
      if (rq && Date.now() - (rq.at || 0) < 120000 && loaded) {
        if (panel.hidden) { panel.hidden = false; $('fab').hidden = true; }
        pullShopOf({ shopId: rq.id, productUrl: rq.url });
        store.set({ mahShopReq: null }); // ใช้แล้ว (แท็บ meta.ai อื่นไม่ต้องดึงซ้ำตอนเปิดใหม่)
      }
      if (!ch.mah3Products) return;
      const nv = ch.mah3Products.newValue || [];
      if (mySaves.includes(JSON.stringify(nv))) return;
      // ของจากแท็บ Affiliate (＋ คิวคลิป / เก็บลิงก์): สินค้าใหม่ = เพิ่ม · ตัวเดิม = เติมเฉพาะช่องที่ยังว่าง (ลิงก์/รูป/ราคา/รายละเอียด)
      // ไม่ทับค่าที่แผงนี้แก้ไปแล้ว และไม่ลบสินค้าที่แผงนี้มี — สำเนาจากอีกแท็บอาจเก่ากว่า (เคยทำลิงก์/สินค้าที่เพิ่งเพิ่มหายตอนลงคิวทั้งหมด)
      const byId = new Map(products.map((p) => [p.id, p]));
      let changed = false;
      for (const p of nv) {
        const cur = byId.get(p.id);
        if (!cur) { products.push({ ...newProduct(), ...p }); changed = true; continue; }
        for (const k of ['link', 'productUrl', 'commission', 'price', 'desc']) if (p[k] && !cur[k]) { cur[k] = p[k]; changed = true; }
        if ((p.images || []).length > (cur.images || []).length) { cur.images = p.images; cur.imageUrls = p.imageUrls; changed = true; }
      }
      if (changed) { save(); renderAll(); }
    });
  } catch (e) {}

  const saveGemini = () => {
    gemini.key = $('gKey').value.trim();
    gemini.model = $('gModel').value.trim();
    store.set({ mahGemini: gemini });
  };
  $('gKey').oninput = () => { saveGemini(); modelCache = null; renderFill(); };
  $('gTestBtn').onclick = async () => {
    const b = $('gTestBtn');
    b.disabled = true; b.textContent = 'กำลังทดสอบ...';
    try { await testGemini(); } catch (e) { $('gTest').append(el('div', 'warn', String(e.message || e))); }
    b.disabled = false; b.textContent = '🔌 ทดสอบ key + รุ่น';
  };
  $('gModel').oninput = saveGemini;
  // 📁 โฟลเดอร์ของบัญชีนี้ใต้ Downloads/ShopeeVideo (ส่วนเสริมตัวเบื้องหลังใช้ตอนบันทึกไฟล์)
  const showSaveDir = () => bg({ type: 'saveDir' }).then((r) => { if (r.ok) { saveSub = r.dir || ''; renderSv(); } $('saveDirHint').textContent = !r.ok ? '' : r.dir ? `ไฟล์ของบัญชีนี้บันทึกที่ Downloads/ShopeeVideo/${r.dir}/ · จะโพสต์จากโปรแกรม Shopee Video ให้ตั้งโฟลเดอร์คลิปในโปรแกรมนั้นเป็นโฟลเดอร์นี้` : 'ไม่รู้อีเมลของ Chrome profile นี้ (ไม่ได้ล็อกอิน Google) — ไฟล์ลง Downloads/ShopeeVideo/ เหมือนเดิม · พิมพ์ชื่อโฟลเดอร์เองได้'; });
  let saveDirTimer = 0;
  $('saveDir').oninput = () => { store.set({ mahSaveDir: $('saveDir').value.trim() }); clearTimeout(saveDirTimer); saveDirTimer = setTimeout(showSaveDir, 400); };
  try { chrome.storage.local.get('mahSaveDir', (o) => { $('saveDir').value = (o && o.mahSaveDir) || ''; showSaveDir(); }); } catch (e) {}
  $('cleanOn').onchange = () => { st.cleanOn = $('cleanOn').checked; save(); renderAll(); };
  $('delOldChat').onchange = () => { st.delOldChat = $('delOldChat').checked; save(); };
  $('outro').onchange = () => { st.outro = $('outro').checked; save(); renderAll(); };
  $('osText').oninput = () => {
    st.osText = $('osText').value;
    $('osWarn').textContent = checkText(st.osText).join(' · ');
    save();
  };
  $('scene').oninput = () => {
    st.scene = $('scene').value;
    $('sceneWarn').textContent = checkText(st.scene).join(' · ');
    save();
  };
  $('fbToken').oninput = () => { fb.userToken = $('fbToken').value.trim(); saveFb(); };
  $('fbComment').onchange = () => { st.fbComment = $('fbComment').checked; save(); };
  $('fbReelLink').onchange = () => { st.fbReelLink = $('fbReelLink').checked; save(); };
  $('autoClear').onchange = () => { st.autoClear = $('autoClear').checked; save(); if (st.autoClear) autoClear(); };
  $('fbDelPhotos').onchange = () => { st.fbDelPhotos = $('fbDelPhotos').checked; save(); };
  $('aiLabel').onchange = () => { st.aiLabel = $('aiLabel').checked; save(); };
  $('fbAiFlag').onchange = () => { st.fbAiFlag = $('fbAiFlag').checked; save(); };
  $('fbAll').onclick = () => fbPostAll();
  $('fbSpread').onclick = () => { // เกลี่ยคลิปค้าง (ยังไม่โพสต์ FB) ให้ทุกเพจที่เปิดใช้ วนตามลำดับคิว
    clearTimeout(spreadTimer);
    if (!spreadArm) { spreadArm = true; spreadTimer = setTimeout(() => { spreadArm = false; renderPostLists(); }, 5000); renderPostLists(); return; }
    spreadArm = false;
    const on = fbPagesOn(), list = fbUnposted();
    if (on.length < 2 || !list.length || fbBulk.on) { renderPostLists(); return; }
    list.forEach((p) => { delete p.fbPageId; });
    let c = 0;
    for (const p of list) { // วนทีละเพจ · 🧬 เวอร์ชันของสินค้าเดียวกันข้ามเพจที่เวอร์ชันอื่นจอง/โพสต์แล้ว
      const used = verPages(p), k = on.findIndex((_, j) => !used.has(on[(c + j) % on.length].id)), at = (c + Math.max(0, k)) % on.length;
      p.fbPageId = on[at].id; c = at + 1;
    }
    save(); renderAll();
    const lo = Math.floor(list.length / on.length), hi = Math.ceil(list.length / on.length);
    msg(`🔀 แบ่งคลิปค้าง ${list.length} ตัวให้ ${on.length} เพจแล้ว (เพจละ ${lo === hi ? lo : `${lo}–${hi}`} ตัว) — กด 📘 โพสต์ทั้งหมด ได้เลย`, 'ok');
    log(`🔀 แบ่งคลิปค้าง ${list.length} ตัวให้ ${on.map((pg) => pg.name).join(', ')}`, 'ok');
  };
  $('fillMake').onclick = () => fillMakeAll();
  // ชื่อไฟล์คลิป = ชื่อสินค้า (safeName) · อาจมี -A / -B (2 แบบ) · " (1)" (ชื่อซ้ำ) → ตัดออกแล้วเทียบแบบไม่สนช่องว่าง/เครื่องหมาย
  const clipKey = (s) => String(s || '').replace(/\.(mp4|webm|mov|m4v)$/i, '').replace(/\s*\(\d+\)$/, '').replace(/-[AB]$/i, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
  $('fbFiles').onclick = () => $('fbFileIn').click();
  $('fbFileIn').onchange = async () => {
    const files = [...$('fbFileIn').files];
    $('fbFileIn').value = '';
    if (!files.length) return;
    const done = products.filter((p) => p.done), keyOf = new Map(done.map((p) => [p.id, clipKey(fileBase(p, safeName(p.name)).split('/').pop())])); // 🧬 เวอร์ชันเฉพาะ FB = ชื่อ-vN
    let ok = 0;
    const miss = [];
    msg(`📁 กำลังจับคู่ไฟล์คลิป ${files.length} ไฟล์...`, '');
    for (const file of files) {
      const k = clipKey(file.name);
      const p = okVideo(file) && k && (done.find((x) => keyOf.get(x.id) === k) || done.find((x) => { const kk = keyOf.get(x.id); return kk.length >= 12 && (k.startsWith(kk.slice(0, 40)) || kk.startsWith(k.slice(0, 40))); }));
      if (!p) { miss.push(file.name); continue; }
      mediaFor.set(p.id, { ...(mediaFor.get(p.id) || {}), video: { src: '', blob: file } });
      await mediaPut(`clip:${p.id}`, file);
      if (reelPick.has(p.id)) reelPick.delete(p.id);
      ok++;
    }
    renderPostLists();
    msg(`📁 ใส่ไฟล์คลิปให้สินค้า ${ok} ตัวแล้ว${miss.length ? ` · ไม่ตรงกับสินค้าในรายการ ${miss.length} ไฟล์ (${miss.slice(0, 3).join(', ')}${miss.length > 3 ? ' …' : ''})` : ''}${ok ? ' — กด 📘 โพสต์ทั้งหมด / 🎬 ลง Reel ได้เลย' : ''}`, ok ? 'ok' : 'err');
  };
  $('fbWipe').onclick = () => {
    clearTimeout(fbWipeTimer);
    if (!fbWipeArm) { fbWipeArm = true; fbWipeTimer = setTimeout(() => { fbWipeArm = false; renderPostLists(); }, 5000); renderPostLists(); return; }
    fbWipeArm = false;
    const gone = fbDoneAll();
    removeProducts(gone);
    msg(`ลบคลิปที่ทำเสร็จทั้งหมด ${gone.length} ตัวแล้ว ✓ (ไฟล์ในเครื่องยังอยู่ · สินค้าที่รอทำในคิวยังอยู่)`, 'ok');
  };
  $('fbClear').onclick = () => {
    clearTimeout(fbClearTimer);
    if (!fbClearArm) { fbClearArm = true; fbClearTimer = setTimeout(() => { fbClearArm = false; renderPostLists(); }, 5000); renderPostLists(); return; }
    fbClearArm = false;
    const gone = fbPostedDone();
    removeProducts(gone);
    msg(`เคลียร์ตัวที่โพสต์ลงเพจแล้ว ${gone.length} ตัว ✓ (คลิป/.txt ในเครื่องยังอยู่)`, 'ok');
  };
  $('svOpen').onclick = () => { if (svOn()) window.open(sv.url, 'shopeeVideoPoster'); };
  $('svRefresh').onclick = () => { sv = null; svSig = ''; renderSv(); svCheck(); };
  svCheck(); // ตัวเลขคลิปรอโพสต์บนแท็บ
  setInterval(() => { if ((!panel.hidden && !$('tab-sv').hidden) || Date.now() - svAt > 60000) svCheck(); }, 5000); // ทุก 1 นาทีแม้แผงปิด — จับคลิปที่ลง Shopee แล้วก่อนไฟล์ถูกลบ // เปิดแท็บ 🛍 อยู่ = ทุก 5 วิ · ไม่งั้นนาทีละครั้ง
  $('fbLoad').onclick = async () => {
    const b = $('fbLoad');
    b.disabled = true; b.textContent = 'กำลังดึง...';
    const r = await bg({ type: 'fbPages', userToken: fb.userToken });
    b.disabled = false; b.textContent = 'ดึงรายชื่อเพจ';
    if (!r.ok) { msg(`ดึงรายชื่อเพจไม่ได้: ${r.error}${/190|expired|session/i.test(r.error) ? ' — token หมดอายุ สร้างใหม่แล้ววางอีกครั้ง' : ''}`, 'err'); return; }
    const old = new Map(fb.pages.map((x) => [x.id, x]));
    // เพจเดิมคงการเลือก + พรีเซนเตอร์ประจำเพจไว้ (ดึงใหม่ตอน token หมดอายุ ไม่ให้ตั้งค่าหาย)
    // เพจใหม่: ดึงครั้งแรก = เลือกไว้ทุกเพจ · เคยตั้งเพจไว้แล้ว = ยังไม่เลือก (token "ทุกเพจ" ดึงเพจที่ไม่ได้ใช้มาด้วย)
    const first = !old.size, fresh = r.pages.filter((x) => !old.has(x.id));
    fb.pages = r.pages.map((x) => (old.has(x.id) ? { ...x, on: old.get(x.id).on, presenterId: old.get(x.id).presenterId || '' } : { ...x, on: first }));
    if (!first && fresh.length) fbOffOpen = true;
    fb.expiresAt = r.expiresAt == null ? fb.expiresAt : r.expiresAt;
    saveFb(); renderAll();
    const tw = tokenWarn(r);
    if (tw && r.pages.length) { msg(`ได้ ${r.pages.length} เพจ — ${tw}`, 'err'); return; }
    msg(!r.pages.length ? 'token นี้ไม่มีเพจที่จัดการได้ — เช็กสิทธิ์ pages_show_list'
      : first ? `ได้ ${r.pages.length} เพจ ✓ เลือกไว้ทุกเพจ — ไม่ใช้เพจไหนกดชื่อเพจนั้น (หรือ “ไม่ใช้ทุกเพจ” แล้วเลือกเอง)`
      : `ได้ ${r.pages.length} เพจ ✓${fresh.length ? ` · เพจใหม่ ${fresh.length} เพจยังไม่ได้เลือก (${fresh.map((x) => x.name).slice(0, 5).join(', ')}${fresh.length > 5 ? ' …' : ''}) — กดชื่อเพจเพื่อใช้` : ''}`, r.pages.length ? 'ok' : 'err');
  };
  $('presDesc').oninput = () => { const sel = presenter(); if (sel) { sel.desc = $('presDesc').value; save(); } };
  const saveSp = () => { spCreds = { appId: $('spApp').value.trim(), secret: $('spSecret').value.trim() }; store.set({ mahShopeeApi: spCreds }); renderSearch(); };
  $('spApp').oninput = saveSp;
  $('spSecret').oninput = saveSp;
  const spGo = () => (/shopee\.co\.th\/|shp\.ee\//i.test($('spKw').value) ? shopPull() : spSearch(false)); // วางลิงก์ร้าน/สินค้า = ดึงทั้งร้าน
  $('spGo').onclick = spGo;
  $('spShop').onclick = () => shopPull();
  root.querySelectorAll('.chips.scroll').forEach((x) => x.addEventListener('wheel', (e) => { // ลูกกลิ้งเมาส์ = เลื่อนแถวซ้าย-ขวา
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX) && x.scrollWidth > x.clientWidth) { x.scrollLeft += e.deltaY; e.preventDefault(); }
  }, { passive: false }));
  $('spKw').onkeydown = (e) => { if (e.key === 'Enter') spGo(); };
  $('spMore').onclick = () => spSearch(true);
  $('spAll').onclick = () => addAllFromSearch();
  $('spHideMade').onchange = () => { st.spHideMade = $('spHideMade').checked; save(); renderSearch(); };
  $('spSold').onchange = () => { // กรองจากที่โหลดแล้ว · เหลือน้อย = โหลดหน้าถัดไปให้ (ทั้งร้านไม่โหลดเอง)
    st.spSold = $('spSold').checked; save();
    if (st.spSold && spActive() && !sp.shop && !sp.busy && sp.more && spShown().length < 10) spSearch(true);
    else renderSearch();
  };
  $('histBox').addEventListener('toggle', renderHist);
  $('histFind').oninput = renderHist;
  $('histClear').onclick = () => {
    clearTimeout(histTimer);
    if (!histArm) { histArm = true; histTimer = setTimeout(() => { histArm = false; renderHist(); }, 5000); renderHist(); return; }
    histArm = false;
    const n = Object.keys(history).length;
    history = {};
    saveHist(); renderHist(); renderSearch();
    msg(`ล้างประวัติแล้ว ${n} ตัว ✓ (ป้าย “เคยทำ” ในผลค้นหาหายหมด · คิวและไฟล์ในเครื่องไม่เกี่ยว)`, 'ok');
  };
  $('spXtra').onchange = () => {
    st.spXtra = $('spXtra').checked; save();
    if (spActive() && sp.api && !sp.shop) spSearch(false, spPick()); // Open API กรองที่ต้นทาง → ค้นใหม่ (ทั้งร้านไม่กรอง Extra = ไม่ต้องโหลดใหม่)
    else if (spActive() && !sp.shop && st.spXtra && sp.more && spShown().length < 10) spSearch(true); // หน้าเว็บ: กรองจากที่โหลดแล้ว ได้น้อยก็โหลดเพิ่มให้
    else renderSearch();
  };
  $('sameLine').oninput = () => {
    st.lines[1] = $('sameLine').value;
    $('sameWarn').textContent = checkText(st.lines[1]).join(' · ');
    save();
  };
  for (const t of ['keydown', 'keyup', 'keypress']) host.addEventListener(t, (e) => e.stopPropagation());

  $('addProduct').onclick = () => {
    const p = newProduct();
    products.push(p);
    openCards.add(p.id); // สินค้าใหม่ กางให้กรอกเลย
    if (st.qFilter === 'done') st.qFilter = 'all';
    qFind = ''; $('qFind').value = '';
    save(); renderAll();
    const input = root.querySelector(`#products [data-id="${p.id}"] input[type=text]`);
    if (input) { input.focus(); input.scrollIntoView({ block: 'center' }); }
  };
  $('qFind').oninput = () => { qFind = $('qFind').value; renderProducts(); };
  // ใน Shadow DOM เบราว์เซอร์ล้าง e.target หลังจบ event จึงเก็บ input ไว้ก่อน await
  $('faceFile').addEventListener('change', async (e) => {
    const input = e.currentTarget;
    const files = [...input.files];
    input.value = '';
    try {
      const img = (await Promise.all(files.map(loadImage)))[0];
      if (img) { draft = { image: img }; $('newpName').value = ''; $('newpDesc').value = ''; renderPeople(); $('newpName').focus(); }
    } catch (err) { msg('อ่านรูปไม่ได้', 'err'); }
  });
  $('newpCancel').onclick = () => { draft = null; renderPeople(); };
  $('newpSave').onclick = () => {
    if (!draft) return;
    const p = { id: uid(), name: $('newpName').value.trim() || `พรีเซนเตอร์ ${presenters.length + 1}`, desc: $('newpDesc').value.trim(), image: draft.image };
    presenters.push(p);
    st.presenterId = p.id;
    draft = null;
    save(); renderAll();
  };
  $('prodFile').addEventListener('change', async (e) => {
    const input = e.currentTarget;
    const files = [...input.files].filter((f) => f.type.startsWith('image/'));
    input.value = '';
    const p = products.find((x) => x.id === uploadTarget);
    try { if (p) p.images.push(...await Promise.all(files.map(loadImage))); } catch (err) { msg('อ่านรูปไม่ได้', 'err'); }
    save(); renderAll();
  });
  root.querySelectorAll('.tabs button').forEach((b) => {
    b.onclick = () => {
      root.querySelectorAll('.tabs button').forEach((x) => x.classList.toggle('on', x === b));
      b.scrollIntoView({ block: 'nearest', inline: 'nearest' }); // แผงแคบ: เลื่อนแถบแท็บให้เห็นแท็บที่เลือก
      root.querySelectorAll('main[id^="tab-"]').forEach((m) => { m.hidden = m.id !== `tab-${b.dataset.tab}`; });
      if (b.dataset.tab === 'search' && !spActive()) { // เปิดครั้งแรก: โหลดสินค้าแนะนำให้เลย ไม่ต้องค้นหา
        setTimeout(() => $('spKw').focus(), 0);
        if (!sp.autoTried && !sp.busy) { sp.autoTried = true; spSearch(false, { home: true, quiet: true }); } // ไม่ได้กดเอง → ไม่สลับแท็บไปหน้าล็อกอิน
      }
      if (b.dataset.tab === 'queue') renderProducts(); // ช่องบทพูดปรับความสูงได้เมื่อมองเห็นแล้ว
      if (b.dataset.tab === 'sv') svCheck();
    };
  });
  $('tabQueue').classList.add('on');
  // หมวดตั้งค่าที่กาง/พับไว้ — จำไว้ (st.folds)
  root.querySelectorAll('details.fold').forEach((d) => {
    d.addEventListener('toggle', () => { st.folds = { ...(st.folds || {}), [d.dataset.fold]: d.open }; save(); });
  });
  const applyFolds = () => root.querySelectorAll('details.fold').forEach((d) => { const v = (st.folds || {})[d.dataset.fold]; if (v != null) d.open = !!v; });
  $('fab').onclick = () => { panel.hidden = false; $('fab').hidden = true; renderProducts(); };
  // ธีมมืด/สว่าง (ค่าเริ่มต้น: มืด) — ใส่ class ที่ host แล้ว CSS สลับตัวแปรสี
  function applyTheme() {
    const dark = st.theme !== 'light';
    host.classList.toggle('dark', dark);
    $('theme').textContent = dark ? '☀️' : '🌙';
  }
  $('theme').onclick = () => { st.theme = st.theme === 'light' ? 'dark' : 'light'; save(); applyTheme(); };
  applyTheme();
  $('close').onclick = () => { panel.hidden = true; $('fab').hidden = false; };
  // ลากขอบซ้ายปรับความกว้างแผง · จำไว้ (st.panelW) · ดับเบิลคลิก = กลับขนาดตั้งต้น
  const applyPanelW = () => { panel.style.width = st.panelW ? `${Math.min(st.panelW, innerWidth - 40)}px` : ''; };
  $('grip').addEventListener('mousedown', (e) => {
    e.preventDefault();
    const x0 = e.clientX, w0 = panel.getBoundingClientRect().width, grip = $('grip');
    grip.classList.add('on');
    const move = (ev) => { panel.style.width = `${Math.max(420, Math.min(innerWidth - 40, w0 + (x0 - ev.clientX)))}px`; };
    const up = () => {
      document.removeEventListener('mousemove', move, true); document.removeEventListener('mouseup', up, true);
      grip.classList.remove('on');
      st.panelW = Math.round(panel.getBoundingClientRect().width); save();
    };
    document.addEventListener('mousemove', move, true); document.addEventListener('mouseup', up, true);
  });
  $('grip').addEventListener('dblclick', () => { delete st.panelW; save(); applyPanelW(); });

})();
