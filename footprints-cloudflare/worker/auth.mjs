const encoder=new TextEncoder();
const cookieName='__Host-footprints_author';
const ttl=7*24*3600;
const base64=bytes=>btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
const decode=s=>Uint8Array.from(atob(s.replaceAll('-','+').replaceAll('_','/')),c=>c.charCodeAt(0));
const stableId='vi';
const safeHeaders={'Cache-Control':'private, no-store','Content-Type':'application/json; charset=utf-8','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY'};
const respond=(data,status=200,extra={})=>new Response(JSON.stringify(data),{status,headers:{...safeHeaders,...extra}});
async function equal(a,b) {
  const [one,two]=await Promise.all([crypto.subtle.digest('SHA-256',a),crypto.subtle.digest('SHA-256',b)]);
  if(typeof crypto.subtle.timingSafeEqual==='function')return crypto.subtle.timingSafeEqual(one,two);
  const key=await crypto.subtle.importKey('raw',crypto.getRandomValues(new Uint8Array(32)),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
  return crypto.subtle.verify('HMAC',key,await crypto.subtle.sign('HMAC',key,one),two);
}
export async function sha256(value){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(value))),b=>b.toString(16).padStart(2,'0')).join('');}
async function hmacKey(secret){return crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);}
async function passwordHash(password,salt=crypto.getRandomValues(new Uint8Array(16))) {
  const key=await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveBits']);
  const hash=new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',iterations:100000,salt},key,256));
  return 'pbkdf2-sha256:100000:'+base64(salt)+':'+base64(hash);
}
async function matchesPassword(password,stored){try{const parts=stored.split(':');if(parts.length!==4||parts[0]!=='pbkdf2-sha256'||parts[1]!=='100000')return false;return await equal(encoder.encode(await passwordHash(password,decode(parts[2]))),encoder.encode(stored));}catch{return false;}}
async function authState(env){return env.DB.prepare('SELECT * FROM author_auth WHERE id = 1').first();}
function configured(env){return typeof env.SESSION_SECRET==='string'&&env.SESSION_SECRET.length>=32;}
export async function authorSession(request,env,now=Date.now()) {
  if(!configured(env))return null;
  const cookies=(request.headers.get('cookie')??'').split(';').map(s=>s.trim()).filter(s=>s.startsWith(cookieName+'='));
  if(cookies.length!==1)return null;
  const token=cookies[0].slice(cookieName.length+1),parts=token.split('.');
  if(parts.length!==2||token.length>2000)return null;
  try{
    if(!await crypto.subtle.verify('HMAC',await hmacKey(env.SESSION_SECRET),decode(parts[1]),encoder.encode(parts[0])))return null;
    const payload=JSON.parse(new TextDecoder().decode(decode(parts[0]))),seconds=Math.floor(now/1000);
    if(payload.sub!==stableId||!Number.isInteger(payload.exp)||payload.exp<=seconds||payload.exp>seconds+ttl+60)return null;
    const state=await authState(env);
    return state?.revision===payload.revision?{id:stableId}:null;
  }catch{return null;}
}
async function sessionCookie(env,revision,now=Date.now()) {
  const payload=base64(encoder.encode(JSON.stringify({sub:stableId,revision,exp:Math.floor(now/1000)+ttl})));
  const signature=base64(new Uint8Array(await crypto.subtle.sign('HMAC',await hmacKey(env.SESSION_SECRET),encoder.encode(payload))));
  return cookieName+'='+payload+'.'+signature+'; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age='+ttl;
}
async function limitAttempts(request,env,now) {
  const window=Math.floor(now/900000),ip=request.headers.get('cf-connecting-ip')??'unknown';
  const digest=base64(new Uint8Array(await crypto.subtle.sign('HMAC',await hmacKey(env.SESSION_SECRET),encoder.encode(ip))));
  const bucket=window+':'+digest,expires=Math.floor(now/1000)+1800;
  const row=await env.DB.prepare('INSERT INTO auth_attempts (bucket,attempts,expires_at) VALUES (?,1,?) ON CONFLICT (bucket) DO UPDATE SET attempts = attempts + 1 RETURNING attempts').bind(bucket,expires).first();
  await env.DB.prepare('DELETE FROM auth_attempts WHERE bucket IN (SELECT bucket FROM auth_attempts WHERE expires_at < ? LIMIT 100)').bind(Math.floor(now/1000)).run();
  return row.attempts<=5;
}
async function input(request){
  const reader=request.body?.getReader();if(!reader)throw new InputError('没有收到登录信息。');let size=0,chunks=[];
  while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>4096){await reader.cancel();throw new InputError('登录信息过长。');}chunks.push(value);}
  const all=new Uint8Array(size);let offset=0;for(const part of chunks){all.set(part,offset);offset+=part.length;}
  let data;try{data=JSON.parse(new TextDecoder().decode(all));}catch{throw new InputError('登录信息格式不正确。');}
  if(!data||typeof data!=='object'||Array.isArray(data))throw new InputError('登录信息格式不正确。');return data;
}
class InputError extends Error {}
export async function authAction(request,env,now=Date.now()) {
  const path=new URL(request.url).pathname.replace(/\/+$/,'');
  if(path==='/author/logout'&&request.method==='GET')return new Response(null,{status:303,headers:{Location:'/author/login','Cache-Control':'no-store','Set-Cookie':cookieName+'=; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=0'}});
  if(request.method!=='POST')return respond({error:'这个操作暂不支持。'},405);
  if(request.headers.get('Origin')!==new URL(request.url).origin||request.headers.get('Sec-Fetch-Site')==='cross-site'||request.headers.get('X-Footprints-Editor')!=='1')return respond({error:'请从本站作者登录页面提交。'},403);
  if(!request.headers.get('Content-Type')?.startsWith('application/json'))return respond({error:'登录数据格式不正确。'},415);
  if(!configured(env))return respond({error:'作者登录尚未配置。'},503);
  try{
    if(!await limitAttempts(request,env,now))return respond({error:'尝试次数过多，请 15 分钟后再试。'},429,{'Retry-After':'900'});
    const data=await input(request),state=await authState(env),password=data.password;
    if(typeof password!=='string'||password.length<12||password.length>128)return respond({error:'密码需要 12 到 128 个字符。'},400);
    if(path==='/author/setup'){
      if(state)return respond({error:'作者密码已设置，请直接登录。'},409);
      if(typeof data.token!=='string'||data.token.length>128||!env.SETUP_TOKEN_HASH||!await equal(encoder.encode(await sha256(data.token)),encoder.encode(env.SETUP_TOKEN_HASH)))return respond({error:'初始化代码无效。'},403);
      const result=await env.DB.prepare('INSERT INTO author_auth (id,password_hash,revision,updated_at) VALUES (1,?,1,?) ON CONFLICT DO NOTHING').bind(await passwordHash(password),new Date(now).toISOString()).run();
      if(result.meta.changes!==1)return respond({error:'作者密码已设置，请直接登录。'},409);
      return respond({ok:true,redirect:'/write/'},200,{'Set-Cookie':await sessionCookie(env,1,now)});
    }
    if(path==='/author/login'){
      if(!state||!await matchesPassword(password,state.password_hash))return respond({error:'密码不正确，或作者账号尚未初始化。'},401);
      return respond({ok:true,redirect:'/write/'},200,{'Set-Cookie':await sessionCookie(env,state.revision,now)});
    }
    return respond({error:'这个登录操作不存在。'},404);
  }catch(error){if(error instanceof InputError)return respond({error:error.message},400);console.error(JSON.stringify({event:'author_auth_failed',error:error.name,path}));return respond({error:'登录暂时不可用，请检查输入并稍后重试。'},503);}
}
export async function authorSetupNeeded(env){return !(await authState(env));}
