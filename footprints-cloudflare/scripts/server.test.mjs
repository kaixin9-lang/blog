import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFile, readdir } from 'node:fs/promises';
import { handleRequest } from '../lib/server.mjs';
import { renderMarkdown } from '../lib/markdown.mjs';
const sql=await readFile(new URL('../migrations/0001_blog_posts.sql',import.meta.url),'utf8');
export function database(t){
  const sqlite=new DatabaseSync(':memory:');sqlite.exec(sql);t.after(()=>sqlite.close());
  function statement(query,args=[]){return {bind(...values){return statement(query,values);},async first(){return sqlite.prepare(query).get(...args)??null;},async all(){return {results:sqlite.prepare(query).all(...args)};},async run(){const result=sqlite.prepare(query).run(...args);return {success:true,meta:{changes:Number(result.changes)}};}};}
  return {prepare:query=>statement(query)};
}
const origin='https://footprints.test';
const email='vi@example.test';
const id='11111111-1111-4111-8111-111111111111';
const input={title:'第一篇真实足迹',category:'life',date:'2026-10-11',image:'forest.jpg',excerpt:'',tags:['生活'],slug:'first-real-post',markdown:'## 今天的片刻\n\n窗边的光，值得记下来。\n\n```js\nconsole.log("hello");\n```'};
function request(path,{data,author=true,overrides={},method}={}){return new Request(origin+path,{method:method??(data?'POST':'GET'),headers:{...(author?{'oai-authenticated-user-id':'author-site-id','oai-authenticated-user-email':email}:{}),...(data?{'Origin':origin,'Content-Type':'application/json','X-Footprints-Editor':'1'}:{}),...overrides},...(data?{body:JSON.stringify(data)}:{})});}
function fixture(t){const env={DB:database(t),AUTHOR_EMAIL:email};return {env,call:(path,options)=>handleRequest(request(path,options),env),payload:(version=0,post=input)=>({id,version,post})};}

test('only the configured authenticated author can use private routes',async t=>{
  const f=fixture(t);
  assert.equal((await f.call('/api/admin/posts',{author:false})).status,401);
  assert.equal((await f.call('/api/admin/posts',{overrides:{'oai-authenticated-user-email':'someone@example.test'}})).status,403);
  assert.equal((await handleRequest(request('/api/admin/posts'),{DB:f.env.DB})).status,503);
  assert.equal((await f.call('/api/admin/posts',{overrides:{'oai-authenticated-user-id':''}})).status,401);
  assert.deepEqual(await(await f.call('/api/session',{author:false})).json(),{signedIn:false,canWrite:false,configured:true});
  const gate=await(await f.call('/write/',{author:false})).text();assert.match(gate,/作者登录/);assert.doesNotMatch(gate,/data-writing-workspace/);
  assert.match(await(await f.call('/write/')).text(),/data-writing-workspace/);
});
test('write endpoints reject cross-origin submissions and missing editor headers',async t=>{
  const f=fixture(t);
  for(const overrides of [{Origin:'https://evil.test'},{Origin:''},{'X-Footprints-Editor':''},{'Sec-Fetch-Site':'cross-site'}])assert.equal((await f.call('/api/admin/posts',{data:f.payload(),overrides})).status,403);
  assert.equal((await f.call('/api/admin/posts',{data:f.payload(),overrides:{'Content-Type':'text/plain'}})).status,415);
  assert.equal((await f.call('/api/admin/posts')).status,200);
  assert.equal((await f.call('/api/admin/publish',{method:'GET'})).status,405);
  assert.equal((await f.call('/api/admin/posts',{data:f.payload(),author:false})).status,401);
  assert.equal((await(await f.call('/api/admin/posts')).json()).posts.length,0);
  const bad=new Request(origin+'/api/admin/posts',{method:'POST',headers:request('/api/admin/posts',{data:f.payload()}).headers,body:'null'});
  assert.equal((await handleRequest(bad,f.env)).status,400);
});
test('cloud drafts stay private, persist across requests, and are editable',async t=>{
  const f=fixture(t),saved=await f.call('/api/admin/posts',{data:f.payload()});assert.equal(saved.status,201);
  const row=await saved.json();assert.equal(row.version,1);assert.equal(row.published,false);
  assert.equal((await(await f.call('/api/admin/posts')).json()).posts[0].post.markdown,input.markdown);
  const publicIndex=await(await f.call('/posts.json',{author:false})).json();assert.equal(publicIndex.length,8);assert(!publicIndex.some(p=>p.slug===input.slug));
  assert.equal((await f.call('/posts/'+input.slug+'/',{author:false})).status,404);
  for(const path of ['/','/archive/','/feed.xml','/sitemap.xml'])assert.doesNotMatch(await(await f.call(path,{author:false})).text(),/第一篇真实足迹|first-real-post/);
  const updated=await f.call('/api/admin/posts',{data:f.payload(1,{...input,title:'修改后的标题'})});assert.equal((await updated.json()).version,2);
});
test('publishing updates article, home, archive, search, RSS and sitemap immediately',async t=>{
  const f=fixture(t),response=await f.call('/api/admin/publish',{data:f.payload()});assert.equal(response.status,201);
  const row=await response.json();assert(row.published);assert(row.publishedAt);
  for(const path of ['/','/archive/','/posts/first-real-post/','/feed.xml']){const res=await f.call(path,{author:false});assert.equal(res.status,200);assert.match(await res.text(),/第一篇真实足迹/);}
  const index=await(await f.call('/posts.json',{author:false})).json();assert.equal(index.length,9);assert.match(index[0].text,/窗边的光/);
  const html=await(await f.call('/posts/first-real-post/',{author:false})).text();assert.match(html,/<h2 id="heading-1">今天的片刻/);assert.match(html,/href="#heading-1"/);assert.match(html,/data-copy-code/);assert.doesNotMatch(html,/这是一篇示例文章/);
  assert.match(await(await f.call('/sitemap.xml',{author:false})).text(),/first-real-post/);
});
test('editing a published article saves private changes until explicit republish',async t=>{
  const f=fixture(t);await f.call('/api/admin/publish',{data:f.payload()});
  const changed={...input,title:'还没有公开的新标题',markdown:'## 私密修改\n\n这一段还不能给读者看。'};
  const draft=await(await f.call('/api/admin/posts',{data:f.payload(1,changed)})).json();assert(draft.published);
  for(const path of ['/','/archive/','/posts/first-real-post/','/feed.xml','/posts.json']){const text=await(await f.call(path,{author:false})).text();assert.match(text,/第一篇真实足迹/);assert.doesNotMatch(text,/还没有公开的新标题|这一段还不能/);}
  assert.equal((await(await f.call('/api/admin/posts')).json()).posts[0].post.title,changed.title);
  await f.call('/api/admin/publish',{data:f.payload(2,changed)});assert.match(await(await f.call('/posts/first-real-post/',{author:false})).text(),/还没有公开的新标题/);
});
test('stale versions, duplicate slugs and invalid content cannot overwrite records',async t=>{
  const f=fixture(t);await f.call('/api/admin/posts',{data:f.payload()});
  assert.equal((await f.call('/api/admin/posts',{data:f.payload(0,{...input,title:'错误的覆盖'})})).status,409);
  assert.equal((await f.call('/api/admin/posts',{data:{id:'22222222-2222-4222-8222-222222222222',version:0,post:input}})).status,409);
  assert.equal((await f.call('/api/admin/posts',{data:f.payload(1,{...input,slug:'another-address'})})).status,409);
  for(const post of [{...input,date:'2026-02-30'},{...input,category:'hacked'},{...input,image:'../../secret'},{...input,title:''},{...input,markdown:'x'.repeat(50001)}])assert.equal((await f.call('/api/admin/posts',{data:f.payload(1,post)})).status,400);
  assert.equal((await f.call('/api/admin/posts',{data:f.payload(1,{...input,slug:'a-gentle-dark-mode'})})).status,409);
  assert.equal((await(await f.call('/api/admin/posts')).json()).posts[0].post.title,input.title);
});
test('unpublish removes every public reference and draft deletion is constrained',async t=>{
  const f=fixture(t);await f.call('/api/admin/publish',{data:f.payload()});
  assert.equal((await f.call('/api/admin/delete',{data:{id,version:1}})).status,409);
  assert.equal((await f.call('/api/admin/unpublish',{data:{id,version:1}})).status,200);
  for(const path of ['/','/archive/','/posts.json','/feed.xml','/sitemap.xml'])assert.doesNotMatch(await(await f.call(path,{author:false})).text(),/first-real-post/);
  assert.equal((await f.call('/posts/first-real-post/',{author:false})).status,404);
  assert.equal((await f.call('/api/admin/delete',{data:{id,version:2}})).status,200);
  assert.equal((await(await f.call('/api/admin/posts')).json()).posts.length,0);
});
test('Markdown renders formatting while scripts and dangerous URL schemes stay inert',()=>{
  const result=renderMarkdown('## 标题\n\n**重点**\n\n<script>alert(1)</script>\n\n[危险](javascript:alert(1))\n\n![图片](data:text/html,x)\n\n- 一\n- 二\n\n> 引用');
  assert.match(result.html,/<strong>重点/);assert.match(result.html,/<ul>/);assert.match(result.html,/<blockquote>/);assert.doesNotMatch(result.html,/<script>|href="javascript:|src="data:text\/html/);assert.match(result.html,/&lt;script&gt;/);
  assert.doesNotMatch(renderMarkdown('# 正文中的标题').html,/<h1/);
});
test('storage errors produce retryable errors rather than successful writes',async t=>{
  const env={AUTHOR_EMAIL:email,DB:{prepare(){throw new Error('Database unavailable');}}};
  assert.equal((await handleRequest(request('/api/admin/posts',{data:{id,version:0,post:input}}),env)).status,503);
  assert.equal((await handleRequest(request('/posts.json',{author:false}),env)).status,503);
});
