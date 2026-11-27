/** FNV-1a + xorshift32: same UTF-16 seed/cell/LOD => same decorations. */
export function hashSeed(value) {
  let h=2166136261;
  for(let i=0;i<String(value).length;i++){
    h=Math.imul(h^String(value).charCodeAt(i),16777619);
  }
  return h>>>0;
}
export function seededRandom(seed) {
  let x=hashSeed(seed)||0x9e3779b9;
  return ()=>{
    x ^= x << 13;x ^= x >>>17;x ^= x << 5;
    return (x>>>0)/4294967296;
  };
}
