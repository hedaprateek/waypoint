import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRefreshController} from './scripts/refresh-controller.mjs';
const projectRoot=dirname(fileURLToPath(import.meta.url));
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.txt':'text/plain; charset=utf-8','.webmanifest':'application/manifest+json'};
export async function createWaypointServer({root=projectRoot,controller}={}){
 root=resolve(root);const publicRoot=resolve(root,'public');controller||=await createRefreshController({root});
 const reply=(response,status,body)=>{response.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});response.end(JSON.stringify(body));};
 return http.createServer(async(request,response)=>{
  response.setHeader('X-Content-Type-Options','nosniff');response.setHeader('Cache-Control','no-cache');
  try{
   const host=request.headers.host||'';const port=request.socket.localPort;const allowedHosts=new Set(['localhost:'+port,'127.0.0.1:'+port]);if(!allowedHosts.has(host)){reply(response,421,{error:'Use the local Waypoint address.'});return;}
   const url=new URL(request.url,'http://'+host);
   if(url.pathname==='/api/data/status'){
    if(request.method!=='GET'){reply(response,405,{error:'Use GET to check refresh status.'});return;}
    reply(response,200,{...(controller.getStatus?await controller.getStatus():controller.status),canRefresh:true});return;
   }
   if(url.pathname==='/api/data/refresh'){
    if(request.method!=='POST'){reply(response,405,{error:'Use the Refresh data button to start an update.'});return;}
    if(request.headers.origin!=='http://'+host||request.headers['sec-fetch-site']==='cross-site'||!/^application\/json(?:\s*;|$)/i.test(request.headers['content-type']||'')){reply(response,403,{error:'Refresh is only available from this local Waypoint page.'});return;}
    let body='';for await(const chunk of request){body+=chunk;if(body.length>1024){reply(response,413,{error:'Request too large.'});return;}}
    try{const value=JSON.parse(body);if(value.action!=='refresh')throw Error();}catch{reply(response,400,{error:'Invalid refresh request.'});return;}
    try{reply(response,202,await controller.start());}catch(error){reply(response,409,{error:String(error.message).slice(0,300)});}return;
   }
   if(url.pathname.startsWith('/api/')){reply(response,404,{error:'Not found.'});return;}
   if(!['GET','HEAD'].includes(request.method)){response.writeHead(405).end();return;}
   const pathname=decodeURIComponent(url.pathname);const file=resolve(publicRoot,'.'+(pathname==='/'?'/index.html':pathname));if(!file.startsWith(publicRoot+sep)){response.writeHead(403).end();return;}
   const bytes=await readFile(file);response.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream'});response.end(request.method==='HEAD'?undefined:bytes);
  }catch(error){if(error.code==='ENOENT'||error.code==='EISDIR')response.writeHead(404).end('Not found');else if(error instanceof URIError)response.writeHead(400).end('Invalid path');else if(!response.headersSent)reply(response,500,{error:'This request could not be completed. The current travel data is preserved.'});else response.end();}
 });
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const server=await createWaypointServer();server.on('error',error=>{console.error(error.code==='EADDRINUSE'?'Port 8816 is already in use. Open the existing preview or stop it before starting again.':error.message);process.exitCode=1;});server.listen(8816,'127.0.0.1',()=>console.log('Waypoint preview: http://localhost:8816/ — manual refresh available.'));
}
