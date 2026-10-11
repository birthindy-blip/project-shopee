const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const {webcrypto}=require('node:crypto');

function adapter({existing=false, populated=false}={}) {
  let listener, sent=false, now=0;
  class Textarea { constructor(){this._value=populated ? 'draft' : '';this.tagName='TEXTAREA';} get value(){return this._value;} set value(v){this._value=v;} focus(){} dispatchEvent(){} getBoundingClientRect(){return {width:300,height:60,bottom:600,right:400,top:540};} }
  const box=new Textarea();
  const button={disabled:false,title:'',textContent:'Send',getAttribute:k=>k==='aria-label'?'Send':null,getBoundingClientRect:()=>({width:30,height:30,left:390,top:550}),click:()=>{sent=true;box.value='';}};
  const video={src:'https://media.test/new.mp4',currentSrc:'',duration:10,querySelector:()=>null};
  const old={...video,src:'https://media.test/old.mp4'};
  const payload=new Uint8Array(600000); payload.fill(42);
  const context={
    chrome:{runtime:{id:'ours',onMessage:{addListener:fn=>listener=fn}}},
    document:{querySelectorAll:q=>q==='video' ? (existing ? [old,...(sent?[video]:[])] : sent?[video]:[]) : q.startsWith('textarea') ? [box] : [button]},
    getComputedStyle:()=>({display:'block',visibility:'visible'}),HTMLTextAreaElement:Textarea,
    Event:class {},Date:{now:()=>now},setTimeout:(fn,ms)=>{if(ms<10000){now+=ms;queueMicrotask(fn);} return 1;},clearTimeout:()=>{},
    fetch:async url=>({ok:true,blob:async()=>new Blob([url.includes('old') ? new Uint8Array([1,2,3]) : payload],{type:'video/mp4'})}),
    crypto:webcrypto,Blob,Uint8Array,URL,AbortController,console,
    btoa:s=>Buffer.from(s,'binary').toString('base64'),atob:s=>Buffer.from(s,'base64').toString('binary')
  };
  vm.runInNewContext(fs.readFileSync('meta-content.js','utf8'),context);
  const call=(message,sender='ours')=>new Promise(resolve=>{const accepted=listener(message,{id:sender},resolve);if(!accepted)resolve(null);});
  return {call,payload,wasSent:()=>sent};
}
test('receives generated media in bounded chunks, rejects duplicate generation, releases media',async()=>{
  const a=adapter({existing:true});
  const result=await a.call({type:'tthMetaGenerate',id:'job',prompt:'Make a video'});
  assert.equal(result.ok,true);assert.equal(result.size,a.payload.length);
  const ping=await a.call({type:'tthMetaPing'});assert.equal(ping.pending,'job');
  assert.equal((await a.call({type:'tthMetaGenerate',id:'other',prompt:'another'})).ok,false);
  const chunks=[];
  for(let offset=0;offset<result.size;offset+=262144){const r=await a.call({type:'tthMetaChunk',id:'job',offset});chunks.push(Buffer.from(r.data,'base64'));}
  assert.deepEqual(Buffer.concat(chunks),Buffer.from(a.payload));
  assert.equal((await a.call({type:'tthMetaChunk',id:'wrong',offset:0})).ok,false);
  assert.equal((await a.call({type:'tthMetaChunk',id:'job',offset:-1})).ok,false);
  await a.call({type:'tthMetaRelease',id:'job'});
  assert.equal((await a.call({type:'tthMetaInfo',id:'job'})).ok,false);
});
test('does not overwrite a user draft or submit it',async()=>{
  const a=adapter({populated:true});
  const result=await a.call({type:'tthMetaGenerate',id:'job',prompt:'Make a video'});
  assert.equal(result.ok,false);assert.equal(a.wasSent(),false);
});
test('ignores messages from another extension',async()=>{
  assert.equal(await adapter().call({type:'tthMetaPing'},'other'),null);
});
