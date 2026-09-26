const C="pcu-v11"; // ↑ เพิ่มเลขนี้ทุกครั้งที่แก้ style.css / script.js เพื่อบังคับล้างแคชเก่า
const ASSETS=["./","./index.html","./style.css","./script.js","./manifest.json"];
const NET_TIMEOUT=2500; // รอเครือข่ายนานสุดกี่มิลลิวินาที ก่อนยอมหยิบของในแคชมาแสดงก่อน

self.addEventListener("install",e=>{
  e.waitUntil(caches.open(C).then(c=>c.addAll(ASSETS)));
  self.skipWaiting(); // ให้ Service Worker เวอร์ชันใหม่เข้าควบคุมทันที
});

self.addEventListener("activate",e=>{
  e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x)))));
  self.clients.claim();
});

/* เอาของใหม่จากเครือข่ายก่อนเหมือนเดิม แต่ถ้าเกิน NET_TIMEOUT ยังไม่ตอบ
   ให้หยิบของในแคชขึ้นมาแสดงทันที ส่วนตัวที่โหลดค้างอยู่ก็ปล่อยให้ทำงานต่อจนจบ
   แล้วเก็บลงแคชไว้ใช้รอบหน้า — ผู้ใช้จึงไม่ต้องนั่งรอเน็ตช้าอีก */
function netFirst(req,fallbackUrl){
  return new Promise(resolve=>{
    let done=false;
    const useCache=()=>{
      if(done)return; done=true;
      resolve(
        caches.match(req)
          .then(r=>r || (fallbackUrl?caches.match(fallbackUrl):null))
          .then(r=>r || fetch(req))   // ไม่มีในแคชจริงๆ ก็รอเครือข่ายต่อไป
      );
    };
    const timer=setTimeout(useCache,NET_TIMEOUT);
    fetch(req).then(res=>{
      if(res&&res.ok){
        const cp=res.clone();
        caches.open(C).then(c=>c.put(req,cp));
      }
      if(done)return;                // แคชชิงตอบไปก่อนแล้ว — เก็บของใหม่ไว้เฉยๆ
      done=true; clearTimeout(timer);
      resolve(res);
    }).catch(()=>{clearTimeout(timer);useCache()});
  });
}

self.addEventListener("fetch",e=>{
  const req=e.request;
  if(req.method!=="GET")return;
  const url=new URL(req.url);
  if(url.origin!==location.origin)return; // ไม่ยุ่งกับ iframe ของมหิดล

  // ---- หน้า HTML (navigate) ----
  if(req.mode==="navigate"){
    e.respondWith(netFirst(req,"./index.html"));
    return;
  }

  // ---- style.css / script.js / manifest.json ----
  if(/(style\.css|script\.js|manifest\.json)$/.test(url.pathname)){
    e.respondWith(netFirst(req));
    return;
  }

  // ---- ไฟล์อื่นๆ (รูป/ฟอนต์) : cache-first ----
  e.respondWith(
    caches.match(req).then(r=>r||fetch(req).then(res=>{
      if(res&&res.ok){
        const cp=res.clone();
        caches.open(C).then(c=>c.put(req,cp));
      }
      return res;
    }))
  );
});
