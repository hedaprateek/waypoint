import {sourceFreshness,formatDataDate,STALE_AFTER_DAYS} from './data-freshness.js';

export function createRefreshUI({getManifest,reload,notify=()=>{}}){
 const button=document.querySelector('#refreshData'),summary=document.querySelector('#dataSummary'),notice=document.querySelector('#refreshNotice'),message=document.querySelector('#refreshMessage'),progress=document.querySelector('#refreshProgress');
 let local=false,timer=null,working=false,pendingReload=false,pendingStatus=false;
 const text=(tag,value,className)=>{const e=document.createElement(tag);e.textContent=value;if(className)e.className=className;return e;};
 function setButton(){button.disabled=working;button.textContent=working?'Refreshing…':pendingReload?'Load refreshed data':pendingStatus?'Check refresh status':local?'↻ Refresh data':'↻ Reload published data';button.setAttribute('aria-busy',String(working));}
 function show(value,{failed=false,running=false,completed=0,total=1}={}){notice.hidden=false;notice.classList.toggle('refresh-failed',failed);message.textContent=value;progress.hidden=!running;if(running){progress.max=Math.max(1,total);progress.value=Math.min(completed,total);}notice.setAttribute('aria-busy',String(running));}
 function update(){const manifest=getManifest();if(!manifest)return;const rows=sourceFreshness(manifest);const stale=rows.filter(r=>r.stale);summary.textContent=manifest.refreshedAt?'Sources downloaded '+formatDataDate(manifest.refreshedAt):'Reference data bundled '+formatDataDate(manifest.built);document.querySelector('#dataAgeBadge').hidden=!stale.length;document.querySelector('#dataAgeBadge').textContent='Some sources older than '+STALE_AFTER_DAYS+' days';
  const list=document.querySelector('#sourceFreshness');list.replaceChildren();for(const row of rows){const card=text('article','','freshness-card'+(row.stale?' data-old':''));card.append(text('h3',row.label));const label=row.id==='estimates'?'Calculated for each search':row.checked.label+' '+formatDataDate(row.checked.value);card.append(text('p',label,'freshness-date'),text('p',row.period,'freshness-period'));
   if(row.stale)card.append(text('span','Older reference data · still usable for approximate planning','freshness-warning'));
   if(row.reportingPeriods?.length){const details=document.createElement('details');details.append(text('summary','Reporting periods'));for(const entry of row.reportingPeriods){details.append(text('p',entry.source+': '+entry.period,'source-period'));}card.append(details);}
   if(row.source){const link=text('a','View source ↗');link.href=row.source;link.target='_blank';link.rel='noopener noreferrer';card.append(link);}list.append(card);}
  document.querySelector('#refreshHelp').textContent=local?'Manual only. Downloads the latest source files, checks them, then switches to the complete validated dataset. Keep using the planner while it runs.':'This static view reloads its published snapshot. Full source downloads are available through the local Waypoint server or npm run refresh.';
 }
 async function getStatus(){const response=await fetch('/api/data/status',{cache:'no-store',signal:AbortSignal.timeout(10000)});if(!response.ok)throw Error('Refresh status is unavailable.');const result=await response.json();if(result.canRefresh!==true)throw Error('No local refresh service.');return result;}
 async function loadNewData(){pendingReload=true;await reload();pendingReload=false;update();}
 async function handleStatus(status){
  if(status.phase==='running'){working=true;pendingStatus=false;setButton();show(status.message||'Checking source data…',{running:true,completed:status.completed||0,total:status.total||1});clearTimeout(timer);timer=setTimeout(poll,2000);return;}
  if(status.phase==='succeeded'){
   try{if(status.revision&&status.revision!==getManifest()?.revision)await loadNewData();show('Source refresh complete. Last downloaded '+formatDataDate(status.lastSuccessAt)+'. Reporting periods and approximate fare models are shown in Data status.');notify('Data refreshed. Your journey has been recalculated.');}
   catch{pendingReload=true;show('New data was saved, but this tab could not load it. Your existing journey is still available. Tap “Load refreshed data” to retry.',{failed:true});}
  }else if(status.phase==='failed')show(status.message+' Your last validated dataset remains available.',{failed:true});
  working=false;pendingStatus=false;setButton();update();
 }
 async function poll(){try{await handleStatus(await getStatus());}catch{working=false;pendingStatus=true;setButton();show('The local refresh status could not be read. Your current journey is preserved. Tap “Check refresh status” to reconnect.',{failed:true});}}
 button.addEventListener('click',async()=>{
  if(working)return;working=true;setButton();
  try{
   if(pendingReload){await loadNewData();show('Refreshed data loaded. Your journey has been recalculated.');working=false;setButton();return;}
   if(pendingStatus){await poll();return;}
   if(!local){show('Reloading the published snapshot…',{running:true});await loadNewData();show('Published data reloaded. Source dates are unchanged unless a newer snapshot was published.');working=false;setButton();return;}
   show('Starting a manual source refresh. Your current data stays available…',{running:true});
   const response=await fetch('/api/data/refresh',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'refresh'}),signal:AbortSignal.timeout(15000)});const result=await response.json();if(response.status===409){const current=await getStatus();if(current.phase==='running'){await handleStatus(current);return;}}if(!response.ok)throw Error(result.error||'The refresh could not start.');await handleStatus(result);
  }catch(error){working=false;setButton();show(String(error.message||'Data could not reload.')+' Your current dataset and saved trips are preserved.',{failed:true});}
 });
 document.querySelector('#dataDetails').addEventListener('click',()=>{update();document.querySelector('#dataDialog').showModal();});
 async function connect(){button.disabled=true;if(['localhost','127.0.0.1','[::1]'].includes(location.hostname)){try{const status=await getStatus();local=true;update();if(status.phase==='running'){await handleStatus(status);return;}if(status.phase==='failed')show(status.message+' The last validated dataset is still in use.',{failed:true});}catch{local=false;}}working=false;setButton();update();}
 update();connect();return {update};
}
