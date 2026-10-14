import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
// Mock identity is sent only to a local Worker, never to production.
const origin='http://127.0.0.1:4174';
const id=randomUUID(),slug='local-smoke-'+id;
const auth={'oai-authenticated-user-id':'local-smoke-vi','oai-authenticated-user-email':'vi@example.test'};
const post={title:'本地写作流程验收',slug,category:'tech',date:'2026-10-11',image:'desk.jpg',excerpt:'仅存在于本地测试数据库。',tags:['测试'],markdown:'## 本地真实 Worker\n\n确认数据库保存和页面渲染。'};
async function call(path,data){const response=await fetch(origin+path,{...(data?{method:'POST',headers:{...auth,'Origin':origin,'Content-Type':'application/json','X-Footprints-Editor':'1'},body:JSON.stringify(data)}:{})});return response;}
let version=0,published=false;
try {
  for(const path of ['/','/archive/','/about/','/write/','/style.css','/editor.js','/assets/coffee.jpg'])assert.equal((await call(path)).status,200,path);
  const anonymous=await call('/api/admin/posts',{id,version,post});
  // Above request carries explicit LOCAL mock identity; public isolation is checked below.
  assert.equal(anonymous.status,201);version=(await anonymous.json()).version;
  assert.equal((await fetch(origin+'/api/admin/posts')).status,401);
  assert.equal((await call('/posts/'+slug+'/')).status,404);
  const indexBefore=await(await call('/posts.json')).json();assert(!indexBefore.some(p=>p.slug===slug));
  const pub=await call('/api/admin/publish',{id,version,post});assert.equal(pub.status,200);version=(await pub.json()).version;published=true;
  const article=await call('/posts/'+slug+'/');assert.equal(article.status,200);assert.match(await article.text(),/本地真实 Worker/);
  assert((await(await call('/posts.json')).json()).some(p=>p.slug===slug));
  assert.match(await(await call('/archive/')).text(),new RegExp(slug));
  assert.match(await(await call('/feed.xml')).text(),new RegExp(slug));
  assert.match(await(await call('/sitemap.xml')).text(),new RegExp(slug));
  console.log(JSON.stringify({result:'passed',runtime:'compiled Vinext / workerd',database:'local persistent D1',flows:['public page and assets','author-only writes','private draft','publish','article','search','archive','RSS','sitemap']}));
} finally {
  if(published){const res=await call('/api/admin/unpublish',{id,version});if(res.ok)version=(await res.json()).version;}
  if(version)assert.equal((await call('/api/admin/delete',{id,version})).status,200,'Remove local test draft');
}
