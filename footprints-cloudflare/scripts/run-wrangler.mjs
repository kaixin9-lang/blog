import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const child=spawn(process.execPath,[fileURLToPath(new URL('../node_modules/wrangler/bin/wrangler.js',import.meta.url)),...process.argv.slice(2)],{
  cwd:root,stdio:'inherit',windowsHide:true,
  env:{...process.env,WRANGLER_SEND_METRICS:'false',WRANGLER_LOG_PATH:fileURLToPath(new URL('../.runtime/logs/',import.meta.url)),WRANGLER_LOG_SANITIZE:'true'}
});
child.on('error',()=>{console.error('Unable to start Wrangler.');process.exitCode=1;});
child.on('exit',code=>{process.exitCode=code??1;});
