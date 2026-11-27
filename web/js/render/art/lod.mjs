/** 4 art LODs, exclusively based on projected synthetic hex radius. */
export const LOD_LEVELS=Object.freeze(["overview","regional","local","detail"]);
export function levelForScale(scale,radiusM) {
  if(!Number.isFinite(scale)||!Number.isFinite(radiusM)||scale<=0||radiusM<=0)
    throw new RangeError("INVALID_ART_SCALE");
  const px=scale*radiusM;
  if(px<22)return "overview";
  if(px<48)return "regional";
  if(px<95)return "local";
  return "detail";
}
export function activeLod(scale,radiusM,override="auto"){
  if(override==="auto")return levelForScale(scale,radiusM);
  if(!LOD_LEVELS.includes(override))throw new RangeError("INVALID_LOD_OVERRIDE");
  return override;
}
export function artBudget(lod){
  if(!LOD_LEVELS.includes(lod))throw new RangeError("INVALID_LOD");
  return ({overview:0,regional:2,local:5,detail:9})[lod];
}
