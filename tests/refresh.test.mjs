import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {join} from 'node:path';
import {fixture,minima} from './refresh-fixtures.mjs';
import {refreshData,activeSnapshot,sourceURLs,atomicJSON,acquireRefreshLock} from '../scripts/data-refresh.mjs';
import {createRefreshController} from '../scripts/refresh-controller.mjs';
import {buildStatic} from '../scripts/build.mjs';
import {sourceFreshness} from '../public/data-freshness.js';
import {loadAtlas,loadAirport,airportRecordState,clearLookupCaches} from '../public/api.js';

test('a manual refresh bypasses cached airport records and publishes one complete immutable snapshot',async t=>{
 const f=await fixture(t);await mkdir(join(f.root,'.cache'),{recursive:true});await writeFile(join(f.root,'.cache/airport-klh.json'),JSON.stringify({...f.networks.KLH,generated:'2014-01-01'}));const events=[];
 const result=await refreshData({root:f.root,fetcher:f.fetcher,minima,onProgress:event=>events.push(event)});const active=await activeSnapshot(f.root);
 assert.equal(active.manifest.revision,result.revision);assert.notEqual(active.directory,f.data);assert.ok(f.requested.includes(sourceURLs.airport('KLH')));assert.ok(f.requested.includes(sourceURLs.airport('HYD')));
 assert.equal(active.manifest.sources.connections.generatedAt,'2026-10-14');assert.equal(active.manifest.sources.rail.effectiveAt,null);assert.ok(active.manifest.sources.rail.retrievedAt);assert.equal(active.manifest.sources.connections.reportingPeriods[0].period,'domestic 2025-10…2026-09');assert.equal(events.at(-1).completed,events.at(-1).total);
 assert.equal(JSON.parse(await readFile(join(f.data,'manifest.json'),'utf8')).built,'2026-01-01'); // The previous snapshot is retained.
 const fetcher=async path=>{const file=String(path).split('?')[0].replace(/^data\//,'');try{return new Response(await readFile(join(f.data,file)));}catch{return new Response('',{status:404});}};
 const atlas=await loadAtlas({fetcher,fresh:true});assert.equal(atlas.manifest.revision,result.revision);assert.equal(atlas.trains.length,1);
});
test('one failed airport request preserves the active pointer and last good data',async t=>{
 const f=await fixture(t);await atomicJSON(join(f.data,'current.json'),{manifest:'manifest.json',revision:'old'});const before=await readFile(join(f.data,'current.json'),'utf8');const original=await readFile(join(f.data,'flights.json'),'utf8');
 await assert.rejects(refreshData({root:f.root,minima,fetcher:async url=>url===sourceURLs.airport('HYD')?new Response('Unavailable',{status:503}):f.fetcher(url)}),/503/);
 assert.equal(await readFile(join(f.data,'current.json'),'utf8'),before);assert.equal(await readFile(join(f.data,'flights.json'),'utf8'),original);
});
test('unexpected shrinkage, invalid JSON and airport identity changes cannot replace a valid snapshot',async t=>{
 const f=await fixture(t);
 for(const [url,bad,pattern]of [[sourceURLs.stations,'[]',/shrank/],[sourceURLs.trains,'<html>Error</html>',/unexpected response/],[sourceURLs.airport('KLH'),JSON.stringify({...f.networks.KLH,airport:{iata:'WRONG'}}),/Invalid connection/]]){
  const old=f.values.get(url);f.values.set(url,bad);await assert.rejects(refreshData({root:f.root,fetcher:f.fetcher,minima}),pattern);assert.equal((await activeSnapshot(f.root)).manifest.built,'2026-01-01');f.values.set(url,old);
 }
});
test('source-generated dates remain old even after a recent download',()=>{
 const rows=sourceFreshness({built:'2026-10-23',flightGenerated:'2025-01-01',sources:{connections:{retrievedAt:'2026-10-23T12:00:00Z',generatedAt:'2025-01-01'}}},Date.parse('2026-10-23T13:00:00Z'));
 assert.equal(rows.find(r=>r.id==='connections').stale,true);assert.equal(rows.find(r=>r.id==='rail').stale,false);assert.match(rows.find(r=>r.id==='rail').period,/effective date not supplied/);assert.equal(rows.find(r=>r.id==='estimates').checked.value,null);
});
test('the controller coalesces refreshes and records failures without losing the previous success date',async t=>{
 const f=await fixture(t);let release,count=0;const gate=new Promise(done=>release=done);const controller=await createRefreshController({root:f.root,refresh:async({onProgress})=>{count++;onProgress({message:'Testing source',completed:1,total:2});await gate;return {revision:'new',manifest:{refreshedAt:'2026-10-23T12:00:00Z'}};}});
 await controller.start();await controller.start();assert.equal(count,1);assert.equal(controller.status.phase,'running');release();await controller.completion;assert.equal(controller.status.phase,'succeeded');
 const failing=await createRefreshController({root:f.root,refresh:async()=>{throw Error('Source offline');}});await failing.start();await failing.completion;assert.equal(failing.status.phase,'failed');assert.equal(failing.status.lastSuccessAt,'2026-10-23T12:00:00Z');assert.match(failing.status.message,/offline/);
});
test('separate refresh processes cannot overlap and abandoned locks can recover',async t=>{
 const f=await fixture(t);const release=await acquireRefreshLock(f.root);await assert.rejects(acquireRefreshLock(f.root),/already running/);await release();await atomicJSON(join(f.root,'.cache/refresh.lock'),{pid:2147483646,id:'abandoned'});const recovered=await acquireRefreshLock(f.root);await recovered();
 await atomicJSON(join(f.root,'.cache/refresh-status.json'),{phase:'running',ownerPid:2147483646});const controller=await createRefreshController({root:f.root});assert.equal(controller.status.phase,'failed');assert.match(controller.status.message,/interrupted/);
});

test('a running server sees a CLI refresh finish and preserves its last-success date on the next failure',async t=>{
 const f=await fixture(t);const controller=await createRefreshController({root:f.root,refresh:async()=>{throw Error('Next source unavailable');}});
 await atomicJSON(join(f.root,'.cache/refresh-status.json'),{phase:'running',ownerPid:process.pid,startedAt:'2026-10-23T12:00:00Z',lastSuccessAt:null});assert.equal((await controller.getStatus()).phase,'running');
 await atomicJSON(join(f.root,'.cache/refresh-status.json'),{phase:'succeeded',ownerPid:process.pid,startedAt:'2026-10-23T12:00:00Z',lastSuccessAt:'2026-10-23T12:01:00Z'});assert.equal((await controller.getStatus()).phase,'succeeded');
 await controller.start();await controller.completion;assert.equal(controller.status.lastSuccessAt,'2026-10-23T12:01:00Z');assert.equal(controller.status.phase,'failed');
});
test('static export contains only the active data files and a portable pointer',async t=>{
 const f=await fixture(t);await refreshData({root:f.root,fetcher:f.fetcher,minima});const output=await buildStatic({root:f.root});const files=await readdir(join(output,'data'));assert.equal(files.includes('snapshots'),false);assert.equal(JSON.parse(await readFile(join(output,'data/current.json'),'utf8')).manifest,'manifest.json');assert.equal(JSON.parse(await readFile(join(output,'data/manifest.json'),'utf8')).schemaVersion,2);assert.equal((await readdir(output)).includes('serve.mjs'),false);
});
test('a malformed active pointer or incomplete dataset is rejected instead of mixing generations',async t=>{
 const f=await fixture(t);await atomicJSON(join(f.data,'current.json'),{manifest:'../../.cache/private.json'});await assert.rejects(activeSnapshot(f.root),/pointer is invalid/);
 await assert.rejects(loadAtlas({fetcher:async()=>new Response(JSON.stringify({manifest:'https://elsewhere.test/data.json'}))}),/pointer is invalid/);
 const files={'data/current.json':{manifest:'manifest.json'},'data/manifest.json':{...f.manifest,stations:999},'data/stations.json':f.stations,'data/airports.json':f.airports,'data/flights.json':f.networks,'data/trains-0.json':f.trains};await assert.rejects(loadAtlas({fetcher:async path=>new Response(JSON.stringify(files[path]))}),/consistency check/);
});
test('expired airport lookups retry the source and keep explicitly stale data on failure; saved trips are untouched',async()=>{
 const oldStorage=globalThis.localStorage,oldFetch=globalThis.fetch;const store=new Map();const storage={getItem:key=>store.get(key)||null,setItem:(key,value)=>store.set(key,value),removeItem:key=>store.delete(key),key:i=>[...store.keys()][i],get length(){return store.size;}};
 globalThis.localStorage=storage;let calls=0;globalThis.fetch=async()=>{calls++;throw Error('Offline');};
 try{const data={airport:{iata:'LHR'},routes:[],generated:'2025-01-01'};storage.setItem('waypoint:airport:LHR',JSON.stringify({at:Date.now()-100*864e5,data}));storage.setItem('waypoint:trips','["keep"]');const networks={};const result=await loadAirport('LHR',networks);assert.equal(calls,1);assert.equal(airportRecordState(result).stale,true);assert.equal(JSON.parse(storage.getItem('waypoint:airport:LHR')).at<Date.now()-90*864e5,true);await loadAirport('LHR',networks);assert.equal(calls,2);clearLookupCaches();assert.equal(storage.getItem('waypoint:trips'),'["keep"]');assert.equal(storage.getItem('waypoint:airport:LHR'),null);}finally{if(oldStorage===undefined)delete globalThis.localStorage;else globalThis.localStorage=oldStorage;globalThis.fetch=oldFetch;}
});
