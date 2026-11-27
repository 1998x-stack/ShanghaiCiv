/** All points in fictional local metres; no real Shanghai coordinates. */
export const SYNTHETIC_ZONES=Object.freeze([
 Object.freeze({id:"fiction-finance",label:"虚构金融城",type:"finance",x:900,y:900,description:"金融风格原型；非陆家嘴"}),
 Object.freeze({id:"fiction-tech",label:"虚构科技园",type:"tech",x:2150,y:2000,description:"科技风格原型；非张江"}),
 Object.freeze({id:"fiction-transit",label:"虚构交通枢纽",type:"transit",x:4600,y:850,description:"交通风格原型；非虹桥"}),
 Object.freeze({id:"fiction-manufacture",label:"虚构制造港",type:"manufacture",x:5950,y:2300,description:"制造风格原型；非临港"})
]);
export function assertSyntheticZones(scene,zones=SYNTHETIC_ZONES){
 if(scene?.synthetic!==true||scene?.canonical_crs!=="SYNTHETIC_LOCAL_METERS")
   throw new Error("ART_ZONE_REQUIRES_SYNTHETIC_SCENE");
 const ids=new Set();
 for(const z of zones){
   if(!z.id.startsWith("fiction-")||ids.has(z.id)||
      !Number.isFinite(z.x)||!Number.isFinite(z.y)||
      !["finance","tech","transit","manufacture"].includes(z.type)||
      !z.description.includes("非"))throw new Error("UNSAFE_SYNTHETIC_ZONE");
   ids.add(z.id);
 }
 return zones;
}
