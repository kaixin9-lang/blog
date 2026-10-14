import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { authAction,authorSession } from '../worker/auth.mjs';
import { fixture,request,password,post,cookieFrom,origin } from './test-fixture.mjs';

test('public callers cannot authorize with forged Sites identity headers',async t=>{
  const f=await fixture(t),headers={'oai-authenticated-user-id':'vi','oai-authenticated-user-email':'author@footprints.internal'};
  assert.equal((await f.call('/api/admin/posts',{headers})).status,401);
  assert.equal((await f.call('/api/admin/publish',{headers,data:{id:randomUUID(),version:0,post}})).status,401);
  assert.deepEqual(await(await f.call('/api/session',{headers})).json(),{signedIn:false,canWrite:false,configured:true});
  assert.doesNotMatch(await(await f.call('/write/',{headers})).text(),/data-writing-workspace/);
});
test('only the secret setup code can create the single author and it becomes unusable',async t=>{
  const f=await fixture(t);
  assert.equal((await f.call('/author/setup',{data:{token:'wrong',password}})).status,403);
  assert.equal(f.sqlite.prepare('SELECT count(*) AS n FROM author_auth').get().n,0);
  const setup=await f.call('/author/setup',{data:{token:f.token,password}});assert.equal(setup.status,200);
  const cookie=cookieFrom(setup);assert(cookie);assert.match(setup.headers.get('Set-Cookie'),/Secure; HttpOnly; SameSite=Lax/);
  assert.notEqual(f.sqlite.prepare('SELECT password_hash FROM author_auth').get().password_hash,password);
  assert.deepEqual(await authorSession(request('/',{cookie}),f.env),{id:'vi'});
  assert.equal((await f.call('/author/setup',{data:{token:f.token,password:'Replacement-password!'}})).status,409);
  assert.equal((await f.call('/author/setup')).status,303);
  assert.match(await(await f.call('/write/',{cookie})).text(),/data-writing-workspace/);
});
test('simultaneous setup requests cannot replace the first author password',async t=>{
  const f=await fixture(t),results=await Promise.all([1,2].map(()=>f.call('/author/setup',{data:{token:f.token,password}})));
  assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
  assert.equal(f.sqlite.prepare('SELECT count(*) AS n FROM author_auth').get().n,1);
});
test('author login checks passwords and limits repeated attempts by IP',async t=>{
  const f=await fixture(t);await f.call('/author/setup',{data:{token:f.token,password},ip:'192.0.2.2'});
  const now=Date.now();
  for(let i=0;i<5;i++)assert.equal((await authAction(request('/author/login',{data:{password:'Incorrect-password!'}}),f.env,now)).status,401);
  const blocked=await authAction(request('/author/login',{data:{password}}),f.env,now);assert.equal(blocked.status,429);assert.equal(blocked.headers.get('Retry-After'),'900');
  assert.equal((await authAction(request('/author/login',{data:{password}}),f.env,now+900001)).status,200);
  const login=await f.call('/author/login/',{data:{password},ip:'192.0.2.3'});assert.equal(login.status,200);
  assert.equal((await f.call('/api/admin/posts',{cookie:cookieFrom(login)})).status,200);
});
test('tampered, expired, duplicate, and revoked cookies do not grant write access',async t=>{
  const f=await fixture(t),setup=await f.call('/author/setup',{data:{token:f.token,password}}),cookie=cookieFrom(setup);
  const [name,token]=cookie.split('='),[payload,signature]=token.split('.'),bad=name+'='+payload+'.'+(signature[0]==='A'?'B':'A')+signature.slice(1);
  assert.equal((await f.call('/api/admin/posts',{cookie:bad})).status,401);
  assert.equal(await authorSession(request('/',{cookie}),f.env,Date.now()+7*86400000+1000),null);
  assert.equal(await authorSession(request('/',{cookie:cookie+'; '+cookie}),f.env),null);
  f.sqlite.exec('UPDATE author_auth SET revision=revision+1 WHERE id=1');
  assert.equal((await f.call('/api/admin/posts',{cookie})).status,401);
});
test('setup and login reject cross-origin, malformed, oversized, and unconfigured submissions',async t=>{
  const f=await fixture(t),data={token:f.token,password};
  for(const headers of [{Origin:'https://evil.test'},{Origin:''},{'X-Footprints-Editor':''},{'Sec-Fetch-Site':'cross-site'}])assert.equal((await f.call('/author/setup',{data,headers})).status,403);
  assert.equal((await f.call('/author/setup',{data,headers:{'Content-Type':'text/plain'}})).status,415);
  for(const raw of ['null','[]','{','x'.repeat(5000)])assert.equal((await f.call('/author/setup',{raw,ip:'192.0.2.4'})).status,400);
  assert.equal((await authAction(request('/author/setup',{data}),{...f.env,SESSION_SECRET:''})).status,503);
  assert.equal(f.sqlite.prepare('SELECT count(*) AS n FROM author_auth').get().n,0);
});
test('authenticated author draft, preview, publish, update, unpublish, delete work independently',async t=>{
  const f=await fixture(t),cookie=cookieFrom(await f.call('/author/setup',{data:{token:f.token,password}})),id=randomUUID();
  const save=await f.call('/api/admin/posts',{cookie,data:{id,version:0,post}});assert.equal(save.status,201);
  assert.equal((await f.call('/posts/'+post.slug+'/')).status,404);
  assert.equal((await(await f.call('/posts.json')).json()).length,8);
  assert.equal((await f.call('/api/admin/preview',{cookie,data:{post}})).status,200);
  assert.equal((await f.call('/api/admin/publish',{cookie,data:{id,version:1,post}})).status,200);
  assert.match(await(await f.call('/posts/'+post.slug+'/')).text(),/本地验证文章/);
  assert.equal(f.sqlite.prepare('SELECT author_id FROM blog_posts WHERE id=?').get(id).author_id,'vi');
  const changed={...post,title:'未公开的新标题'};
  assert.equal((await f.call('/api/admin/posts',{cookie,data:{id,version:2,post:changed}})).status,200);
  const publicHtml=await(await f.call('/posts/'+post.slug+'/')).text();assert.doesNotMatch(publicHtml,/未公开的新标题/);
  assert.equal((await f.call('/api/admin/publish',{cookie,data:{id,version:3,post:changed},headers:{Origin:'https://evil.test'}})).status,403);
  assert.equal((await f.call('/api/admin/publish',{cookie,data:{id,version:3,post:changed}})).status,200);
  assert.match(await(await f.call('/posts/'+post.slug+'/')).text(),/未公开的新标题/);
  assert.equal((await f.call('/api/admin/unpublish',{cookie,data:{id,version:4}})).status,200);
  assert.equal((await f.call('/api/admin/delete',{cookie,data:{id,version:5}})).status,200);
  assert.equal(f.sqlite.prepare('SELECT count(*) AS n FROM blog_posts').get().n,0);
});
test('canonical, RSS, sitemap and robots use the independent Cloudflare request host',async t=>{
  const f=await fixture(t);
  for(const path of ['/','/feed.xml','/sitemap.xml','/robots.txt']){
    const response=await f.call(path);assert.equal(response.status,200);const body=await response.text();
    assert.match(body,new RegExp(origin.replaceAll('.','\\.')));assert.doesNotMatch(body,/chatgpt\.site/);
  }
  assert.match(await(await f.call('/author/login')).text(),/name="robots" content="noindex,nofollow"/);
  const logout=await f.call('/author/logout');assert.equal(logout.status,303);assert.match(logout.headers.get('Set-Cookie'),/Max-Age=0/);
});
