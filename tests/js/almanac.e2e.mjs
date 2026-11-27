/** P08: actual Chromium explorer & Almanac E2E (no public data). */
import assert from "node:assert/strict";
import {mkdir} from "node:fs/promises";
import {chromium} from "playwright";

const base="http://127.0.0.1:8765/web/dev/synthetic-map.html";
const browser=await chromium.launch({headless:true,args:["--disable-dev-shm-usage"]});
await mkdir("artifacts/p08",{recursive:true});
try{
  const page=await browser.newPage({viewport:{width:1500,height:960}});
  const pageErrors=[];
  page.on("pageerror",e=>pageErrors.push(e.message));
  const response=await page.goto(base,{waitUntil:"domcontentloaded"});
  assert.equal(response.status(),200);
  await page.locator("#app[data-ready='true']").waitFor({timeout:20000});
  assert.match(await page.locator("#load-state").innerText(),/56 个虚构格网单元/);
  assert.match(await page.locator(".map-disclosure").innerText(),/FICTIONAL/);
  assert.equal(await page.locator("#metric-year").inputValue(),"2024");
  assert.equal(await page.locator("#metric-lens").inputValue(),"lens-population");
  assert.match(await page.locator("#lens-legend").innerText(),/虚构人口/);
  assert.match(await page.locator("#lens-notice").innerText(),/区级区域着色/);

  // Focus on fictional district A and choose centre grid cell.
  await page.locator("#region-search").selectOption("synthetic-district-a");
  const canvas=page.locator("#map-interaction");
  const c=await canvas.boundingBox();
  assert(c.width>500&&c.height>400);
  await page.mouse.click(c.x+c.width/2,c.y+c.height/2);
  assert.notEqual(await page.locator("#cell-id").innerText(),"—");
  assert.match(await page.locator("#almanac-summary").innerText(),/区级数值/);
  assert.match(await page.locator("#almanac-regions").innerText(),/虚构甲区/);
  assert.match(await page.locator("#almanac-regions").innerText(),/100,000 人/);
  assert.match(await page.locator("#source-detail").innerText(),/SYN-001/);
  assert.match(await page.locator("#source-detail").innerText(),/ShanghaiCiv Test Suite/);
  assert.match(await page.locator("#source-detail").innerText(),/source|来源/i);
  assert.match(await page.locator("#comparison-result").innerText(),/10,000 人/);
  assert.match(await page.locator("#comparison-result").innerText(),/10.00%/);
  assert.match(await page.locator("#zone-estimate").innerText(),/模拟估算/);

  // Dynamic 2025 data, still district scale.
  await page.locator("#metric-year").selectOption("2025");
  assert.match(await page.locator("#almanac-regions").innerText(),/110,000 人/);
  assert.match(page.url(),/year=2025/);
  assert.match(await page.locator("#almanac-summary").innerText(),/不是按覆盖比例分摊/);

  // Derived density method is visible and sector B has missing value.
  await page.locator("#metric-lens").selectOption("lens-density");
  assert.match(await page.locator("#source-detail").innerText(),/synthetic_population_divided_by_area/);
  assert.match(await page.locator("#almanac-regions").innerText(),/1,321/);
  assert.match(page.url(),/lens=lens-density/);

  // Geography B: 2025 density explicitly null, cannot be ranked or compared.
  await page.locator("#region-search").selectOption("synthetic-district-b");
  const b=await canvas.boundingBox();
  await page.mouse.click(b.x+b.width/2,b.y+b.height/2);
  assert.match(await page.locator("#almanac-regions").innerText(),/虚构乙区/);
  assert.match(await page.locator("#almanac-regions").innerText(),/暂无数据/);
  assert.match(await page.locator("#comparison-result").innerText(),/数据缺失/);
  assert.match(await page.locator("#source-detail").innerText(),/missing_value/);

  // Reload preserves period, lens, and selected geographic cell.
  const beforeHash=page.url().split("#")[1];
  assert(beforeHash.includes("year=2025")&&beforeHash.includes("lens=lens-density"));
  await page.reload({waitUntil:"domcontentloaded"});
  await page.locator("#app[data-ready='true']").waitFor({timeout:20000});
  assert.equal(await page.locator("#metric-year").inputValue(),"2025");
  assert.equal(await page.locator("#metric-lens").inputValue(),"lens-density");
  assert.notEqual(await page.locator("#cell-id").innerText(),"—");

  // Turning thematic overlay off does not affect geographic selection.
  await page.locator("#metric-lens").selectOption("none");
  assert.match(await page.locator("#lens-notice").innerText(),/关闭专题着色/);
  assert.match(await page.locator("#almanac-summary").innerText(),/请选择一个虚构区级专题/);
  await page.locator("#metric-lens").selectOption("lens-population");
  assert.notEqual(await page.locator("#cell-id").innerText(),"—");
  await page.screenshot({path:"artifacts/p08/district-almanac-desktop.png",fullPage:true});
  assert.deepEqual(pageErrors,[]);

  const mobile=await browser.newPage({viewport:{width:390,height:844},
    deviceScaleFactor:2,isMobile:true,hasTouch:true});
  await mobile.goto(base,{waitUntil:"domcontentloaded"});
  await mobile.locator("#app[data-ready='true']").waitFor({timeout:20000});
  assert(await mobile.locator("#metric-year").isVisible());
  assert(await mobile.locator("#metric-lens").isVisible());
  assert(await mobile.locator(".map-disclosure").isVisible());
  await mobile.locator("#region-search").selectOption("synthetic-district-a");
  const touchMap=mobile.locator("#map-interaction");
  const rect=await touchMap.boundingBox();
  await touchMap.click({position:{x:Math.min(rect.width-3,rect.width/2),y:Math.min(rect.height-3,rect.height/2)}});
  assert.notEqual(await mobile.locator("#cell-id").innerText(),"—");
  assert.match(await mobile.locator("#source-detail").innerText(),/SYN-001/);
  await mobile.screenshot({path:"artifacts/p08/district-almanac-mobile.png",fullPage:true});

  // Missing year source must fail visibly without silently reusing data.
  const failure=await browser.newPage();
  await failure.route("**/synthetic_2025.json",route=>route.abort());
  await failure.goto(base,{waitUntil:"domcontentloaded"});
  await failure.locator("#app[data-ready='error']").waitFor({timeout:20000});
  assert(await failure.locator("#error-banner").isVisible());

  console.log("P08 E2E PASS: two periods, two lenses, 2025 null, derived/estimate source, URL restore, mobile and source failure.");
}finally{
  await browser.close();
}
