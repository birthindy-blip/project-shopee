let previewEnabled=true,previewBusy=false,previewTimer=null,previewURL='',previewSerial='',previewCaptured=0;
function clearPreview(){
 if(previewURL)URL.revokeObjectURL(previewURL);previewURL='';previewCaptured=0;
 $('phoneScreen').removeAttribute('src');$('phoneScreen').hidden=true;
 $('largeScreen').removeAttribute('src');$('expandScreen').disabled=true;
 $('screenPlaceholder').hidden=false;
}
function schedulePreview(delay=0){
 clearTimeout(previewTimer);
 if(previewEnabled&&!document.hidden)previewTimer=setTimeout(updatePreview,delay);
}
async function updatePreview(){
 previewTimer=null;
 if(previewBusy||!previewEnabled||document.hidden)return;
 if(snapshot&&snapshot.job.cooldown&&snapshot.job.cooldown.phase==='waiting')return;
 const p=snapshot&&snapshot.phone;
 if(!p||p.state!=='device'){schedulePreview(3000);return}
 const selected=p.serial;previewBusy=true;const started=performance.now();let failed=false;
 try{
  const response=await fetch('/api/phone-screen',{method:'POST',headers:{'Content-Type':'application/json','X-App-Token':token},body:'{}',signal:AbortSignal.timeout(20000)});
  if(!response.ok){const result=await response.json();throw Error(result.error||'อ่านจอมือถือไม่ได้')}
  const actual=response.headers.get('X-Phone-Serial');
  const blob=await response.blob();
  if(!previewEnabled||!snapshot||snapshot.phone.serial!==selected||actual!==selected||(snapshot.job.cooldown&&snapshot.job.cooldown.phase==='waiting'))return;
  const old=previewURL;previewURL=URL.createObjectURL(blob);previewCaptured=Number(response.headers.get('X-Frame-Time'))*1000;
  $('phoneScreen').onload=()=>{if(old)URL.revokeObjectURL(old)};
  $('phoneScreen').src=previewURL;$('phoneScreen').hidden=false;$('phoneScreen').classList.remove('stale');
  $('largeScreen').src=previewURL;$('screenPlaceholder').hidden=true;$('expandScreen').disabled=false;
  $('liveIndicator').textContent='ภาพสด';$('liveIndicator').classList.remove('off');
  $('screenTime').textContent='ภาพล่าสุด '+new Date(previewCaptured).toLocaleTimeString('th-TH',{hour12:false})+' · อัปเดตประมาณทุก 3 วิ';
 }catch(e){
  if(!previewEnabled||document.hidden)return;
  failed=true;$('liveIndicator').textContent='รอภาพ';$('liveIndicator').classList.add('off');
  $('phoneScreen').classList.add('stale');
  $('screenTime').textContent=e.name==='TimeoutError'?'มือถือกำลังตอบช้า จะลองอ่านภาพใหม่':e.message;
  if(!previewURL){$('screenPlaceholder').textContent='รอภาพจากมือถือ…';$('screenPlaceholder').hidden=false}
 }finally{previewBusy=false;schedulePreview(failed?6000:Math.max(0,3000-(performance.now()-started)))}
}
function renderMonitor(s){
 const j=s.job,p=s.phone,logs=j.logs||[];
 const cooling=!!j.cooldown&&j.cooldown.phase==='waiting';
 const clipLine=[...logs].reverse().find(line=>/^━━━ \[\d+\/\d+\]/.test(line));
 const currentName=clipLine?clipLine.replace(/^━━━ \[\d+\/\d+\]\s*/,'').replace(/\s*━━━$/,''):j.prepared?j.prepared.clip_name:j.published?j.published.clip_name:'';
 const meaningful=[...logs].reverse().find(line=>/▶|⏳|🔎|⏸|เหลือ \d|❌|✅|🗑|↻/.test(line))||'';
 const remaining=meaningful.match(/เหลือ (\d+:\d+)/);
 const coolingClip=cooling?s.clips.find(c=>c.key===j.cooldown.clip_key):null;
 $('currentClip').textContent=coolingClip?coolingClip.name:currentName||(!s.pending?'คิวหมดแล้ว':j.running?'กำลังเชื่อมต่อมือถือ…':'พร้อมโพสต์คลิปในคิว');
 $('currentStep').textContent=j.attention?j.attention.title:remaining?'พักก่อนคลิปถัดไป · เหลือ '+remaining[1]:j.running?meaningful.trim():j.state==='failed'?'งานหยุด · ดูสาเหตุในบันทึก':j.state==='stopped'?'หยุดคิวแล้ว':j.state==='posted'?'ยืนยันโพสต์สำเร็จแล้ว':'กดเริ่มเพื่อทำคิวต่อเนื่อง';
 $('attentionCheckBtn').textContent=j.unconfirmed?'ตรวจผลคลิปค้าง':'ยืนยันบนมือถือแล้ว · ตรวจอีกครั้ง';
 if(j.unconfirmed){
  $('startBtn').disabled=true;
  if(!j.running){$('appState').textContent='คิวพัก · รอตรวจผลคลิปค้าง';$('jobState').textContent='รอตรวจผลโพสต์';$('currentClip').textContent=j.unconfirmed.clip_name;}
  $('attentionCheckBtn').disabled=j.running||p.state!=='device'||p.serial!==j.unconfirmed.serial;
 }
 if(j.running&&j.idle_seconds>=120)$('currentStep').textContent='มือถือกำลังตอบช้า · โปรแกรมจะพักงานหากไม่ตอบเกิน 5 นาที';
 if(cooling){$('currentStep').textContent=cooldownLabel(j.cooldown);$('jobState').textContent='พักจอ 1 ชั่วโมง';$('attentionCheckBtn').disabled=true;}
 $('delaySummary').textContent='พัก '+s.settings.delay_minutes.join('–')+' นาที';
 $('cleanupSummary').textContent=s.settings.delete_after_post?'ลบไฟล์หลังโพสต์สำเร็จ':'เก็บไฟล์หลังโพสต์';
 $('queueCount').textContent='· '+s.pending+' คลิป';
 $('quickCheck').hidden=s.base_ready||j.running;$('quickCheck').disabled=j.running||cooling||p.state!=='device';
 $('resumeBtn').disabled=j.running||!!j.attention||p.state!=='device';
 $('refreshBtn').disabled=j.running;
 if(activeActions){for(const id of ['startBtn','quickCheck','checkBtn','postOneBtn','prepareBtn','publishBtn','attentionCheckBtn'])$(id).disabled=true;$('currentStep').textContent='กำลังส่งคำสั่ง…';}
 if(previewSerial!==p.serial||p.state!=='device'){
  clearPreview();previewSerial=p.serial;
  $('screenPlaceholder').textContent=p.state==='device'?'กำลังอ่านจอมือถือ…':'เสียบมือถือและอนุญาต USB debugging';
 }
 if(p.state!=='device'){$('liveIndicator').textContent='ยังไม่เชื่อมต่อ';$('liveIndicator').classList.add('off')}
 $('previewToggle').disabled=cooling;
 if(cooling){clearTimeout(previewTimer);previewTimer=null;clearPreview();$('screenPlaceholder').textContent='พักหน้าจอให้เครื่องเย็น';$('liveIndicator').textContent='พักเครื่อง';$('liveIndicator').classList.add('off');$('screenTime').textContent=cooldownLabel(j.cooldown);}
 else if(!previewEnabled){$('liveIndicator').textContent='พักภาพ';$('liveIndicator').classList.add('off')}
 else if(p.state==='device'&&!previewBusy&&!previewTimer)schedulePreview();
}
$('previewToggle').onclick=()=>{
 previewEnabled=!previewEnabled;$('previewToggle').textContent=previewEnabled?'พักภาพสด':'เปิดภาพสด';
 $('previewToggle').setAttribute('aria-pressed',String(!previewEnabled));
 if(previewEnabled)schedulePreview();else{
  clearTimeout(previewTimer);previewTimer=null;$('liveIndicator').textContent='พักภาพ';$('liveIndicator').classList.add('off');
  $('screenTime').textContent='พักภาพสดแล้ว · คิวโพสต์ยังทำงานตามเดิม';$('phoneScreen').classList.add('stale');
 }
};
$('expandScreen').onclick=()=>{if(previewURL){$('largeScreen').src=previewURL;$('screenDialog').showModal()}};
$('closeScreen').onclick=()=>$('screenDialog').close();
$('screenDialog').onclick=e=>{if(e.target===$('screenDialog'))$('screenDialog').close()};
$('quickCheck').onclick=()=>action('/api/start',{kind:'check'});
$('queueSearch').oninput=()=>{lastQueue='';if(snapshot)render(snapshot)};
document.addEventListener('visibilitychange',()=>{clearTimeout(previewTimer);previewTimer=null;if(!document.hidden)schedulePreview()});
refresh();setInterval(refresh,3000);schedulePreview();
