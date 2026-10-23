const cacheRecord=key=>{try{const value=JSON.parse(localStorage.getItem('waypoint:'+key));if(value&&Number.isFinite(value.at)&&value.at<=Date.now()+60000)return value;}catch{}return null;};
const readCache=key=>{const value=cacheRecord(key);return value&&Date.now()-value.at<7*864e5?value.data:null;};
const writeCache=(key,data)=>{try{localStorage.setItem('waypoint:'+key,JSON.stringify({at:Date.now(),data}));}catch{}};
export async function json(url,timeout=18000){const r=await fetch(url,{signal:AbortSignal.timeout(timeout)});if(!r.ok)throw Error('Service returned '+r.status);return r.json();}
let lastGeocode=0,geocodeQueue=Promise.resolve();
export function geocode(query){const key='geo:'+query.trim().toLowerCase(),cached=readCache(key);if(cached)return Promise.resolve(cached);const run=async()=>{await new Promise(done=>setTimeout(done,Math.max(0,1200-(Date.now()-lastGeocode))));lastGeocode=Date.now();const url='https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&addressdetails=1&q='+encodeURIComponent(query);const rows=await json(url);const places=rows.map(p=>({name:p.name||p.display_name.split(',')[0],detail:p.display_name,lat:+p.lat,lon:+p.lon,country:p.address?.country_code?.toUpperCase()}));writeCache(key,places);return places;};const job=geocodeQueue.then(run);geocodeQueue=job.catch(()=>{});return job;}
const airportStates=new WeakMap();
export const airportRecordState=data=>airportStates.get(data)||null;
const validAirport=(data,code)=>data?.airport?.iata===code&&Array.isArray(data.routes);
export async function loadAirport(code,networks){
 const memory=networks[code],memoryState=memory&&airportStates.get(memory);if(memory&&!memoryState)return memory; // Bundled data is versioned by its source manifest.
 if(memory&&memoryState&&!memoryState.stale&&Date.now()-memoryState.at<30*864e5)return memory;
 const key='airport:'+code,record=cacheRecord(key),cached=validAirport(record?.data,code)?record:null;
 if(cached&&Date.now()-cached.at<30*864e5){networks[code]=cached.data;airportStates.set(cached.data,{at:cached.at,stale:false});return cached.data;}
 try{const data=await json('https://airportmiles.com/api/v1/airports/'+encodeURIComponent(code.toLowerCase())+'.json');if(!validAirport(data,code))throw Error('Airport data format changed.');networks[code]=data;writeCache(key,data);airportStates.set(data,{at:Date.now(),stale:false});return data;}
 catch(error){const fallback=memory||cached?.data;if(!fallback)throw error;networks[code]=fallback;airportStates.set(fallback,{at:memoryState?.at??cached?.at??0,stale:true});return fallback;}
}
export function clearLookupCaches(){try{const keys=[];for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(/^waypoint:(?:airport:|geo:|osm-rail:)/.test(key))keys.push(key);}for(const key of keys)localStorage.removeItem(key);}catch{}}
export async function loadAtlas({fresh=false,fetcher=globalThis.fetch}={}){
 const get=async path=>{const response=await fetcher(path,{signal:AbortSignal.timeout(45000),...(fresh?{cache:'no-store'}:{})});if(!response.ok)throw Error('Travel data could not load (HTTP '+response.status+').');return response.json();};
 let pointer={manifest:'manifest.json'};const response=await fetcher('data/current.json'+(fresh?'?check='+Date.now():''),{cache:'no-store',signal:AbortSignal.timeout(15000)});if(response.ok)pointer=await response.json();else if(response.status!==404)throw Error('Could not read the active dataset.');
 if(!/^(?:snapshots\/[a-zA-Z0-9_-]+\/)?manifest\.json$/.test(pointer.manifest||''))throw Error('The dataset version pointer is invalid.');
 const base='data/'+pointer.manifest.replace(/manifest\.json$/,'');const manifest=await get(base+'manifest.json'+(fresh?'?check='+Date.now():''));
 if(!Array.isArray(manifest.trainFiles)||!manifest.trainFiles.length||!manifest.trainFiles.every(file=>/^trains-\d+\.json$/.test(file)))throw Error('The timetable file list is invalid.');
 const results=await Promise.allSettled([get(base+'stations.json'),get(base+'airports.json'),get(base+'flights.json'),...manifest.trainFiles.map(file=>get(base+file))]);for(const result of results)if(result.status==='rejected')throw result.reason;
 const [stations,airports,networks,...chunks]=results.map(r=>r.value);const trains=chunks.flat();
 if(!Array.isArray(stations)||!stations.length||!Array.isArray(airports)||!airports.length||!chunks.every(Array.isArray)||stations.length!==manifest.stations||airports.length!==manifest.airports||trains.length!==manifest.trains||!networks||typeof networks!=='object'||Array.isArray(networks)||Object.keys(networks).length!==manifest.airportNetworks)throw Error('The dataset failed its consistency check.');
 return {stations,airports,trains,networks,manifest,base};
}
export async function localRail(point){const key='osm-rail:'+point.lat.toFixed(2)+','+point.lon.toFixed(2),cached=readCache(key);if(cached)return cached;const query=`[out:json][timeout:20];nwr[railway=station](around:50000,${point.lat},${point.lon});out center tags;`;const data=await json('https://overpass-api.de/api/interpreter?data='+encodeURIComponent(query),26000);const rows=data.elements.map(e=>({id:e.tags.ref||'OSM-'+e.id,name:e.tags['name:en']||e.tags.name||'Railway station',lat:e.lat??e.center?.lat,lon:e.lon??e.center?.lon,kind:'rail',source:'OpenStreetMap'})).filter(s=>Number.isFinite(s.lat)&&Number.isFinite(s.lon));writeCache(key,rows);return rows;}
export const providers={geocoding:'https://operations.osmfoundation.org/policies/nominatim/',airports:'https://ourairports.com/data/',flights:'https://airportmiles.com/api',rail:'https://github.com/prasenjit-27/Indian-Railway-Data'};
