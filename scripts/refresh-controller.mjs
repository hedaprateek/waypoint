import {readFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {atomicJSON,refreshData,acquireRefreshLock,processAlive} from './data-refresh.mjs';

export async function createRefreshController({root,refresh=refreshData,fetcher,minima}={}){
 root=resolve(root);const statusPath=join(root,'.cache','refresh-status.json');let status={phase:'idle',message:'Refresh only when you want newer source data.',lastSuccessAt:null};
 try{status=JSON.parse(await readFile(statusPath,'utf8'));if(status.phase==='running'&&!processAlive(status.ownerPid)){status={...status,phase:'failed',message:'The previous refresh was interrupted. Your last validated dataset is still in use.',endedAt:new Date().toISOString()};await atomicJSON(statusPath,status);}}catch(error){if(error.code!=='ENOENT')status={phase:'idle',message:'Ready for a manual refresh.',lastSuccessAt:null};}
 let completion=null,running=false;
 const persist=()=>atomicJSON(statusPath,status);
 async function getStatus(){
  if(running)return {...status};
  try{const saved=JSON.parse(await readFile(statusPath,'utf8'));if(!completion||saved.ownerPid!==process.pid||saved.startedAt!==status.startedAt)status=saved;}catch{}
  if(status.phase==='running'&&!processAlive(status.ownerPid)){status={...status,phase:'failed',endedAt:new Date().toISOString(),message:'The previous refresh was interrupted. Your last validated dataset is still in use.'};await persist();}
  return {...status};
 }
 return {
  get status(){return {...status};},get completion(){return completion;},
  getStatus,
  async start(){if(running)return {...status};await getStatus();const release=await acquireRefreshLock(root);status={phase:'running',ownerPid:process.pid,startedAt:new Date().toISOString(),endedAt:null,lastSuccessAt:status.lastSuccessAt||null,message:'Starting a manual source refresh…',completed:0,total:1};running=true;try{await persist();}catch(error){running=false;await release();throw error;}
   completion=(async()=>{try{const result=await refresh({root,fetcher,minima,onProgress:progress=>{status={...status,...progress};}});status={...status,phase:'succeeded',revision:result.revision,lastSuccessAt:result.manifest.refreshedAt,endedAt:new Date().toISOString(),message:'Sources refreshed. Approximate fares and timetable assumptions are unchanged.'};}catch(error){status={...status,phase:'failed',endedAt:new Date().toISOString(),message:String(error.message||'The source refresh failed. Your previous data is unchanged.').slice(0,500)};}finally{try{await persist();}finally{running=false;await release();}}})();completion.catch(()=>{});return {...status};
  }
 };
}
