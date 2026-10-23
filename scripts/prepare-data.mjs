// Compatibility entry point. A complete source refresh prevents old cache files from appearing freshly updated.
import {refreshCLI} from './refresh-data.mjs';
console.log('Prefer npm run refresh. This command now downloads, validates and prepares one complete snapshot.');
await refreshCLI();
