// กดไอคอนส่วนเสริม → เปิดหน้า TikTok Uploader ในแท็บใหม่ (งานทั้งหมดทำในหน้านั้น — เปิดค้างไว้ระหว่างอัปโหลด)
chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: chrome.runtime.getURL('app.html') });
});
// One queue controller at a time; a closed controller releases its lease.
let metaOwner = null;
chrome.runtime.onConnect.addListener(port => {
  if (port.name !== 'tthMetaQueue') return;
  if (metaOwner) { port.postMessage({ok:false}); port.disconnect(); return; }
  metaOwner = port; port.postMessage({ok:true});
  port.onDisconnect.addListener(() => { if (metaOwner === port) metaOwner = null; });
});
