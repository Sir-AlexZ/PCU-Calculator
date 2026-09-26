/* ---------- บันทึกกิจกรรม (activity log) ----------
   ต้องอยู่บนสุดของไฟล์ เพื่อให้ดักจับ error ได้ตั้งแต่วินาทีแรก
   เก็บแค่ "เกิดอะไรขึ้น เมื่อไหร่ ตอนนั้นมีกี่ราย" — ห้ามเก็บค่าที่กรอก (ชื่อ HN ตัวเลขวัด) เด็ดขาด
   เปิดดูได้โดยแตะป้าย "0 ราย" ในแท็บประวัติติดกัน 5 ครั้ง */
const LOG_KEY="pcu_log_v1", LOG_MAX=200;
function logEvt(type,msg){
  try{
    let a; try{a=JSON.parse(localStorage.getItem(LOG_KEY))}catch(e){}
    if(!Array.isArray(a))a=[];
    a.push({t:new Date().toISOString(),type,msg:String(msg??"").slice(0,300)});
    if(a.length>LOG_MAX)a=a.slice(-LOG_MAX);        // เก็บเฉพาะล่าสุด วนทับของเก่า
    localStorage.setItem(LOG_KEY,JSON.stringify(a));
  }catch(e){}                                      // ตัว log เองห้ามทำให้แอปพัง
}
function readLog(){try{const a=JSON.parse(localStorage.getItem(LOG_KEY));return Array.isArray(a)?a:[]}catch(e){return[]}}
window.addEventListener("error",e=>logEvt("error",`${e.message||"unknown"} @ ${(e.filename||"").split("/").pop()||"?"}:${e.lineno||0}:${e.colno||0}`));
window.addEventListener("unhandledrejection",e=>{const r=e.reason;logEvt("error","Promise: "+(r&&r.message?r.message:String(r)))});

/* ---------- PWA ---------- */
if("serviceWorker" in navigator)navigator.serviceWorker.register("sw.js").catch(e=>logEvt("error","ลงทะเบียน Service Worker ไม่สำเร็จ: "+(e&&e.message)));

/* ---------- helpers ---------- */
const $=id=>document.getElementById(id), n=id=>parseFloat($(id).value)||0;
/* แปลงอักขระพิเศษเป็นข้อความธรรมดา ก่อนเอาค่าที่ผู้ใช้พิมพ์ไปต่อเป็น HTML
   (กันกรณีพิมพ์ < > " ' & ลงช่องชื่อ/HN แล้วหน้าประวัติเพี้ยนหรือหาย) */
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function toast(m){const t=$("toast");t.textContent=m;t.classList.add("on");setTimeout(()=>t.classList.remove("on"),1900)}
function go(t){document.querySelectorAll("nav button").forEach(b=>b.classList.toggle("on",b.dataset.t===t));
 ["in","out","cv","his"].forEach(s=>$(s).classList.toggle("hidden",s!==t));window.scrollTo(0,0);if(t==="his")renderHist();if(t==="cv"){mountCV();chips()}}
document.querySelectorAll("nav button").forEach(b=>b.onclick=()=>go(b.dataset.t));
function setTag(el,txt,cls){if(el){el.textContent=txt;el.className="tag "+cls}}

/* ---------- ตารางเกณฑ์ ---------- */
const BMI_T=[[0,18.5,"น้ำหนักน้อยกว่าเกณฑ์","เสี่ยงได้รับสารอาหารไม่เพียงพอ","t-warn","<18.5"],
 [18.5,23,"น้ำหนักปกติ","สมดุลร่างกายดี ความเสี่ยงโรคต่ำ","t-ok","18.5 – 22.9"],
 [23,25,"น้ำหนักเกิน","เริ่มมีความเสี่ยงต่อปัญหาสุขภาพ","t-warn","23.0 – 24.9"],
 [25,30,"โรคอ้วนระดับ 1","เสี่ยงต่อโรคความดัน เบาหวาน และโรคหัวใจ","t-bad","25.0 – 29.9"],
 [30,999,"โรคอ้วนระดับ 2","เสี่ยงสูงต่อปัญหาสุขภาพร้ายแรง","t-vbad","≥ 30.0"]];
const GRIP={M:[[.65,"ดีมาก","t-ok","≥ 0.65"],[.60,"ดี","t-ok","0.60 – 0.64"],[.49,"ปานกลาง","t-warn","0.49 – 0.59"],[.44,"ต่ำ","t-bad","0.44 – 0.48"],[0,"ต่ำมาก","t-vbad","≤ 0.43"]],
 F:[[.49,"ดีมาก","t-ok","≥ 0.49"],[.45,"ดี","t-ok","0.45 – 0.48"],[.36,"ปานกลาง","t-warn","0.36 – 0.44"],[.32,"ต่ำ","t-bad","0.32 – 0.35"],[0,"ต่ำมาก","t-vbad","≤ 0.31"]]};
const HT_T=[["Optimal","<120","และ","<80","ต่ำกว่าเกณฑ์","t-ok"],["Normal","120-129","และ/หรือ","80-84","ปกติ","t-ok"],
 ["High normal","130-139","และ/หรือ","85-89","สูงกว่าเกณฑ์","t-warn"],["HT grade 1","140-159","และ/หรือ","90-99","ความดันสูงระดับ 1","t-bad"],
 ["HT grade 2","160-179","และ/หรือ","100-109","ความดันสูงระดับ 2","t-bad"],["HT grade 3","≥180","และ/หรือ","≥110","ความดันสูงระดับ 3","t-vbad"],
 ["Isolated Systolic HT","≥140","และ","<90","ความดันตัวบนสูงเดี่ยว","t-bad"]];

/* ---------- CORE CALC ---------- */
let R={};
function calc(){
  const wt=n("wt"),ht=n("ht"),age=n("age"),sex=$("sex").value,wc=n("wc"),hc=n("hc"),sbp=n("sbp"),dbp=n("dbp"),gr=n("gr"),gl=n("gl");
  const blank=id=>$(id).value==="";
  $("wcIn").textContent=wc?(wc/2.54).toFixed(1)+" นิ้ว":"– นิ้ว";
  $("hcIn").textContent=hc?(hc/2.54).toFixed(1)+" นิ้ว":"– นิ้ว";

  /* --- BMI --- */
  const m=ht/100, bmi=(wt>0&&m>0)?wt/(m*m):0;
  const bi=BMI_T.find(r=>bmi>=r[0]&&bmi<r[1]);
  $("bmiV").textContent=bmi?bmi.toFixed(1):"–";
  if(bmi)setTag($("bmiT"),bi[2],bi[4]);else setTag($("bmiT"),"กรอกน้ำหนัก/ส่วนสูง","t-mut");
  $("bmiM").textContent=bmi?bi[3]:"";
  let tb="<tr><th>ค่า BMI</th><th>เกณฑ์แปลผล</th><th>ความหมาย / ภาวะ</th></tr>";
  BMI_T.forEach(r=>tb+=`<tr class="${bmi&&r===bi?'hl':''}"><td>${r[5]}</td><td>${r[2]}</td><td>${r[3]}</td></tr>`);
  $("bmiTb").innerHTML=tb;

  /* --- WHR + แปลผลรอบเอว --- */
  const sexOK = sex==="M" || sex==="F";
  const whr=(wc>0&&hc>0)?wc/hc:0;
  const wcCut = sexOK ? (sex==="M"?90:80) : null;
  const whrCut = sexOK ? (sex==="M"?0.90:0.85) : null;
  const wcInch = wc>0 ? +(wc/2.54).toFixed(1) : "";
  const hcInch = hc>0 ? +(hc/2.54).toFixed(1) : "";
  const inchCut = sexOK ? (sex==="M"?35.4:31.5) : null;
  let wcTxt = "";
  if(!sexOK){
    setTag($("wcTag"), "กรุณาเลือกเพศก่อน", "t-mut");
  } else if(wc>0){
    const over = (wc >= wcCut) || (wc/2.54 >= inchCut);
    wcTxt = over ? "เกินเกณฑ์มาตรฐาน" : "อยู่ในเกณฑ์มาตรฐาน";
    setTag($("wcTag"), wcTxt, over ? "t-bad" : "t-ok");
  } else setTag($("wcTag"), "กรอกรอบเอว", "t-mut");

  $("wcV").innerHTML=wc?`${wc.toFixed(1)} ซม. <small style="font-size:11px;color:var(--mut)">(${wcInch} นิ้ว)</small>`:"–";
  $("hcV").innerHTML=hc?`${hc.toFixed(1)} ซม. <small style="font-size:11px;color:var(--mut)">(${hcInch} นิ้ว)</small>`:"–";
  $("whrV").textContent=whr?whr.toFixed(2):"–";
  let whrTxt="";
  if(!sexOK){
    setTag($("whrT"),"กรุณาเลือกเพศก่อน","t-mut");
  } else if(whr){const ob=whr>=whrCut;whrTxt=ob?"อ้วนลงพุง (เสี่ยง)":"ปกติ";setTag($("whrT"),whrTxt,ob?"t-bad":"t-ok");}
  else setTag($("whrT"),"กรอกรอบเอว/สะโพก","t-mut");
  $("whrM").textContent = sexOK
    ? `เกณฑ์${sex==="M"?"ชาย":"หญิง"}: รอบเอว ≥ ${wcCut} ซม. (${inchCut} นิ้ว) = เกินเกณฑ์ · WHR ≥ ${whrCut.toFixed(2)} = อ้วนลงพุง`
    : "กรุณาเลือกเพศก่อนเพื่อดูเกณฑ์อ้างอิง";
  $("wcTb").innerHTML=`<tr><th>เพศ</th><th>รอบเอว (ซม.)</th><th>รอบเอว (นิ้ว)</th><th>การแปลผล</th></tr>
    <tr class="${sex==='M'&&wcTxt==='อยู่ในเกณฑ์มาตรฐาน'?'hl':''}"><td>ชาย</td><td>&lt; 90</td><td>&lt; 35.4</td><td>อยู่ในเกณฑ์มาตรฐาน</td></tr>
    <tr class="${sex==='M'&&wcTxt==='เกินเกณฑ์มาตรฐาน'?'hl':''}"><td>ชาย</td><td>≥ 90</td><td>≥ 35.4</td><td>เกินเกณฑ์มาตรฐาน</td></tr>
    <tr class="${sex==='F'&&wcTxt==='อยู่ในเกณฑ์มาตรฐาน'?'hl':''}"><td>หญิง</td><td>&lt; 80</td><td>&lt; 31.5</td><td>อยู่ในเกณฑ์มาตรฐาน</td></tr>
    <tr class="${sex==='F'&&wcTxt==='เกินเกณฑ์มาตรฐาน'?'hl':''}"><td>หญิง</td><td>≥ 80</td><td>≥ 31.5</td><td>เกินเกณฑ์มาตรฐาน</td></tr>`;

  /* --- OSTA --- */
  const osta=(wt>0&&age>0)?(wt-age)*0.2:null;let ostaTxt="";
  ["os1","os2","os3"].forEach(i=>$(i).className="");
  if(osta!==null){
    if(osta<-4){ostaTxt="ความเสี่ยงสูง";setTag($("ostaT"),ostaTxt,"t-bad");$("os1").className="hl";}
    else if(osta<=-1){ostaTxt="ความเสี่ยงปานกลาง";setTag($("ostaT"),ostaTxt,"t-warn");$("os2").className="hl";}
    else{ostaTxt="ความเสี่ยงต่ำ";setTag($("ostaT"),ostaTxt,"t-ok");$("os3").className="hl";}
  }else setTag($("ostaT"),"กรอกอายุ/น้ำหนัก","t-mut");
  $("ostaV").textContent=osta!==null?osta.toFixed(2):"–";

  /* --- GRIP --- */
  const tbl = sexOK ? GRIP[sex] : null;
  const gv=g=>(wt>0&&g>0)?g/wt:0;
  const gi=v=>(v&&tbl)?tbl.find(r=>v>=r[0]):null;
  const rr=gv(gr),lr=gv(gl),ri=gi(rr),li=gi(lr);
  $("grV").textContent=rr?rr.toFixed(2):"–";$("glV").textContent=lr?lr.toFixed(2):"–";
  ri?setTag($("grT"),ri[1],ri[2]):setTag($("grT"), sexOK?"–":"กรุณาเลือกเพศก่อน","t-mut");
  li?setTag($("glT"),li[1],li[2]):setTag($("glT"), sexOK?"–":"กรุณาเลือกเพศก่อน","t-mut");
  let gt = sexOK
    ? `<tr><th>ระดับ (${sex==="M"?"ชาย":"หญิง"})</th><th>ค่าอ้างอิง</th><th>ขวา</th><th>ซ้าย</th></tr>`
    : `<tr><td colspan="4">กรุณาเลือกเพศก่อนเพื่อดูตารางอ้างอิง</td></tr>`;
  if(tbl) tbl.forEach(r=>gt+=`<tr class="${(ri===r||li===r)?'hl':''}"><td>${r[1]}</td><td>${r[3]}</td><td>${ri===r?rr.toFixed(2):""}</td><td>${li===r?lr.toFixed(2):""}</td></tr>`);
  $("gripTb").innerHTML=gt;

  /* --- HT --- */
  let hIdx=-1;
  if(sbp>0&&dbp>0){
    if(sbp>=180||dbp>=110)hIdx=5;else if(sbp>=160||dbp>=100)hIdx=4;
    else if(sbp>=140||dbp>=90)hIdx=3;else if(sbp>=130||dbp>=85)hIdx=2;
    else if(sbp>=120||dbp>=80)hIdx=1;else hIdx=0;
    if(sbp>=140&&dbp<90)hIdx=6;
  }
  $("bpV").textContent=(sbp&&dbp)?`${sbp} / ${dbp} mmHg`:"–";
  const hRow=hIdx>=0?HT_T[hIdx]:null;
  $("htC").textContent=hRow?hRow[0]:"–";
  hRow?setTag($("htT"),hRow[4],hRow[5]):setTag($("htT"),"กรอก SBP/DBP","t-mut");
  let ht2="<tr><th>Category</th><th>SBP</th><th></th><th>DBP</th><th>สรุปผล</th></tr>";
  HT_T.forEach((r,i)=>ht2+=`<tr class="${i===hIdx?'hl':''}"><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td><td>${r[3]}</td><td>${r[4]}</td></tr>`);
  $("htTb").innerHTML=ht2;

  /* --- DM RISK --- */
  const fdmVal=$("fdm").value;
  const D=[];let tot=0,p=0,dmIncomplete=false;
  p=age>=50?2:age>=45?1:0; D.push(["อายุ",age?age+" ปี":"–",p]);tot+=p;
  if(sexOK){ p=sex==="M"?2:0; D.push(["เพศ",sex==="M"?"ชาย":"หญิง",p]); tot+=p; }
  else { D.push(["เพศ","ยังไม่ได้เลือก","–"]); dmIncomplete=true; }
  p=bmi>=27.5?5:bmi>=23?3:0; D.push(["ดัชนีมวลกาย",bmi?bmi.toFixed(1)+" kg/m²":"–",p]);tot+=p;
  p=(sexOK&&wc>=wcCut&&wc>0)?2:0; D.push(["รอบเอว",wc?wc.toFixed(0)+" ซม.":"–",p]);tot+=p;
  p=(sbp>=140||dbp>=90)?2:0; D.push(["ความดันโลหิต",(sbp&&dbp)?sbp+"/"+dbp:"–",p]);tot+=p;
  if(fdmVal===""){ D.push(["ประวัติ DM ในครอบครัว","ยังไม่ได้เลือก","–"]); dmIncomplete=true; }
  else { p=fdmVal==="1"?4:0; D.push(["ประวัติ DM ในครอบครัว",fdmVal==="1"?"มี":"ไม่มี",p]); tot+=p; }
  let dTxt,dCls;
  if(dmIncomplete){ dTxt="กรอกข้อมูลไม่ครบ"; dCls="t-mut"; }
  else if(tot<=2){dTxt="เสี่ยงน้อย";dCls="t-ok"}else if(tot<=5){dTxt="เสี่ยงปานกลาง";dCls="t-warn"}
  else if(tot<=8){dTxt="เสี่ยงสูง";dCls="t-bad"}else{dTxt="เสี่ยงสูงมาก";dCls="t-vbad"}
  $("dmV").textContent = dmIncomplete ? "–" : tot; setTag($("dmT"),dTxt,dCls);
  let dt2="<tr><th>ปัจจัย</th><th>ค่าที่ได้</th><th>คะแนน</th></tr>";
  D.forEach(r=>dt2+=`<tr><td>${r[0]}</td><td>${r[1]}</td><td><b>${r[2]}</b></td></tr>`);
  dt2+=`<tr class="hl"><td colspan="2">รวมคะแนน</td><td><b>${tot}</b></td></tr>`;
  $("dmTb").innerHTML=dt2;

  /* --- CV RISK --- */
  const cvEl=$("cvPct");
  const cv=cvEl?parseFloat(cvEl.value):NaN;
  let cvTxt="",cvCls="t-mut",cvIdx=-1;
  ["cv1","cv2","cv3","cv4"].forEach(i=>{if($(i))$(i).className=""});
  if(isFinite(cv)&&cv>=0){
    if(cv<10){cvTxt="ความเสี่ยงต่ำ";cvCls="t-ok";cvIdx=1}
    else if(cv<20){cvTxt="ความเสี่ยงปานกลาง";cvCls="t-warn";cvIdx=2}
    else if(cv<30){cvTxt="ความเสี่ยงสูง";cvCls="t-bad";cvIdx=3}
    else{cvTxt="ความเสี่ยงสูงมาก";cvCls="t-vbad";cvIdx=4}
    if($("cv"+cvIdx))$("cv"+cvIdx).className="hl";
    $("cvV").textContent=cv.toFixed(1);
  }else $("cvV").textContent="–";
  setTag($("cvT"),isFinite(cv)?cvTxt:"ยังไม่ได้กรอก",cvCls);
  setTag($("cvT2"),isFinite(cv)?cvTxt:"ยังไม่ได้กรอก",cvCls);

  /* --- header --- */
  const nm=$("name").value.trim()||"(ไม่ระบุชื่อ)",hn=$("hn").value.trim();
  const sexTxt = sex==="M"?"ชาย":sex==="F"?"หญิง":"ยังไม่ระบุเพศ";
  const smokeVal=$("smoke").value, dmVal=$("dm").value;
  $("who").innerHTML=`<b style="color:var(--txt);font-size:15px">${esc(nm)}</b>${hn?" · HN "+esc(hn):""} · ${sexTxt} ${age||"–"} ปี · วันที่ ${esc($("dt").value)||"–"}`;

  R={name:nm,hn,date:$("dt").value,
     age:blank("age")?"":age,
     sex:sex==="M"?"ชาย":sex==="F"?"หญิง":"",
     wt:blank("wt")?"":wt, ht:blank("ht")?"":ht, wc:blank("wc")?"":wc, hc:blank("hc")?"":hc,
     sbp:blank("sbp")?"":sbp, dbp:blank("dbp")?"":dbp, gr:blank("gr")?"":gr, gl:blank("gl")?"":gl,
     smoke:smokeVal==="1"?"สูบ":smokeVal==="0"?"ไม่สูบ":"",dm:dmVal==="1"?"เป็น":dmVal==="0"?"ไม่เป็น":"",fdm:fdmVal==="1"?"มี":fdmVal==="0"?"ไม่มี":"",
     bmi:bmi?+bmi.toFixed(1):"",bmiTxt:bmi?bi[2]:"",whr:whr?+whr.toFixed(2):"",whrTxt,
     wcInch,hcInch,wcTxt,
     cvRisk:isFinite(cv)?+cv.toFixed(1):"",cvTxt:isFinite(cv)?cvTxt:"",
     osta:osta!==null?+osta.toFixed(2):"",ostaTxt,gripR:rr?+rr.toFixed(2):"",gripRTxt:ri?ri[1]:"",
     gripL:lr?+lr.toFixed(2):"",gripLTxt:li?li[1]:"",htCat:hRow?hRow[0]:"",htTxt:hRow?hRow[4]:"",
     dmScore:dmIncomplete?"":tot,dmTxt:dTxt};
  chips();
}
document.querySelectorAll("input,select").forEach(e=>e.addEventListener("input",calc));
$("dt").valueAsDate=new Date();calc();

/* ---------- CV: chips / clipboard ---------- */
const CV_URL="https://www.rama.mahidol.ac.th/cardio_vascular_risk/thai_cv_risk_score/";
function chips(){
  const c=[["อายุ",R.age||"–"],["เพศ",R.sex||"–"],["SBP",R.sbp||"–"],["รอบเอว (นิ้ว)",R.wc ? (R.wc / 2.54).toFixed(1) : "–"],
           ["ส่วนสูง (ซม.)",R.ht||"–"],["สูบบุหรี่",R.smoke||"–"],["เบาหวาน",R.dm||"–"]];
  /* เก็บค่าไว้ใน data-v แทนการฝังลงใน onclick="cp('...')"
     ค่าจะเป็นแค่ข้อความ ไม่มีวันถูกตีความเป็นโค้ด ต่อให้มีเครื่องหมาย ' หรือ " ติดมา */
  $("cvChips").innerHTML=c.map(x=>`<span class="chip" data-v="${esc(x[1])}">${esc(x[0])}: <b>${esc(x[1])}</b> 📋</span>`).join("");
}
/* ดักคลิกที่กล่องแม่ครั้งเดียว แล้วหยิบค่าจากชิปที่ถูกแตะ (ไม่ต้องสร้างตัวดักใหม่ทุกครั้งที่คำนวณ) */
$("cvChips").addEventListener("click",e=>{
  const el=e.target.closest(".chip[data-v]");
  if(el)cp(el.dataset.v);
});
function cp(v){navigator.clipboard?.writeText(v).then(()=>toast("คัดลอก "+v+" แล้ว")).catch(()=>toast("คัดลอกไม่ได้"))}
/* ---------- CV: โหลด iframe เฉพาะตอนเข้าแท็บนี้ ---------- */
/* เดิม iframe มี src ตั้งแต่แรก ทำให้ทุกครั้งที่เปิดแอปต้องไปดึงเว็บรามามาด้วย
   ถ้าเว็บรามาช้าหรือล่ม แอปทั้งตัวจะพลอยหมุนค้างตาม จึงเปลี่ยนมาโหลดเมื่อจำเป็นเท่านั้น */
const CV_WAIT=12000;              // ถือว่า "ช้าผิดปกติ" ถ้าเกินกี่มิลลิวินาที
let cvTimer=null;
function cvMsg(html){             // html ว่าง = ซ่อนกล่องแจ้งสถานะ
  const s=$("cvStatus"); if(!s)return;
  s.innerHTML=html||""; s.classList.toggle("hidden",!html);
}
function mountCV(){
  const f=$("cvFrame"); if(!f)return;
  if(f.getAttribute("src"))return;                       // โหลดไปแล้ว ไม่ต้องโหลดซ้ำ
  if(navigator.onLine===false){                          // ออฟไลน์ก็ไม่ต้องเสียเวลาลอง
    cvMsg("📴 ตอนนี้ไม่ได้ต่ออินเทอร์เน็ต — หน้าเครื่องคำนวณของรามาจึงโหลดไม่ได้<br>ส่วนอื่นของแอปยังใช้ได้ตามปกติ · เมื่อต่อเน็ตแล้วกด 🔄 โหลดใหม่");
    return;
  }
  cvMsg("⏳ กำลังโหลดเว็บของรามาธิบดี…");
  cvTimer=setTimeout(()=>cvMsg(
    "⚠️ เว็บของรามาธิบดีใช้เวลานานผิดปกติ หรืออาจขัดข้องอยู่ (เคยพบรหัส 504 Gateway Time-out)<br>"+
    "<b>เป็นปัญหาที่ฝั่งเว็บต้นทาง ไม่ใช่แอปนี้เสีย</b> — ค่าที่กรอกไว้ยังอยู่ครบ<br>"+
    "ทางเลือก: กด 🔄 โหลดใหม่ · กด 🔗 เปิดในเบราว์เซอร์ · หรือคำนวณจากที่อื่นแล้วกรอก %CV Risk ในช่องด้านบนได้เลย"
  ),CV_WAIT);
  f.addEventListener("load",()=>{clearTimeout(cvTimer);cvMsg("")},{once:true});
  f.src=f.dataset.src;
}
function reloadCV(){
  const f=$("cvFrame"); if(!f)return;
  clearTimeout(cvTimer);
  if(!f.getAttribute("src")){mountCV();return}             // ยังไม่เคยโหลด = โหลดครั้งแรก
  cvMsg("⏳ กำลังโหลดเว็บของรามาธิบดี…");
  cvTimer=setTimeout(()=>cvMsg(
    "⚠️ ยังโหลดไม่ขึ้น — เว็บต้นทางน่าจะขัดข้องอยู่ ลองใหม่อีกครั้งภายหลัง หรือกด 🔗 เปิดในเบราว์เซอร์"
  ),CV_WAIT);
  f.addEventListener("load",()=>{clearTimeout(cvTimer);cvMsg("")},{once:true});
  f.src=f.dataset.src;                                     // ตั้งจาก data-src เสมอ กันค่าเพี้ยนหลัง redirect
}
function openCV(){window.open(CV_URL,"_blank")}
async function pasteCV(){
  try{
    const t=await navigator.clipboard.readText();
    const mm=String(t).match(/\d+(\.\d+)?/);
    if(mm){$("cvPct").value=mm[0];calc();toast("ใส่ค่า "+mm[0]+"% แล้ว")}
    else toast("ไม่พบตัวเลขในคลิปบอร์ด");
  }catch(e){toast("เบราว์เซอร์ไม่อนุญาต — พิมพ์เองได้เลยครับ")}
}

/* ---------- EXCEL / PDF ---------- */
const COLS=[["วันที่","date"],["ชื่อ-สกุล","name"],["HN","hn"],["เพศ","sex"],["อายุ","age"],["น้ำหนัก(กก.)","wt"],["ส่วนสูง(ซม.)","ht"],
 ["BMI","bmi"],["เกณฑ์ BMI","bmiTxt"],
 ["รอบเอว(ซม.)","wc"],["รอบเอว(นิ้ว)","wcInch"],["แปลผลรอบเอว","wcTxt"],
 ["รอบสะโพก(ซม.)","hc"],["รอบสะโพก(นิ้ว)","hcInch"],
 ["WHR","whr"],["แปลผล WHR","whrTxt"],
 ["OSTA","osta"],["แปลผล OSTA","ostaTxt"],["SBP","sbp"],["DBP","dbp"],["HT Category","htCat"],["สรุป HT","htTxt"],
 ["บีบมือขวา(กก.)","gr"],["อัตราส่วนขวา","gripR"],["ระดับขวา","gripRTxt"],["บีบมือซ้าย(กก.)","gl"],["อัตราส่วนซ้าย","gripL"],["ระดับซ้าย","gripLTxt"],
 ["สูบบุหรี่","smoke"],["เบาหวาน","dm"],["ประวัติ DM ครอบครัว","fdm"],["คะแนน DM Risk","dmScore"],["สรุป DM Risk","dmTxt"],
 ["%CV Risk (10 ปี)","cvRisk"],["ระดับ CV Risk","cvTxt"]];

/* ---------- EXCEL / CSV Export Functions ---------- */
function dl(blob, fn) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = fn;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 3000);
}

function csvBlob(rows) {
  let csv = COLS.map(c => `"${c[0]}"`).join(",") + "\r\n";
  rows.forEach(r => {
    let row = COLS.map(c => {
      let val = r[c[1]] ?? "";
      return `"${String(val).replace(/"/g, '""')}"`;
    }).join(",");
    csv += row + "\r\n";
  });
  return new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
}

function toExcel() {
  calc();
  dl(csvBlob([R]), `PCU_${(R.name||"record").replace(/\s/g,"")}_${R.date||""}.csv`);
  toast("บันทึกไฟล์ Excel (CSV) แล้ว");
}

function histExcel() {
  const a = load();
  if (!a.length) { toast("ยังไม่มีข้อมูล"); return; }
  dl(csvBlob(a), `PCU_History_${new Date().toISOString().slice(0,10)}.csv`);
  toast("ส่งออก " + a.length + " รายการแล้ว");
}

/* ---------- HISTORY ---------- */
const KEY="pcu_history_v1";
const load=()=>{try{return JSON.parse(localStorage.getItem(KEY))||[]}catch(e){return[]}};
/* เขียนแล้วอ่านกลับมาเทียบทันที — ถ้าไม่ตรงหรือเขียนไม่ได้ จะโยน error ออกไปให้คนเรียกจัดการ
   (เดิมไม่มีการตรวจ ถ้าพื้นที่เต็มหรือเบราว์เซอร์ไม่ยอมให้เขียน ปุ่มจะเงียบไปเฉย ๆ โดยไม่มีใครรู้) */
function save(a){
  const s=JSON.stringify(a);
  localStorage.setItem(KEY,s);
  if(localStorage.getItem(KEY)!==s){const e=new Error("อ่านกลับมาแล้วไม่ตรงกับที่เขียน");e.name="VerifyError";throw e}
}
/* แปลสาเหตุเป็นภาษาคน */
function whyFail(e){
  const n=e&&e.name||"";
  if(n==="QuotaExceededError"||n==="NS_ERROR_DOM_QUOTA_REACHED"||(e&&(e.code===22||e.code===1014)))
    return "พื้นที่เก็บข้อมูลของเบราว์เซอร์เต็ม — ส่งออก Excel เก็บไว้ก่อน แล้วลบประวัติเก่าที่ลงข้อมูลหลักไปแล้วออก";
  if(n==="SecurityError")
    return "เบราว์เซอร์ไม่อนุญาตให้เก็บข้อมูล (เช่น เปิดในโหมดส่วนตัว หรือปิดการเก็บข้อมูลเว็บไซต์ไว้)";
  if(n==="VerifyError")
    return "บันทึกแล้วตรวจสอบไม่ผ่าน ข้อมูลที่อ่านกลับมาไม่ตรงกับที่เขียน";
  return "ข้อผิดพลาดที่ไม่รู้จัก: "+(n||"")+" "+(e&&e.message||"");
}
/* แถบแดงค้างบนจอ — ไม่หายเองเหมือน toast ต้องกด ✕ เท่านั้น */
function showSaveError(title,e,body){
  $("saveErrTitle").textContent=title;
  $("saveErrBody").textContent=body||"ลองกดอีกครั้ง ถ้ายังไม่ได้ให้แจ้งผู้ดูแลแอป";
  $("saveErrWhy").textContent="สาเหตุ: "+whyFail(e);
  $("saveErr").classList.remove("hidden");
  window.scrollTo(0,0);
}
function hideSaveError(){$("saveErr").classList.add("hidden")}
$("saveErrClose").addEventListener("click",hideSaveError);

function saveRec(){
  calc();
  const a=load();a.unshift({...R,id:Date.now(),ts:new Date().toLocaleString("th-TH")});
  try{save(a)}
  catch(e){
    logEvt("save_fail",e.name+": "+whyFail(e)+" · ในเครื่องมี "+(a.length-1)+" ราย");
    showSaveError("⛔ บันทึกไม่สำเร็จ — ข้อมูลรายนี้ยังไม่ถูกเก็บในเครื่อง",e,
      "กรุณาจดค่าลงกระดาษทันทีก่อนปิดหน้านี้ · ค่าที่กรอกยังอยู่ในฟอร์ม ไม่ได้หายไป");
    return;
  }
  hideSaveError();
  logEvt("save_ok","รวม "+a.length+" ราย");
  toast("บันทึกลงเครื่องแล้ว ✓ (รวม "+a.length+" ราย)");renderHist();
}
function renderHist(){
  const a=load(),q=($("q")?.value||"").toLowerCase();
  const f=a.filter(r=>!q||((r.name||"")+(r.hn||"")).toLowerCase().includes(q));
  const has=v=>v!==""&&v!=null;
  $("cnt").textContent=a.length+" ราย";
  /* ทุกค่าที่มาจากข้อมูลที่บันทึกไว้ผ่าน esc() ก่อนต่อเป็น HTML
     id ผ่าน Number() เพราะไปอยู่ใน onclick — ถ้าไม่ใช่ตัวเลขจะกลายเป็น NaN ไม่ใช่โค้ดแปลกปลอม */
  $("histList").innerHTML=f.length?f.map(r=>{const id=Number(r.id);return `<div class="hist">
    <b>${esc(r.name)}</b> ${r.hn?`<span style="color:var(--mut)">· HN ${esc(r.hn)}</span>`:""}
    <div class="m">${esc(r.ts)} · ${esc(r.sex||"ยังไม่ระบุเพศ")} ${has(r.age)?esc(r.age)+" ปี":"อายุ: ยังไม่ได้กรอก"}</div>
    <div class="chips">
      <span class="chip">BMI ${has(r.bmi)?esc(r.bmi)+` (${esc(r.bmiTxt)})`:"ยังไม่ได้กรอก"}</span>
      <span class="chip">WHR ${has(r.whr)?esc(r.whr):"ยังไม่ได้กรอก"}</span>
      <span class="chip">OSTA ${has(r.osta)?esc(r.osta)+` (${esc(r.ostaTxt)})`:"ยังไม่ได้กรอก"}</span>
      <span class="chip">BP ${(has(r.sbp)&&has(r.dbp))?`${esc(r.sbp)}/${esc(r.dbp)} ${esc(r.htCat)}`:"ยังไม่ได้กรอก"}</span>
      <span class="chip">DM ${has(r.dmScore)?esc(r.dmScore)+` คะแนน (${esc(r.dmTxt)})`:"ยังไม่ได้กรอกครบ"}</span>
      <span class="chip">Grip R ${has(r.gripR)?esc(r.gripR):"–"} / L ${has(r.gripL)?esc(r.gripL):"–"}</span>
      <span class="chip">รอบเอว ${has(r.wc)?`${esc(r.wc)} ซม. (${esc(r.wcInch||"–")} นิ้ว) ${esc(r.wcTxt)}`:"ยังไม่ได้กรอก"}</span>
      ${has(r.cvRisk)?`<span class="chip">CV Risk ${esc(r.cvRisk)}% (${esc(r.cvTxt)})</span>`:""}
    </div>
    <div class="row">
      <button class="btn o" onclick="reuse(${id})">↩️ โหลดเข้าฟอร์ม</button>
      <button class="btn g" onclick="one(${id})">📗 Excel</button>
      <button class="btn r" onclick="del(${id})">🗑 ลบ</button>
    </div></div>`}).join(""):`<div class="card" style="text-align:center;color:var(--mut)">ยังไม่มีข้อมูล</div>`;
}
function reuse(id){const r=load().find(x=>x.id===id);if(!r)return;
  $("name").value=r.name==="(ไม่ระบุชื่อ)"?"":r.name;$("hn").value=r.hn;$("age").value=r.age;
  $("sex").value=r.sex==="ชาย"?"M":r.sex==="หญิง"?"F":"";
  $("wt").value=r.wt;$("ht").value=r.ht;$("wc").value=r.wc;$("hc").value=r.hc;$("sbp").value=r.sbp;$("dbp").value=r.dbp;
  $("gr").value=r.gr;$("gl").value=r.gl;
  $("smoke").value=r.smoke==="สูบ"?"1":r.smoke==="ไม่สูบ"?"0":"";
  $("dm").value=r.dm==="เป็น"?"1":r.dm==="ไม่เป็น"?"0":"";
  $("fdm").value=r.fdm==="มี"?"1":r.fdm==="ไม่มี"?"0":"";$("dt").value=r.date||"";
  $("cvPct").value=(r.cvRisk??"");
  calc();go("out");toast("โหลดข้อมูลแล้ว");}
function one(id){
  const r = load().find(x => x.id === id);
  dl(csvBlob([r]), `PCU_${r.name}_${r.date||""}.csv`);
  toast("บันทึกแล้ว");
}
function del(id){if(!confirm("ลบรายการนี้?"))return;
  const before=load(), after=before.filter(x=>x.id!==id);
  try{save(after)}catch(e){logEvt("del_fail",e.name+" · ยังมี "+before.length+" ราย");showSaveError("⛔ ลบไม่สำเร็จ — รายการยังอยู่ในเครื่อง",e);return}
  logEvt("del","ลบ 1 ราย · เหลือ "+after.length+" ราย");
  renderHist();toast("ลบแล้ว")}
function wipe(){
  const n=load().length;
  if(!confirm("ลบประวัติทั้งหมด "+n+" รายการถาวร?\nถ้ายังไม่ได้ลงข้อมูลหลัก ให้กดยกเลิกก่อน"))return;
  try{save([])}catch(e){logEvt("wipe_fail",e.name+" · ยังมี "+n+" ราย");showSaveError("⛔ ลบทั้งหมดไม่สำเร็จ — ข้อมูลยังอยู่ในเครื่อง",e);return}
  logEvt("wipe","ลบทั้งหมด "+n+" ราย");
  renderHist();toast("ลบทั้งหมดแล้ว")}
function clearForm(){if(!confirm("ล้างข้อมูลในฟอร์ม?"))return;
  document.querySelectorAll("input").forEach(i=>{if(i.id!=="q")i.value=""});$("sex").value="";
  ["smoke","dm","fdm"].forEach(i=>$(i).value="");$("dt").valueAsDate=new Date();calc();
  logEvt("clear_form","ล้างฟอร์ม (ไม่กระทบประวัติที่บันทึกไว้ · ในเครื่องมี "+load().length+" ราย)");
  toast("ล้างแล้ว")}
renderHist();

/* ---------- โหมดสี (สว่าง / มืด / ตามระบบ) ---------- */
(function(){
  if(!window.PCUTheme)return; // ตัวหลักอยู่ใน <head> ของ index.html
  const btns=document.querySelectorAll(".theme button");
  const NAME={auto:"ตามระบบ",light:"สว่าง",dark:"มืด"};
  function sync(){
    const m=PCUTheme.get();
    btns.forEach(b=>{const on=b.dataset.m===m;b.classList.toggle("on",on);b.setAttribute("aria-pressed",on)});
  }
  btns.forEach(b=>b.addEventListener("click",()=>{
    const m=b.dataset.m, dark=PCUTheme.set(m);
    sync();
    toast("โหมดสี: "+NAME[m]+(m==="auto"?" (ตอนนี้: "+(dark?"มืด":"สว่าง")+")":""));
  }));
  sync();
})();

/* ---------- คำแนะนำสำหรับ Samsung Internet (แสดงครั้งเดียว ปิดแล้วไม่แสดงอีก) ---------- */
(function(){
  const box=document.getElementById("sbTip"); if(!box)return;
  const isSamsung=/SamsungBrowser/i.test(navigator.userAgent);
  const installed=(window.matchMedia&&matchMedia("(display-mode: standalone)").matches)||navigator.standalone===true;
  let closed=false; try{closed=localStorage.getItem("pcu-sbtip")==="1"}catch(e){}
  if(isSamsung&&!installed&&!closed)box.classList.remove("hidden");
  document.getElementById("sbTipClose").addEventListener("click",()=>{
    box.classList.add("hidden");
    try{localStorage.setItem("pcu-sbtip","1")}catch(e){}
  });
})();

/* ---------- ตรวจว่าเปิดด้วยอะไร (ใช้ทั้งกล่องเตือนและ log) ---------- */
const ENV=(function(){
  const u=navigator.userAgent;
  const iOS=/iP(hone|ad|od)/.test(u)||(/Macintosh/.test(u)&&navigator.maxTouchPoints>1); // iPad รุ่นใหม่แสดงตัวเป็น Mac
  const android=/Android/.test(u);
  const line=/ Line\/\d/.test(u);                         // เบราว์เซอร์ในตัวของ LINE ทั้ง iOS และ Android
  const inApp=line||/FBAN|FBAV|Instagram/.test(u);
  const standalone=(window.matchMedia&&matchMedia("(display-mode: standalone)").matches)||navigator.standalone===true;
  // Safari แท้บน iPhone/iPad: มี Version/…Safari และไม่ใช่ Chrome/Firefox/Edge/Opera/Google app/แอปอื่นที่ห่อเว็บไว้
  const iosSafari=iOS&&/Version\/[\d.]+.*Safari/.test(u)&&!/CriOS|FxiOS|EdgiOS|OPiOS|GSA\/|YaBrowser/.test(u)&&!inApp;
  let browser="อื่น ๆ";
  if(line)browser="LINE (เบราว์เซอร์ในแอป)";
  else if(/FBAN|FBAV|Instagram/.test(u))browser="Facebook/IG (เบราว์เซอร์ในแอป)";
  else if(/SamsungBrowser/.test(u))browser="Samsung Internet";
  else if(/EdgA?\/|EdgiOS/.test(u))browser="Edge";
  else if(/CriOS/.test(u))browser="Chrome";
  else if(/FxiOS|Firefox\//.test(u))browser="Firefox";
  else if(/Chrome\//.test(u))browser="Chrome";
  else if(/Safari\//.test(u))browser="Safari";
  const os=iOS?"iOS/iPadOS":android?"Android":/Windows/.test(u)?"Windows":/Macintosh/.test(u)?"macOS":"อื่น ๆ";
  return {iOS,android,line,inApp,standalone,iosSafari,browser,os};
})();

/* กล่องคำแนะนำแบบปิดแล้วไม่แสดงอีก — ใช้ร่วมกันทุกกล่อง */
function tipOnce(boxId,closeId,flag,show){
  const box=$(boxId); if(!box)return;
  let closed=false; try{closed=localStorage.getItem(flag)==="1"}catch(e){}
  if(show&&!closed)box.classList.remove("hidden");
  $(closeId).addEventListener("click",()=>{box.classList.add("hidden");try{localStorage.setItem(flag,"1")}catch(e){}});
}
/* Safari บน iPhone/iPad ที่ยังไม่ได้ติดตั้งเป็นแอป */
tipOnce("iosTip","iosTipClose","pcu-iostip",ENV.iosSafari&&!ENV.standalone);
/* เปิดอยู่ในเบราว์เซอร์ของ LINE */
tipOnce("lineTip","lineTipClose","pcu-linetip",ENV.line);

/* ---------- แผง log ลับ: แตะป้าย "0 ราย" ติดกัน 5 ครั้งภายใน 2 วินาที ---------- */
(function(){
  const badge=$("cnt"), panel=$("logPanel"); if(!badge||!panel)return;
  let taps=0, timer=null;
  badge.addEventListener("click",()=>{
    taps++; clearTimeout(timer); timer=setTimeout(()=>taps=0,2000);
    if(taps>=5){taps=0; panel.classList.toggle("hidden"); if(!panel.classList.contains("hidden"))showLog()}
  });
  const pad=n=>String(n).padStart(2,"0");
  const fmt=iso=>{const d=new Date(iso);return isNaN(d)?iso:`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`};
  const line=x=>`${fmt(x.t)} | ${x.type} | ${x.msg}`;
  function showLog(){
    const a=readLog();
    $("logSum").textContent=`มี ${a.length} รายการ (เก็บล่าสุดไม่เกิน ${LOG_MAX}) · แสดง 30 รายการล่าสุด`;
    $("logView").textContent=a.slice(-30).reverse().map(line).join("\n")||"(ยังไม่มีบันทึก)";   // textContent = แสดงเป็นข้อความล้วน
  }
  $("logExport").addEventListener("click",()=>{
    const a=readLog();
    const head=[
      "PCU Calculator — บันทึกกิจกรรม",
      "ส่งออกเมื่อ: "+fmt(new Date().toISOString()),
      "เบราว์เซอร์: "+ENV.browser+" · ระบบ: "+ENV.os+" · ติดตั้งเป็นแอป: "+(ENV.standalone?"ใช่":"ไม่ใช่"),
      "ประวัติในเครื่องตอนนี้: "+load().length+" ราย",
      "User-Agent: "+navigator.userAgent,
      "(ไฟล์นี้ไม่มีชื่อ HN หรือค่าที่วัดของผู้รับบริการ)",
      "----------------------------------------"
    ];
    dl(new Blob(["﻿"+head.concat(a.map(line)).join("\r\n")],{type:"text/plain;charset=utf-8"}),
       `PCU_log_${fmt(new Date().toISOString()).replace(/[: ]/g,"-")}.txt`);
    toast("ส่งออก log "+a.length+" รายการแล้ว");
  });
  $("logClear").addEventListener("click",()=>{
    if(!confirm("ล้าง log ทั้งหมด? (ไม่กระทบประวัติผู้รับบริการ)"))return;
    try{localStorage.removeItem(LOG_KEY)}catch(e){}
    logEvt("log_clear","ล้าง log");
    showLog(); toast("ล้าง log แล้ว");
  });
})();

/* ---------- บันทึกตอนเปิดแอป ---------- */
(function(){
  let storage="ใช้ได้";
  try{const k="pcu-probe";localStorage.setItem(k,"1");if(localStorage.getItem(k)!=="1")storage="อ่านกลับไม่ตรง";localStorage.removeItem(k)}
  catch(e){storage="ใช้ไม่ได้ ("+e.name+")"}
  const base=`${ENV.browser} · ${ENV.os} · ${ENV.standalone?"ติดตั้งเป็นแอป":"เปิดในเบราว์เซอร์"} · ที่เก็บข้อมูล${storage} · ประวัติ ${load().length} ราย`;
  // ดึงเวอร์ชันแคชจาก Service Worker เอง จะได้ไม่ต้องแก้เลขเวอร์ชันสองที่
  if(window.caches&&caches.keys)caches.keys().then(k=>logEvt("open",base+" · "+(k.filter(x=>/^pcu-/.test(x)).join(",")||"ยังไม่มีแคช"))).catch(()=>logEvt("open",base));
  else logEvt("open",base);
})();
