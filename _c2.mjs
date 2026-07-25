import http from "http"; import fs from "fs"; import path from "path"; import { chromium } from "playwright";
const ROOT="/home/user/kontyuu-zukan"; const SHOT="/tmp/claude-0/-home-user-kontyuu-zukan/973d043e-0dc1-50e5-aa86-4b9da02e3295/scratchpad";
const MIME={".html":"text/html",".css":"text/css",".js":"application/javascript",".json":"application/json",".webmanifest":"application/manifest+json",".png":"image/png"};
const s=http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split("?")[0]);if(p==="/")p="/index.html";fs.readFile(path.join(ROOT,p),(e,d)=>{if(e){r.writeHead(404);r.end();return;}r.writeHead(200,{"Content-Type":MIME[path.extname(p)]||"text/plain"});r.end(d);});});
await new Promise(r=>s.listen(4181,r));
const b=await chromium.launch({executablePath:"/opt/pw-browsers/chromium-1194/chrome-linux/chrome"});
for (const [w,label] of [[716,"tab"],[900,"wide"],[390,"phone"]]) {
  const pg=await (await b.newContext({viewport:{width:w,height:900},deviceScaleFactor:2,reducedMotion:"reduce"})).newPage();
  const errs=[]; pg.on("pageerror",e=>errs.push(e.message)); pg.on("dialog",d=>d.accept());
  await pg.goto("http://localhost:4181/index.html",{waitUntil:"networkidle"});
  await pg.evaluate(()=>localStorage.setItem("mz-gemini-key","AIzaTESTKEY"));  // hide api hint like the real device
  await pg.reload({waitUntil:"networkidle"});
  async function reg(n){ await pg.click("#fab",{force:true}); await pg.waitForTimeout(90); await pg.$eval("#picker",el=>el.hidden=true); await pg.setInputFiles("#file-gallery", SHOT+"/fake_bug.jpg"); await pg.waitForTimeout(300); await pg.fill("#r-name-input",n); await pg.click("#r-save"); await pg.waitForTimeout(380); await pg.click("#cel-ok").catch(()=>{}); await pg.waitForTimeout(70); }
  for (const n of ["こがねむし","てんとうむし","かぶとむし","くわがた","かまきり","ばった"]) await reg(n);
  await pg.waitForTimeout(300);
  const m = await pg.evaluate(()=>{
    const plate=document.querySelector(".title-plate").getBoundingClientRect();
    const btns=document.querySelector(".topbar-btns").getBoundingClientRect();
    const bar=document.querySelector(".topbar").getBoundingClientRect();
    const logo=document.querySelector(".logo");
    return {overlap: Math.round(plate.right - btns.left), headerH: Math.round(bar.height),
            titleCut: logo.scrollWidth>logo.clientWidth+1, plateCenter: Math.round(plate.left+plate.width/2), vw: window.innerWidth};
  });
  console.log(label, "overlap:", m.overlap, "| headerH:", m.headerH, "| titleCut:", m.titleCut, "| center:", m.plateCenter, "/", m.vw, "| errors:", errs.length?errs:"none");
  await pg.screenshot({path:SHOT+`/v19b-${label}.png`, clip:{x:0,y:0,width:w,height:Math.min(900, m.headerH+460)}});
  await pg.close();
}
await b.close(); s.close();
