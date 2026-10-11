// Balance queued work across enabled accounts; every job has one destination.
(function(root) {
  const pending = job => ['wait','ready','error','interrupted'].includes(job.state);
  function next(jobs, accounts) {
    if (!accounts.length) return '';
    const counts = new Map(accounts.map(a=>[a.openId,0]));
    jobs.filter(pending).forEach(j=>{ if(counts.has(j.openId)) counts.set(j.openId,counts.get(j.openId)+1); });
    return accounts.reduce((best,a)=>counts.get(a.openId)<counts.get(best.openId)?a:best).openId;
  }
  function distribute(jobs, accounts) {
    if (!accounts.length) throw new Error('เปิดใช้บัญชี TikTok อย่างน้อย 1 บัญชีก่อน');
    let index=0;
    return jobs.map(j=>pending(j) ? {...j,openId:accounts[index++ % accounts.length].openId} : {...j});
  }
  const api={pending,next,distribute};
  if(typeof module!=='undefined') module.exports=api; else root.TTHRouting=api;
})(globalThis);
