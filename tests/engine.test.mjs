import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {km,nearest,corridor,createRailIndex,planRail,createFlightGraph,planFlights,filterRoutes,scoreRoutes,nextDeparture,dateDay,groundLeg,parseShare,shareURL} from '../public/engine.js';
import {cities} from '../public/cities.js';
const read=async name=>{if(name==='trains'){const manifest=await read('manifest');return (await Promise.all(manifest.trainFiles.map(file=>readFile(new URL('../public/data/'+file,import.meta.url),'utf8').then(JSON.parse)))).flat();}return JSON.parse(await readFile(new URL('../public/data/'+name+'.json',import.meta.url),'utf8'));};
test('great-circle distance, radius and corridor do not confuse nearby with on-route',()=>{
 const a={lat:0,lon:0},b={lat:0,lon:1};assert.ok(Math.abs(km(a,b)-111.195)<.01);
 assert.equal(nearest(a,[a,b],{radius:50}).length,1);
 const middle={lat:0,lon:.5},off={lat:8,lon:.5};assert.deepEqual(corridor(a,b,[middle,off],20).map(p=>p.lat),[0]);
});
test('rail departure respects operating day at the boarding station across midnight',()=>{
 assert.equal(dateDay('2026-10-23'),5);
 const monday={days:[1]};const stop=['X',90,100,2,0];
 assert.equal(nextDeparture(monday,stop,0,'2026-10-27'),100);
 assert.equal(nextDeparture(monday,stop,101,'2026-10-27'),10180);
});
test('a transfer needs 90 minutes and journey totals include connection waiting',()=>{
 const stations=[{id:'A',name:'A',lat:16,lon:74},{id:'B',name:'B',lat:16,lon:75},{id:'C',name:'C',lat:16,lon:76}];
 const trains=[{id:'1',name:'First',days:[0,1,2,3,4,5,6],stops:[['A',null,600,1,0],['B',660,null,1,120]]},{id:'2',name:'Safe',days:[0,1,2,3,4,5,6],stops:[['B',null,780,1,0],['C',900,null,1,120]]},{id:'3',name:'Too close',days:[0,1,2,3,4,5,6],stops:[['B',null,690,1,0],['C',810,null,1,120]]}];
 const routes=planRail(createRailIndex(trains,stations),stations[0],stations[2],{radius:20,date:'2026-10-23',start:480,maxChanges:1});
 assert.equal(routes.length,1);assert.equal(routes[0].layover,120);assert.equal(routes[0].minutes,420);assert.deepEqual(routes[0].legs.map(l=>l.train),['1','2']);
 assert.equal(planRail(createRailIndex(trains,stations),stations[0],stations[2],{radius:20,date:'2026-10-23',start:480,maxChanges:0}).length,0);
});
test('airport graph does not invent reverse services or use trivial traffic as a routine connection',()=>{
 const airports=[{id:'A',lat:10,lon:70,scheduled:true,country:'IN'},{id:'B',lat:10,lon:75,scheduled:true,country:'IN'},{id:'C',lat:10,lon:80,scheduled:true,country:'IN'}];
 const networks={A:{routes:[{to:{iata:'B'},km:500,passengers:15000},{to:{iata:'C'},km:1000,passengers:18}]},B:{routes:[{to:{iata:'C'},km:500,passengers:20000}]}};
 const graph=createFlightGraph(networks,airports);
 assert.equal(planFlights(graph,airports[0],airports[2],{radius:20,maxChanges:0}).length,0);
 const routes=planFlights(graph,airports[0],airports[2],{radius:20,maxChanges:1});assert.equal(routes.length,1);assert.equal(routes[0].changes,1);assert.equal(routes[0].wait,330);
 assert.equal(planFlights(graph,airports[2],airports[0],{radius:20}).length,0);
});
test('ticket estimates are per person while cab costs are shared by party size',()=>{
 const a={lat:16,lon:74},b={lat:16,lon:75};assert.ok(Math.abs(groundLeg(a,b,1).low-groundLeg(a,b,4).low*4)<4);
});
test('filters use budget lower bounds and ranking trades money against time explicitly',()=>{
 const cheap={mode:'rail',low:500,high:1000,minutes:1200,changes:0,legs:[{}],carbon:20};const fast={mode:'air',low:3000,high:5000,minutes:180,changes:0,legs:[{}],carbon:100};
 assert.equal(scoreRoutes([cheap,fast],'balanced',0)[0],cheap);assert.equal(scoreRoutes([cheap,fast],'balanced',1000)[0],fast);
 assert.deepEqual(filterRoutes([cheap,fast],{modes:['rail'],budget:600}),[cheap]);assert.deepEqual(filterRoutes([cheap,fast],{hours:5}),[fast]);
});
test('shared journeys round-trip Unicode names and reject invalid coordinates',()=>{
 const state={from:{name:'इचलकरंजी',lat:16.69,lon:74.46,country:'IN'},to:{name:'Hyderabad',lat:17.38,lon:78.48},date:'2026-10-23'};
 const url=shareURL('https://example.com/waypoint/',state);assert.equal(parseShare(new URL(url).hash).from.name,state.from.name);assert.equal(parseShare('#from=bad~999~hello').from,undefined);
});
test('bundled atlas has no invalid rail coordinates and produces useful real-world journey candidates',async()=>{
 const [stations,trains,airports,networks]=await Promise.all(['stations','trains','airports','flights'].map(read));
 assert.ok(stations.length>8000);assert.ok(airports.length>3000);assert.ok(stations.every(s=>s.lat>6&&s.lon>68));
 const a=cities[0],b=cities.find(c=>c.name==='Hyderabad'),rails=planRail(createRailIndex(trains,stations),a,b,{date:'2026-10-24'}),flights=planFlights(createFlightGraph(networks,airports),a,b);
 assert.ok(rails.length>0);assert.ok(flights.length>0);
 for(const route of [...rails,...flights]){assert.ok(route.minutes>0&&Number.isFinite(route.low)&&route.high>=route.low);for(const l of route.legs)assert.ok(l.from&&l.to&&l.minutes>0);}
});
