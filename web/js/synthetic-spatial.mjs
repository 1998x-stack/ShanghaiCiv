/**
 * Synthetic-only browser spatial builder. Mirrors P04's Python area clipping.
 *
 * Invariants: XY in fictional local metres; no real map coordinates,
 * no statistical estimates, no use of provider tiles or GIS APIs.
 */
import {HexGrid} from "./hex.mjs";

const SQRT3 = Math.sqrt(3);
const EPS = 1e-9;

export function assertSyntheticScene(scene) {
  if (!scene || scene.schema_version !== 1 || scene.synthetic !== true ||
      scene.canonical_crs !== "SYNTHETIC_LOCAL_METERS" ||
      scene.raw_crs !== "SYNTHETIC_LOCAL_METERS" ||
      scene.geometry_license_status !== "synthetic" ||
      !String(scene.disclosure || "").includes("FICTIONAL") ||
      !Array.isArray(scene.regions) || !Array.isArray(scene.surfaces) ||
      !scene.regions.length || !scene.surfaces.length) {
    throw new Error("UNAPPROVED_OR_INVALID_MAP_SOURCE");
  }
  if (scene.regions.some(r => r.kind !== "district") ||
      scene.surfaces.some(s => s.kind !== "water") ||
      scene.grid?.layout !== "odd-r" || scene.grid?.orientation !== "pointy") {
    throw new Error("UNAPPROVED_MAP_GEOMETRY");
  }
  return scene;
}

export function ring(points) {
  if (!Array.isArray(points) || points.length < 3) throw new Error("INVALID_RING");
  const result = points.map(v => {
    if (!Array.isArray(v) || v.length !== 2 || !v.every(Number.isFinite)) {
      throw new Error("INVALID_VERTEX");
    }
    return [v[0], v[1]];
  });
  if (result.length > 3 && result[0][0] === result.at(-1)[0] &&
      result[0][1] === result.at(-1)[1]) result.pop();
  if (result.length < 3 || Math.abs(signedArea(result)) <= EPS) {
    throw new Error("ZERO_AREA_RING");
  }
  return result;
}

export function signedArea(pts) {
  let twice = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i+1)%pts.length];
    twice += a[0]*b[1] - b[0]*a[1];
  }
  return twice / 2;
}

function polygons(geom) {
  if (!geom || !Array.isArray(geom.coordinates)) throw new Error("INVALID_GEOMETRY");
  const items = geom.type === "Polygon" ? [geom.coordinates] :
    geom.type === "MultiPolygon" ? geom.coordinates : null;
  if (!items || !items.length) throw new Error("UNSUPPORTED_GEOMETRY_TYPE");
  for (const item of items) {
    if (!Array.isArray(item) || !item.length) throw new Error("INVALID_SHELL");
    for (const points of item) ring(points);
  }
  return items;
}

export function bbox(points) {
  return [
    Math.min(...points.map(p=>p[0])), Math.min(...points.map(p=>p[1])),
    Math.max(...points.map(p=>p[0])), Math.max(...points.map(p=>p[1]))
  ];
}

export function geometryBounds(geom) {
  const all = polygons(geom).flatMap(poly => poly.flatMap(points => ring(points)));
  return bbox(all);
}

function cross(a,b,p) {
  return (b[0]-a[0])*(p[1]-a[1]) - (b[1]-a[1])*(p[0]-a[0]);
}

export function clipToConvex(subject, clipper) {
  if (!Array.isArray(clipper) || clipper.length < 3) throw new Error("INVALID_CLIPPER");
  const sign = signedArea(clipper) >= 0 ? 1 : -1;
  let output = [...subject];
  for (let i=0; i<clipper.length; i++) {
    const a = clipper[i], b = clipper[(i+1)%clipper.length];
    const input = output;
    output = [];
    if (!input.length) break;
    let previous = input.at(-1), prevD = sign * cross(a,b,previous);
    for (const current of input) {
      const d = sign * cross(a,b,current);
      if ((d >= -EPS) !== (prevD >= -EPS)) {
        const den = prevD-d;
        if (Math.abs(den)>EPS) {
          const t=Math.max(0,Math.min(1,prevD/den));
          output.push([
            previous[0] + t*(current[0]-previous[0]),
            previous[1] + t*(current[1]-previous[1])
          ]);
        }
      }
      if (d >= -EPS) output.push(current);
      previous=current;prevD=d;
    }
  }
  return output;
}

export function intersectionArea(geom, clipper) {
  const [xmin,ymin,xmax,ymax]=bbox(clipper);
  let total=0;
  for (const poly of polygons(geom)) {
    const shell=ring(poly[0]);
    const [sx0,sy0,sx1,sy1]=bbox(shell);
    if (sx0>xmax || sx1<xmin || sy0>ymax || sy1<ymin) continue;
    const shellArea = Math.abs(signedArea(clipToConvex(shell,clipper)));
    const holesArea = poly.slice(1).reduce((s,hole)=>
      s + Math.abs(signedArea(clipToConvex(ring(hole),clipper))),0);
    const part = shellArea-holesArea;
    if (part < -1e-5) throw new Error("INTERSECTION_HOLES_EXCEED_SHELL");
    total += Math.max(0, part);
  }
  return total;
}

const rounded = value => Math.round(value*1e8)/1e8;

export function buildSyntheticCoverage(scene) {
  assertSyntheticScene(scene);
  const grid = new HexGrid(scene.grid);
  const cellArea=3*SQRT3*grid.radius_m*grid.radius_m/2;
  const regions=[...scene.regions].sort((a,b)=>a.id.localeCompare(b.id));
  const surfaces=[...scene.surfaces].sort((a,b)=>a.id.localeCompare(b.id));
  const boundsFor = f => ({feature:f, bounds:geometryBounds(f.geometry)});
  const districtShapes=regions.map(boundsFor);
  const waterShapes=surfaces.map(boundsFor);
  const memberships=[], cells=[];
  const boundsOverlap=(a,b)=>a[0]<=b[2]&&a[2]>=b[0]&&a[1]<=b[3]&&a[3]>=b[1];
  for(let id=0;id<grid.size;id++) {
    const [col,row]=grid.colRow(id);
    const hex=grid.vertices(col,row), cb=grid.cellBounds(col,row);
    let land=0,water=0;
    for(const {feature,bounds} of districtShapes) {
      if(!boundsOverlap(cb,bounds)) continue;
      const fraction=intersectionArea(feature.geometry,hex)/cellArea;
      if(fraction>EPS) {
        land += fraction;
        memberships.push({cell_id:id,region_id:feature.id,fraction:rounded(fraction)});
      }
    }
    for(const {feature,bounds} of waterShapes) {
      if(boundsOverlap(cb,bounds)) water += intersectionArea(feature.geometry,hex)/cellArea;
    }
    if(land+water>1+2e-7) throw new Error("GEOMETRY_PARTITION_OVERLAP");
    if(land < -EPS || water < -EPS) throw new Error("NEGATIVE_COVERAGE");
    land=Math.min(1,Math.max(0,land));
    water=Math.min(1,Math.max(0,water));
    const outside=Math.max(0,1-land-water);
    const partial=[land,water,outside].filter(f=>f>1e-7).length>1;
    const dominant=land>=Math.max(water,outside)?"land":water>=outside?"water":"outside";
    cells.push({
      cell_id:id,land_fraction:rounded(land),water_fraction:rounded(water),
      outside_fraction:rounded(outside),partial_cell:partial,dominant
    });
  }
  const byCell=new Map(cells.map(c=>[c.cell_id,[]]));
  for(const m of memberships)byCell.get(m.cell_id).push(m);
  for(const cell of cells) {
    const sum=byCell.get(cell.cell_id).reduce((s,m)=>s+m.fraction,0);
    if(Math.abs(sum-cell.land_fraction)>5e-7) throw new Error("LAND_MEMBERSHIP_MISMATCH");
    if(Math.abs(cell.land_fraction+cell.water_fraction+cell.outside_fraction-1)>5e-7)
      throw new Error("SURFACE_FRACTION_INVALID");
  }
  return {grid,cells,memberships,byCell,cellArea};
}
