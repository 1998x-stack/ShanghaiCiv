/** Bounded descriptor LRU: no Canvas DOM objects survive destruction. */
export class ArtCache {
  constructor(limit=192){
    if(!Number.isSafeInteger(limit)||limit<1||limit>4096)
      throw new RangeError("INVALID_ART_CACHE_LIMIT");
    this.limit=limit;this.entries=new Map();
    this.hits=0;this.misses=0;this.evictions=0;
  }
  getOrCreate(key,factory){
    if(this.entries.has(key)){
      const result=this.entries.get(key);
      this.entries.delete(key);this.entries.set(key,result);
      this.hits++;return result;
    }
    this.misses++;
    const created=factory();
    if(this.entries.size===this.limit){
      this.entries.delete(this.entries.keys().next().value);this.evictions++;
    }
    this.entries.set(key,created);
    return created;
  }
  clear(){this.entries.clear();}
  stats(){
    return {hits:this.hits,misses:this.misses,evictions:this.evictions,
      entries:this.entries.size,limit:this.limit};
  }
}
