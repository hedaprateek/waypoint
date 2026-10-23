import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {createRefreshController} from './refresh-controller.mjs';
export async function refreshCLI(){const root=fileURLToPath(new URL('..',import.meta.url));const controller=await createRefreshController({root});await controller.start();console.log('Refreshing sources. The current dataset stays available until validation succeeds.');let last='';const timer=setInterval(()=>{const message=controller.status.message;if(message!==last){console.log(message);last=message;}},1000);try{await controller.completion;}finally{clearInterval(timer);}console.log(controller.status.message);if(controller.status.phase!=='succeeded')process.exitCode=1;}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await refreshCLI();
