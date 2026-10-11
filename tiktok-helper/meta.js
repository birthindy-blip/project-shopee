// Persistent generation queue. Media stays as Blob in this extension's IndexedDB.
(() => {
  let jobs = [], running = false, stopping = false, current = null, lease = null;
  const dbReady = new Promise((resolve,reject) => {
    const req = indexedDB.open('tthMetaMedia',1);
    req.onupgradeneeded = () => req.result.createObjectStore('clips');
    req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error);
  });
  async function media(action,id,value) {
    const db = await dbReady;
    return new Promise((resolve,reject) => {
      const tx = db.transaction('clips',action === 'get' ? 'readonly' : 'readwrite');
      const req = action === 'put' ? tx.objectStore('clips').put(value,id) : action === 'delete' ? tx.objectStore('clips').delete(id) : tx.objectStore('clips').get(id);
      tx.oncomplete = () => resolve(req.result); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error);
    });
  }
  const save = () => store.set({tthMetaJobs:jobs});
  async function ask(tabId,message) {
    const r = await chrome.tabs.sendMessage(tabId,message);
    if (!r?.ok) throw new Error(r?.error || 'Meta AI ไม่ตอบ — Reload ส่วนเสริมแล้วรีเฟรชแท็บ Meta AI');
    return r;
  }
  async function tabs() {
    const selected = $('metaTab').value;
    const all = await chrome.tabs.query({url:['https://www.meta.ai/*','https://meta.ai/*']});
    $('metaTab').replaceChildren(...all.map(t => { const o=el('option','',t.title || 'Meta AI'); o.value=t.id; return o; }));
    if (all.some(t => String(t.id) === selected)) $('metaTab').value=selected;
    $('metaState').textContent = all.length ? `${all.length} แท็บ` : 'ยังไม่มีแท็บ Meta AI';
  }
  function draw() {
    const on=accountsOn();
    function options(id,first) {
      const select=$(id), selected=select.value;
      const opts=[['',first], ...acc.accounts.map(a=>[a.openId,`${accName(a)}${a.on && !a.expired ? '' : ' (ปิดใช้ / หมดอายุ)'}`])];
      const sig=JSON.stringify(opts);
      if(select.dataset.sig!==sig) { select.replaceChildren(...opts.map(([v,t])=>{const o=el('option','',t);o.value=v; if(id==='metaTarget' && v && !on.some(a=>a.openId===v)) o.disabled=true;return o;})); select.value=opts.some(([v])=>v===selected)?selected:'';select.dataset.sig=sig; }
    }
    options('metaTarget', on.length ? 'แบ่งให้บัญชีที่มีคลิปรอน้อยที่สุด' : 'เจนอย่างเดียว — ยังไม่เลือกบัญชี');
    options('metaFilter','ดูทุกบัญชี');
    const waiting=jobs.filter(TTHRouting.pending);
    $('metaQueueCount').textContent=`${waiting.length} รอทำ · ${jobs.length} ทั้งหมด`;
    $('navJobs').textContent=waiting.length;
    $('metaDistribution').replaceChildren();
    const counts=el('div','account-summary');
    for(const a of acc.accounts) counts.append(el('span','',`${accName(a)} · ${waiting.filter(j=>j.openId===a.openId).length} คลิป`));
    if(waiting.some(j=>!j.openId)) counts.append(el('span','',`ยังไม่เลือกบัญชี · ${waiting.filter(j=>!j.openId).length}`));
    $('metaDistribution').append(counts);
    $('metaSendSummary').textContent=$('metaAuto').checked ? `${st.mode==='direct'?'โพสต์ตรงตามสิทธิ์แอป TikTok':'ส่งกล่องร่าง — กดโพสต์เองใน TikTok'} · เว้น ${st.gap} นาที` : 'เจนอย่างเดียว — คลิปจะอยู่ที่แท็บ “คลิปพร้อมส่ง”';
    $('metaDistribute').disabled=running || !waiting.length || !on.length;
    for(const id of ['metaName','metaPrompt','metaCaption','metaImage','metaTarget','metaAdd']) $(id).disabled=running;
    $('metaRun').disabled=running || !jobs.some(j => j.state==='wait' || j.state==='ready');
    $('metaStop').disabled=!running || stopping;
    $('metaRun').textContent=running ? 'กำลังทำคิว...' : '▶ เริ่มคิวเจน';
    $('metaAuto').disabled=running; $('metaTab').disabled=running; $('metaRefresh').disabled=running;
    const visibleJobs=jobs.filter(j=>!$('metaFilter').value || j.openId===$('metaFilter').value);
    $('metaJobs').replaceChildren(...visibleJobs.map(j => {
      const row=el('div',`item ${j.state==='error' ? 'err' : j.state==='done' ? 'ok' : ''}`);
      const title=el('div','nm',j.name), acts=el('div','acts'), note=el('div','note',j.note || j.state);
      const states={wait:'รอเจน',ready:'มีคลิปแล้ว',generating:'กำลังเจน',done:'เสร็จ',error:'ต้องตรวจ',interrupted:'หยุดไว้'};
      title.append(el('span','status-badge',states[j.state] || j.state));
      const target=el('select'); target.setAttribute('aria-label',`บัญชีสำหรับ ${j.name}`);
      const choices=[['','ยังไม่เลือกบัญชี'],...acc.accounts.map(a=>[a.openId,accName(a)])];
      if(j.openId && !acc.accounts.some(a=>a.openId===j.openId)) choices.push([j.openId,'บัญชีถูกนำออกแล้ว']);
      target.replaceChildren(...choices.map(([v,t])=>{const o=el('option','',t);o.value=v; if(v && !on.some(a=>a.openId===v)) o.disabled=true;return o;})); target.value=j.openId || '';
      const existing=items.find(it=>it.id===j.id);
      target.disabled=running || !!(existing && doneBefore(existing).length);
      target.onchange=async()=>{j.openId=target.value; if(existing){existing.openId=j.openId;existing.accountLocked=!!j.openId;} await save();draw();renderItems();};
      const prompt=el('details','prompt-preview'); const summary=el('summary','','ดูพรอมป์ต์'); prompt.append(summary,el('p','hint',j.prompt));
      if (j.state==='error' || j.state==='interrupted') {
        const retry=el('button','btn','ตรวจ / ทำต่อ'); retry.disabled=running;
        retry.onclick=async () => {
          try {
            const ping=j.tabId ? await ask(j.tabId,{type:'tthMetaPing'}).catch(()=>null) : null;
            if (await media('get',j.id)) { j.state='ready'; j.note='มีคลิปแล้ว — พร้อมส่งเข้าคิว TikTok'; }
            else if (ping?.pending===j.id) {
              await receive(j,await ask(j.tabId,{type:'tthMetaInfo',id:j.id})); j.state='ready'; j.note='รับคลิปเดิมแล้ว';
            } else {
              if (ping?.busy) throw new Error('Meta AI ยังทำงานอยู่ — รอคลิปเดิมก่อน');
              if (!confirm('ไม่พบไฟล์คลิปที่เก็บไว้ ตรวจ Meta AI ว่าคลิปเดิมยังสร้างอยู่หรือไม่ ก่อนยืนยันส่งพรอมป์ต์ใหม่')) return;
              j.state='wait'; j.note='รอเจนใหม่';
            }
            await save(); draw();
          } catch(e) { msg(e.message,'err'); }
        }; acts.append(retry);
      }
      const remove=el('button','icon','🗑'); remove.disabled=running;
      remove.onclick=async () => {
        try {
          if (j.tabId) await ask(j.tabId,{type:'tthMetaRelease',id:j.id}).catch(()=>{});
          await media('delete',j.id); jobs=jobs.filter(x=>x!==j); await save(); draw();
        } catch(e) { msg(e.message,'err'); }
      };
      acts.append(remove); row.append(title,acts,target,note,prompt); return row;
    }), ...(visibleJobs.length?[]:[el('div','empty','ยังไม่มีคลิปในคิวนี้ — ใส่พรอมป์ต์แล้วกด “เพิ่มคลิปเข้าคิว”')]));
  }
  async function receive(j,info) {
    const parts=[];
    for (let offset=0;offset<info.size;offset+=262144) {
      if (stopping) throw new Error('หยุดรับคลิปแล้ว — กดทำต่อเพื่อรับคลิปเดิม');
      const chunk=await ask(j.tabId,{type:'tthMetaChunk',id:j.id,offset});
      const bytes=Uint8Array.from(atob(chunk.data),c=>c.charCodeAt(0));
      if (bytes.length!==Math.min(262144,info.size-offset)) throw new Error('ข้อมูลคลิปไม่ครบ');
      parts.push(bytes);
    }
    const blob=new Blob(parts,{type:info.mime});
    await media('put',j.id,blob);
    await ask(j.tabId,{type:'tthMetaRelease',id:j.id});
  }
  async function enqueue(j) {
    const blob=await media('get',j.id);
    if (!blob) throw new Error('ไม่มีไฟล์คลิปที่เก็บไว้');
    let it=items.find(x=>x.id===j.id);
    if (!it) {
      const extension=/webm/.test(blob.type) ? 'webm' : /quicktime/.test(blob.type) ? 'mov' : 'mp4';
      const file=new File([blob],`${j.name.replace(/[\\/:*?"<>|]/g,'_')}-${j.id.slice(0,8)}.${extension}`,{type:blob.type});
      it={id:j.id,file,key:`${file.name}|${file.size}`,base:j.name,caption:j.caption,fromTxt:false,generated:true,openId:j.openId || '',accountLocked:!!j.openId,state:'wait',note:'คลิปจาก Meta AI'};
      items.push(it);
    }
    if(it.state!=='ok') {it.openId=j.openId || '';it.accountLocked=!!j.openId;}
    render(); return it;
  }
  async function acquire() {
    return new Promise((resolve,reject) => {
      const port=chrome.runtime.connect({name:'tthMetaQueue'});
      port.onMessage.addListener(m => { if (m.ok) { lease=port; resolve(); } else reject(new Error('คิวกำลังทำงานในอีกหน้าต่าง')); });
      port.onDisconnect.addListener(() => { if (lease===port) { lease=null; stopping=true; } reject(new Error('เชื่อมตัวควบคุมคิวไม่ได้')); });
    });
  }
  $('metaOpen').onclick=async () => { await chrome.tabs.create({url:'https://www.meta.ai/'}); await tabs(); };
  $('metaRefresh').onclick=() => tabs().catch(e=>msg(e.message,'err'));
  $('metaAdd').onclick=async () => {
    try {
      const prompt=$('metaPrompt').value.trim(), name=$('metaName').value.trim();
      if (!prompt || !name) throw new Error('ใส่ชื่อคลิปและพรอมป์ต์ก่อน');
      const file=$('metaImage').files[0]; let image=null;
      if (file) {
        if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size>10*1024*1024) throw new Error('ใช้รูป JPG/PNG/WebP ไม่เกิน 10 MB');
        const dataUrl=await new Promise((resolve,reject) => { const reader=new FileReader(); reader.onload=()=>resolve(reader.result); reader.onerror=()=>reject(reader.error); reader.readAsDataURL(file); });
        image={name:file.name,type:file.type,dataUrl};
      }
      const openId=$('metaTarget').value || TTHRouting.next(jobs,accountsOn());
      jobs.push({id:crypto.randomUUID(),name,prompt,caption:captionFromTxt($('metaCaption').value || name),image,openId,state:'wait',note:'รอเจน'});
      await save(); draw(); $('metaName').value=''; $('metaPrompt').value=''; $('metaCaption').value=''; $('metaImage').value='';
    } catch(e) { msg(e.message,'err'); }
  };
  $('metaAuto').onchange=() => {store.set({tthMetaAuto:$('metaAuto').checked});draw();};
  $('metaFilter').onchange=draw;
  $('metaDistribute').onclick=async()=>{
    try {jobs=TTHRouting.distribute(jobs,accountsOn()); for(const j of jobs){const it=items.find(x=>x.id===j.id); if(it && it.state!=='ok' && TTHRouting.pending(j)){it.openId=j.openId;it.accountLocked=true;}} await save();draw();renderItems();msg('แบ่งคลิปที่ยังรอให้บัญชีที่เปิดใช้แล้ว ดูปลายทางของแต่ละคลิปได้ในคิว','ok');}
    catch(e){msg(e.message,'err');}
  };
  document.addEventListener('tthAccountsChanged',draw);
  document.addEventListener('tthItemAssigned',e=>{ const j=jobs.find(x=>x.id===e.detail.id);if(j){j.openId=e.detail.openId;save();draw();} });
  $('metaStop').onclick=() => {
    stopping=true; draw();
    if (current?.state==='generating') ask(current.tabId,{type:'tthMetaCancel',id:current.id}).catch(()=>{});
  };
  $('metaRun').onclick=async () => {
    if (running) return;
    const auto=$('metaAuto').checked, tabId=Number($('metaTab').value);
    try {
      await appReady;
      if (bulk.on || items.some(x=>x.state==='busy')) throw new Error('รอคิวอัปโหลดเดิมให้เสร็จก่อน');
      if (auto && !accountsOn().length) throw new Error('เชื่อมบัญชี TikTok ก่อน หรือปิดอัปโหลดอัตโนมัติ');
      if (jobs.some(j=>j.state==='wait')) {
        if (!tabId) throw new Error('เปิดและเลือกแท็บ Meta AI ก่อน');
        const ping=await ask(tabId,{type:'tthMetaPing'});
        if (!ping.input || ping.busy || ping.pending) throw new Error('Meta AI ยังไม่พร้อมหรือมีคลิปค้าง — ตรวจแท็บและรับคลิปค้างก่อน');
      }
      await acquire(); running=true; stopping=false; paused.clear();
      const latest=await store.get(['tthMetaJobs','tthHistory']);
      jobs=latest.tthMetaJobs || jobs; uploads=latest.tthHistory || uploads;
      if(auto) {
        for(const j of jobs.filter(x=>x.state==='wait' || x.state==='ready')) {
          if(!j.openId) j.openId=TTHRouting.next(jobs,accountsOn());
          const a=accountsOn().find(a=>a.openId===j.openId);
          if(!a) throw new Error(`บัญชีของคลิป “${j.name}” ไม่พร้อม — เลือกบัญชีใหม่ในคิว`);
          if(st.mode==='direct' && !a.scope.split(',').includes('video.publish')) throw new Error(`บัญชี ${accName(a)} ต้องเชื่อมใหม่ในโหมดโพสต์ตรง`);
        }
        await save();
      }
      // Freeze posting settings and manual upload controls for this run.
      [...document.querySelectorAll('main > section')].slice(1).forEach(e=>e.inert=true); draw();
      for (const j of jobs.filter(j=>j.state==='wait' || j.state==='ready')) {
        if (stopping) break; current=j;
        try {
          if (j.state==='wait') {
            j.tabId=tabId; j.state='generating'; j.note='Meta AI กำลังสร้างคลิป'; await save(); draw();
            const info=await ask(tabId,{type:'tthMetaGenerate',id:j.id,prompt:j.prompt,image:j.image});
            j.note='กำลังรับไฟล์คลิป'; draw(); await receive(j,info);
            j.state='ready'; j.note='เจนเสร็จแล้ว'; await save();
          }
          if (stopping) break;
          const it=await enqueue(j);
          if (auto && !doneBefore(it).length) {
            j.note='กำลังอัปโหลด TikTok'; draw();
            if (!await uploadOne(it)) throw new Error(it.note);
          }
          j.state='done'; j.note=auto ? it.note || 'เคยอัปโหลดแล้ว' : 'เพิ่มในรายการคลิปแล้ว — กดอัปโหลดด้านล่าง'; await save(); draw();
          if (auto && +st.gap && jobs.some(x=>x.state==='wait' || x.state==='ready')) {
            const end=Date.now()+ +st.gap*60000;
            while (Date.now()<end && !stopping) { $('metaState').textContent=`พัก ${Math.ceil((end-Date.now())/1000)} วิ`; await wait(1000); }
          }
        } catch(e) {
          j.state=stopping ? 'interrupted' : 'error'; j.note=String(e.message || e); await save(); draw();
          // Stop on ambiguity/failure; never post another clip or resend blindly.
          break;
        }
      }
    } catch(e) { msg(e.message,'err'); }
    finally {
      const wasRunning=running;
      running=false; current=null; stopping=false; if (lease) { lease.disconnect(); lease=null; }
      [...document.querySelectorAll('main > section')].slice(1).forEach(e=>e.inert=false);
      draw(); if (wasRunning) msg('คิวหยุดแล้ว / ทำครบแล้ว — ดูผลรายคลิป','');
    }
  };
  window.addEventListener('beforeunload',e=>{ if (running) { e.preventDefault(); e.returnValue=''; } });
  chrome.storage.onChanged.addListener((changes,area) => {
    if (area==='local' && changes.tthMetaJobs && !running) { jobs=changes.tthMetaJobs.newValue || []; draw(); }
  });
  (async () => {
    await appReady;
    const saved=await store.get(['tthMetaJobs','tthMetaAuto']); jobs=saved.tthMetaJobs || []; $('metaAuto').checked=!!saved.tthMetaAuto;
    for (const j of jobs) {
      if (j.state==='generating') { j.state='interrupted'; j.note='หน้าควบคุมปิดระหว่างเจน — ตรวจคลิปเดิมก่อนทำต่อ'; }
      if (await media('get',j.id)) {
        const it=await enqueue(j);
        if (doneBefore(it).length) { j.state='done'; j.note='เคยส่ง TikTok แล้ว'; }
      }
    }
    await save(); await tabs(); draw();
  })().catch(e=>msg(`โหลดคิว Meta AI ไม่ได้: ${e.message}`,'err'));
})();
