// กดไอคอนส่วนเสริม → เปิดหน้า TikTok Uploader ในแท็บใหม่ (งานทั้งหมดทำในหน้านั้น — เปิดค้างไว้ระหว่างอัปโหลด)
chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: chrome.runtime.getURL('app.html') });
});
