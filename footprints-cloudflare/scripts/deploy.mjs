import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
const config=JSON.parse(await readFile(new URL('../wrangler.jsonc',import.meta.url),'utf8'));
if(!config.account_id||!config.d1_databases[0]?.database_id||config.d1_databases[0].database_id==='00000000-0000-4000-8000-000000000000')throw new Error('Cloudflare account and D1 database must be configured before deploying.');
const r=spawnSync(process.execPath,['node_modules/wrangler/bin/wrangler.js','deploy','--config','wrangler.jsonc'],{stdio:'inherit',env:{...process.env,WRANGLER_SEND_METRICS:'false',WRANGLER_WRITE_LOGS:'false',WRANGLER_LOG_PATH:'.runtime/logs'}});process.exit(r.status??1);
