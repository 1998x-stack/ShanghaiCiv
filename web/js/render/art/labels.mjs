/** Greedy label placement with deterministic priority and rectangle collision. */
export function intersects(a,b,pad=4){
  return a.x < b.x+b.w+pad && b.x < a.x+a.w+pad &&
         a.y < b.y+b.h+pad && b.y < a.y+a.h+pad;
}
export function placeLabels(candidates,width,height,pad=4){
  if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)
    throw new RangeError("INVALID_LABEL_VIEWPORT");
  const placed=[],boxes=[];
  const ordered=[...candidates].sort((a,b)=>(b.priority-a.priority)||String(a.id).localeCompare(String(b.id)));
  for(const item of ordered){
    const rect=item.box;
    if(!rect||[rect.x,rect.y,rect.w,rect.h].some(x=>!Number.isFinite(x))||rect.w<=0||rect.h<=0)
      throw new RangeError("INVALID_LABEL_RECT");
    if(rect.x<0||rect.y<0||rect.x+rect.w>width||rect.y+rect.h>height)continue;
    if(boxes.some(b=>intersects(rect,b,pad)))continue;
    placed.push(item);boxes.push(rect);
  }
  return placed;
}
