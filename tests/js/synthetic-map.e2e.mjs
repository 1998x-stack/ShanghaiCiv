/**
 * P07 real Chromium E2E smoke/regression using Playwright (installed only in CI).
 * Start python -m http.server 8765 --bind 127.0.0.1 at repo root first.
 */
import assert from "node:assert/strict";
import {mkdir} from "node:fs/promises";
import {chromium} from "playwright";

const base="http://127.0.0.1:8765/web/dev/synthetic-map.html";
const browser=await chromium.launch({headless:true,args:["--disable-dev-shm-usage"]});
const artifactDir="artifacts/p07";
await mkdir(artifactDir,{recursive:true});

try {
  const page=await browser.newPage({viewport:{width:1400,height:900},deviceScaleFactor:1});
  const errors=[];
  page.on("pageerror",error=>errors.push(error.message));
  const response=await page.goto(base,{waitUntil:"domcontentloaded"});
  assert.equal(response.status(),200);
  await page.locator("#app[data-ready='true']").waitFor({timeout:20000});
  assert.match(await page.locator("#load-state").innerText(),/56 个虚构格网单元/);
  assert.equal(await page.locator("#error-banner").isVisible(),false);
  assert.match(await page.locator("body").innerText(),/虚构地图，仅供算法测试/);
  assert.match(await page.locator("#perf-line").innerText(),/可见格/);

  // Select a cell and verify the area fraction inspector.
  const canvas=page.locator("#map-interaction");
  const b=await canvas.boundingBox();
  assert(b.width>400&&b.height>350);
  const cx=b.x+b.width*.52,cy=b.y+b.height*.53;
  await page.mouse.click(cx,cy);
  assert.notEqual(await page.locator("#cell-id").innerText(),"—");
  assert.match(await page.locator("#land-value").innerText(),/%$/);
  assert.match(page.url(),/cell=\d+/);

  // Zoom changes the view without dropping current selection.
  const urlBeforeZoom=page.url();
  await page.locator("#zoom-in").click();
  assert.notEqual(page.url(),urlBeforeZoom);
  assert.notEqual(await page.locator("#cell-id").innerText(),"—");

  // Toggle and restore via URL; update browser history state.
  await page.locator("#layer-grid").uncheck();
  assert.equal(await page.locator("#layer-grid").isChecked(),false);
  await page.reload({waitUntil:"domcontentloaded"});
  await page.locator("#app[data-ready='true']").waitFor({timeout:20000});
  assert.equal(await page.locator("#layer-grid").isChecked(),false);
  assert.notEqual(await page.locator("#cell-id").innerText(),"—");

  // Drag must alter camera position, keyboard input must remain usable.
  const before=page.url();
  const box=await canvas.boundingBox();
  await page.evaluate(() => {
    window.__p07PointerLog = [];
    const node=document.getElementById("map-interaction");
    for(const type of ["pointerdown","pointermove","pointerup"]) {
      node.addEventListener(type,e=>window.__p07PointerLog.push({
        type, pointerId:e.pointerId, x:e.offsetX, y:e.offsetY,
        target:e.target.id, buttons:e.buttons
      }),{capture:true});
    }
  });
  await page.mouse.move(box.x+box.width*.55,box.y+box.height*.56);
  await page.mouse.down();
  await page.mouse.move(box.x+box.width*.65,box.y+box.height*.60,{steps:8});
  await page.mouse.up();
  const pointerLog=await page.evaluate(()=>window.__p07PointerLog);
  assert.notEqual(page.url(),before,"Drag did not persist camera: "+JSON.stringify(pointerLog));
  const afterDrag=page.url();
  await canvas.focus();
  await page.keyboard.press("ArrowRight");
  assert.notEqual(page.url(),afterDrag);
  await page.keyboard.press("Enter");
  assert.notEqual(await page.locator("#cell-id").innerText(),"—");

  // Region selector and reset buttons.
  await page.locator("#region-search").selectOption("synthetic-district-b");
  await page.locator("#reset-view").click();
  assert.equal(await page.locator("#cell-id").innerText(),"—");
  await page.screenshot({path:artifactDir+"/synthetic-desktop.png",fullPage:true});
  assert.deepEqual(errors,[]);
  await page.close();

  // Mobile viewport with touch support / 2d canvas and prominent warning.
  const mobile=await browser.newPage({
    viewport:{width:390,height:844},deviceScaleFactor:2,
    isMobile:true,hasTouch:true
  });
  await mobile.goto(base,{waitUntil:"domcontentloaded"});
  await mobile.locator("#app[data-ready='true']").waitFor({timeout:20000});
  assert(await mobile.locator(".map-disclosure").isVisible());
  assert(await mobile.locator("#zoom-in").isVisible());
  const target=mobile.locator("#map-interaction");
  await target.click({position:{x:150,y:155}});
  assert.notEqual(await mobile.locator("#cell-id").innerText(),"—");
  await mobile.screenshot({path:artifactDir+"/synthetic-mobile.png",fullPage:true});
  await mobile.close();

  // Failure must be visibly diagnosed instead of drawing fake geometry.
  const failure=await browser.newPage();
  await failure.route("**/synthetic_gis_scene.json",route=>route.abort());
  await failure.goto(base,{waitUntil:"domcontentloaded"});
  await failure.locator("#app[data-ready='error']").waitFor({timeout:20000});
  assert(await failure.locator("#error-banner").isVisible());
  assert.match(await failure.locator("#load-state").innerText(),/加载失败/);
  await failure.close();

  console.log("P07 E2E PASS: desktop select/zoom/pan/keyboard/layers/hash; mobile; missing source.");
} finally {
  await browser.close();
}
