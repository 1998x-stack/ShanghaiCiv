/** Pure camera math in fictional local metres, no geodetic projection. */
export class Camera {
  constructor() {
    this.width=1; this.height=1; this.centerX=0; this.centerY=0;
    this.scale=1; this.minScale=0.045; this.maxScale=3.6;
  }
  resize(width,height) {
    if(!Number.isFinite(width)||!Number.isFinite(height)||width<1||height<1)
      throw new RangeError("INVALID_VIEWPORT_SIZE");
    this.width=width;this.height=height;
  }
  fitBounds([xmin,ymin,xmax,ymax],padding=64) {
    if(![xmin,ymin,xmax,ymax].every(Number.isFinite)||xmin>=xmax||ymin>=ymax)
      throw new RangeError("INVALID_WORLD_BOUNDS");
    const usableW=Math.max(1,this.width-2*padding),usableH=Math.max(1,this.height-2*padding);
    this.scale=Math.max(this.minScale,Math.min(this.maxScale,
      Math.min(usableW/(xmax-xmin),usableH/(ymax-ymin))));
    this.centerX=(xmin+xmax)/2;this.centerY=(ymin+ymax)/2;
  }
  worldToScreen(x,y) {
    return [(x-this.centerX)*this.scale+this.width/2,
            (y-this.centerY)*this.scale+this.height/2];
  }
  screenToWorld(x,y) {
    return [(x-this.width/2)/this.scale+this.centerX,
            (y-this.height/2)/this.scale+this.centerY];
  }
  panPixels(dx,dy) {
    if(!Number.isFinite(dx)||!Number.isFinite(dy))throw new RangeError("INVALID_PAN");
    this.centerX-=dx/this.scale;this.centerY-=dy/this.scale;
  }
  zoomAt(px,py,factor) {
    if(!Number.isFinite(factor)||factor<=0)throw new RangeError("INVALID_ZOOM");
    const [x,y]=this.screenToWorld(px,py);
    this.scale=Math.min(this.maxScale,Math.max(this.minScale,this.scale*factor));
    const [newX,newY]=this.screenToWorld(px,py);
    this.centerX+=x-newX;this.centerY+=y-newY;
  }
  viewportWorld(paddingPx=0) {
    const [xmin,ymin]=this.screenToWorld(-paddingPx,-paddingPx);
    const [xmax,ymax]=this.screenToWorld(this.width+paddingPx,this.height+paddingPx);
    return [xmin,ymin,xmax,ymax];
  }
  toState() {
    return {x:this.centerX,y:this.centerY,z:this.scale};
  }
  restore(state) {
    if(!state||![state.x,state.y,state.z].every(Number.isFinite)||
       state.z<=0||state.z>this.maxScale||state.z<this.minScale)
      return false;
    this.centerX=state.x;this.centerY=state.y;this.scale=state.z;
    return true;
  }
}
