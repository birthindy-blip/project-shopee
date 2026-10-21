const fs=require('fs'),vm=require('vm'),assert=require('assert');
const elements=new Map();
function element(id){if(!elements.has(id))elements.set(id,{id,textContent:'',innerHTML:'',value:'',hidden:false,disabled:false,checked:false,scrollTop:0,scrollHeight:0,classList:{add(){},remove(){}},setAttribute(){},removeAttribute(){},parentElement:{append(){}},closest(){return null},showModal(){},close(){}});return elements.get(id);}
let captures=0;
const sandbox={console,Date,Math,String,Number,JSON,AbortSignal,performance:{now:()=>0},window:{},
 document:{hidden:false,getElementById:element,querySelector:()=>({content:'test'}),activeElement:{closest:()=>null},createElement:()=>element('created'),addEventListener(){}},
 setTimeout:()=>1,clearTimeout(){},setInterval(){},URL:{revokeObjectURL(){},createObjectURL(){return 'test'}},
 fetch:async()=>{captures++;throw Error('preview must remain asleep');}};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync('ui.js','utf8'),sandbox);
let preview=fs.readFileSync('ui-preview.js','utf8').replace('refresh();setInterval(refresh,3000);schedulePreview();','');
vm.runInContext(preview,sandbox);
sandbox.state={settings:{serial:'phone',clips_folder:'folder',daily_limit:74,delay_minutes:[1,2],auto_post:true,delete_after_post:true},
 phone:{state:'device',serial:'phone',model:'Redmi 5A',dependencies:true,checked:false,shopee:false,screen:false,devices:[{serial:'phone',state:'device'}]},
 clips:[{key:'original',name:'Woodpanda',state:'pending',product:{status:'unchecked'},caption:'caption',size_mb:4.3,has_text:true,has_link:true}],
 pending:1,today:70,total_posted:118,base_ready:false,ready:false,notes:[],folders:['folder'],
 job:{running:false,kind:'post',state:'attention',logs:[],attention:{title:'heat',message:'heat'},
 cooldown:{phase:'waiting',clip_key:'original',seconds_remaining:3600,resume_at:Date.now()/1000+3600}}};
vm.runInContext('render(state)',sandbox);
assert(element('attentionMessage').textContent.includes('01:00:00'));
assert(element('currentStep').textContent.includes('01:00:00'));
assert.strictEqual(element('currentClip').textContent,'Woodpanda');
assert.strictEqual(element('stopBtn').disabled,false);
assert.strictEqual(element('checkBtn').disabled,true);
assert.strictEqual(element('attentionCheckBtn').disabled,true);
assert.strictEqual(element('previewToggle').disabled,true);
(async()=>{
 await vm.runInContext('updatePreview()',sandbox);
 assert.strictEqual(captures,0);
 sandbox.state.job.cooldown.seconds_remaining=1;
 vm.runInContext('render(state)',sandbox);
 assert(element('currentStep').textContent.includes('00:00:01'));
 sandbox.state.job.cooldown=null;sandbox.state.job.attention=null;sandbox.state.job.state='done';
 sandbox.state.ready=true;sandbox.state.base_ready=true;
 sandbox.state.phone.checked=true;sandbox.state.phone.shopee=true;sandbox.state.phone.screen=true;
 vm.runInContext('render(state)',sandbox);
 assert.strictEqual(element('previewToggle').disabled,false);
 assert.strictEqual(element('checkBtn').disabled,false);
 assert.strictEqual(element('stopBtn').disabled,true);
 console.log('Cooldown dashboard: countdown, stop, disabled early checks, no preview capture, and resume controls passed.');
})().catch(e=>{console.error(e);process.exitCode=1});
