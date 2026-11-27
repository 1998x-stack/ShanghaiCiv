/** P10 real Chromium Explorer / source / export E2E. Requires repo-root HTTP server. */
import assert from "node:assert/strict";
import {mkdir,readFile} from "node:fs/promises";
import {chromium} from "playwright";

const base="http://127.0.0.1:8765/web/dev/synthetic-map.html";
await mkdir("artifacts/p10",{recursive:true});
const browser=await chromium.launch({headless:true,args:["--disable-dev-shm-usage"]});
try{
  const page=await browser.newPage({viewport:{width:1500,height:950},deviceScaleFactor:1,acceptDownloads:true});
  const errors=[];
  page.on("pageerror",err=>errors.push(err.message));
  const r=await page.goto(base,{waitUntil:"domcontentloaded"});
  assert.equal(r.status(),200);
  await page.locator("#app[data-ready='true']").waitFor({timeout:20000});
  assert.equal(await page.locator("#explorer-sort").inputValue(),"population");
  assert.match(await page.locator("#explorer-year").innerText(),/2024/);
  assert.match(await page.locator(".explorer-warning").innerText(),/SYNTHETIC ONLY/);
  assert.equal(await page.locator("#explorer-rank tbody tr").count(),2);
  assert.deepEqual(await page.locator("#explorer-rank tbody tr").evaluateAll(
    nodes=>nodes.map(n=>n.dataset.regionId)),["synthetic-district-a","synthetic-district-b"]);
  assert.match(await page.locator("#explorer-rank tbody").innerText(),/100,000 人/);
  assert.match(await page.locator("#explorer-rank tbody").innerText(),/暂无数据/);
  assert.match(await page.locator("#explorer-comparison").innerText(),/50,000 人/);
  assert.match(await page.locator("#explorer-scatter").innerText(),/不计算相关性/);
  assert.equal(await page.locator("#explorer-scatter svg g[data-region-id]").count(),1);
  assert.match(await page.locator("#explorer-industry-empty").innerText(),/暂无可比较的区级产业结构数据/);

  // Sorting must be stable and leave null at the bottom in both directions.
  await page.locator("#explorer-direction").selectOption("asc");
  assert.deepEqual(await page.locator("#explorer-rank tbody tr").evaluateAll(
    nodes=>nodes.map(n=>n.dataset.regionId)),["synthetic-district-b","synthetic-district-a"]);
  await page.locator("#explorer-sort").selectOption("population_density");
  assert.deepEqual(await page.locator("#explorer-rank tbody tr").evaluateAll(
    nodes=>nodes.map(n=>n.dataset.regionId)),["synthetic-district-a","synthetic-district-b"]);
  assert.match(await page.locator("#explorer-counts").innerText(),/缺失 1/);

  // Table selection focuses same district on map and Almanac (not fake hex statistic).
  await page.locator('#explorer-rank button[data-region-id="synthetic-district-b"]').click();
  assert.notEqual(await page.locator("#cell-id").innerText(),"—");
  assert.equal(await page.locator('#explorer-rank button[data-region-id="synthetic-district-b"]')
    .getAttribute("aria-pressed"),"true");
  assert.match(page.url(),/focus=synthetic-district-b/);
  assert.match(await page.locator("#almanac-regions").innerText(),/虚构乙区/);
  assert.match(await page.locator("#almanac-summary").innerText(),/区级数值/);

  // Switching shared P08 year immediately changes Explorer, missing B stays null.
  await page.locator("#metric-year").selectOption("2025");
  assert.match(await page.locator("#explorer-year").innerText(),/2025/);
  assert.match(await page.locator("#explorer-rank tbody").innerText(),/110,000 人/);
  assert.match(await page.locator('#explorer-rank tr[data-region-id="synthetic-district-b"]')
    .innerText(),/暂无数据/);
  assert.match(await page.locator("#explorer-comparison").innerText(),/缺失值不可比较/);
  assert.match(await page.locator("#explorer-audit").innerText(),/SYN-001/);
  assert.match(await page.locator("#explorer-audit").innerText(),/synthetic/);

  // Compare selectors: same district fails explicitly, no invented difference.
  await page.locator("#explorer-left").selectOption("synthetic-district-a");
  await page.locator("#explorer-right").selectOption("synthetic-district-a");
  assert.match(await page.locator("#explorer-comparison").innerText(),/请选择不同的虚构行政区/);
  await page.locator("#explorer-right").selectOption("synthetic-district-b");
  await page.locator("#explorer-compare-metric").selectOption("population_density");
  assert.match(await page.locator("#explorer-comparison").innerText(),/缺失值不可比较/);

  // Scatter only one A point; clicking it synchronizes map + selected row.
  await page.locator('#explorer-scatter svg g[data-region-id="synthetic-district-a"]').click();
  assert.equal(await page.locator('#explorer-rank button[data-region-id="synthetic-district-a"]')
    .getAttribute("aria-pressed"),"true");
  assert.match(page.url(),/focus=synthetic-district-a/);
  assert.notEqual(await page.locator("#cell-id").innerText(),"—");
  assert.match(await page.locator("#explorer-audit").innerText(),/synthetic_population_divided_by_area/);

  // URL must restore Explorer sorting, chosen period, metric and map cell.
  await page.reload({waitUntil:"domcontentloaded"});
  await page.locator("#app[data-ready='true']").waitFor({timeout:20000});
  assert.equal(await page.locator("#explorer-sort").inputValue(),"population_density");
  assert.equal(await page.locator("#explorer-direction").inputValue(),"asc");
  assert.equal(await page.locator("#metric-year").inputValue(),"2025");
  assert.equal(await page.locator("#explorer-compare-metric").inputValue(),"population_density");
  assert.equal(await page.locator('#explorer-rank button[data-region-id="synthetic-district-a"]')
    .getAttribute("aria-pressed"),"true");

  // Download only an explicitly marked synthetic test CSV, no real data.
  const [download]=await Promise.all([
    page.waitForEvent("download"),page.locator("#explorer-download").click()
  ]);
  assert.match(download.suggestedFilename(),/^SYNTHETIC-ONLY-explorer-2025\.csv$/);
  const csv=await readFile(await download.path(),"utf8");
  assert.match(csv,/SYNTHETIC TEST ONLY - NOT REAL SHANGHAI DATA/);
  assert.match(csv,/source_id/);
  assert.match(csv,/SYN-001/);
  assert.match(csv,/unavailable/);
  assert.match(csv,/publish_approved/);
  assert.match(await page.locator("#explorer-download-status").innerText(),/正式上海统计导出仍 BLOCKED/);
  await page.screenshot({path:"artifacts/p10/explorer-desktop.png",fullPage:true});
  assert.deepEqual(errors,[]);

  // 390px touch mobile layout preserves control and source warnings.
  const mobile=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2,
    isMobile:true,hasTouch:true});
  await mobile.goto(base,{waitUntil:"domcontentloaded"});
  await mobile.locator("#app[data-ready='true']").waitFor({timeout:20000});
  assert(await mobile.locator("#explorer-sort").isVisible());
  assert(await mobile.locator("#explorer-scatter").isVisible());
  await mobile.locator("#explorer-sort").selectOption("population_density");
  await mobile.locator('#explorer-rank button[data-region-id="synthetic-district-a"]').click();
  assert.notEqual(await mobile.locator("#cell-id").innerText(),"—");
  assert(await mobile.locator(".map-disclosure").isVisible());
  await mobile.screenshot({path:"artifacts/p10/explorer-mobile.png",fullPage:true});
  await mobile.close();
  console.log("P10 E2E PASS: two districts, two periods, sort, null, comparison, scatter selection, URL, provenance, synthetic CSV and mobile.");
}finally{await browser.close();}
