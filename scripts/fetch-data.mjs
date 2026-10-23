// Compatibility entry point. Downloads and preparation now form one validated refresh transaction.
import {refreshCLI} from './refresh-data.mjs';
console.log('Prefer npm run refresh. This command now completes both download and preparation.');
await refreshCLI();
