import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {Camera} from "../../web/js/camera.mjs";
import {HexGrid} from "../../web/js/hex.mjs";
import {hashSeed,seededRandom} from "../../web/js/render/art/random.mjs";
import {artBudget,levelForScale,activeLod,LOD_LEVELS} from "../../web/js/render/art/lod.mjs";
import {ArtCache} from "../../web/js/render/art/cache.mjs";
import {descriptorsForCell} from "../../web/js/render/art/props.mjs";
import {placeLabels,intersects} from "../../web/js/render/art/labels.mjs";
import {SYNTHETIC_ZONES,assertSyntheticZones} from "../../web/js/render/art/zones.mjs";
import {ART_SEED} from "../../web/js/render/art/tokens.mjs";

const fixture=JSON.parse(readFileSync(
  new URL("../fixtures/synthetic/synthetic_gis_scene.json",import.meta.url),"utf8"
));

test("P09 four LOD threshold modes are deterministic and bounded",()=>{
  const levels=[[.03,"overview"],[.07,"regional"],[.14,"local"],[.25,"detail"]];
  for(const [scale,name] of levels){
    assert.equal(levelForScale(scale,500),name);
    assert.equal(activeLod(scale,500,"auto"),name);
    assert.equal(activeLod(.03,500,name),name);
  }
  assert.deepEqual(LOD_LEVELS,["overview","regional","local","detail"]);
  assert.deepEqual(LOD_LEVELS.map(artBudget),[0,2,5,9]);
  assert.throws(()=>activeLod(1,500,"bad"),RangeError);
  assert.throws(()=>levelForScale(0,500),RangeError);
});

test("seeded original art is stable across calls and independent of rendering order",()=>{
  const cell={land_fraction:1,water_fraction:0,partial_cell:false};
  const first=descriptorsForCell(23,cell,"detail",ART_SEED);
  const other=descriptorsForCell(12,cell,"regional",ART_SEED);
  const second=descriptorsForCell(23,cell,"detail",ART_SEED);
  assert.deepEqual(first,second);
  assert.equal(first.length,9);
  assert.equal(other.length,2);
  assert.notDeepEqual(descriptorsForCell(24,cell,"detail"),first);
  assert.notDeepEqual(descriptorsForCell(23,cell,"detail","another-seed"),first);
  assert(first.every(p=>Math.hypot(p.x,p.y)<.56&&Object.isFrozen(p)));
  assert.equal(hashSeed(ART_SEED),hashSeed(ART_SEED));
  const rng=seededRandom("repeatable");
  assert.deepEqual([rng(),rng(),rng()],
    [seededRandom("repeatable")(),...(()=>{
      const t=seededRandom("repeatable");t();return [t(),t()];
    })()]);
});

test("art decorations never pretend to have actual building or tree observations",()=>{
  const water={land_fraction:0,water_fraction:1,partial_cell:false};
  const land={land_fraction:1,water_fraction:0,partial_cell:false};
  const waterProps=descriptorsForCell(2,water,"local");
  const landProps=descriptorsForCell(3,land,"local");
  assert(waterProps.every(p=>["wave","ripple"].includes(p.kind)));
  assert(landProps.every(p=>["tree","shrub","roof"].includes(p.kind)));
  assert.deepEqual(descriptorsForCell(9,land,"overview"),[]);
  assert.throws(()=>descriptorsForCell(-1,land,"detail"),RangeError);
});

test("LRU cache respects memory budget and reports hits, misses, evictions",()=>{
  const cache=new ArtCache(2);
  const first=cache.getOrCreate("a",()=>[1]);
  cache.getOrCreate("b",()=>[2]);
  assert.strictEqual(cache.getOrCreate("a",()=>[42]),first);
  cache.getOrCreate("c",()=>[3]);
  assert.equal(cache.stats().entries,2);
  assert.equal(cache.stats().evictions,1);
  assert.equal(cache.stats().hits,1);
  assert.equal(cache.stats().misses,3);
  cache.getOrCreate("b",()=>[4]);
  assert.equal(cache.stats().evictions,2);
  cache.clear();
  assert.equal(cache.stats().entries,0);
  assert.throws(()=>new ArtCache(0),RangeError);
});

test("label collisions resolved with stable priority, not visual position or arrays",()=>{
  const items=[
    {id:"alpha",priority:10,box:{x:10,y:10,w:80,h:20}},
    {id:"beta",priority:2,box:{x:12,y:12,w:80,h:20}},
    {id:"gamma",priority:4,box:{x:130,y:50,w:75,h:18}}
  ];
  const one=placeLabels(items,300,200);
  const two=placeLabels([...items].reverse(),300,200);
  assert.deepEqual(one,two);
  assert.deepEqual(one.map(x=>x.id),["alpha","gamma"]);
  assert(intersects(items[0].box,items[1].box));
  assert(!intersects(items[0].box,items[2].box));
});

test("all four synthetic zone archetypes use invented coordinates and explicit disclaimers",()=>{
  assert.equal(assertSyntheticZones(fixture),SYNTHETIC_ZONES);
  assert.deepEqual(SYNTHETIC_ZONES.map(z=>z.type),[
    "finance","tech","transit","manufacture"
  ]);
  assert(SYNTHETIC_ZONES.every(z=>z.id.startsWith("fiction-")&&z.description.includes("非")));
  assert.throws(()=>assertSyntheticZones({...fixture,canonical_crs:"EPSG:4326"}));
  assert.throws(()=>assertSyntheticZones(fixture,[{...SYNTHETIC_ZONES[0],id:"real-lujiazui"}]));
});

test("visible-cells culling scales with viewport rather than full candidate 250k cells",()=>{
  const grid=new HexGrid({radius_m:500,cols:500,rows:500});
  const camera=new Camera();
  camera.resize(1200,800);camera.centerX=4000;camera.centerY=4500;camera.scale=.16;
  const visible=grid.visibleCells(...camera.viewportWorld(24));
  assert(visible.length>0&&visible.length<500);
  assert(visible.every(id=>Number.isSafeInteger(id)&&id>=0&&id<grid.size));
  assert.equal(new Set(visible).size,visible.length);
});
