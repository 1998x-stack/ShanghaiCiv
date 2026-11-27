// Cross-record semantic rules mirroring pipeline/contracts.py.
// Formal structural schemas live under schemas/*.schema.json.
// All functions are pure and safe to run in a browser without npm.
const KINDS = new Set(["municipality","district","zone","hex_cell","facility"]);
const STATUSES = new Set(["observed","derived","estimated","unavailable"]);
const validString = x => typeof x === "string" && x.trim().length > 0;
const validId = x => validString(x) && !/\s/.test(x);
const finite = x => typeof x === "number" && Number.isFinite(x);
const period = /^\d{4}(?:-\d{2}(?:-\d{2})?)?$/;

export function comparable(a, b) {
  if (!a || !b || a.status === "unavailable") return false;
  return ["metric_id","unit","period","granularity","status"].every(k => a[k] === b[k]) &&
    finite(a.value) && finite(b.value);
}

export function validateBundle(bundle) {
  if (!bundle || typeof bundle !== "object" || Array.isArray(bundle)) return ["BUNDLE_STRUCTURE"];
  const errors = new Set();
  const bad = code => errors.add(code);
  if (bundle.schema_version !== 1) bad("SCHEMA_VERSION");
  let release = bundle.release;
  if (!release || typeof release !== "object" || Array.isArray(release)) {
    bad("RELEASE_FIELDS"); release = {};
  }
  if (release.schema_version !== 1 || !validString(release.build_id) ||
      !validString(release.data_vintage) || typeof release.synthetic !== "boolean" ||
      typeof release.publish_approved !== "boolean" ||
      !["blocked","approved"].includes(release.license_review)) bad("RELEASE_FIELDS");
  const synthetic = release.synthetic === true, publishing = release.publish_approved === true;
  if (synthetic && publishing) bad("RELEASE_SYNTHETIC_PUBLISH");
  if (publishing && release.license_review !== "approved") bad("RELEASE_LICENSE_NOT_APPROVED");

  const groups = {};
  for (const key of ["sources","regions","metrics","lenses"]) {
    if (!Array.isArray(bundle[key])) bad("BUNDLE_STRUCTURE");
    groups[key] = Array.isArray(bundle[key]) ? bundle[key] : [];
  }
  const {sources,regions,metrics,lenses} = groups;
  const smap = new Map(), rmap = new Map();
  for (const s of sources) {
    if (!s || typeof s !== "object" || Array.isArray(s)) { bad("SOURCE_FIELDS"); continue; }
    const sid = s.id;
    if (!validId(sid) || !validString(s.publisher) || !validString(s.title) || !validString(s.url) ||
        !KINDS.has(s.native_granularity) ||
        !["unknown","allowed","restricted","prohibited","synthetic"].includes(s.license_status) ||
        !(s.redistribution_allowed == null || typeof s.redistribution_allowed === "boolean")) bad("SOURCE_FIELDS");
    if (smap.has(sid)) bad("SOURCE_DUPLICATE");
    if (typeof sid === "string") smap.set(sid,s);
    if ((synthetic && s.license_status !== "synthetic") ||
        (!synthetic && s.license_status === "synthetic")) bad("SYNTHETIC_REAL_SOURCE_MIX");
    if (publishing && (s.license_status !== "allowed" || s.redistribution_allowed !== true)) bad("SOURCE_RELEASE");
  }
  for (const r of regions) {
    if (!r || typeof r !== "object" || Array.isArray(r)) { bad("REGION_FIELDS"); continue; }
    const rid = r.id;
    if (!validId(rid) || !validString(r.name_zh) || !KINDS.has(r.kind) ||
        !(r.parent_id == null || validId(r.parent_id)) ||
        !(r.code == null || validString(r.code)) ||
        !(r.geometry_ref == null || validString(r.geometry_ref))) bad("REGION_FIELDS");
    if (rmap.has(rid)) bad("REGION_DUPLICATE");
    if (typeof rid === "string") rmap.set(rid,r);
  }
  for (const r of regions) {
    if (!r || typeof r !== "object" || Array.isArray(r)) continue;
    if (r.parent_id != null && !rmap.has(r.parent_id)) bad("REGION_PARENT");
    const seen = new Set();
    let curr = r;
    while (curr && typeof curr === "object") {
      if (seen.has(curr.id)) { bad("REGION_CYCLE"); break; }
      seen.add(curr.id);
      curr = typeof curr.parent_id === "string" ? rmap.get(curr.parent_id) : null;
    }
  }

  let world = bundle.world;
  if (!world || typeof world !== "object" || Array.isArray(world)) { bad("WORLD_FIELDS"); world = {}; }
  const grid = world.grid && typeof world.grid === "object" && !Array.isArray(world.grid) ? world.grid : {};
  const proj = world.projection && typeof world.projection === "object" && !Array.isArray(world.projection) ? world.projection : {};
  if (world.schema_version !== 1) bad("WORLD_FIELDS");
  if (grid.layout !== "odd-r" || grid.orientation !== "pointy" ||
      !finite(grid.radius_m) || grid.radius_m <= 0 ||
      !Number.isSafeInteger(grid.cols) || grid.cols <= 0 ||
      !Number.isSafeInteger(grid.rows) || grid.rows <= 0 ||
      !finite(grid.origin_x_m) || !finite(grid.origin_y_m)) bad("GRID_INVALID");
  if (!validString(proj.crs) || proj.units !== "metre" || proj.axis !== "x-right-y-down" ||
      !finite(proj.origin_x_m) || !finite(proj.origin_y_m)) bad("GRID_PROJECTION");
  if (synthetic && typeof proj.crs === "string" && !proj.crs.startsWith("SYNTHETIC_")) bad("SYNTHETIC_REAL_CRS_MIX");
  const size = Number.isSafeInteger(grid.cols) && Number.isSafeInteger(grid.rows) ? grid.cols*grid.rows : 0;
  let memberships = world.memberships;
  if (!Array.isArray(memberships)) { bad("WORLD_FIELDS"); memberships = []; }
  const weightByCell = new Map(), pairs = new Set();
  for (const m of memberships) {
    if (!m || typeof m !== "object" || Array.isArray(m)) { bad("MEMBERSHIP_INVALID"); continue; }
    const {cell_id:cid,region_id:rid,fraction} = m;
    if (!Number.isSafeInteger(cid) || cid < 0 || cid >= size ||
        !finite(fraction) || fraction <= 0 || fraction > 1) { bad("MEMBERSHIP_INVALID"); continue; }
    if (!validId(rid) || !rmap.has(rid) || rmap.get(rid).kind !== "district") {
      bad("MEMBERSHIP_REGION"); continue;
    }
    const pair = JSON.stringify([cid,rid]);
    if (pairs.has(pair)) bad("MEMBERSHIP_DUPLICATE");
    pairs.add(pair);
    weightByCell.set(cid, (weightByCell.get(cid) || 0) + fraction);
  }
  if ([...weightByCell.values()].some(v => v > 1.000001)) bad("MEMBERSHIP_SUM");

  const seenMetrics = new Set();
  for (const m of metrics) {
    if (!m || typeof m !== "object" || Array.isArray(m)) { bad("METRIC_FIELDS"); continue; }
    const {metric_id:mid,geography_id:rid,granularity:gran,status,value:val,source_id:sid} = m;
    const flags = m.quality_flags;
    if (!validId(mid) || !validId(rid) || !KINDS.has(gran) || !validString(m.unit) ||
        !validString(m.period) || !STATUSES.has(status) || !validId(sid) ||
        !(m.method_id == null || validId(m.method_id)) ||
        !Array.isArray(flags) || !flags.every(validString) ||
        (Array.isArray(flags) && flags.length !== new Set(flags.map(String)).size)) bad("METRIC_FIELDS");
    if (typeof m.period !== "string" || !period.test(m.period)) bad("METRIC_PERIOD");
    const key = JSON.stringify([mid,rid,m.period]);
    if (seenMetrics.has(key)) bad("METRIC_DUPLICATE");
    seenMetrics.add(key);
    if ((status === "unavailable" && val !== null) ||
        (status !== "unavailable" && !finite(val))) bad("METRIC_STATUS_VALUE");
    if ((status === "derived" || status === "estimated") && !validId(m.method_id)) bad("METRIC_DERIVATION");
    if (status === "observed" && m.method_id != null) bad("METRIC_DERIVATION");
    if (!rmap.has(rid) || rmap.get(rid).kind !== gran) {
      if (gran === "hex_cell" && typeof rid === "string" && /^hex:\d+$/.test(rid)) {
        const cell = Number(rid.slice(4));
        if (!Number.isSafeInteger(cell) || cell < 0 || cell >= size) bad("METRIC_GEO_REF");
        if (status === "observed" && (!Array.isArray(flags) || !flags.includes("direct_spatial_observation"))) bad("METRIC_HEX_OBSERVATION");
      } else bad("METRIC_GEO_REF");
    }
    if (!smap.has(sid)) bad("METRIC_SOURCE_REF");
    else if (status === "observed" && smap.get(sid).native_granularity !== gran) bad("METRIC_NATIVE_GRANULARITY");
    if (status === "estimated" && (!Array.isArray(flags) || !flags.includes("modeled"))) bad("METRIC_ESTIMATE_FLAG");
  }
  const metricById = new Map();
  for (const m of metrics) {
    if (!m || typeof m.metric_id !== "string") continue;
    if (!metricById.has(m.metric_id)) metricById.set(m.metric_id,new Set());
    metricById.get(m.metric_id).add(m.granularity);
  }
  const seenLenses = new Set();
  for (const l of lenses) {
    if (!l || typeof l !== "object" || Array.isArray(l)) { bad("LENS_FIELDS"); continue; }
    if (!validId(l.id) || !validString(l.title) || !validId(l.metric_id) ||
        !KINDS.has(l.granularity) || !["linear","log","quantile","category"].includes(l.scale)) bad("LENS_FIELDS");
    if (seenLenses.has(l.id)) bad("LENS_DUPLICATE");
    seenLenses.add(l.id);
    if (!metricById.has(l.metric_id)) bad("LENS_METRIC_REF");
    else if (!metricById.get(l.metric_id).has(l.granularity)) bad("LENS_GRANULARITY");
  }
  return [...errors].sort();
}
