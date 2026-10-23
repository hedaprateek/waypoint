import {cp,mkdir,writeFile,readdir,unlink} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {activeSnapshot} from './data-refresh.mjs';
export async function buildStatic({root=resolve(import.meta.dirname,'..')}={}){
 const output=join(root,'dist');await mkdir(output,{recursive:true});const snapshot=await activeSnapshot(root);
 for(const name of await readdir(join(root,'public')))if(name!=='data')await cp(join(root,'public',name),join(output,name),{recursive:true});
 const dataOutput=join(output,'data');await mkdir(dataOutput,{recursive:true});const files=['manifest.json','stations.json','airports.json','flights.json','rail-license.txt',...snapshot.manifest.trainFiles];
 if(!snapshot.manifest.trainFiles.every(file=>/^trains-\d+\.json$/.test(file)))throw Error('Invalid train data filenames.');
 for(const item of await readdir(dataOutput,{withFileTypes:true}))if(item.isFile()&&!files.includes(item.name)&&item.name!=='current.json')await unlink(join(dataOutput,item.name));
 for(const file of files)await cp(join(snapshot.directory,file),join(dataOutput,file));
 await writeFile(join(dataOutput,'current.json'),JSON.stringify({schemaVersion:1,revision:snapshot.manifest.revision||'legacy',manifest:'manifest.json'}));await writeFile(join(output,'.nojekyll'),'');
 console.log('Built Waypoint: '+snapshot.manifest.stations+' stations, '+snapshot.manifest.airports+' airports, '+snapshot.manifest.trains+' train snapshots.');return output;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await buildStatic();
