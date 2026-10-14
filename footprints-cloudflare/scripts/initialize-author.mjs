import { randomBytes, createHash } from 'node:crypto';
import { readFile, writeFile, access } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root=new URL('../',import.meta.url),config=JSON.parse(await readFile(new URL('wrangler.jsonc',root),'utf8'));
const url=new URL(process.argv[2]);
if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||!url.hostname.startsWith(config.name+'.')||!url.hostname.endsWith('.workers.dev'))throw new Error('Pass the verified deployed Worker URL.');
const setupFile=new URL('.runtime/author-setup.link',root);
try{await access(setupFile);throw new Error('An initialization link already exists. Use that link; do not rotate secrets.');}catch(error){if(error.code!=='ENOENT')throw error;}
async function wrangler(args,input) {
  return new Promise((resolve,reject)=>{
    const child=spawn(process.execPath,[fileURLToPath(new URL('node_modules/wrangler/bin/wrangler.js',root)),...args,'--config','wrangler.jsonc'],{cwd:fileURLToPath(root),stdio:['pipe','pipe','pipe'],windowsHide:true,env:{...process.env,WRANGLER_SEND_METRICS:'false',WRANGLER_LOG:'log',WRANGLER_WRITE_LOGS:'false',WRANGLER_LOG_PATH:fileURLToPath(new URL('.runtime/logs/',root)),WRANGLER_LOG_SANITIZE:'true'}});
    let stdout='';child.stdout.on('data',part=>{stdout+=part;});child.stderr.resume();child.on('error',reject);child.on('close',code=>resolve({code,stdout}));child.stdin.end(input);
  });
}
const state=await wrangler(['d1','execute',config.d1_databases[0].database_name,'--remote','--command','SELECT count(*) AS authors FROM author_auth','--json']);
if(state.code!==0)throw new Error('Unable to verify the author database.');
const rows=JSON.parse(state.stdout);
if(rows[0]?.results[0]?.authors!==0)throw new Error('Author is already initialized; do not rotate secrets.');
const token=randomBytes(32).toString('base64url');
const secrets={SESSION_SECRET:randomBytes(32).toString('base64url'),SETUP_TOKEN_HASH:createHash('sha256').update(token).digest('hex')};
const result=await wrangler(['secret','bulk'],JSON.stringify(secrets));
if(result.code!==0)throw new Error('Secret upload failed. Credentials have not been printed. Check Cloudflare authorization and retry.');
const link=new URL('/author/setup',url);link.hash='code='+token;
await writeFile(setupFile,link.href+'\n',{flag:'wx'});
console.log('Author secrets uploaded through stdin. Password remains unset.');
console.log('Private initialization link saved to .runtime/author-setup.link.');
