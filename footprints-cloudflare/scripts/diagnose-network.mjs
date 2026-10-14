import { lookup,resolve4,resolve6 } from 'node:dns/promises';
import { connect } from 'node:tls';
import { mkdir,writeFile } from 'node:fs/promises';
const defaultHost='footprints-vi.footprints-cloudflare.workers.dev';
const host=process.argv[3]??defaultHost,mode=process.argv[2]??'direct';
if(!/^[a-z0-9.-]+$/i.test(host))throw new Error('Expected a hostname.');
const report={checkedAt:new Date().toISOString(),host,mode,explicitProxyEnvironmentPresent:['HTTPS_PROXY','https_proxy','HTTP_PROXY','http_proxy','ALL_PROXY','all_proxy'].some(key=>!!process.env[key]),http:[]};
const failure=error=>({code:error.cause?.code??error.code??error.name,message:error.cause?.message??error.message});
if(mode==='direct'){
  const jobs=[['os',()=>lookup(host,{all:true})],['A',()=>resolve4(host)],['AAAA',()=>resolve6(host)]];
  report.dns=await Promise.all(jobs.map(async([name,run])=>{try{return {name,ok:true,answers:await run()};}catch(error){return {name,ok:false,error:failure(error)};}}));
  report.tls=await new Promise(resolve=>{
    let tcpConnected=false;const socket=connect({host,port:443,servername:host,rejectUnauthorized:true,timeout:12000});
    socket.once('connect',()=>{tcpConnected=true;});
    socket.once('secureConnect',()=>{const cert=socket.getPeerCertificate();resolve({ok:true,tcpConnected,authorized:socket.authorized,protocol:socket.getProtocol(),certificateExpires:cert.valid_to});socket.destroy();});
    socket.once('error',error=>{resolve({ok:false,tcpConnected,error:failure(error)});socket.destroy();});
    socket.once('timeout',()=>{resolve({ok:false,tcpConnected,error:{code:'TIMEOUT'}});socket.destroy();});
  });
}
const agents={desktop:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',android:'Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36'};
report.http=await Promise.all(Object.entries(agents).flatMap(([client,agent])=>['/','/author/login'].map(async path=>{
  const started=Date.now();try{const response=await fetch('https://'+host+path,{headers:{'User-Agent':agent},signal:AbortSignal.timeout(12000)});const html=await response.text();return {client,path,status:response.status,ms:Date.now()-started,footprints:html.includes('Footprints'),server:response.headers.get('Server')};}catch(error){return {client,path,ms:Date.now()-started,error:failure(error)};}
})));
const reportName=host===defaultHost?'network-'+mode+'.json':'network-'+host+'-'+mode+'.json';
await mkdir(new URL('../.runtime/',import.meta.url),{recursive:true});await writeFile(new URL('../.runtime/'+reportName,import.meta.url),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
