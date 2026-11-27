/** Real Chromium P09 E2E: four art LODs, deterministic redraw, controls and mobile. */
import assert from "node:assert/strict";
import {mkdir} from "node:fs/promises";
import {chromium} from "playwright";

const host="http://127.0.0.1:8765";
await mkdir("artifacts/p09",{recursive:true});
const browser=await chromium.launch({headless:true,args:["--disable-dev-shm-usage"]});
const rendered=async(page,lod)=>{
  await page.waitForFunction(x=>{
    const s=document.getElementById("art-state")?.textContent||"";
    return s.includes("LOD "+x+" ·");
  },lod,{timeout:12000});
};
try{
  const gallery=await browser.newPage({viewport:{width:1440,height:900}});
  const g=await gallery.goto(host+"/web/dev/art.html",{waitUntil:"domcontentloaded"});
  assert.equal(g.status(),200);
  await gallery.locator("#gallery[data-ready='true']").waitFor({timeout:20000});
  assert.match(await gallery.locator(".warning").innerText(),/非上海地图/);
  for(const [lod,count] of [["overview",0],["regional",2],["local",5],["detail",9]]){
    const text=await gallery.locator("#stats-"+lod).innerText();
    assert(text.includes("LOD "+lod),text);
    const canvas=gallery.locator("#art-"+lod);
    const box=await canvas.boundingBox();
    assert(box.width>300&&box.height>200);
    const pixels=await canvas.evaluate(c=>c.toDataURL("image/png"));
    assert(pixels.length>1200,"Blank LOD canvas: "+lod);
    if(count===0)assert.match(text,/装饰 0/);
  }
  const firstGallery=await gallery.locator("#art-detail").evaluate(c=>c.toDataURL());
  await gallery.reload({waitUntil:"domcontentloaded"});
  await gallery.locator("#gallery[data-ready='true']").waitFor({timeout:20000});
  const secondGallery=await gallery.locator("#art-detail").evaluate(c=>c.toDataURL());
  assert.equal(firstGallery,secondGallery,"Same fixture and zoom must paint identical pixels");
  await gallery.screenshot({path:"artifacts/p09/four-lods-desktop.png",fullPage:true});
  await gallery.close();

  const page=await browser.newPage({viewport:{width:1500,height:900},deviceScaleFactor:1});
  const errors=[];page.on("pageerror",e=>errors.push(e.message));
  await page.goto(host+"/web/dev/synthetic-map.html",{waitUntil:"domcontentloaded"});
  await page.locator("#app[data-ready='true']").waitFor({timeout:20000});
  assert(await page.locator("#art-decorations").isChecked());
  assert(await page.locator("#art-zones").isChecked());
  assert.equal(await page.locator("#art-zone option").count(),5);
  assert.match(await page.locator(".art-info").innerText(),/非陆家嘴/);

  await page.locator("#art-lod").selectOption("overview");
  await rendered(page,"overview");
  assert.match(await page.locator("#art-state").innerText(),/装饰 0/);
  await page.locator("#art-lod").selectOption("detail");
  await rendered(page,"detail");
  const detailState=await page.locator("#art-state").innerText();
  assert.match(detailState,/缓存 \d+\/160/);
  assert.match(detailState,/命中 \d+/);

  // Pure decorations are stable when toggled off and back on.
  const before=await page.locator("#map-base").evaluate(c=>c.toDataURL());
  await page.locator("#art-decorations").uncheck();
  await page.waitForFunction(()=>/装饰 0/.test(document.getElementById("art-state").textContent));
  await page.locator("#art-decorations").check();
  await page.waitForFunction(()=>!/装饰 0/.test(document.getElementById("art-state").textContent));
  const after=await page.locator("#map-base").evaluate(c=>c.toDataURL());
  assert.equal(before,after,"Procedural art must not shimmer after toggles");

  // Focusing a fictional archetype updates camera, not district metric.
  const oldUrl=page.url();
  await page.locator("#art-zone").selectOption("fiction-manufacture");
  assert.notEqual(page.url(),oldUrl);
  assert.match(await page.locator("#art-state").innerText(),/LOD detail/);
  assert.match(await page.locator("#lens-legend").innerText(),/虚构人口/);
  await page.locator("#art-zones").uncheck();
  await page.reload({waitUntil:"domcontentloaded"});
  await page.locator("#app[data-ready='true']").waitFor({timeout:20000});
  assert.equal(await page.locator("#art-lod").inputValue(),"detail");
  assert.equal(await page.locator("#art-zones").isChecked(),false);
  assert.match(await page.locator("#source-detail").innerText(),/尚无可核验|尚无/);
  await page.screenshot({path:"artifacts/p09/art-map-desktop.png",fullPage:true});
  assert.deepEqual(errors,[]);

  const mobile=await browser.newPage({viewport:{width:390,height:844},
    isMobile:true,hasTouch:true,deviceScaleFactor:2});
  await mobile.goto(host+"/web/dev/synthetic-map.html",{waitUntil:"domcontentloaded"});
  await mobile.locator("#app[data-ready='true']").waitFor({timeout:20000});
  assert(await mobile.locator("#art-lod").isVisible());
  await mobile.locator("#art-lod").selectOption("regional");
  await rendered(mobile,"regional");
  await mobile.locator("#art-zone").selectOption("fiction-tech");
  assert.match(mobile.url(),/x=/);
  assert(await mobile.locator(".map-disclosure").isVisible());
  await mobile.screenshot({path:"artifacts/p09/art-map-mobile.png",fullPage:true});
  await mobile.close();
  console.log("P09 E2E PASS: four LOD gallery, seed pixel identity, cache, toggle, fictional zones, URL and mobile.");
}finally{await browser.close();}
