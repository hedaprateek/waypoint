import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('..',import.meta.url)).replace(/[\\/]$/,'');
await mkdir(root+'/.cache',{recursive:true});await mkdir(root+'/public/vendor',{recursive:true});
const files=[
 ['stations.json','https://raw.githubusercontent.com/prasenjit-27/Indian-Railway-Data/main/stations.json'],
 ['trains.json','https://raw.githubusercontent.com/prasenjit-27/Indian-Railway-Data/main/trains.json'],
 ['rail-license.txt','https://raw.githubusercontent.com/prasenjit-27/Indian-Railway-Data/main/LICENSE'],
 ['airports.csv','https://raw.githubusercontent.com/davidmegginson/ourairports-data/main/airports.csv'],
 ['flight-index.json','https://airportmiles.com/api/v1/index.json']
];
await Promise.all(files.map(async([name,url])=>{const r=await fetch(url,{signal:AbortSignal.timeout(180000)});if(!r.ok)throw Error(name+': HTTP '+r.status);const b=Buffer.from(await r.arrayBuffer());await writeFile(root+'/.cache/'+name,b);console.log(name+': '+b.length+' bytes');}));
for(const file of ['leaflet.js','leaflet.css']){const r=await fetch('https://unpkg.com/leaflet@1.9.4/dist/'+file);if(!r.ok)throw Error('Leaflet download failed');await writeFile(root+'/public/vendor/'+file,await r.text());}
