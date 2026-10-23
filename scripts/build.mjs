import {cp,mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..');
await mkdir(root+'/dist',{recursive:true});
await cp(root+'/public',root+'/dist',{recursive:true});
await writeFile(root+'/dist/.nojekyll','');
const manifest=JSON.parse(await readFile(root+'/public/data/manifest.json','utf8'));
console.log('Built Waypoint: '+manifest.stations+' stations, '+manifest.airports+' airports, '+manifest.trains+' train snapshots.');
