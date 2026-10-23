import test from 'node:test';
import assert from 'node:assert/strict';
import {request as httpRequest} from 'node:http';
import {fixture} from './refresh-fixtures.mjs';
import {createWaypointServer} from '../serve.mjs';

test('manual refresh is same-origin POST-only, and the local server never exposes private files',async t=>{
 const f=await fixture(t);let starts=0;const controller={status:{phase:'idle'},async start(){starts++;return {phase:'running'};}};const server=await createWaypointServer({root:f.root,controller});await new Promise(done=>server.listen(0,'127.0.0.1',done));t.after(()=>new Promise(done=>{server.close(done);server.closeAllConnections();}));const base='http://127.0.0.1:'+server.address().port;
 const status=await(await fetch(base+'/api/data/status')).json();assert.equal(status.canRefresh,true);assert.equal((await fetch(base+'/api/data/refresh')).status,405);
 for(const headers of [{'Content-Type':'application/json'},{'Content-Type':'application/json',Origin:'https://elsewhere.test'},{'Content-Type':'text/plain',Origin:base},{'Content-Type':'application/json',Origin:base,'Sec-Fetch-Site':'cross-site'}])assert.equal((await fetch(base+'/api/data/refresh',{method:'POST',headers,body:'{"action":"refresh"}'})).status,403);
 assert.equal(starts,0);assert.equal((await fetch(base+'/api/data/refresh',{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:'{"action":"refresh"}'})).status,202);assert.equal(starts,1);
 const wrongHost=await new Promise((done,reject)=>{const request=httpRequest(base+'/',{headers:{Host:'attacker.test:'+server.address().port}},response=>{response.resume();done(response.statusCode);});request.on('error',reject);request.end();});assert.equal(wrongHost,421);
 for(const path of ['/.git/config','/.cache/refresh-status.json','/serve.mjs','/scripts/data-refresh.mjs'])assert.equal((await fetch(base+path)).status,404,path);
 assert.equal((await fetch(base+'/data/manifest.json')).status,200);
});
