const {test}=require('node:test');
const assert=require('node:assert/strict');
const {next,distribute}=require('./routing.js');
const accounts=[{openId:'a'},{openId:'b'},{openId:'c'}];
test('distributes seven pending jobs evenly and preserves completed destinations',()=>{
  const jobs=[...Array.from({length:7},(_,id)=>({id,state:'wait'})),{id:8,state:'done',openId:'old'}];
  const result=distribute(jobs,accounts);
  assert.deepEqual(result.slice(0,7).map(j=>j.openId),['a','b','c','a','b','c','a']);
  assert.equal(result[7].openId,'old'); assert.equal(jobs[0].openId,undefined);
});
test('next account balances existing assignments instead of always starting at first account',()=>{
  assert.equal(next([{state:'wait',openId:'a'},{state:'ready',openId:'b'}],accounts),'c');
  assert.equal(next([{state:'done',openId:'a'}],accounts),'a');
  assert.equal(next([],[]),'');
});
test('distribution requires an enabled destination and handles one account',()=>{
  assert.throws(()=>distribute([{state:'wait'}],[]));
  assert.deepEqual(distribute([{state:'ready'},{state:'error'},{state:'interrupted'}],[accounts[1]]).map(j=>j.openId),['b','b','b']);
});
