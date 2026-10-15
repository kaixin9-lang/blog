import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { DatabaseSync } from 'node:sqlite';
import { readFile, readdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { handleRequest } from '../lib/server.mjs';
const editor=await readFile(new URL('../src/editor.js',import.meta.url),'utf8');
const migration=await readFile(new URL('../migrations/0001_blog_posts.sql',import.meta.url),'utf8');
const origin='https://footprints.test',auth={'oai-authenticated-user-id':'vi','oai-authenticated-user-email':'vi@example.test'};
const settle=()=>new Promise(resolve=>setImmediate(resolve));
async function fixture(t,{backup,blockedStorage=false}={}){
  const sqlite=new DatabaseSync(':memory:');sqlite.exec(migration);t.after(()=>sqlite.close());
  function statement(sql,args=[]){return {bind(...a){return statement(sql,a);},async first(){return sqlite.prepare(sql).get(...args)??null;},async all(){return {results:sqlite.prepare(sql).all(...args)};},async run(){return {meta:{changes:Number(sqlite.prepare(sql).run(...args).changes)}};}};}
  const env={AUTHOR_EMAIL:'vi@example.test',DB:{prepare:sql=>statement(sql)}};
  const response=await handleRequest(new Request(origin+'/write/',{headers:auth}),env);
  const dom=new JSDOM(await response.text(),{url:origin+'/write/',runScripts:'outside-only',pretendToBeVisual:true});t.after(()=>dom.window.close());
  const w=dom.window,d=w.document,errors=[];w.addEventListener('error',event=>errors.push(event.error));
  w.crypto.randomUUID=randomUUID;w.confirm=()=>true;
  w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
  if(backup)w.localStorage.setItem('footprints-writing-backup-v1',JSON.stringify(backup));
  if(blockedStorage)Object.defineProperty(w,'localStorage',{get(){throw new Error('Blocked');}});
  let failure=false,delay=null,calls=[];
  w.fetch=async(path,options={})=>{
    calls.push({path,options});if(failure)throw new Error('网络暂时不可用');
    if(delay)await delay;
    return handleRequest(new Request(origin+path,{...options,headers:{...auth,...(options.body?{Origin:origin}:{}),...options.headers}}),env);
  };
  w.eval(editor);await settle();
  const $=s=>d.querySelector(s),set=(s,v)=>{$(s).value=v;$(s).dispatchEvent(new w.Event('input',{bubbles:true}));};
  return {w,d,$,set,errors,calls,env,fail:v=>{failure=v;},delay:v=>{delay=v;},publicRequest:path=>handleRequest(new Request(origin+path),env)};
}
async function fill(f){f.set('#article-title','一篇从网页写下的足迹');f.set('#article-body','## 我的第一段\n\n今天认真记录生活。');f.set('#article-tags','日常，记录');}
test('editor saves to the real route, reopens a cloud draft and publishes',async t=>{
  const f=await fixture(t);await fill(f);f.$('#save-draft').click();await settle();
  assert.match(f.$('#editor-status').textContent,/草稿已保存到云端/);assert.equal(f.$('#draft-count').textContent,'1');assert.equal(f.$('#article-slug').readOnly,true);
  assert.equal((await(await f.publicRequest('/posts.json')).json()).length,8);
  f.$('#new-article').click();assert.equal(f.$('#article-title').value,'');f.$('[data-draft-id]').click();assert.equal(f.$('#article-title').value,'一篇从网页写下的足迹');
  f.$('#publish-article').click();await settle();assert.match(f.$('#editor-status').textContent,/已发布/);assert.equal(f.$('#published-count').textContent,'1');assert.equal(f.$('#read-published').hidden,false);
  const posts=await(await f.publicRequest('/posts.json')).json();assert.equal(posts.length,9);assert.equal(posts[0].title,'一篇从网页写下的足迹');assert.deepEqual(f.errors,[]);
});
test('preview is sandboxed and does not create a cloud draft or publication',async t=>{
  const f=await fixture(t);await fill(f);f.$('#preview-article').click();await settle();
  assert(f.$('#preview-dialog').open);assert.equal(f.$('#article-preview').getAttribute('sandbox'),'');assert.match(f.$('#article-preview').srcdoc,/一篇从网页写下的足迹/);assert.match(f.$('#article-preview').srcdoc,/<base href="https:\/\/footprints.test\//);
  assert.equal(f.$('#draft-count').textContent,'0');assert.equal((await(await f.publicRequest('/posts.json')).json()).length,8);f.$('#close-preview').click();assert(!f.$('#preview-dialog').open);
});
test('failed saves preserve text and local recovery; retry creates only one draft',async t=>{
  const f=await fixture(t);await fill(f);f.fail(true);f.$('#save-draft').click();await settle();
  assert.match(f.$('#editor-status').textContent,/当前文字已保留/);assert.equal(f.$('#article-title').value,'一篇从网页写下的足迹');assert(f.w.localStorage.getItem('footprints-writing-backup-v1'));assert(!f.$('#save-draft').disabled);
  f.fail(false);f.$('#save-draft').click();await settle();assert.equal(f.$('#draft-count').textContent,'1');assert.equal(f.w.localStorage.getItem('footprints-writing-backup-v1'),null);
});
test('recovery restores unsaved text without automatically publishing or saving it',async t=>{
  const backup={id:randomUUID(),version:0,published:false,post:{title:'关闭页面前的文字',markdown:'尚未保存的段落',category:'tech',date:'2026-10-11',image:'desk.jpg',excerpt:'',tags:['草稿'],slug:''}};
  const f=await fixture(t,{backup});assert(!f.$('#recovery-banner').hidden);f.$('#recover-writing').click();assert.equal(f.$('#article-title').value,backup.post.title);assert.equal(f.$('#article-body').value,backup.post.markdown);assert.equal(f.$('#draft-count').textContent,'0');assert.match(f.$('#editor-status').textContent,/已恢复/);
});
test('double clicks are locked while a save is in progress',async t=>{
  const f=await fixture(t);await fill(f);let release;f.delay(new Promise(resolve=>{release=resolve;}));
  f.$('#save-draft').click();f.$('#save-draft').click();assert(f.$('#article-fields').disabled);assert.equal(f.calls.filter(c=>c.path==='/api/admin/posts'&&c.options.body).length,1);
  release();await settle();assert.equal(f.$('#draft-count').textContent,'1');assert(!f.$('#article-fields').disabled);
});
test('empty article cannot publish; Ctrl S saves and formatting inserts markdown',async t=>{
  const f=await fixture(t);f.set('#article-title','技术笔记');f.$('#publish-article').click();assert.match(f.$('#editor-status').textContent,/写一点正文/);
  f.$('[data-format="code"]').click();assert.match(f.$('#article-body').value,/```/);f.w.document.dispatchEvent(new f.w.KeyboardEvent('keydown',{key:'s',ctrlKey:true,cancelable:true}));await settle();assert.equal(f.$('#draft-count').textContent,'1');
});
test('blocked local storage does not prevent cloud draft saving',async t=>{
  const f=await fixture(t,{blockedStorage:true});await fill(f);f.$('#save-draft').click();await settle();assert.equal(f.$('#draft-count').textContent,'1');assert.deepEqual(f.errors,[]);
});
