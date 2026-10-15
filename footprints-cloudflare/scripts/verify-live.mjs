import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const origin=new URL(process.argv[2]).origin,checks=[];
const paths=['/','/archive/','/about/','/posts.json','/feed.xml','/sitemap.xml','/robots.txt','/write/','/author/login','/author/setup','/style.css','/app.js','/editor.js','/author.js','/assets/mountains.jpg','/assets/coffee.jpg','/assets/favicon.svg'];
const results=await Promise.allSettled(paths.map(async path=>{
  const response=await fetch(origin+path,{redirect:'manual',signal:AbortSignal.timeout(30000)});
  if(path==='/author/setup'&&response.status===303){assert.equal(response.headers.get('Location'),'/author/login');checks.push({path,status:303,initializationClosed:true});return [path,'initialized'];}
  assert.equal(response.status,200,path);checks.push({path,status:response.status,type:response.headers.get('Content-Type')});
  if(response.headers.get('Content-Type')?.startsWith('image/'))return [path,null];
  return [path,await response.text()];
}));
const failed=results.filter(r=>r.status==='rejected');if(failed.length){for(const result of failed)console.error(result.reason.message);throw new Error('Live route checks failed.');}
const pages=new Map(results.map(r=>r.value)),posts=JSON.parse(pages.get('/posts.json'));
const migrated=posts.filter(p=>p.slug.startsWith('note-'));assert.equal(migrated.length,2);assert.equal(posts.length,10);
for(const post of migrated){const path='/posts/'+post.slug+'/';const r=await fetch(origin+path,{signal:AbortSignal.timeout(30000)});assert.equal(r.status,200);assert((await r.text()).includes(post.title));checks.push({path,status:200,title:post.title});}
for(const path of ['/','/feed.xml','/sitemap.xml','/robots.txt']){assert(pages.get(path).includes(origin));assert(!pages.get(path).includes('chatgpt.site'));}
assert(pages.get('/write/').includes('作者登录'));assert(!pages.get('/write/').includes('data-writing-workspace'));
assert(pages.get('/author/login').includes('data-mode="login"'));assert(pages.get('/author/setup')==='initialized'||pages.get('/author/setup').includes('data-mode="setup"'));
const denied=await fetch(origin+'/api/admin/posts',{headers:{'oai-authenticated-user-id':'vi','oai-authenticated-user-email':'author@footprints.internal'},signal:AbortSignal.timeout(30000)});assert.equal(denied.status,401);checks.push({path:'/api/admin/posts',status:401,forgedIdentityRejected:true});
const session=await(await fetch(origin+'/api/session')).json();assert.equal(session.canWrite,false);assert.equal(session.signedIn,false);
const report={checkedAt:new Date().toISOString(),origin,passed:true,checks,publicPosts:posts.length,migratedPosts:migrated.length,publicWriteAccess:false,authorPasswordInitialized:pages.get('/author/setup')==='initialized',realPhoneNetworkVerified:false};
await mkdir(new URL('../test-results/',import.meta.url),{recursive:true});await writeFile(new URL('../test-results/live-verification.json',import.meta.url),JSON.stringify(report,null,2));
console.log(JSON.stringify({origin,passed:true,routes:checks.length,publicPosts:posts.length,migratedPosts:migrated.length,forgedIdentityRejected:true}));
