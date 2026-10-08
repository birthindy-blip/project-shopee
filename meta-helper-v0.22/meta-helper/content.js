// Shopee Video ผู้ช่วยทำคลิป v0.22 (บน meta.ai): คิวสินค้า + คลังพรีเซนเตอร์ + prompt ทีละคลิป (คลิปละ 10 วิ) + รันคิวอัตโนมัติ
(() => {
  if (window.__mahLoaded) return;
  window.__mahLoaded = true;

  // ---------- ส่วนประกอบ prompt (แบ่งเป็นหมวด) ----------
  const R = {
    style: {
      auto: 'Visual style: choose the style that best fits the product.',
      minimal: 'Visual style: minimal — plain clean background, soft neutral colors, generous empty space, soft natural light.',
      natural: 'Visual style: natural lifestyle — real home or outdoor setting, warm natural light, casual everyday feel.',
    },
    who: {
      auto: 'Choose the best fit for the product: a real person, only hands, or a cute animal.',
      person: 'A real Thai person, visible on camera, talking to the camera.',
      animal: 'A cute real animal (cat or dog) with the product; a Thai voice-over speaks.',
      hands: "Only a person's realistic hands handle and demonstrate the product. Never show the face or body; a Thai voice-over speaks.",
      none: 'No people or animals on screen: product-only shots with smooth camera moves and close-ups; a Thai voice-over speaks.',
    },
    realistic: 'Ultra realistic, photorealistic real human, natural skin texture, realistic light and shadows, natural expressions and accurate lip-sync, shot on a modern smartphone. Not cartoon, not CGI.',
    face: "Face lock: the face must match the face reference photo exactly in every frame (face shape, eyes, nose, lips, skin tone, hair, age). Do not beautify or morph.",
    voiceFromPhoto: 'Voice: a real, natural Thai voice whose gender and age match the person in the face reference photo.',
    voiceDefault: 'Voice: a real, natural Thai voice of an ordinary person.',
    natural: 'Sound like a real person casually filming a phone vlog for friends — relaxed, conversational, natural breaths, small smiles and laughs in the voice, tiny hesitations are fine. Not a narrator, announcer, radio or advertising voice; not robotic or over-acted.',
    tone: {
      bright: 'Voice tone: bright, cheerful and energetic, with a smile in the voice.',
      soft: 'Voice tone: soft, warm and calm.',
      excited: 'Voice tone: excited and amazed, lively pace, like discovering something great (without exaggerated claims).',
      casual: 'Voice tone: very casual and warm, like chatting with a close friend.',
      pro: 'Voice tone: clear, confident and trustworthy, like a product expert.',
      asmr: 'Voice tone: quiet, close-to-mic ASMR whisper, slow and relaxing, with soft product sounds.',
    },
    text: {
      keywords: 'Show 2–3 short Thai keyword pop-ups (1–3 words each) at key moments, placed next to the feature they describe, never covering the product or faces.',
      captions: 'Show Thai subtitles of the speech in the lower third, short lines, perfectly in sync with the voice.',
      hook: 'Show one short Thai hook title in the first 2 seconds, large and centered, then it disappears.',
    },
    fx: {
      auto: 'Text animation: choose a trendy short-video style that fits the product.',
      pop: 'Text animation: bouncy pop-in (scale up with a small bounce), bold rounded font, white text with a soft drop shadow.',
      type: 'Text animation: typewriter effect, letters appear one by one, clean bold font.',
      highlight: 'Text animation: the current word is highlighted with a colored box behind it (karaoke style), bold font, white with black outline.',
      neon: 'Text animation: glowing neon text that flickers on, bright color on a dark soft glow.',
      hand: 'Text animation: casual handwritten white Thai text (marker-pen style) that writes itself on stroke by stroke, with a hand-drawn underline and a curved hand-drawn arrow pointing at the exact product feature being described. Clean, minimal, like a lifestyle product video.',
    },
    textRule: 'On-screen text must be spelled exactly right in Thai (correct vowels and tone marks), sharp and readable; keep it short and never cover the product. If Thai text cannot be rendered perfectly, show no text at all.',
    // ช่วงของคลิป: meta.ai ทำได้ทีละ ~10 วิ แล้วต่อคลิป ภาพตรงรอยต่อมักไม่ต่อเนื่อง
    // → ช่วง 1–3 จบในวิที่ 10 พอดี · ช่วง 4–5 เป็นช็อตใหม่หลัง 10 วิ ให้รอยตัดดูตั้งใจ
    story: {
      10: [
        { t: [0, 2], what: 'Hook: a striking close-up that grabs attention' },
        { t: [2, 6], what: 'Show the product and its details' },
        { t: [6, 10], what: 'Show how it is used and its best feature; end on the last spoken line' },
      ],
      15: [
        { t: [0, 2], what: 'Hook: a striking close-up that grabs attention' },
        { t: [2, 6], what: 'Show the product and its details' },
        { t: [6, 10], what: 'Show how it is used; finish this part cleanly at 10s' },
        { t: [10, 15], what: 'Fresh shot: real everyday use and its best feature; end on the last spoken line' },
      ],
      20: [
        { t: [0, 2], what: 'Hook: a striking close-up that grabs attention' },
        { t: [2, 6], what: 'Show the product and its details' },
        { t: [6, 10], what: 'Show how it is used; finish this part cleanly at 10s' },
        { t: [10, 20], what: 'Fresh shots: real everyday use from new angles and its best feature; end on the last spoken line' },
      ],
    },
    // จังหวะคลิป: เร็ว = ตัดภาพถี่ + พูดไว + เพลงคลอ · ปกติ = ตัดทุก 2–3 วิ
    pace: {
      fast: {
        edit: 'Editing: very fast-paced — a new shot every 0.5–1 second; rapid cuts between close-ups, macro details, different angles and in-use shots; never hold one shot longer than 1.5 seconds. Keep the same person, place and product across cuts.',
        speech: 'Speech pace: brisk and lively like a real TikTok/Shopee review, but still natural conversation — keep talking to the end without long pauses.',
        audio: 'Audio: upbeat trendy background music kept low under the voice.',
      },
      normal: {
        edit: 'Editing: smooth pacing with a cut every 2–3 seconds between close-ups, product details and in-use shots. Keep the same person, place and product across cuts.',
        speech: 'Speech pace: natural and relaxed, clear and easy to follow.',
        audio: '',
      },
    },
    // ลูกเล่นภาพ (เลือกได้หลายอย่าง)
    vfx: {
      auto: 'Effects: add 2–3 trendy short-video effects that fit the product — e.g. punch-in zooms on key words, whip-pan transitions, speed ramps — with matching quick sound effects (whoosh, pop).',
      none: 'Effects: none — clean straight cuts only.',
      zoom: 'punch-in zooms on key words and product details',
      whip: 'whip-pan / swipe transitions between shots',
      ramp: 'speed ramps (fast motion into slow motion on the product)',
      freeze: "a freeze-frame with a quick white flash on the product's best detail",
      split: 'a split-screen showing two angles or two uses side by side',
      shake: 'subtle camera shake and light flashes on the beat',
    },
    ending: 'Ending: no pointing gestures, no call-to-action pose; simply end on the last spoken line.',
    extend: (sec, n) => `If you can only generate 10 seconds at a time: make segments 1–3 first (0–10s), then extend from the last frame with segment${n > 4 ? `s 4–${n}` : ' 4'} until it reaches ${sec} seconds — same person, outfit, place, lighting and product.`,
    cut10: (n) => `The video has ${n} segments. Segments 1–3 make up the first 10 seconds and must end on a clean cut exactly at 10s; segment${n > 4 ? `s 4–${n} continue` : ' 4 continues'} after 10s with fresh shots (a new angle or another spot in the same place), so the cut at 10s looks intentional.`,
    // ความคมชัด (meta.ai กำหนดความละเอียดไฟล์เอง — prompt ขอให้ภาพคมที่สุดเท่าที่ทำได้)
    quality: {
      normal: '',
      high: 'Image quality: sharp and high-detail, crisp focus on the product, clean natural colors, no blur, no noise, no compression artifacts; highest resolution available (1080x1920).',
      max: 'Image quality: maximum sharpness and detail — like a 4K commercial product shoot downscaled to 1080x1920: tack-sharp focus on the product, fine textures and readable printed text, stable camera, no motion blur, no noise, no compression artifacts.',
    },
    // ล้างไฟล์ในพื้นที่ทำงานของ meta.ai (จำกัด ~500MB — ไฟล์เก่าค้างจนรวมคลิปไม่ได้)
    files: {
      clean: 'Workspace housekeeping: before you start, delete all old video and image files left from previous requests in your workspace (anything not created for this request), so storage stays well under the limit. Keep only this request\'s reference images.',
      join: (sec) => `If the video is made in parts, join the parts into ONE final mp4 of exactly ${sec} seconds (e.g. ffmpeg concat), then delete the part files and show only the final video.`,
      after: 'After the final video is ready, delete any intermediate or temporary files you created.',
      sweep: 'Housekeeping only: please delete all old video and image files from earlier requests in your workspace to free storage. Do not create any image or video. Reply with one short line when done.',
    },
    productLock: 'Every product must match its reference images exactly — shape, color, material, logo, printed text and proportions. Do not redesign, distort, add or remove details.',
    rules: [
      'All speech is Thai only. Any on-screen text is Thai only (no English).',
      'Thai must be correct: pronounce every Thai word clearly and correctly with a natural native Thai accent — no mispronounced, garbled or made-up words; speak the given Thai lines exactly as written. Any Thai text on screen must be spelled exactly right, otherwise leave it out.',
      'Never show or say any price, discount, promotion, free shipping or urgency.',
      'No children: no babies, kids or anyone who looks under 18 anywhere in the video.',
      'No exaggerated or health claims. Natural, friendly Shopee Video review tone.',
    ],
  };

  // คำต้องห้าม (ตรวจบทพูด/ฉากก่อนใส่ prompt)
  const BANNED = [
    ['ห้ามบอกราคา', /ราคา|บาท|฿|\d+\s*\.-|ถูก(มาก|สุด|ๆ|จัด)/],
    ['ห้ามบอกโปร', /โปร(?!ด|แกรม|ตีน|ไฟล์|เจ)|ส่วนลด|ลด(ราคา|เหลือ|ทันที|\s*\d)|โค้ด|คูปอง|แถม(?!ยัง)|ส่งฟรี|ฟรี(?!ไซ)|sale|เซล|%|แฟลช|วันนี้วันเดียว|รีบ(สั่ง|ซื้อ|กด)/i],
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

  const OPTIONS = {
    duration: [['10', '10 วิ'], ['15', '15 วิ'], ['20', '20 วิ']],
    pace: [['fast', 'เร็ว (พูดไว ตัดไว)'], ['normal', 'ปกติ']],
    quality: [['normal', 'ปกติ'], ['high', 'คมชัดสูง'], ['max', 'คมชัดสูงสุด']],
    scenes: [['auto', 'อัตโนมัติ'], ['3', '3 ซีน'], ['4', '4 ซีน'], ['5', '5 ซีน'], ['6', '6 ซีน'], ['8', '8 ซีน']],
    cleanEvery: [['1', 'ทุกคลิป'], ['3', 'ทุก 3 คลิป'], ['5', 'ทุก 5 คลิป'], ['10', 'ทุก 10 คลิป']],
    variants: [['1', '1 คลิป'], ['2', '2 แบบ (A/B เลือกตัวที่ดีกว่า)']],
    post: [['on', 'สร้าง'], ['off', 'ไม่สร้าง']],
    gap: [['0', 'ไม่พัก'], ['5', '5 วิ'], ['15', '15 วิ'], ['30', '30 วิ']],
    vfx: [['auto', 'อัตโนมัติ'], ['zoom', 'ซูมกระแทก'], ['whip', 'ปัดเปลี่ยนฉาก'], ['ramp', 'เร่ง-สโลว์'], ['freeze', 'ภาพค้าง+แฟลช'], ['split', 'แบ่งจอ'], ['shake', 'สั่นตามจังหวะ'], ['none', 'ไม่ใส่']],
    style: [['auto', 'อัตโนมัติ'], ['minimal', 'มินิมอล'], ['natural', 'ธรรมชาติ']],
    view: [['auto', 'อัตโนมัติ'], ['full', 'เห็นทั้งตัว'], ['hands', 'เห็นแค่มือ'], ['none', 'ไม่เห็นคน']],
    presenter: [['auto', 'อัตโนมัติ'], ['human', 'คน'], ['animal', 'สัตว์']],
    tone: [['auto', 'อัตโนมัติ'], ['bright', 'สดใส'], ['soft', 'นุ่มนวล'], ['excited', 'ตื่นเต้น'], ['casual', 'เป็นกันเอง'], ['pro', 'มืออาชีพ'], ['asmr', 'กระซิบ ASMR']],
    text: [['none', 'ไม่มี'], ['keywords', 'คำเด่นเด้ง'], ['captions', 'ซับบทพูด'], ['hook', 'หัวข้อเปิด']],
    scriptMode: [['ai', '✨ Gemini เขียนให้ทีละสินค้า'], ['same', 'พิมพ์เอง (ใช้บทเดียวกันทุกตัว)']],
    fx: [['auto', 'อัตโนมัติ'], ['pop', 'เด้ง'], ['type', 'พิมพ์ทีละตัว'], ['highlight', 'ไฮไลต์คำ'], ['neon', 'นีออน'], ['hand', 'ลายมือ + ลูกศร']],
  };

  // แนวสำเร็จรูป: กดทีเดียวตั้งค่าหลายอย่าง
  const PRESETS = [
    { label: '🏠 สินค้าในห้อง + ลายมือชี้จุดเด่น', set: { style: 'natural', view: 'none', presenter: 'auto', tone: 'casual', text: 'keywords', fx: 'hand',
      scene: 'Bright, airy living room in warm cream tones with a light wooden floor and plenty of daylight from large windows — bright and cheerful. Mix wide shots that show the whole room and its cozy atmosphere with close-ups of the product; keep the room clearly visible behind the product (no heavy background blur).' } },
  ];
  // ฉากของแนวห้องรุ่นเก่า (มืดกว่า + ฉากหลังเบลอ) → อัปเดตเป็นแบบใหม่ให้อัตโนมัติ
  const OLD_ROOM_SCENES = [
    'Cozy living room in warm cream tones, light wooden floor, soft natural window light, softly blurred background. Close-up product shots with smooth camera moves.',
    'Cozy living room in warm cream tones, light wooden floor, soft natural window light, softly blurred background. Close-up product shots with slow, smooth camera moves.',
  ];
  const MULTI = new Set(['vfx']); // ตัวเลือกที่เลือกได้หลายอัน
  const DEFAULTS = { duration: '10', style: 'auto', presenter: 'auto', view: 'auto', tone: 'auto', pace: 'fast', scenes: 'auto', quality: 'high', gap: '5', variants: '1', cleanOn: true, cleanEvery: '5', post: 'on', vfx: ['auto'], scriptMode: 'ai', text: 'none', fx: 'auto', osText: '', scene: '', lines: {}, presenterId: '' };
  let st = { ...DEFAULTS };
  let products = [];
  let presenters = []; // [{ id, name, desc, image }]

  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const newProduct = () => ({ id: uid(), name: '', on: true, done: false, images: [], link: '', commission: '', price: '' });

  function mode() {
    if (st.view === 'none') return 'none';
    if (st.view === 'hands') return 'hands';
    if (st.presenter === 'animal') return 'animal';
    if (st.view === 'full' || st.presenter === 'human') return 'person';
    return 'auto';
  }
  const presenter = () => presenters.find((p) => p.id === st.presenterId) || null;
  const faceUsable = () => !!presenter() && (mode() === 'person' || mode() === 'auto');
  let runItem = null; // ระหว่างรันคิว: ทำทีละสินค้า
  const todo = () => products.filter((p) => !p.done && (p.name.trim() || p.images.length)); // ทุกตัวในคิวที่ยังไม่เสร็จ
  const active = () => (runItem ? [runItem] : todo().slice(0, 1));
  const seconds = () => ({ 15: 15, 20: 20 })[st.duration] || 10;

  // รูปที่จะแนบตามลำดับ (ลำดับต้องตรงกับที่บอกใน prompt)
  function filesFor() {
    return [faceUsable() ? presenter().image : null, ...active().flatMap((p) => p.images)].filter(Boolean);
  }

  // กำหนดจำนวนซีน (ช็อต) ทั้งคลิป · คลิปเกิน 10 วิ ต้องมีรอยตัดซีนที่วิ 10 พอดี
  function sceneLine(sec) {
    const n = +st.scenes;
    if (!n) return '';
    const per = (sec / n).toFixed(1).replace(/\.0$/, '');
    return `Scenes: exactly ${n} distinct scenes (shots) in total, about ${per} seconds each — cut only between scenes${sec > 10 ? ', with one scene change exactly at 10 seconds' : ''}. Each scene shows a different angle or moment; keep the same person, place and product across scenes.`;
  }

  function buildPrompt() {
    const m = mode();
    const items = active();
    const names = items.map((p, i) => p.name.trim() || `product ${i + 1}`);
    const sec = seconds();
    const pr = presenter();
    const section = (title, lines) => [`[${title}]`, ...lines.filter(Boolean)].join('\n');

    const refs = [];
    let n = 1;
    if (faceUsable()) refs.push(`Image ${n++} = presenter's face.`);
    items.forEach((p, i) => {
      if (!p.images.length) return;
      const a = n;
      n += p.images.length;
      refs.push(`${a === n - 1 ? `Image ${a}` : `Images ${a}-${n - 1}`} = ${names[i]}.`);
    });

    const presenterLines = [R.who[m === 'auto' && faceUsable() ? 'person' : m]]; // เลือกรูปพรีเซนเตอร์แล้ว = คนจริง
    if (faceUsable()) {
      presenterLines.push(R.realistic, R.face);
      if (pr.desc.trim()) presenterLines.push(`Description: ${pr.desc.trim()}.`);
      presenterLines.push(R.voiceFromPhoto);
    } else if (m !== 'animal') presenterLines.push(R.voiceDefault);
    presenterLines.push(R.tone[st.tone] || R.tone.casual, R.natural); // อัตโนมัติ = เป็นกันเอง · เสียงคนจริงธรรมชาติ
    const pace = R.pace[st.pace] || R.pace.fast;
    presenterLines.push(st.tone === 'asmr' ? R.pace.normal.speech : pace.speech);
    const vfx = Array.isArray(st.vfx) && st.vfx.length ? st.vfx : ['auto'];
    const vfxLine = vfx.includes('none') ? R.vfx.none : vfx.includes('auto') ? R.vfx.auto
      : `Effects: use ${vfx.map((k) => R.vfx[k]).filter(Boolean).join('; ')} — with matching quick sound effects (whoosh, pop).`;

    // ตัวหนังสือบนจอ
    const custom = (st.osText || '').trim();
    const textLines = st.text === 'none' ? ['No on-screen text at all.']
      : [R.text[st.text] || '', custom ? `Use exactly this Thai text on screen: "${custom}"` : '', R.fx[st.fx] || R.fx.auto, R.textRule];

    // บทพูด: 1 บรรทัด = 1 ช่วง (ถ้าจำนวนบรรทัดตรงกับช่วง จะใส่บทแยกตามช่วง)
    const segs = R.story[sec];
    const said = (st.scriptMode === 'ai' ? (items[0] && items[0].script) || '' : st.lines[1] || '').split('\n').map((x) => x.trim()).filter(Boolean);
    const perSeg = said.length === segs.length;
    const storyLines = sec > 10 ? [R.cut10(segs.length)] : [];
    segs.forEach((g, i) => storyLines.push(`${i + 1}) ${g.t[0]}–${g.t[1]}s — ${g.what}.${perSeg ? ` ${m === 'person' || m === 'auto' ? 'Presenter says' : 'Voice-over'} in Thai: "${said[i]}"` : ''}`));
    const speaker = m === 'person' || m === 'auto' ? 'The presenter says' : 'The voice-over says';
    return [
      section('VIDEO', [
        `Shopee Video product clip for: ${names.map((x) => `"${x}"`).join(', ') || 'the product'}.`,
        `Vertical 9:16 (1080x1920), full-frame, no letterboxing. Length: exactly ${sec} seconds.`,
        sec > 10 ? R.extend(sec, R.story[sec].length) : '',
        R.style[st.style],
        R.quality[st.quality] || '',
      ]),
      refs.length ? section('REFERENCE IMAGES', refs) : '',
      st.scene.trim() ? section('SCENE', [st.scene.trim()]) : '',
      section('PRESENTER', presenterLines),
      section('STORY', [...storyLines, sceneLine(sec) || pace.edit, vfxLine, pace.audio, R.ending,
        !perSeg && said.length ? `${speaker} in Thai: "${said.join(' ')}"${sec > 10 ? ' — end a sentence right at 10 seconds; never let a sentence run across the 10-second cut.' : ''}` : '']),
      section('ON-SCREEN TEXT', textLines),
      section('FILES', [st.cleanOn && st.cleanEvery === '1' ? R.files.clean : '', sec > 10 ? R.files.join(sec) : '', R.files.after]),
      section('PRODUCT LOCK', [R.productLock]),
      section('RULES — MUST FOLLOW', R.rules.map((r) => `- ${r}`)),
    ].filter(Boolean).join('\n\n');
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
  async function insertInto(box, text) {
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
  const scriptKey = () => `${seconds()}|${scriptFast() ? 'fast' : 'normal'}|v2`;
  // บทที่ต้องเขียน (ใหม่): ยังไม่มีบท หรือบทที่ Gemini เขียนไว้สำหรับความยาว/จังหวะอื่น (บทที่แก้เองไม่ทับ)
  const needsScript = (p) => !(p.script || '').trim() || (p.scriptBy !== 'user' && p.scriptFor !== scriptKey());
  // หมุนแบบเปิดคลิป (hook) ทีละสินค้า กันขึ้นต้นเหมือนกันทุกตัว
  const HOOKS = [
    'a direct question to the viewer about a small everyday problem this product solves',
    'POV style — start with "POV:" and a relatable everyday moment',
    'a relatable complaint or pain point, then the product as the fix',
    'a friend-to-friend recommendation ("บอกต่อ" style) naming who it is perfect for',
    'start by describing the moment of using it — what you see, hear or feel',
    'a quick comparison with the usual old way of doing it',
    'start straight with the most interesting visible detail of the product',
    'a casual first-time reaction in your own words, then what surprised you',
  ];
  let hookIdx = 0;
  // คำอุทานขึ้นต้น (Gemini ชอบเปิดด้วย "เฮ้ย") → ห้าม / ตัดทิ้ง
  const INTERJ = /^\s*(เฮ้ย|เห้ย|เฮ้|เห้|เฮ้ยย+|โอ้โห|โห+|ว้าว+|อุ๊ย|อุ้ย|เอ้า|เออ|อ้าว|อะ|นี่|แก)(?=[\s!?,.…~ๆ]|$)[\s!?,.…~ๆ]*/;
  const startsInterj = (script) => INTERJ.test((script || '').split('\n')[0]);
  const stripInterj = (script) => { const L = script.split('\n'); L[0] = L[0].replace(INTERJ, '').trim() || L[0]; return L.join('\n'); };
  const firstWords = (script) => (script || '').split('\n')[0].replace(/\s+/g, ' ').trim().slice(0, 14);
  const TONE_TH = { bright: 'สดใส ร่าเริง', soft: 'นุ่มนวล อบอุ่น', excited: 'ตื่นเต้น มีพลัง (แต่ไม่พูดเกินจริง)', casual: 'เป็นกันเอง เหมือนคุยกับเพื่อน', pro: 'ชัดเจน น่าเชื่อถือ แบบผู้รู้', asmr: 'กระซิบ ช้าๆ ผ่อนคลาย' };
  function scriptRequest(p, violations, hook, recent) {
    const m = mode();
    const sec = seconds();
    const fast = scriptFast();
    const segs = R.story[sec];
    const rate = SCRIPT_RATE[fast ? 'fast' : 'normal'];
    const segSpec = segs.map((g, i) => {
      const d = g.t[1] - g.t[0];
      return `${i + 1}) ${g.t[0]}–${g.t[1]}s (${g.what.split(';')[0]}): about ${Math.round(d * rate[0])}–${Math.round(d * rate[1])} Thai characters`;
    });
    const L = [
      'You write a short spoken Thai script for a Shopee Video product clip.',
      `Product name: "${p.name.trim() || 'unknown'}"`,
      (p.desc || '').trim() ? `Product details from the shop page (may contain sales talk — never repeat prices, discounts or promotions): "${p.desc.trim().slice(0, 600)}"` : '',
      p.images.length ? 'The attached images show the product.' : '',
      `The ${sec}-second clip has ${segs.length} segments. Write one Thai line per segment, sized to fit it${fast ? ' at a fast pace' : ''} — do not write more than this:`,
      ...segSpec,
      'Each line must be complete on its own — never split a sentence across two segments.',
      sec > 10 ? 'The video has a hard cut at 10 seconds (between segment 3 and 4): segment 3 must finish the thought; segment 4 starts fresh.' : '',
      `Speaker: ${m === 'person' || m === 'auto' ? 'a real person talking to the camera' : 'a voice-over (the speaker is not on screen)'}.`,
      `Tone: ${TONE_TH[st.tone] || TONE_TH.casual}.`,
      'Language: casual, friendly everyday spoken Thai, exactly how Thai people really talk to a close friend — natural particles and fillers inside sentences (เลย, นะ, อะ, แบบ, จริงๆ, มากกก), short and loose phrasing, talk to the viewer directly. No formal, written or advertising-style wording; it must not sound like an ad.',
      'Use เรา for I/we; never ผม, ดิฉัน, ครับ, ค่ะ or คะ (the voice may be male or female).',
      'Spell every Thai word correctly (vowels, tone marks) and use common words that are easy to pronounce clearly — no slang spellings that a voice could misread.',
      fast ? 'Delivery: fast, punchy and energetic like a viral TikTok/Shopee review — short phrases, no filler, keep talking to the end.' : 'Delivery: relaxed and natural.',
      `Opening line (segment 1) style for THIS product: ${hook.style}. Make it specific to this product; no exaggeration. NEVER start with an interjection or filler such as เฮ้ย, เห้ย, เฮ้, โห, โอ้โห, ว้าว, อุ๊ย, เอ้า, เออ, อะ, นี่ or แก — the first word must already be about the product or the viewer's situation.`,
      recent.length ? `Other clips in this batch already open like this — your first line must start differently and use different words: ${recent.map((x) => `"${x}"`).join(', ')}` : '',
      'Content: what it is, what stands out, how it is used in real life. Use only what the name and images show; do not invent specs.',
      'Hard rules:',
      '- No price, baht amounts, discount, promotion, sale, coupon, code, freebies, free shipping, percentages, "today only" or any urgency (รีบ...).',
      '- No exaggerated claims: no ที่สุด, อันดับ 1, เบอร์ 1, 100%, การันตี, รับประกัน, เห็นผล, ปาฏิหาริย์.',
      '- No health or body claims (ลดน้ำหนัก, ผอม, บำรุง, ดีต่อสุขภาพ, รักษา, ภูมิคุ้มกัน).',
      '- Never mention children or babies (เด็ก, ลูกน้อย, ทารก).',
      '- Do not claim long-term personal use or fake experiences (e.g. "ใช้มา 3 เดือน").',
      '- Thai only: no English words, no emoji, no hashtags.',
      violations && violations.length ? `Your previous script broke these rules: ${violations.join('; ')}. Rewrite it without them.` : '',
      'Also write a post caption for the clip: 1–2 short casual Thai lines (same rules — no price, promotion or exaggeration), and 3–5 relevant hashtags (Thai or English, no promo words).',
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
    if (!gemini.key) throw new Error('ยังไม่ได้ใส่ Gemini API key (แท็บตั้งค่าคลิป)');
    const images = p.images.slice(0, 2).map((i) => i.dataUrl);
    let bad = null, script = '';
    const want = R.story[seconds()].length;
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
    if (!gemini.key) { msg('ใส่ Gemini API key ก่อน (แท็บตั้งค่าคลิป → บทพูด)', 'err'); return; }
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
  const NOT_SEND_RE = /stop|cancel|ยกเลิก|หยุด|attach|แนบ|upload|อัปโหลด|voice|mic|เสียง|menu|เมนู|more|share|แชร์|download|ดาวน์โหลด|\badd\b|เพิ่ม|photo|image|รูป|ภาพ|media|file|ไฟล์|camera|กล้อง|gallery|emoji|setting|ตั้งค่า|\bmode\b|โหมด|model|aspect|ratio|style|สไตล์|tool|เครื่องมือ|search|ค้นหา|copy|คัดลอก|edit|แก้ไข|new chat|แชทใหม่/i;
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
  function sendCandidates(input) {
    const ir = input.getBoundingClientRect();
    const cx = ir.right, cy = ir.top + ir.height / 2;
    return [...document.querySelectorAll('button, [role=button]')]
      .filter((b) => !isOurs(b) && b.getBoundingClientRect().width > 0 && !opensPicker(b) && !badButtons.has(btnSig(b)))
      .filter((b) => { const l = labelOf(b); return SEND_RE.test(l) && !NOT_SEND_RE.test(l); })
      .map((b) => { const r = b.getBoundingClientRect(); return { b, strong: SEND_STRONG.test(labelOf(b)), d: Math.hypot(r.left + r.width / 2 - cx, r.top + r.height / 2 - cy) }; })
      .filter((x) => x.d < 400)
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
    const ir = input.getBoundingClientRect();
    const c = [...document.querySelectorAll('button, [role=button]')].filter((b) => {
      if (isOurs(b) || !shown(b) || !b.querySelector('svg') || opensPicker(b) || badButtons.has(btnSig(b))) return false;
      const l = labelOf(b), r = b.getBoundingClientRect();
      return !NOT_SEND_RE.test(l) && r.left >= ir.left + ir.width * 0.5 && r.left < ir.right + 120 && Math.abs(r.top + r.height / 2 - (ir.top + ir.height / 2)) < Math.max(80, ir.height);
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
      promptOnPage: !!findAnchor('Shopee Video product clip for'), badButtons: [...badButtons], buttons, videos,
    }, null, 1);
  }
  class Stopped extends Error {}
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
    badButtons.add(btnSig(b));
    try { chrome.storage.local.set({ mahBadButtons: [...badButtons].slice(-30) }); } catch (e) {}
  }
  async function submit(input) {
    // รอปุ่มส่งที่กดได้ (รูปอัปโหลดเสร็จ) สูงสุด 60 วิ · ถ้า 3 วิแล้วไม่มีปุ่มที่มีชื่อเลย ลองปุ่มไอคอนขวาสุดของช่องพิมพ์
    const sentNow = () => !input.isConnected || !textOf(input) || isBusy();
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
      if (!btn) break;
      const picker = await guardedClick(btn);
      if (!picker && await waitFor(sentNow, 8000, 400)) return how;
      // ไม่ใช่ปุ่มส่ง → จำไว้ แล้วลองตัวถัดไป
      rememberBad(btn);
      log(`⚠ ปุ่ม ${how} ไม่ใช่ปุ่มส่ง${picker ? ' (เปิดหน้าต่างเลือกไฟล์ — กันไว้แล้ว)' : ''} — จำไว้ไม่กดอีก ลองปุ่มอื่น`, 'warn');
    }
    // สุดท้าย: กด Enter ในช่องพิมพ์
    input.focus();
    for (const t of ['keydown', 'keypress', 'keyup']) input.dispatchEvent(new KeyboardEvent(t, { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true }));
    if (await waitFor(sentNow, 8000, 400)) return 'Enter';
    throw new Error(`หาปุ่มส่งที่ใช้ได้ไม่เจอ${isBusy() ? ' (meta.ai ยังทำงานอยู่)' : ''} — กด 🔍 คัดลอกข้อมูลหน้าเว็บ ส่งให้ผู้พัฒนาดู`);
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
  async function markExisting() {
    const fps = [];
    for (const v of allVideos().slice(-40)) if (srcOf(v)) fps.push(await fingerprint(v));
    rememberClips(fps);
  }
  // ข้อความ prompt ที่เราเพิ่งส่ง (บนหน้าแชต) — คลิปใหม่ต้องอยู่ "หลัง" ข้อความนี้
  function findAnchor(head) {
    if (!head) return null;
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let last = null, n;
    while ((n = w.nextNode())) {
      if (!n.nodeValue.includes(head)) continue;
      const e = n.parentElement;
      if (e && !isOurs(e) && !e.closest('[contenteditable], textarea')) last = e;
    }
    return last;
  }
  // รอวิดีโอใหม่จนนิ่ง (วิดีโอเดียวกันที่โชว์หลายที่ = นับครั้งเดียว)
  async function waitForNewVideos(known, ms) {
    const end = Date.now() + ms;
    let prev = '', stable = 0, toldOld = false;
    const diag = { old: 0, total: 0 };
    while (Date.now() < end) {
      await nap(2000);
      let fresh = allVideos().filter((v) => srcOf(v) && !known.els.has(v) && !known.norm.has(normSrc(srcOf(v))));
      diag.total = allVideos().length;
      // ชอบวิดีโอที่อยู่หลัง prompt ที่เพิ่งส่ง แต่ถ้าหน้าเว็บเรียงคลิปใหม่ไว้บนสุด ก็รับตัวที่ไม่ใช่ของเก่าได้
      const anchor = findAnchor(known.head);
      if (anchor) {
        const after = fresh.filter((v) => anchor.compareDocumentPosition(v) & Node.DOCUMENT_POSITION_FOLLOWING);
        if (after.length) fresh = after;
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
      const sig = ready.map((x) => x.fp).join('|');
      if (ready.length && sig === prev) { if (++stable >= 2) return ready.map((x) => x.v); } else stable = 0;
      prev = sig;
    }
    throw new Error(`รอคลิปนานเกิน ${Math.round(ms / 60000)} นาที (บนหน้ามีวิดีโอ ${diag.total} ตัว · ข้ามคลิปเก่า ${diag.old} · meta.ai ${isBusy() ? 'ยังทำงานอยู่' : 'ว่างแล้ว'}${findAnchor(known.head) ? '' : ' · ไม่เห็นข้อความ prompt บนหน้า — อาจส่งไม่ติด'})`);
  }
  const safeName = (s) => (s || 'สินค้า').replace(/[\\/:*?"<>|#%\n\r\t]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);
  function bgDownload(url, filename) {
    return new Promise((res, rej) => {
      try { chrome.runtime.sendMessage({ type: 'download', url, filename }, (r) => (r && r.ok ? res() : rej(new Error((r && r.error) || 'ดาวน์โหลดไม่ได้')))); } catch (e) { rej(e); }
    });
  }
  const blobToDataUrl = (blob) => new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = rej; fr.readAsDataURL(blob); });
  // โหลดผ่าน chrome.downloads (รองรับชื่อไทย + โฟลเดอร์ Downloads/ShopeeVideo)
  async function readVideo(v) {
    const src = srcOf(v);
    try { return { src, blob: await (await fetch(src)).blob() }; } catch (e) {
      if (src.startsWith('blob:')) throw e;
      return { src, blob: null }; // ลิงก์ข้ามโดเมน → ให้ Chrome โหลดเอง
    }
  }
  async function saveVideo({ src, blob }, base) {
    if (!blob) { await bgDownload(src, `ShopeeVideo/${base}.mp4`); return; }
    const ext = /webm/.test(blob.type) ? 'webm' : 'mp4';
    try { await bgDownload(await blobToDataUrl(blob), `ShopeeVideo/${base}.${ext}`); } catch (e) {
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
  // 10 วิ = 1 ไฟล์ · 20 วิ = คลิปยาวไฟล์เดียว หรือ 2 ท่อนที่ meta.ai ต่อให้ (รอท่อน 2 สูงสุด 4 นาที)
  async function collectClips(known, wantLong) {
    const full = seconds() * 0.75; // ถือว่าได้คลิปยาวครบ
    const vids = await waitForNewVideos(known, 6 * 60000);
    let uniq = await uniqueVideos(vids);
    if (!wantLong) return uniq.slice(0, 1);
    if (!uniq.some((x) => x.dur >= full) && uniq.length < 2) {
      log(`ได้คลิปแรกแล้ว รอ meta.ai ต่อให้ครบ ${seconds()} วิ...`);
      try { uniq = await uniqueVideos([...vids, ...await waitForNewVideos(snapshot(known.head), 2 * 60000)]); }
      catch (e) { if (e instanceof Stopped) throw e; log('⚠ meta.ai ไม่ต่อคลิปให้ — โหลดเท่าที่มี', 'warn'); }
    }
    let long = uniq.find((x) => x.dur >= full);
    if (!long && uniq.length >= 2) { // สั่งให้ meta.ai รวมเอง → รอไฟล์รวมอีกสักพัก
      log(`ได้ 2 ท่อนแล้ว รอ meta.ai รวมเป็นไฟล์เดียวอีกสูงสุด 90 วิ...`);
      try {
        const more = await uniqueVideos(await waitForNewVideos(snapshot(known.head), 90000));
        long = more.find((x) => x.dur >= full);
      } catch (e) { if (e instanceof Stopped) throw e; }
      if (!long) log('meta.ai ไม่ได้รวมให้ — จะรวมในเครื่องแทน');
    }
    return long ? [long] : uniq.slice(0, 2);
  }

  // ไฟล์ข้อความโพสต์คู่คลิป
  function postText(p) {
    const tags = (p.tags && p.tags.length ? p.tags : ['#ShopeeVideo', '#รีวิว', '#ของใช้ดีบอกต่อ']).join(' ');
    const link = p.link || p.productUrl || '';
    const body = [(p.caption || p.name || '').trim(), '', tags, link ? `\n🛒 ${link}` : ''].join('\n').trim();
    return `﻿${body}\n`; // BOM ให้ Notepad อ่านไทยถูก
  }
  async function savePost(p, base) {
    const b64 = btoa(unescape(encodeURIComponent(postText(p))));
    await bgDownload(`data:text/plain;charset=utf-8;base64,${b64}`, `ShopeeVideo/${base}.txt`);
  }
  const onceEv = (target, ev, ms) => new Promise((res) => {
    const t = setTimeout(() => res(false), ms);
    target.addEventListener(ev, () => { clearTimeout(t); res(true); }, { once: true });
  });
  // รวม 2 ท่อนเป็นไฟล์เดียว: เล่นต่อกันบน canvas + เสียง แล้วอัดด้วย MediaRecorder (เวลาจริง)
  async function mergeClips(parts) {
    const type = ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm']
      .find((t) => window.MediaRecorder && MediaRecorder.isTypeSupported(t));
    if (!type) throw new Error('เบราว์เซอร์นี้รวมไฟล์ไม่ได้');
    if (parts.some((x) => !x.blob)) throw new Error('ไฟล์ข้ามโดเมน รวมในเบราว์เซอร์ไม่ได้');
    const v = document.createElement('video');
    v.playsInline = true;
    const ac = new AudioContext();
    const dest = ac.createMediaStreamDestination();
    ac.createMediaElementSource(v).connect(dest); // เสียงเข้าไฟล์ ไม่ออกลำโพง
    await ac.resume().catch(() => {});
    const c = document.createElement('canvas');
    const g = c.getContext('2d');
    const urls = parts.map((x) => URL.createObjectURL(x.blob));
    const chunks = [];
    let rec = null, drawing = true;
    const draw = () => {
      if (!drawing) return;
      if (v.videoWidth) { // วาดแบบเต็มกรอบ (crop กลาง) เผื่อ 2 ท่อนขนาดไม่เท่ากัน
        const k = Math.max(c.width / v.videoWidth, c.height / v.videoHeight);
        const w = v.videoWidth * k, h = v.videoHeight * k;
        g.drawImage(v, (c.width - w) / 2, (c.height - h) / 2, w, h);
      }
      if (v.requestVideoFrameCallback) v.requestVideoFrameCallback(draw); else requestAnimationFrame(draw);
    };
    try {
      for (let i = 0; i < urls.length; i++) {
        v.src = urls[i];
        if (!(await onceEv(v, 'loadedmetadata', 15000))) throw new Error('เปิดไฟล์ท่อนไม่ได้');
        if (!rec) {
          c.width = v.videoWidth || 720;
          c.height = v.videoHeight || 1280;
          const stream = new MediaStream([...c.captureStream(30).getVideoTracks(), ...dest.stream.getAudioTracks()]);
          rec = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 8000000 });
          rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
          rec.start(500);
        }
        try { await v.play(); } catch (e) { throw new Error('Chrome ไม่ให้เล่นวิดีโออัตโนมัติ (คลิกหน้าเว็บสักครั้งแล้วรันใหม่)'); }
        draw();
        if (!(await onceEv(v, 'ended', ((v.duration || 30) + 15) * 1000))) throw new Error('เล่นท่อนไม่จบ (แท็บถูกย่อ?)');
      }
    } finally {
      drawing = false;
      if (rec && rec.state !== 'inactive') { const stopped = onceEv(rec, 'stop', 5000); rec.stop(); await stopped; }
      ac.close().catch(() => {});
      urls.forEach((u) => URL.revokeObjectURL(u));
    }
    return new Blob(chunks, { type: type.split(';')[0] });
  }

  function log(text, cls) {
    const t = new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    run.log.push({ text: `${t}  ${text}`, cls: cls || '' });
    if (run.log.length > 200) run.log.shift();
    renderRun();
  }
  function setStatus(p, text) { run.status[p.id] = text; renderProducts(); }

  // ส่ง 1 ครั้ง → รอคลิป → โหลด (+ รวม 2 ท่อน) · คืนจำนวนไฟล์ที่โหลดได้
  async function makeClip(p, base, wantLong, label) {
    setStatus(p, `⏳ รอ meta.ai ว่าง${label}`);
    await waitIdle();
    setStatus(p, `⏳ ใส่ prompt${label}`);
    const input = await waitFor(findInput, 30000);
    if (!input) throw new Error('หาช่องพิมพ์ไม่เจอ');
    const prompt = buildPrompt();
    const known = snapshot(prompt.split('\n')[1].slice(0, 60)); // บรรทัด "Shopee Video product clip for: …"
    const files = filesFor().map(dataUrlToFile);
    if (files.length) {
      const r = await attachFiles(files);
      if (!r.ok) throw new Error('แนบรูปไม่ได้');
      await nap(1500);
    }
    const box = findInput() || input;
    if (!(await insertInto(box, prompt))) throw new Error('ใส่ข้อความไม่ได้');
    await nap(800);
    const how = await submit(box);
    log(`➤ ${base}: ส่งแล้ว (${how})${files.length ? ` + รูป ${files.length}` : ''}`);
    setStatus(p, `⏳ กำลังสร้างคลิป ${seconds()} วิ${label}`);
    const picks = await collectClips(known, wantLong);
    rememberClips(picks.map((x) => x.fp)); // กันโหลดซ้ำรอบหน้า
    // 15/20 วิ ได้มา 2 ท่อน → รวมเป็นไฟล์เดียวในเครื่อง เก็บแค่ไฟล์รวม (ไม่เอาท่อนย่อย)
    let outs = picks.map((x, k) => ({ clip: x, name: picks.length > 1 ? `${base}-${k + 1}` : base }));
    if (picks.length === 2) {
      setStatus(p, `🎬 รวมเป็นไฟล์เดียว${label}`);
      log(`🎬 meta.ai ส่งมา 2 ท่อน — กำลังรวมเป็นไฟล์เดียว ${seconds()} วิ (ใช้เวลาเท่าความยาวคลิป)...`);
      try {
        outs = [{ clip: { src: '', blob: await mergeClips(picks) }, name: base }];
      } catch (e) {
        if (e instanceof Stopped) throw e;
        log(`⚠ รวมไฟล์ไม่ได้ (${e.message || e}) — โหลดเป็น 2 ท่อนแทน กันคลิปหาย`, 'warn');
      }
    }
    setStatus(p, `⬇ ดาวน์โหลด${label}`);
    let saved = 0;
    for (const f of outs) {
      try { await saveVideo(f.clip, f.name); saved++; bump('clips'); log(`✅ โหลดแล้ว ${f.name}`, 'ok'); }
      catch (e) { log(`❌ โหลด ${f.name} ไม่ได้ (${e.message || e}) - กดโหลดเองใน meta.ai`, 'err'); }
      await nap(800);
    }
    return saved;
  }

  // สั่ง meta.ai ล้างไฟล์เก่า (ข้อความแยก ไม่ทำวิดีโอ) ทุก N คลิปที่ทำเสร็จ
  let cleanCount = 0;
  async function maybeSweep() {
    cleanCount++;
    try { chrome.storage.local.set({ mahCleanCount: cleanCount }); } catch (e) {}
    const n = +st.cleanEvery || 5;
    if (!st.cleanOn || n <= 1 || cleanCount % n) return;
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
    if (st.scriptMode === 'ai' && !gemini.key && queue.some((p) => !(p.script || '').trim())) { msg('ใส่ Gemini API key ก่อน (แท็บตั้งค่าคลิป → บทพูด)', 'err'); return; }
    const problems = checkText(`${st.scriptMode === 'ai' ? '' : st.lines[1] || ''} ${st.scene} ${st.text === 'none' ? '' : st.osText || ''}`);
    if (problems.length) { msg(`หยุด: บทพูด/ฉาก/ตัวหนังสือมีคำเสี่ยงผิดกฎ ${problems.join(' · ')}`, 'err'); return; }
    if (!findInput()) { msg('หาช่องพิมพ์ของ meta.ai ไม่เจอ - เปิดหน้าสร้างวิดีโอก่อน', 'err'); return; }
    run.on = true; run.stop = false; run.status = {};
    if (!opts.resumed) run.log = [];
    setRunFlag(true);
    queue.forEach((p) => { run.status[p.id] = 'รอคิว'; });
    log(`เริ่มรันคิว ${queue.length} สินค้า · ${seconds()} วิ — เปิดแท็บนี้ค้างไว้`);
    renderAll();
    try { await markExisting(); } catch (e) {}
    let ok = 0;
    try {
      for (let i = 0; i < queue.length; i++) {
        const p = queue[i];
        const name = safeName(p.name || `สินค้า ${i + 1}`);
        runItem = p;
        setRunFlag(true);
        try {
          const wantLong = seconds() > 10;
          if (st.scriptMode === 'ai') {
            if (needsScript(p)) {
              setStatus(p, '✍ Gemini กำลังเขียนบท');
              try { await writeScript(p); log(`✍ ${name}: “${p.script.split('\n').join(' / ')}”`); } catch (e) {
                if (e instanceof Stopped || /API key/.test(e.message)) throw e;
                p.scriptError = String(e.message || e);
                log(`⚠ ${name}: Gemini เขียนบทไม่ได้ (${e.message}) — ${(p.script || '').trim() ? 'ใช้บทเดิม' : 'ทำคลิปต่อโดยไม่กำหนดบท'} (ยังสั่งห้ามราคา/โปร/เด็ก ใน prompt)`, 'warn');
              }
            }
            const bad = checkText(p.script || '');
            if (bad.length) throw new Error(`บทพูดมีคำต้องห้าม: ${bad.join(' · ')}`);
          }
          const variants = st.variants === '2' ? 2 : 1;
          let saved = 0;
          for (let vi = 0; vi < variants; vi++) {
            const tag = variants > 1 ? `-${'AB'[vi]}` : '';
            try { saved += await makeClip(p, `${name}${tag}`, wantLong, variants > 1 ? ` แบบ ${'AB'[vi]}` : ''); } catch (e) {
              if (e instanceof Stopped || variants === 1) throw e;
              log(`❌ ${name}${tag}: ${e.message || e}`, 'err'); // แบบหนึ่งพลาด อีกแบบยังทำต่อ
            }
          }
          if (!saved) throw new Error('โหลดคลิปไม่ได้เลย');
          if (st.post !== 'off') {
            try { await savePost(p, name); log(`📝 โหลดไฟล์ข้อความโพสต์ ${name}.txt`, 'ok'); }
            catch (e) { log(`⚠ สร้างไฟล์ข้อความโพสต์ไม่ได้ (${e.message || e})`, 'warn'); }
          }
          p.done = true; ok++;
          bump('ok');
          await maybeSweep();
          setStatus(p, '✅ เสร็จ');
          save();
        } catch (e) {
          if (e instanceof Stopped) throw e;
          bump('fail');
          setStatus(p, '❌ ผิดพลาด');
          log(`❌ ${name}: ${e.message || e} — ข้ามไปตัวถัดไป`, 'err');
        }
        const gap = (+st.gap || 0) * 1000;
        if (i < queue.length - 1 && gap) { setStatus(queue[i + 1], '⏸ พักก่อนเริ่ม'); log(`พัก ${gap / 1000} วิ ก่อนสินค้าถัดไป`); await nap(gap); }
      }
      log(`จบคิว: สำเร็จ ${ok}/${queue.length}`, ok === queue.length ? 'ok' : 'warn');
    } catch (e) {
      if (!(e instanceof Stopped)) throw e;
      log('⏹ หยุดแล้ว (คลิปที่กำลังสร้างใน meta.ai ยังทำต่อได้ โหลดเองได้)', 'warn');
      queue.forEach((p) => { if (!/เสร็จ|ผิดพลาด/.test(run.status[p.id] || '')) run.status[p.id] = ''; });
    } finally {
      run.on = false; runItem = null;
      setRunFlag(false);
      save(); renderAll();
    }
  }

  // ทำต่อหลังรีเฟรช: จำไว้ว่ากำลังรันอยู่ ถ้าหน้าโหลดใหม่กลางคัน → ทำต่อเองใน 10 วิ
  function setRunFlag(on) { try { chrome.storage.local.set({ mahRun: { on, at: Date.now() } }); } catch (e) {} }
  function scheduleResume() {
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
      runQueue({ resumed: true });
    }, 10000);
  }

  // ---------- UI (Shadow DOM) ----------
  const host = document.createElement('div');
  host.id = 'mah-root';
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = `
  <style>
    :host { all: initial; }
    * { box-sizing: border-box; font-family: system-ui, "Noto Sans Thai", "Leelawadee UI", sans-serif; }
    [hidden] { display: none !important; }
    #fab { position: fixed; right: 20px; bottom: 96px; z-index: 2147483646; height: 48px; padding: 0 18px; border-radius: 24px;
      border: 1px solid #e5e5e5; cursor: pointer; background: #fff; color: #111; font-size: 15px; font-weight: 600;
      box-shadow: 0 6px 20px rgba(0,0,0,.18); }
    #panel { position: fixed; top: 0; right: 0; bottom: 0; z-index: 2147483647; width: min(580px, 46vw); min-width: 400px;
      background: #fff; color: #111; border-left: 1px solid #e5e5e5; display: flex; flex-direction: column;
      font-size: 15px; line-height: 1.5; box-shadow: -10px 0 40px rgba(0,0,0,.12); }
    header { display: flex; justify-content: space-between; align-items: center; padding: 16px 24px 8px; border-bottom: 1px solid #f0f0f0; }
    header h1 { margin: 0; font-size: 20px; font-weight: 700; }
    header button { border: none; background: none; font-size: 26px; line-height: 1; color: #888; cursor: pointer; }
    main { flex: 1; overflow: auto; padding: 4px 24px 16px; }
    h2 { font-size: 12px; font-weight: 700; color: #888; letter-spacing: .06em; margin: 18px 0 10px; }
    .card { border: 1px solid #ececec; border-radius: 10px; padding: 8px 10px; margin-bottom: 6px; }
    .card.off { opacity: .5; } .card.done { opacity: .4; }
    .card-top { display: flex; gap: 8px; align-items: center; }
    .card-top input[type=text] { flex: 1; }
    .meta { display: flex; flex-wrap: wrap; gap: 6px 10px; align-items: center; font-size: 12px; color: #777; margin-top: 8px; }
    .pill { border: 1px solid #ddd; border-radius: 999px; padding: 2px 10px; font-size: 12px; background: #fff; cursor: pointer; color: #333; }
    .pill:hover { border-color: #111; }
    .icon { border: none; background: none; cursor: pointer; color: #999; font-size: 17px; padding: 4px 6px; }
    .icon:hover { color: #111; }
    input[type=text], input[type=password], textarea { width: 100%; border: 1px solid #e5e5e5; border-radius: 10px; padding: 9px 11px; font-size: 14px;
      color: #111; background: #fafafa; resize: vertical; }
    input[type=text]:focus, input[type=password]:focus, textarea:focus { outline: none; border-color: #111; background: #fff; }
    input[type=checkbox] { width: 17px; height: 17px; accent-color: #111; margin: 0; }
    .imgs { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
    .thumb { position: relative; width: 68px; height: 68px; border-radius: 10px; overflow: hidden; background: #f2f2f2; }
    .thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .thumb button { position: absolute; top: 3px; right: 3px; width: 20px; height: 20px; border-radius: 50%; border: none;
      background: rgba(0,0,0,.6); color: #fff; font-size: 12px; line-height: 20px; padding: 0; cursor: pointer; }
    .add { width: 68px; height: 68px; border-radius: 10px; border: 1px dashed #cfcfcf; background: #fff; color: #888; font-size: 12px; cursor: pointer; }
    .add:hover { border-color: #111; color: #111; }
    .ghost { width: 100%; border: 1px dashed #cfcfcf; background: #fff; border-radius: 12px; padding: 10px; font-size: 14px; color: #555; cursor: pointer; }
    .ghost:hover { border-color: #111; color: #111; }
    .empty { font-size: 13px; color: #999; padding: 6px 0 10px; }
    .opt { margin-bottom: 14px; }
    .opt-label { font-size: 13px; color: #555; margin-bottom: 6px; }
    .chips { display: flex; flex-wrap: wrap; gap: 6px; }
    .chips button { border: 1px solid #e0e0e0; background: #fff; border-radius: 999px; padding: 7px 14px; font-size: 14px; color: #333; cursor: pointer; }
    .chips button.on { background: #111; border-color: #111; color: #fff; }
    .chips button:disabled { opacity: .35; cursor: not-allowed; }
    .hint { font-size: 12px; color: #999; margin-top: 4px; }
    .warn { font-size: 12px; color: #c62828; margin-top: 4px; }
    .people { display: flex; flex-wrap: wrap; gap: 10px; }
    .person { width: 92px; border: 1px solid #e5e5e5; border-radius: 12px; padding: 6px; cursor: pointer; position: relative; background: #fff; text-align: center; }
    .person.on { border-color: #111; box-shadow: 0 0 0 1px #111; }
    .person img { width: 78px; height: 78px; object-fit: cover; border-radius: 8px; display: block; margin: 0 auto 4px; }
    .person .nm { font-size: 12px; color: #333; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .person .x { position: absolute; top: 2px; right: 2px; width: 20px; height: 20px; border-radius: 50%; border: none;
      background: rgba(0,0,0,.6); color: #fff; font-size: 12px; line-height: 20px; padding: 0; cursor: pointer; }
    .person.none { display: flex; align-items: center; justify-content: center; height: 112px; color: #777; font-size: 13px; }
    .newp { border: 1px solid #ececec; border-radius: 12px; padding: 12px; margin-top: 10px; display: grid; grid-template-columns: 68px 1fr; gap: 8px 12px; }
    .newp .full { grid-column: 1 / -1; display: flex; gap: 8px; justify-content: flex-end; }
    .part { border: 1px solid #ececec; border-radius: 12px; padding: 12px 14px; margin-bottom: 12px; }
    .phead { display: flex; justify-content: space-between; align-items: center; font-weight: 700; gap: 8px; }
    .frame { display: flex; gap: 10px; align-items: center; margin: 8px 0 4px; font-size: 13px; color: #555; flex-wrap: wrap; }
    .prompt { white-space: pre-wrap; font-size: 12px; color: #444; background: #fafafa; border: 1px solid #eee; border-radius: 10px;
      padding: 10px; margin-top: 8px; max-height: 260px; overflow: auto; }
    .btn { border: 1px solid #ddd; background: #fff; border-radius: 10px; padding: 7px 12px; font-size: 13px; cursor: pointer; color: #111; }
    .btn.dark { background: #111; color: #fff; border-color: #111; }
    .btn:disabled, .pill:disabled { opacity: .35; cursor: default; }
    footer { border-top: 1px solid #eee; padding: 14px 24px 16px; background: #fff; }
    .actions { display: flex; gap: 8px; }
    .actions button { border-radius: 12px; padding: 12px; font-size: 15px; font-weight: 600; cursor: pointer; }
    .primary { flex: 1; background: #111; color: #fff; border: 1px solid #111; }
    .primary:hover { background: #333; }
    #msg { font-size: 13px; min-height: 18px; margin-top: 8px; color: #666; }
    #msg.ok { color: #0a7d3c; } #msg.err { color: #c62828; }
    .tabs { display: flex; gap: 4px; padding: 0 24px; border-bottom: 1px solid #f0f0f0; }
    .tabs button { border: none; background: none; padding: 12px 14px 10px; font-size: 15px; font-weight: 600; color: #999; cursor: pointer; border-bottom: 2px solid transparent; }
    .tabs button.on { color: #111; border-bottom-color: #111; }
    .runrow { display: flex; gap: 8px; margin-bottom: 8px; }
    .runrow button { border-radius: 12px; padding: 10px 12px; font-size: 14px; font-weight: 600; cursor: pointer; }
    .run { flex: 1; background: #0a7d3c; color: #fff; border: 1px solid #0a7d3c; }
    .run:disabled { opacity: .5; cursor: default; }
    .stop { background: #fff; color: #c62828; border: 1px solid #c62828; }
    #runlog { font: 12px/1.6 ui-monospace, Menlo, Consolas, monospace; background: #fafafa; border: 1px solid #eee; border-radius: 10px;
      padding: 8px 10px; max-height: 150px; overflow: auto; margin-bottom: 8px; white-space: pre-wrap; }
    #gTest .okline { color: #0a7d3c; } #gTest .warn { margin: 0; }
    #runlog .ok { color: #0a7d3c; } #runlog .err { color: #c62828; } #runlog .warn { color: #b26a00; }
    .status { font-weight: 600; color: #111; }
    .qcard { display: grid; grid-template-columns: 52px 1fr; gap: 4px 10px; }
    .qcard .cover { width: 52px; height: 52px; border-radius: 8px; overflow: hidden; background: #f2f2f2; position: relative; cursor: pointer; grid-row: span 2; }
    .qcard .cover img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .qcard .cover .n { position: absolute; right: 2px; bottom: 2px; background: rgba(0,0,0,.65); color: #fff; font-size: 10px; border-radius: 6px; padding: 0 4px; }
    .qcard .cover.empty { display: flex; align-items: center; justify-content: center; font-size: 11px; color: #999; border: 1px dashed #cfcfcf; background: #fff; }
    .qcard .row1 { display: flex; gap: 4px; align-items: center; }
    .qcard .row1 input { flex: 1; padding: 5px 8px; font-size: 13px; border-radius: 8px; }
    .qcard textarea { padding: 5px 8px; font-size: 13px; border-radius: 8px; min-height: 0; line-height: 1.4; }
    .qcard .meta { margin-top: 2px; gap: 4px 8px; grid-column: 2; }
    .qcard .pill { padding: 1px 8px; font-size: 11px; }
    .qcard .warn { grid-column: 2; margin: 0; }
    .qcard .imgs { grid-column: 1 / -1; margin-top: 4px; gap: 6px; }
    .qcard .thumb, .qcard .add { width: 44px; height: 44px; border-radius: 8px; font-size: 11px; }
    .qbar { display: flex; gap: 8px; align-items: center; margin: 12px 0 8px; font-size: 12px; color: #777; }
    .qbar .btn { padding: 5px 10px; font-size: 12px; }
    .qbar { flex-wrap: wrap; } .qbar .stat { margin-left: auto; color: #999; }
    .qcard .more { grid-column: 1 / -1; display: grid; gap: 4px; margin-top: 4px; }
    .qcard .more .cap { font-size: 12px; color: #555; white-space: pre-wrap; }
  </style>
  <button id="fab" title="ผู้ช่วยทำคลิป Shopee Video">🎬 Shopee Video</button>
  <div id="panel" hidden>
    <header><h1>Shopee Video</h1><button id="close" title="ปิด">×</button></header>
    <nav class="tabs"><button data-tab="queue" id="tabQueue">คิวสินค้า</button><button data-tab="settings">ตั้งค่าคลิป</button></nav>
    <main id="tab-queue">
      <div class="qbar" id="qbar"></div>
      <div id="products"></div>
      <button class="ghost" id="addProduct">+ เพิ่มสินค้าเอง</button>
      <div class="hint">เพิ่มจาก Shopee Affiliate: กดปุ่ม “＋ คิวคลิป” บนหน้าข้อเสนอผลิตภัณฑ์ · กด ▶ แล้วทำทุกตัวในคิว ไม่เอาตัวไหนกด 🗑</div>
    </main>
    <main id="tab-settings" hidden>
      <div style="height:14px"></div>
      <div class="opt"><div class="opt-label">แนวสำเร็จรูป (กดแล้วตั้งค่าให้ แก้ต่อได้)</div><div class="chips" id="presets"></div></div>
      <div class="opt"><div class="opt-label">ความยาว</div><div class="chips" data-key="duration"></div></div>
      <div class="opt"><div class="opt-label">จังหวะ</div><div class="chips" data-key="pace"></div></div>
      <div class="opt"><div class="opt-label">ความคมชัด</div><div class="chips" data-key="quality"></div>
        <div class="hint">ขอใน prompt ให้ภาพคมที่สุด — ความละเอียดไฟล์จริง meta.ai เป็นคนกำหนด</div></div>
      <div class="opt"><div class="opt-label">จำนวนซีน</div><div class="chips" data-key="scenes"></div></div>
      <div class="opt"><div class="opt-label">ลูกเล่นภาพ (เลือกได้หลายอัน)</div><div class="chips" data-key="vfx"></div></div>
      <div class="opt"><div class="opt-label">พักระหว่างสินค้าแต่ละตัว (ตอนรันคิว)</div><div class="chips" data-key="gap"></div></div>
      <div class="opt"><label class="opt-label" style="display:flex;gap:8px;align-items:center;cursor:pointer"><input type="checkbox" id="cleanOn"> ล้างไฟล์เก่าใน meta.ai อัตโนมัติ (พื้นที่จำกัด ~500MB · เต็มแล้วรวมคลิป 20 วิไม่ได้)</label>
        <div class="chips" data-key="cleanEvery"></div>
        <div class="hint">ทำครบตามจำนวน → ส่งข้อความแยกสั่ง meta.ai ลบไฟล์เก่า (ไม่ทำวิดีโอ) แล้วรอให้ว่างก่อนทำตัวต่อไป · “ทุกคลิป” = ใส่คำสั่งล้างไว้ใน prompt ทุกตัว</div></div>
      <div class="opt"><button class="btn" id="resetBad">ล้างรายการปุ่มที่จำว่า “ไม่ใช่ปุ่มส่ง”</button>
        <div class="hint">ใช้เมื่อเปลี่ยนหน้าจอ meta.ai หรือระบบจำปุ่มผิด</div></div>
      <div class="opt"><div class="opt-label">คลิปต่อสินค้า</div><div class="chips" data-key="variants"></div></div>
      <div class="opt"><div class="opt-label">ไฟล์ข้อความโพสต์ (.txt: แคปชัน + แฮชแท็ก + ลิงก์ affiliate)</div><div class="chips" data-key="post"></div></div>

      <div class="opt"><div class="opt-label">สไตล์</div><div class="chips" data-key="style"></div></div>
      <div class="opt"><div class="opt-label">การเห็นผู้แสดง</div><div class="chips" data-key="view"></div></div>
      <div class="opt"><div class="opt-label">ผู้แสดง</div><div class="chips" data-key="presenter"></div><div class="hint" id="presenterHint"></div></div>
      <div class="opt"><div class="opt-label">โทนเสียง</div><div class="chips" data-key="tone"></div></div>
      <div class="opt"><div class="opt-label">ตัวหนังสือบนจอ</div><div class="chips" data-key="text"></div></div>
      <div class="opt" id="fxOpt"><div class="opt-label">ลูกเล่นตัวหนังสือ</div><div class="chips" data-key="fx"></div>
        <input type="text" id="osText" placeholder="ข้อความเอง (ไม่บังคับ) เช่น เช็ดทีเดียวเกลี้ยง" style="margin-top:8px"><div class="warn" id="osWarn"></div>
        <div class="hint">AI อาจสะกดตัวหนังสือไทยเพี้ยน ใช้สั้นๆ จะชัดกว่า · ห้ามราคา/โปร/ส่วนลดเหมือนเดิม</div></div>
      <div class="opt" id="peopleOpt">
        <div class="opt-label">พรีเซนเตอร์ (เลือกแล้ว = ultra realistic + ล็อกหน้า + เสียงตามเพศ/อายุในรูป)</div>
        <div class="people" id="people"></div>
        <div class="newp" id="newp" hidden>
          <div id="newpImg"></div>
          <div><input type="text" id="newpName" placeholder="ชื่อ เช่น มิ้นท์"><input type="text" id="newpDesc" placeholder="คำบรรยาย เช่น ผู้หญิงไทย 25 ปี ผมยาวดำ" style="margin-top:6px"></div>
          <div class="full"><button class="btn" id="newpCancel">ยกเลิก</button><button class="btn dark" id="newpSave">บันทึก</button></div>
        </div>
      </div>
      <div class="opt"><div class="opt-label">ฉาก / สถานที่ (ไม่บังคับ)</div>
        <input type="text" id="scene" placeholder="เช่น โต๊ะไม้สีอ่อนริมหน้าต่าง แสงเช้า"><div class="warn" id="sceneWarn"></div></div>

      <h2>บทพูด</h2>
      <div class="opt"><div class="chips" data-key="scriptMode"></div></div>
      <div class="opt" id="aiOpt">
        <div class="opt-label">Gemini API key (ฟรี: aistudio.google.com → Get API key) · เก็บไว้ในเครื่องนี้เท่านั้น</div>
        <input type="password" id="gKey" placeholder="วาง API key ที่นี่" autocomplete="off">
        <input type="text" id="gModel" placeholder="รุ่น (ว่าง = เลือกอัตโนมัติ เช่น gemini-2.5-flash)" style="margin-top:6px">
        <div style="margin-top:8px"><button class="btn" id="gTestBtn">🔌 ทดสอบ key + รุ่น</button></div>
        <div id="gTest" class="hint" style="white-space:pre-wrap"></div>
        <div class="hint">ตอนรัน: สินค้าที่ยังไม่มีบท Gemini จะเขียนบทไทยจากชื่อ + รูป แล้วตรวจคำต้องห้าม (ผิดให้เขียนใหม่) · แก้บทเองได้ที่การ์ดสินค้า</div>
      </div>
      <div id="clips"></div>
      <div class="hint">ใส่ให้ทุกครั้ง: แนวตั้ง 9:16 · ภาษาไทยเท่านั้น · ล็อกสินค้า · ห้ามราคา/โปร/ส่วนลด (ทั้งพูดและตัวหนังสือ) · ห้ามมีเด็ก</div>
      <div class="hint">15 / 20 วิ: สั่ง meta.ai ทำทีเดียวทั้งคลิป (ถ้าทำได้ทีละ 10 วิ ให้ต่อจากเฟรมสุดท้ายเอง)</div>
    </main>
    <footer>
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
    set: (o) => { try { chrome.storage.local.set(o); } catch (e) {} },
  };
  const mySaves = []; // สิ่งที่แท็บนี้บันทึกเอง (ไม่ต้องโหลดกลับ) — เก็บหลายรอบกันบันทึกซ้อนกัน
  const save = () => {
    mySaves.push(JSON.stringify(products));
    if (mySaves.length > 20) mySaves.shift();
    store.set({ mah3: st, mah3Products: products, mah6Presenters: presenters });
  };
  function msg(text, cls) { $('msg').textContent = text; $('msg').className = cls || ''; }

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
  function renderQbar() {
    const box = $('qbar');
    const missing = todo().filter(needsScript).length;
    const sToday = stats.day === today() ? stats : { ok: 0, fail: 0, clips: 0, gemini: 0 };
    const items = [el('span', '', `${todo().length} รอทำ · ${products.filter((p) => p.done).length} เสร็จ`)];
    const stat = el('span', 'stat', `วันนี้ ✅${sToday.ok} ❌${sToday.fail} · คลิป ${sToday.clips} · Gemini ${sToday.gemini} ครั้ง`);
    stat.title = 'สถิติวันนี้: สินค้าที่ทำเสร็จ / ผิดพลาด · ไฟล์คลิปที่โหลด · จำนวนครั้งที่เรียก Gemini (รวมที่ลองใหม่)';
    if (st.scriptMode === 'ai') {
      const b = el('button', 'btn dark', writer.on ? (writer.stop ? 'กำลังหยุด...' : `⏹ หยุดเขียน (${writer.done}/${writer.total})`) : `✨ เขียนบททั้งหมด (${missing})`);
      b.disabled = run.on || (!writer.on && !missing);
      b.title = 'Gemini เขียนบทให้ทุกตัวที่ยังไม่มีบท หรือบทเดิมเขียนไว้สำหรับความยาว/จังหวะอื่น (บทที่แก้เองไม่ทับ) ทีละตัว เว้นระยะกัน rate limit';
      b.onclick = writeAll;
      items.push(b);
    }
    items.push(stat);
    box.replaceChildren(...items);
  }

  function productCard(p) {
    const c = el('div', 'card qcard' + (p.done ? ' done' : ''));
    // รูปปก: กดเพื่อกาง/พับรูปทั้งหมด
    const cover = el('div', 'cover' + (p.images.length ? '' : ' empty'));
    if (p.images.length) {
      const im = el('img'); im.src = p.images[0].dataUrl; cover.append(im);
      if (p.images.length > 1) cover.append(el('span', 'n', `${p.images.length}`));
    } else cover.textContent = '+ รูป';
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
    del.onclick = () => { products = products.filter((x) => x.id !== p.id); save(); renderAll(); };
    row1.append(name, del);
    c.append(cover, row1);
    // บทพูด (โหมด Gemini)
    if (st.scriptMode === 'ai') {
      const t = el('textarea'); t.rows = 1; t.placeholder = 'บทพูด (1 บรรทัด = 1 ช่วงของคลิป) — ว่างไว้ Gemini เขียนให้ตอนรัน'; t.value = p.script || '';
      const fit = () => { t.style.height = 'auto'; t.style.height = `${Math.min(t.scrollHeight + 2, 140)}px`; };
      const stale = () => ((p.script || '').trim() && needsScript(p) ? 'บทนี้เขียนไว้สำหรับคลิปความยาว/จังหวะอื่น — จะเขียนใหม่ตอนรัน (หรือกด ✨ เขียนใหม่)' : '');
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
    if (run.status[p.id]) meta.append(el('span', 'status', run.status[p.id]));
    if (p.commission) meta.append(el('span', '', `คอม ${p.commission}`));
    if (p.link) {
      const b = el('button', 'pill', '📋 ลิงก์');
      b.title = p.link;
      b.onclick = () => copy(p.link, `คัดลอกลิงก์แล้ว ✓ ${p.link}`);
      meta.append(b);
    }
    if (st.scriptMode === 'ai' && !p.done) {
      const w = el('button', 'pill', p.script ? '✨ เขียนใหม่' : '✨ เขียนบท');
      w.disabled = writer.on;
      w.onclick = async () => {
        w.disabled = true; w.textContent = 'กำลังเขียน...';
        try { await writeScript(p); msg('เขียนบทแล้ว ✓', 'ok'); } catch (e) { p.scriptError = String(e.message || e); save(); msg(`เขียนบทไม่ได้: ${p.scriptError}`, 'err'); }
        renderProducts(); renderQbar();
      };
      meta.append(w);
    }
    if (p.done) {
      const again = el('button', 'pill', '↺ ทำใหม่');
      again.onclick = () => { p.done = false; delete run.status[p.id]; save(); renderAll(); };
      meta.append(again);
    }
    c.append(meta);
    if (openImgs.has(p.id)) {
      const imgs = el('div', 'imgs');
      imgs.append(...p.images.map((img, i) => thumb(img, () => { p.images.splice(i, 1); save(); renderAll(); })),
        addBtn('+ รูป', () => { uploadTarget = p.id; $('prodFile').click(); }));
      c.append(imgs);
      // รายละเอียดสินค้า (Gemini ใช้เขียนบท) + แคปชันที่จะใส่ในไฟล์โพสต์
      const more = el('div', 'more');
      const d = el('textarea'); d.rows = 2; d.placeholder = 'รายละเอียด/จุดเด่นสินค้า (ไม่บังคับ) — Gemini ใช้เขียนบท'; d.value = p.desc || '';
      d.oninput = () => { p.desc = d.value; save(); };
      more.append(d);
      if (p.caption || (p.tags && p.tags.length)) more.append(el('div', 'cap', `แคปชันโพสต์: ${p.caption || '-'}\n${(p.tags || []).join(' ')}`));
      c.append(more);
    }
    return c;
  }

  function renderProducts() {
    const box = $('products');
    const list = [...products].sort((a, b) => a.done - b.done);
    box.replaceChildren(...(list.length ? list.map(productCard) : [el('div', 'empty', 'ยังไม่มีสินค้าในคิว')]));
    renderQbar();
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
    if (draft) $('newpImg').replaceChildren(thumb(draft.image, () => { draft = null; renderPeople(); }));
  }

  function renderChips() {
    const m = mode();
    root.querySelectorAll('.chips[data-key]').forEach((box) => {
      const key = box.dataset.key;
      box.replaceChildren(...OPTIONS[key].map(([val, label]) => {
        const b = el('button', '', label);
        const on = key === 'presenter' ? (m === 'hands' ? val === 'human' : m === 'none' ? false : st.presenter === val)
          : MULTI.has(key) ? st[key].includes(val) : st[key] === val;
        b.className = on ? 'on' : '';
        b.disabled = key === 'presenter' && (m === 'hands' || m === 'none');
        b.onclick = () => {
          if (MULTI.has(key)) { // อัตโนมัติ/ไม่ใส่ = เลือกได้อันเดียว · อย่างอื่นกดสลับเปิด/ปิด
            const solo = ['auto', 'none'];
            let a = solo.includes(val) ? [val] : st[key].filter((x) => !solo.includes(x));
            if (!solo.includes(val)) a = a.includes(val) ? a.filter((x) => x !== val) : [...a, val];
            st[key] = a.length ? a : ['auto'];
          } else st[key] = val;
          save(); renderAll();
        };
        return b;
      }));
    });
    $('presenterHint').textContent = m === 'hands' ? 'เห็นแค่มือ = มือคนจริง + เสียงบรรยาย' : m === 'none' ? 'ไม่เห็นคน = ถ่ายสินค้าล้วน + เสียงบรรยาย' : '';
    $('peopleOpt').hidden = !(m === 'person' || m === 'auto');
    $('fxOpt').hidden = st.text === 'none';
    $('aiOpt').hidden = st.scriptMode !== 'ai';
    $('cleanOn').checked = !!st.cleanOn;
    root.querySelector('.chips[data-key=cleanEvery]').style.opacity = st.cleanOn ? '' : '.4';
  }

  // ช่องบทพูด + เฟรมสุดท้าย + prompt ของแต่ละคลิป
  function renderClips() {
    const d = el('div', 'part');
    const head = el('div', 'phead', `คลิป ${seconds()} วิ`);
    const cp = el('button', 'pill', 'คัดลอก prompt');
    cp.onclick = () => copy(buildPrompt(), `คัดลอก prompt แล้ว ✓ (ของ: ${(active()[0] || {}).name || '-'})`);
    head.append(cp);
    const line = el('input');
    line.type = 'text';
    line.placeholder = 'บทพูดไทย (ไม่บังคับ)';
    line.value = st.lines[1] || '';
    line.style.marginTop = '8px';
    const warn = el('div', 'warn', checkText(line.value).join(' · '));
    line.oninput = () => { st.lines[1] = line.value; save(); warn.textContent = checkText(line.value).join(' · '); };
    if (st.scriptMode === 'ai') d.append(head, el('div', 'hint', 'บทพูดแยกตามสินค้า (ดูที่การ์ดในแท็บคิวสินค้า)'));
    else d.append(head, line, warn);
    $('clips').replaceChildren(d);
  }

  function renderRun() {
    const left = todo().length;
    const go = el('button', 'run', run.on ? '⏳ กำลังรันคิว...' : `▶ รันคิวอัตโนมัติ (${left} สินค้า)`);
    go.disabled = run.on || !left || writer.on;
    go.title = 'ใส่ prompt + รูป → กดส่ง → รอคลิป → ดาวน์โหลด ทีละสินค้า จนหมดคิว';
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
    const diag = el('button', 'stop', '🔍');
    diag.title = 'คัดลอกข้อมูลหน้าเว็บ meta.ai (ชื่อ/ตำแหน่งปุ่ม จำนวนวิดีโอ — ไม่มีข้อความแชต) ไว้ส่งให้ผู้พัฒนาปรับตัวจับปุ่ม';
    diag.style.borderColor = '#ccc'; diag.style.color = '#555';
    diag.onclick = () => copy(pageDiag(), 'คัดลอกข้อมูลหน้าเว็บแล้ว ✓ วางส่งในแชตได้เลย');
    const folder = el('button', 'stop', '📂');
    folder.title = 'เปิดโฟลเดอร์ที่เก็บคลิป (Downloads/ShopeeVideo)';
    folder.style.borderColor = '#ccc'; folder.style.color = '#555';
    folder.onclick = () => { try { chrome.runtime.sendMessage({ type: 'showFolder' }, () => {}); } catch (e) { msg('เปิดโฟลเดอร์ไม่ได้ — ดูที่ Downloads/ShopeeVideo', 'err'); } };
    items.push(folder, diag);
    $('runrow').replaceChildren(...items);
    $('tabQueue').textContent = `คิวสินค้า (${left})`;
    const box = $('runlog');
    box.hidden = !run.log.length;
    box.replaceChildren(...run.log.map((l) => el('div', l.cls, l.text)));
    box.scrollTop = box.scrollHeight;
  }

  function renderPresets() {
    $('presets').replaceChildren(...PRESETS.map((pr) => {
      const on = Object.entries(pr.set).every(([k, v]) => st[k] === v);
      const b = el('button', on ? 'on' : '', pr.label);
      b.onclick = () => {
        Object.assign(st, pr.set);
        $('scene').value = st.scene;
        $('sceneWarn').textContent = checkText(st.scene).join(' · ');
        save(); renderAll(); msg(`ตั้งค่าแนว “${pr.label}” แล้ว ✓`, 'ok');
      };
      return b;
    }));
  }

  function renderAll() { renderPresets(); renderProducts(); renderChips(); renderPeople(); renderClips(); renderRun(); }

  (async () => {
    const r = await store.get(['mah3', 'mah3Face', 'mah3Products', 'mah6Presenters', 'mahGemini', 'mahStats', 'mahRun', 'mahSeenClips', 'mahCleanCount', 'mahHookIdx', 'mahBadButtons']);
    badButtons = new Set(r.mahBadButtons || []);
    hookIdx = +r.mahHookIdx || 0;
    seenClips = new Set(r.mahSeenClips || []);
    if (r.mahStats && r.mahStats.day === today()) stats = { ...stats, ...r.mahStats };
    gemini = { ...gemini, ...(r.mahGemini || {}) };
    $('gKey').value = gemini.key || '';
    if (gemini.model === 'gemini-flash-latest') gemini.model = ''; // ค่าเริ่มต้นเดิม → อัตโนมัติ
    $('gModel').value = gemini.model || '';
    st = { ...DEFAULTS, ...(r.mah3 || {}) };
    if (!st.lines || typeof st.lines !== 'object') st.lines = {};
    if (!Array.isArray(st.vfx) || !st.vfx.length) st.vfx = ['auto'];
    if (st.cleanup === 'off') { st.cleanOn = false; delete st.cleanup; } else if (st.cleanup) delete st.cleanup; // ตั้งค่าเดิม v0.20
    cleanCount = +r.mahCleanCount || 0;
    products = (r.mah3Products || []).map((p) => ({ ...newProduct(), ...p }));
    presenters = r.mah6Presenters || [];
    if (!r.mah6Presenters && r.mah3Face) { // ย้ายรูปหน้าจาก v0.5 เป็นพรีเซนเตอร์คนแรก
      presenters = [{ id: uid(), name: 'พรีเซนเตอร์ 1', desc: '', image: r.mah3Face }];
      st.presenterId = presenters[0].id;
      save();
    }
    // (ต้องอยู่หลังโหลดสินค้า/พรีเซนเตอร์ ไม่งั้น save() จะเขียนคิวว่างทับ)
    if (OLD_ROOM_SCENES.includes(st.scene)) { // เคยกดแนวห้องรุ่นเก่า → ห้องสว่าง เห็นบรรยากาศ + บทเป็นกันเอง
      Object.assign(st, PRESETS[0].set);
      save();
    }
    $('scene').value = st.scene || '';
    $('sceneWarn').textContent = checkText(st.scene).join(' · ');
    $('osText').value = st.osText || '';
    $('osWarn').textContent = checkText(st.osText).join(' · ');
    renderAll();
    if (r.mahRun && r.mahRun.on && Date.now() - r.mahRun.at < 30 * 60000 && todo().length) scheduleResume();
  })();
  // สินค้าที่เพิ่มจากแท็บ Shopee โผล่ทันที
  try {
    chrome.storage.onChanged.addListener((ch) => {
      if (!ch.mah3Products) return;
      const nv = ch.mah3Products.newValue || [];
      if (mySaves.includes(JSON.stringify(nv))) return;
      if (run.on || writer.on) { // ระหว่างรัน: เพิ่มเฉพาะสินค้าใหม่ ไม่ทับสถานะที่กำลังทำ
        const ids = new Set(products.map((p) => p.id));
        products.push(...nv.filter((p) => !ids.has(p.id)).map((p) => ({ ...newProduct(), ...p })));
        renderAll();
        return;
      }
      // รวมเข้าของเดิม (ไม่สร้างใหม่) งานที่ถือสินค้าตัวเดิมอยู่จะได้ไม่หลุด
      const byId = new Map(products.map((p) => [p.id, p]));
      products = nv.map((p) => (byId.has(p.id) ? Object.assign(byId.get(p.id), p) : { ...newProduct(), ...p }));
      renderAll();
    });
  } catch (e) {}

  const saveGemini = () => {
    gemini.key = $('gKey').value.trim();
    gemini.model = $('gModel').value.trim();
    store.set({ mahGemini: gemini });
  };
  $('gKey').oninput = () => { saveGemini(); modelCache = null; };
  $('gTestBtn').onclick = async () => {
    const b = $('gTestBtn');
    b.disabled = true; b.textContent = 'กำลังทดสอบ...';
    try { await testGemini(); } catch (e) { $('gTest').append(el('div', 'warn', String(e.message || e))); }
    b.disabled = false; b.textContent = '🔌 ทดสอบ key + รุ่น';
  };
  $('gModel').oninput = saveGemini;
  $('resetBad').onclick = () => { const n = badButtons.size; badButtons = new Set(); try { chrome.storage.local.set({ mahBadButtons: [] }); } catch (e) {} msg(`ล้างแล้ว (${n} ปุ่ม)`, 'ok'); };
  $('cleanOn').onchange = () => { st.cleanOn = $('cleanOn').checked; save(); renderAll(); };
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
  for (const t of ['keydown', 'keyup', 'keypress']) host.addEventListener(t, (e) => e.stopPropagation());

  $('addProduct').onclick = () => {
    products.push(newProduct());
    save(); renderAll();
    const inputs = root.querySelectorAll('#products input[type=text]');
    inputs[inputs.length - 1].focus();
  };
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
      $('tab-queue').hidden = b.dataset.tab !== 'queue';
      $('tab-settings').hidden = b.dataset.tab !== 'settings';
    };
  });
  $('tabQueue').classList.add('on');
  $('fab').onclick = () => { panel.hidden = false; $('fab').hidden = true; };
  $('close').onclick = () => { panel.hidden = true; $('fab').hidden = false; };

})();
