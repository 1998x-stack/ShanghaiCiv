import {seededRandom} from "./random.mjs";
import {artBudget,LOD_LEVELS} from "./lod.mjs";
import {ART_SEED} from "./tokens.mjs";
/**
 * Immutable, normalized-in-hex geometry descriptors, deliberately stylized.
 * All decorations are fictional; none represent surveyed trees, rails or buildings.
 */
export function descriptorsForCell(cellId,cell,lod,seed=ART_SEED){
  if(!Number.isSafeInteger(cellId)||cellId<0||!cell)
    throw new RangeError("INVALID_DECORATION_CELL");
  if(!LOD_LEVELS.includes(lod))throw new RangeError("INVALID_DECORATION_LOD");
  const count=artBudget(lod),rng=seededRandom(seed+":"+cellId+":"+lod);
  const water=(cell.water_fraction??0)>.58;
  const choices=water?["wave","wave","ripple"]:["tree","tree","roof","shrub"];
  const props=[];
  for(let i=0;i<count;i++){
    // Circle of radius ≤0.58R fits inside any pointy-top hex.
    const theta=rng()*Math.PI*2,r=.05+Math.sqrt(rng())*.5;
    const kind=choices[Math.floor(rng()*choices.length)];
    props.push(Object.freeze({
      kind, x:Math.cos(theta)*r,y:Math.sin(theta)*r,
      size:.045+rng()*.07,rotation:rng()*Math.PI*2
    }));
  }
  return Object.freeze(props);
}
