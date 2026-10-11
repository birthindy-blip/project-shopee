const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
async function app() {
  const nodes=new Map();
  const element=()=>({children:[],dataset:{},value:'',className:'',textContent:'',setAttribute(){},append(...v){this.children.push(...v);},replaceChildren(...v){this.children=v;}});
  const ctx=vm.createContext({document:{getElementById:id=>{if(!nodes.has(id))nodes.set(id,element());return nodes.get(id);},createElement:element,documentElement:{dataset:{}},dispatchEvent(){}},chrome:{storage:{local:{get:async()=>({}),set:async()=>{}}}},window:{addEventListener(){}},navigator:{},Event:class{},setTimeout,clearTimeout,ttStatus:async()=>({hasApp:true,accounts:[{openId:'a',name:'A',on:true,scope:'video.upload'},{openId:'b',name:'B',on:true,scope:'video.upload'}]}),ttLimitWhy:e=>e.includes('rate_limit')?'limit':'',calls:[],ttUpload:async args=>{ctx.calls.push(args.openId);throw new Error('rate_limit');}});
  vm.runInContext(fs.readFileSync('app.js','utf8'),ctx);await vm.runInContext('appReady',ctx);return ctx;
}
test('an explicitly assigned disabled account never falls back to a different account',async()=>{
  const ctx=await app();const result=vm.runInContext("acc.accounts[0].on=false; pick({openId:'a',accountLocked:true})",ctx);
  assert.equal(result,null);
  assert.equal(vm.runInContext("pick({openId:'',accountLocked:false}).openId",ctx),'b');
});
test('rate limits preserve assigned destination and do not retry a different account',async()=>{
  const ctx=await app();
  const result=await vm.runInContext("(async()=>{const it={file:{name:'clip.mp4',size:123},key:'key',caption:'caption',openId:'a',accountLocked:true,state:'wait'};const ok=await uploadOne(it);return {ok,openId:it.openId,state:it.state};})()",ctx);
  assert.equal(result.ok,false);assert.equal(result.openId,'a');assert.equal(result.state,'err');assert.deepEqual(ctx.calls,['a']);
});
