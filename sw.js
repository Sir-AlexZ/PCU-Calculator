const C="pcu-v6"; // ↑ เพิ่มเลขนี้ทุกครั้งที่แก้ style.css / script.js เพื่อบังคับล้างแคชเก่า
const ASSETS=["./","./index.html","./style.css","./script.js"];

self.addEventListener("install",e=>{
  e.waitUntil(caches.open(C).then(c=>c.addAll(ASSETS)));
  self.skipWaiting(); // ให้ Service Worker เวอร์ชันใหม่เข้าควบคุมทันที
});

self.addEventListener("activate",e=>{
  e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x)))));
  self.clients.claim();
});

self.addEventListener("fetch",e=>{
  const req=e.request;
  const sameOrigin=new URL(req.url).origin===location.origin;
  if(!sameOrigin) return; // ไม่ยุ่งกับ iframe ของมหิดล

  // ---- หน้า HTML (navigate) : network-first ----
  if(req.mode==="navigate"){
    e.respondWith(
      fetch(req).then(res=>{
        const cp=res.clone();
        caches.open(C).then(c=>c.put(req,cp));
        return res;
      }).catch(()=>caches.match("./index.html"))
    );
    return;
  }

  // ---- style.css / script.js / manifest.json : network-first เช่นกัน (กันไฟล์ค้างเวอร์ชันเก่า) ----
  const url=new URL(req.url);
  if(url.pathname.endsWith("style.css")||url.pathname.endsWith("script.js")||url.pathname.endsWith("manifest.json")){
    e.respondWith(
      fetch(req).then(res=>{
        const cp=res.clone();
        caches.open(C).then(c=>c.put(req,cp));
        return res;
      }).catch(()=>caches.match(req))
    );
    return;
  }

  // ---- ไฟล์อื่นๆ (รูป/ฟอนต์) : cache-first ----
  e.respondWith(
    caches.match(req).then(r=>r || fetch(req).then(res=>{
      const cp=res.clone();
      caches.open(C).then(c=>c.put(req,cp));
      return res;
    }))
  );
});
