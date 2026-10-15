import assert from 'node:assert/strict';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { Miniflare, Response, convertV4MiniflareOptions } from 'miniflare';
const root=new URL('../',import.meta.url),origin='https://footprints-runtime.test';
const token=randomBytes(24).toString('base64url'),password='Local-runtime-verification!';
const config=JSON.parse(await readFile(new URL('wrangler.jsonc',root),'utf8'));
const mf=new Miniflare(convertV4MiniflareOptions({workers:[{name:'footprints-smoke',modules:true,scriptPath:fileURLToPath(new URL('dist/worker/index.js',root)),compatibilityDate:config.compatibility_date,d1Databases:['DB'],bindings:{SESSION_SECRET:randomBytes(32).toString('base64url'),SETUP_TOKEN_HASH:createHash('sha256').update(token).digest('hex')},serviceBindings:{ASSETS:async request=>{
  const path=new URL(request.url).pathname;
  if(!/^\/(?:assets\/[a-z0-9.-]+|[a-z]+\.(?:css|js))$/.test(path))return new Response('missing',{status:404});
  try{return new Response(await readFile(new URL('dist/assets'+path,root)));}catch{return new Response('missing',{status:404});}
}}}]}));
try {
  const db=await mf.getD1Database('DB');
  for(const name of ['0001_blog_posts.sql','0002_author_auth.sql']) {
    const sql=await readFile(new URL('migrations/'+name,root),'utf8');
    await db.batch(sql.replace(/-->[^\n]*\n/g,'').split(';').filter(s=>s.trim()).map(s=>db.prepare(s)));
  }
  const call=(path,{data,cookie,headers={},redirect='manual'}={})=>mf.dispatchFetch(origin+path,{method:data?'POST':'GET',headers:{...(data?{Origin:origin,'Content-Type':'application/json','X-Footprints-Editor':'1'}:{}),...(cookie?{Cookie:cookie}:{}),...headers},...(data?{body:JSON.stringify(data)}:{}),redirect});
  for(const path of ['/','/style.css','/app.js','/assets/mountains.jpg','/author/setup'])assert.equal((await call(path)).status,200,path);
  assert.equal((await call('/api/admin/posts',{headers:{'oai-authenticated-user-id':'vi','oai-authenticated-user-email':'author@footprints.internal'}})).status,401);
  const setup=await call('/author/setup',{data:{token,password}});assert.equal(setup.status,200,await setup.clone().text());
  const cookie=setup.headers.get('Set-Cookie').split(';')[0];
  const post={title:'Cloudflare 运行环境验证',slug:'runtime-verification',date:'2026-10-13',image:'desk.jpg',category:'tech',excerpt:'本地运行环境测试',tags:['技术'],markdown:'## 本地验证\n\nCloudflare Worker 和 D1 完整流程。'};
  const id=randomUUID();
  assert.equal((await call('/api/admin/posts',{cookie,data:{id,version:0,post}})).status,201);
  assert.equal((await call('/posts/'+post.slug+'/')).status,404);
  assert.equal((await call('/api/admin/preview',{cookie,data:{post}})).status,200);
  assert.equal((await call('/api/admin/publish',{cookie,data:{id,version:1,post}})).status,200);
  assert.match(await(await call('/posts/'+post.slug+'/')).text(),/Cloudflare 运行环境验证/);
  assert.equal((await call('/api/admin/unpublish',{cookie,data:{id,version:2}})).status,200);
  assert.equal((await call('/api/admin/delete',{cookie,data:{id,version:3}})).status,200);
  assert.equal((await db.prepare('SELECT count(*) AS n FROM blog_posts').first()).n,0);
  assert.equal((await call('/author/login',{data:{password},headers:{'CF-Connecting-IP':'192.0.2.2'}})).status,200);
  assert.equal((await call('/author/setup',{data:{token,password}})).status,409);
  const report={checkedAt:new Date().toISOString(),runtime:'Cloudflare workerd + local D1',passed:true,checks:['assets and public pages','forged identity rejected','single-use author setup','password login','draft stays private','preview','publish','unpublish','delete'],productionWrites:false};
  await mkdir(new URL('test-results/',root),{recursive:true});await writeFile(new URL('test-results/runtime-verification.json',root),JSON.stringify(report,null,2));
  console.log('Cloudflare workerd + local D1 smoke checks passed.');
} finally {await mf.dispose();}
