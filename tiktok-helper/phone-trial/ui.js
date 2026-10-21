
const token=document.querySelector('meta[name=app-token]').content;let snapshot=null,loaded=false,lastLogs="",polling=false,formDirty=false,lastQueue="",lastDevices="",lastClipOptions="",activeActions=0;
const $=id=>document.getElementById(id);
const escapeHtml=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function toast(message){$("toast").textContent=message;$("toast").hidden=false;clearTimeout(window.toastTimer);window.toastTimer=setTimeout(()=>$("toast").hidden=true,5000)}
async function api(path,data){const response=await fetch(path,{method:"POST",headers:{"Content-Type":"application/json","X-App-Token":token},body:JSON.stringify(data),signal:AbortSignal.timeout(20000)});const result=await response.json();if(!response.ok)throw Error(result.error||"ดำเนินการไม่สำเร็จ");return result}
function cooldownLabel(cd){const seconds=Math.max(0,Math.ceil(cd.seconds_remaining||0));const h=String(Math.floor(seconds/3600)).padStart(2,'0'),m=String(Math.floor(seconds%3600/60)).padStart(2,'0'),sec=String(seconds%60).padStart(2,'0');const until=new Date(cd.resume_at*1000).toLocaleTimeString('th-TH',{timeZone:'Asia/Bangkok',hour12:false});return 'พักเครื่อง · เหลือ '+h+':'+m+':'+sec+' · ตรวจต่อเวลา '+until}
function render(s){
snapshot=s;const p=s.phone,j=s.job,verified=p.shopee&&p.screen;
const cooling=!!j.cooldown&&j.cooldown.phase==='waiting';
const attention=j.attention;$("attentionBox").hidden=!attention;$("attentionTitle").textContent=attention?attention.title:'';$("attentionMessage").textContent=attention?attention.message:'';$("attentionCheckBtn").disabled=j.running||cooling;
$("cleanupInput").checked=!!s.settings.delete_after_post;$("cleanupInput").disabled=j.running;
const deviceStates={device:"พร้อมเชื่อมต่อ",unauthorized:"รออนุญาต",offline:"ยังไม่พร้อม"};
let deviceOptions='<option value="">อัตโนมัติ เมื่อมีเครื่องพร้อมเพียงเครื่องเดียว</option>'+p.devices.map(d=>'<option value="'+escapeHtml(d.serial)+'">'+escapeHtml(d.model||"Android")+' · '+escapeHtml(d.serial)+' · '+escapeHtml(deviceStates[d.state]||d.state)+'</option>').join('');
if(s.settings.serial&&!p.devices.some(d=>d.serial===s.settings.serial))deviceOptions+='<option value="'+escapeHtml(s.settings.serial)+'">ไม่ได้ต่อเครื่องนี้ · '+escapeHtml(s.settings.serial)+'</option>';
const deviceSignature=deviceOptions+'|'+s.settings.serial;if(deviceSignature!==lastDevices){$("deviceSelect").innerHTML=deviceOptions;$("deviceSelect").value=s.settings.serial;lastDevices=deviceSignature}
$("deviceSelect").disabled=j.running;$("deviceSerial").textContent=p.serial?'หมายเลขเครื่องที่ใช้: '+p.serial:'';
$("usbDevices").textContent=(p.usb_devices||[]).map(d=>d.model+' · ต่อ USB แล้ว แต่ยังควบคุมไม่ได้').join(' / ');
const clipOptions=s.clips.filter(c=>c.state==='pending').map(c=>'<option value="'+escapeHtml(c.key)+'">'+escapeHtml(c.name)+'</option>').join('');
if(clipOptions!==lastClipOptions){for(const id of ["basketClip","prepareClip"]){const previous=$(id).value;$(id).innerHTML=clipOptions;if(s.clips.some(c=>c.key===previous&&c.state==='pending'))$(id).value=previous;else if(id==='prepareClip'&&j.prepared&&s.clips.some(c=>c.key===j.prepared.clip_key&&c.state==='pending'))$(id).value=j.prepared.clip_key}lastClipOptions=clipOptions}
$("prepareClip").disabled=j.running;
$("basketClip").disabled=j.running;$("productsBtn").disabled=j.running||!s.pending;$("basketBtn").disabled=j.running||p.state!=='device'||!$("basketClip").value;
const basket=j.basket;if(basket){
const expected=basket.expected||{},actual=basket.actual||{};
const details=basket.method==='single_link_import'?'':
'<table class="identity-table"><tr><th></th><th>จากลิงก์คลิป</th><th>บนมือถือ</th></tr><tr><td>Item ID</td><td>'+escapeHtml(expected.item_id||'—')+'</td><td>'+escapeHtml(actual.item_id||'—')+'</td></tr><tr><td>Shop ID</td><td>'+escapeHtml(expected.shop_id||'—')+'</td><td>'+escapeHtml(actual.shop_id||'—')+'</td></tr></table>';
$("basketResult").className='identity'+(basket.status==='matched'?'':' warn');$("basketResult").innerHTML='<b>'+escapeHtml(basket.message)+'</b>'+(basket.clip_name?'<p>'+escapeHtml(basket.clip_name)+'</p>':'')+details+'<small>'+escapeHtml({single_link_import:'นำเข้าจากลิงก์คลิป → เลือกทั้งหมด → เพิ่มสินค้า 1 รายการ',screen:'อ่านรหัสจากหน้าจอ',phone_share_link:'อ่านลิงก์ที่คัดลอกจากมือถือ',pasted_pinned_link:'เทียบลิงก์สินค้าที่คุณวาง'}[basket.method]||'ยังอ่านรหัสไม่ได้')+'</small>'
}else{$("basketResult").className='identity';$("basketResult").textContent='ยังไม่ได้เทียบกับสินค้าบนมือถือ'}
$("phoneModel").textContent=p.model||"ยังไม่พบมือถือ";
$("phoneState").textContent=p.state==="device"?(verified?"พร้อมควบคุมและใช้ Shopee":"เชื่อมต่อควบคุมได้แล้ว"):p.state==="unauthorized"?"รออนุญาตบนมือถือ":"ยังควบคุมมือถือไม่ได้";
$("phoneState").className=p.state==="device"?"good":"status";$("phoneHint").textContent=verified?"ตรวจ Shopee และอ่านหน้าจอผ่านแล้ว":p.message;
$("pending").textContent=s.pending;$("today").textContent=s.today;$("limitText").textContent="สูงสุด "+s.settings.daily_limit+" คลิปต่อวัน";
$("totalHistory").textContent="ยืนยันสะสม "+(s.total_posted||0)+" คลิป";
$("appState").textContent=cooling?"กำลังพักเครื่อง 1 ชั่วโมง":j.running?"กำลังทำงาน":attention?"ต้องทำบนมือถือ":s.ready?"พร้อมเริ่ม":"รอตรวจความพร้อม";
$("modeLabel").textContent=s.settings.auto_post?"โพสต์อัตโนมัติ":"กดโพสต์เอง";$("folderPath").textContent=s.settings.clips_folder;
const query=$('queueSearch').value.trim().toLocaleLowerCase('th-TH');const visible=s.clips.filter(c=>c.name.toLocaleLowerCase('th-TH').includes(query));const queueSignature=JSON.stringify(s.clips)+'|'+query+'|'+s.settings.auto_post;if(queueSignature!==lastQueue){$('clips').innerHTML=visible.length?visible.map(c=>'<article class="clip"><div class="row"><div class="clip-title">'+escapeHtml(c.name)+'</div><span class="pill">'+({pending:'รอโพสต์',posted:'โพสต์แล้ว',skipped:'ข้ามแล้ว'}[c.state]||escapeHtml(c.state))+'</span></div><div class="meta">'+c.size_mb+' MB · '+(c.has_text?'มีแคปชัน':'ไม่มีไฟล์แคปชัน')+' · '+(c.has_link?'มีลิงก์สินค้า':'ไม่มีลิงก์สินค้า')+'</div><details><summary>ดูแคปชัน</summary><div class="caption">'+escapeHtml(c.caption)+'</div></details></article>').join(''):'<div class="empty">'+(query?'ไม่พบคลิปที่ค้นหา':'ไม่มีคลิปในโฟลเดอร์นี้')+'</div>';lastQueue=queueSignature}
const chosen=s.clips.find(c=>c.key===$("prepareClip").value);
const prepareReady=s.base_ready&&chosen&&chosen.product.status==="resolved";
$("postOneBtn").disabled=j.running||!s.base_ready||!chosen||!chosen.has_text||!chosen.has_link;
$("queueNotes").textContent=s.notes.join(" · ");$("startBtn").disabled=!s.ready||j.running;$("prepareBtn").disabled=!prepareReady||j.running;$("startBtn").textContent=s.settings.auto_post?"เริ่มโพสต์ต่อเนื่อง":"เริ่มเตรียมโพสต์";$("stopBtn").disabled=!j.running&&!cooling;$("checkBtn").disabled=j.running||cooling;$("saveBtn").disabled=j.running;
$("productsBtn").textContent="ตรวจลิงก์คลิปที่เลือก";
const canPublish=j.prepared&&j.prepared.status==='prepared'&&j.prepared.serial===p.serial&&s.clips.some(c=>c.key===j.prepared.clip_key&&c.state==='pending');
$("publishBtn").hidden=!canPublish;$("publishBtn").disabled=j.running||!!attention||p.state!=='device'||s.today>=s.settings.daily_limit;
const published=j.published&&j.published.status==='posted'?j.published:null;
$("preparedResult").hidden=!j.prepared&&!published;$("preparedResult").textContent=published?'โพสต์ '+published.clip_name+' สำเร็จ · คอมเข้าถังขยะ '+published.cleanup.pc.length+' ไฟล์ · มือถือ '+(published.cleanup.phone?'ลบแล้ว':'ยังไม่ได้ลบ')+(published.cleanup.error?' · '+published.cleanup.error:''):j.prepared?'เตรียม '+j.prepared.clip_name+' แล้ว · ปักสินค้าจากลิงก์แล้ว · ยังไม่ได้เผยแพร่':'';
$("readyHint").textContent=s.ready?(s.settings.auto_post?"โปรแกรมนำเข้าสินค้าจากลิงก์ใน .txt แล้วเตรียมและเผยแพร่ต่อเนื่อง พักตามเวลาที่ตั้งไว้":"โปรแกรมเตรียมคลิปและตรวจสินค้าที่ปัก แล้วคุณกดโพสต์เอง"):p.state!=="device"?p.message:!verified?"กดตรวจมือถือที่เลือกให้ผ่านก่อนเริ่ม":!s.pending?"ไม่มีคลิปใหม่ในคิว":s.today>=s.settings.daily_limit?"ถึงจำนวนโพสต์สูงสุดวันนี้แล้ว":"กดตรวจลิงก์ของคลิปก่อนทดลอง";
if(j.running)$("readyHint").textContent=j.prompt?"โปรแกรมรอคำตอบในบันทึกการทำงาน":j.kind==='post'&&s.settings.auto_post?"กำลังทำคิวต่อเนื่อง · ดูขั้นตอนล่าสุดในบันทึกด้านล่าง":"โปรแกรมกำลังทำงาน · ดูขั้นตอนล่าสุดในบันทึกด้านล่าง";
else if(attention)$("readyHint").textContent=attention.message;
if(cooling){$("attentionBox").hidden=false;$("attentionTitle").textContent='พักหน้าจอให้เครื่องเย็น';$("attentionMessage").textContent=cooldownLabel(j.cooldown)+' · ครบเวลาแล้วเปิดจอ ตรวจมือถือ และต่อคิวเดิมอัตโนมัติ';$("readyHint").textContent=cooldownLabel(j.cooldown);}
$("checks").innerHTML=[[p.dependencies,"ตัวเชื่อมมือถือ"],[p.state==="device","อนุญาตให้คอมควบคุม"],[p.shopee,"พบแอป Shopee"],[p.screen,"อ่านหน้าจอได้"]].map(([ok,label])=>'<p class="'+(ok?"good":"muted")+'">'+(ok?"✓ ":"○ ")+label+'</p>').join("");
$("usbGuide").hidden=p.state==="device";$("jobState").textContent=({idle:"ยังไม่มีงาน",running:"กำลังทำงาน",waiting:"รอคำตอบ",attention:"ต้องทำบนมือถือ",prepared:"เตรียมแล้ว · ยังไม่เผยแพร่",posted:"โพสต์สำเร็จ",done:"จบการทำงาน",failed:"ตรวจบันทึกด้านล่าง",stopped:"หยุดแล้ว"}[j.state]||j.state);
$("promptBox").hidden=!j.prompt;$("promptText").textContent=j.prompt||"";
const logs=j.logs.join("\n");if(logs!==lastLogs){$("logs").textContent=logs||"กำลังเริ่มงาน…";$("logs").scrollTop=$("logs").scrollHeight;lastLogs=logs}
if(!loaded||(!formDirty&&document.activeElement.closest("#settingsForm")===null)){$("folderInput").value=s.settings.clips_folder;$("limitInput").value=s.settings.daily_limit;$("delayMin").value=s.settings.delay_minutes[0];$("delayMax").value=s.settings.delay_minutes[1];$("autoInput").checked=s.settings.auto_post;loaded=true}
renderMonitor(s);
}
async function refresh(){if(polling)return;polling=true;try{const r=await fetch("/api/status",{signal:AbortSignal.timeout(15000)});const s=await r.json();if(!r.ok)throw Error(s.error);render(s)}catch(e){$("appState").textContent="รอการเชื่อมต่อโปรแกรม · จะลองใหม่";$("startBtn").disabled=true;$("checkBtn").disabled=true}finally{polling=false}}
async function action(path,data){activeActions++;if(snapshot)renderMonitor(snapshot);try{await api(path,data)}catch(e){toast(e.name==='TimeoutError'?'คำสั่งตอบช้า กำลังตรวจสถานะล่าสุด':e.message)}finally{activeActions--;await refresh()}}
$("checkBtn").onclick=()=>action("/api/start",{kind:"check"});$("refreshBtn").onclick=()=>action("/api/refresh",{});$("startBtn").onclick=()=>action("/api/start",{kind:"post"});$("stopBtn").onclick=()=>action("/api/stop",{});
$("attentionCheckBtn").onclick=()=>action('/api/start',{kind:snapshot&&snapshot.job.unconfirmed?'recover':'check'});
$("postOneBtn").onclick=()=>action('/api/start',{kind:'post_one',clip_key:$("prepareClip").value});
$("prepareBtn").onclick=()=>action("/api/start",{kind:"prepare",clip_key:$("prepareClip").value});
$("publishBtn").onclick=()=>action("/api/start",{kind:"publish"});
$("prepareClip").onchange=()=>{if(snapshot)render(snapshot)};
const resumeBtn=document.createElement('button');resumeBtn.id='resumeBtn';resumeBtn.textContent='ต่อจากหน้าแคปชัน';$("prepareBtn").parentElement.append(resumeBtn);resumeBtn.onclick=()=>action('/api/start',{kind:'resume',clip_key:$("prepareClip").value});
$("cleanupInput").onchange=()=>action("/api/cleanup_settings",{enabled:$("cleanupInput").checked});
$("deviceSelect").onchange=()=>action("/api/device",{serial:$("deviceSelect").value});$("productsBtn").onclick=()=>action("/api/start",{kind:"products",clip_key:$("prepareClip").value});$("basketBtn").onclick=()=>action("/api/start",{kind:"basket",clip_key:$("basketClip").value});
$("answerBtn").onclick=async()=>{await action("/api/answer",{answer:$("answerInput").value});$("answerInput").value=""};$("continueBtn").onclick=()=>action("/api/answer",{answer:""});$("answerInput").onkeydown=e=>{if(e.key==="Enter")$("answerBtn").click()};
$("downloadsBtn").onclick=()=>{$("folderInput").value=snapshot.folders[0];formDirty=true};$("projectBtn").onclick=()=>{$("folderInput").value=snapshot.folders[1];formDirty=true};$("settingsForm").oninput=()=>formDirty=true;
$("settingsForm").onsubmit=async e=>{e.preventDefault();try{await api("/api/settings",{clips_folder:$("folderInput").value,daily_limit:Number($("limitInput").value),delay_minutes:[Number($("delayMin").value),Number($("delayMax").value)],auto_post:$("autoInput").checked});formDirty=false;toast("บันทึกการตั้งค่าแล้ว");await refresh()}catch(e){toast(e.message)}};

