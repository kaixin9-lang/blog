import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
const root = new URL('../test-results/static/', import.meta.url);
const app = await readFile(new URL('app.js',root),'utf8');
const index = JSON.parse(await readFile(new URL('posts.json',root),'utf8'));
async function fixture(t, {page='index.html',url='https://footprints.test/',storage={},blocked=false,failIndex=false} = {}) {
  const html = await readFile(new URL(page,root),'utf8');
  const dom = new JSDOM(html,{url,runScripts:'outside-only',pretendToBeVisual:true});
  t.after(() => dom.window.close());
  const w = dom.window, d = w.document;
  const errors = [];
  w.addEventListener('error',e => errors.push(e.error));
  w.matchMedia = () => ({matches:false,addEventListener(){}});
  w.HTMLElement.prototype.scrollIntoView = function(){};
  w.HTMLDialogElement.prototype.showModal = function(){this.open=true;};
  w.HTMLDialogElement.prototype.close = function(){this.open=false;this.dispatchEvent(new w.Event('close'));};
  for (const [key,value] of Object.entries(storage)) w.localStorage.setItem(key,value);
  if(blocked) Object.defineProperty(w,'localStorage',{get(){throw new Error('Storage blocked');}});
  let unavailable = failIndex;
  let copied = '';
  w.fetch = async () => { if(unavailable) throw new Error('Index unavailable'); return {ok:true,json:async()=>index}; };
  Object.defineProperty(w.navigator,'clipboard',{value:{writeText:async text => {copied=text;}}});
  w.eval(d.querySelector('head script:not([type])').textContent);
  w.eval(app);
  return {w,d,errors,copied:()=>copied,enableIndex:()=>{unavailable=false;},$:s=>d.querySelector(s),$$:s=>Array.from(d.querySelectorAll(s))};
}
async function settled(){ await new Promise(setImmediate); }
async function query(f,value) {f.$('#search-input').value=value;f.$('#search-input').dispatchEvent(new f.w.Event('input'));await settled();}

test('home shows vi and six initial articles, expands to all eight',async t=>{
  const f=await fixture(t);
  assert.match(f.d.title,/Footprints/);assert.match(f.$('.profile-card h3').textContent,/vi/);
  assert.equal(f.$$('.post-card:not([hidden])').length,6);
  f.$('#load-more').click();
  assert.equal(f.$$('.post-card:not([hidden])').length,8);
  assert.equal(f.$('#load-more').hidden,true);assert.equal(f.$('#list-end').hidden,false);
  assert.deepEqual(f.errors,[]);
});
test('category filters show exactly four matching articles and preserve URL',async t=>{
  const f=await fixture(t);
  for(const category of ['life','tech']){
    f.$('[data-filter="'+category+'"]').click();
    assert.equal(f.$$('.post-card:not([hidden])').length,4);
    assert(f.$$('.post-card:not([hidden])').every(c=>c.dataset.category===category));
    assert.equal(new URL(f.w.location.href).searchParams.get('category'),category);
    assert.equal(f.$('[data-filter="'+category+'"]').getAttribute('aria-pressed'),'true');
  }
  f.$('[data-filter="all"]').click();assert.equal(f.$$('.post-card:not([hidden])').length,6);
});
test('direct category link selects the right category on initial load',async t=>{
  const f=await fixture(t,{url:'https://footprints.test/?category=tech#journal'});
  assert.equal(f.$$('.post-card:not([hidden])').length,4);
  assert.equal(f.$('[data-filter="tech"]').getAttribute('aria-pressed'),'true');
});
test('theme switch saves preference and restored theme has correct accessible state',async t=>{
  const f=await fixture(t);f.$('.theme-toggle').click();
  assert.equal(f.d.documentElement.dataset.theme,'dark');
  assert.equal(f.w.localStorage.getItem('footprints-theme'),'dark');
  const restored=await fixture(t,{storage:{'footprints-theme':'dark'}});
  assert.equal(restored.d.documentElement.dataset.theme,'dark');
  assert.equal(restored.$('.theme-toggle').getAttribute('aria-label'),'切换浅色模式');
  restored.$('.theme-toggle').click();assert.equal(restored.d.documentElement.dataset.theme,'light');
});
test('bookmark survives reload, appears in favorites, and can be removed',async t=>{
  const f=await fixture(t);f.$('[data-bookmark="leave-some-space"]').click();
  const storage=f.w.localStorage.getItem('footprints-saved');
  assert.deepEqual(JSON.parse(storage),['leave-some-space']);
  const restored=await fixture(t,{storage:{'footprints-saved':storage}});
  assert.equal(restored.$('[data-bookmark="leave-some-space"]').getAttribute('aria-pressed'),'true');
  restored.$('[data-open-search]').click();restored.$('[data-search-scope="saved"]').click();await settled();
  assert.equal(restored.$$('.search-result').length,1);
  assert.match(restored.$('.search-result').textContent,/给生活留一点空白/);
  restored.$('[data-close-search]').click();restored.$('[data-bookmark="leave-some-space"]').click();
  assert.deepEqual(JSON.parse(restored.w.localStorage.getItem('footprints-saved')),[]);
});
test('full text, title, category and empty search all work',async t=>{
  const f=await fixture(t);f.$('[data-open-search]').click();await settled();
  assert.equal(f.$$('.search-result').length,8);
  await query(f,'变量');assert.equal(f.$$('.search-result').length,1);
  assert.match(f.$('.search-result strong').textContent,/深色模式/);
  await query(f,'localStorage');assert.equal(f.$$('.search-result').length,1);
  await query(f,'技术手记');assert.equal(f.$$('.search-result').length,4);
  await query(f,'不存在的关键词zzzxxy');assert.equal(f.$$('.search-result').length,0);
  assert.match(f.$('.search-empty').textContent,/还没有找到/);
  assert.deepEqual(f.errors,[]);
});
test('Ctrl K opens search and focuses input; keyboard selects results',async t=>{
  const f=await fixture(t);
  f.d.dispatchEvent(new f.w.KeyboardEvent('keydown',{key:'k',ctrlKey:true,bubbles:true}));await settled();
  assert.equal(f.$('#search-dialog').open,true);assert.equal(f.d.activeElement.id,'search-input');
  f.d.dispatchEvent(new f.w.KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true}));
  assert.equal(f.$$('.search-result.focused').length,1);
  f.$('[data-close-search]').click();assert.equal(f.d.body.classList.contains('modal-open'),false);
});
test('mobile menu opens and closes when an anchor is chosen',async t=>{
  const f=await fixture(t);f.$('.menu-toggle').click();
  assert.equal(f.$('#mobile-nav').hidden,false);assert.equal(f.$('.menu-toggle').getAttribute('aria-expanded'),'true');
  f.$('#mobile-nav a[href="/#journal"]').click();
  assert.equal(f.$('#mobile-nav').hidden,true);assert.equal(f.$('.menu-toggle').getAttribute('aria-expanded'),'false');
});
test('article sharing, decoded code copying, and tag search work',async t=>{
  const f=await fixture(t,{page:'posts/a-gentle-dark-mode/index.html',url:'https://footprints.test/posts/a-gentle-dark-mode/'});
  f.$('[data-share]').click();await settled();assert.equal(f.copied(),'https://footprints.test/posts/a-gentle-dark-mode/');
  f.$('[data-copy-code]').click();await settled();assert.match(f.copied(),/--page: #f7f9f6/);
  f.$('[data-search-tag="CSS"]').click();await settled();assert(f.$$('.search-result').length>=1);
  assert(f.$('.demo-notice'));assert.equal(f.$$('.article-toc nav a').length,3);assert.deepEqual(f.errors,[]);
});
test('storage corruption and blocked storage do not break interactions',async t=>{
  const corrupt=await fixture(t,{storage:{'footprints-saved':'not-json','footprints-theme':'unexpected'}});
  assert.equal(corrupt.$('[data-bookmark]').getAttribute('aria-pressed'),'false');
  const blocked=await fixture(t,{blocked:true});
  blocked.$('.theme-toggle').click();assert.equal(blocked.d.documentElement.dataset.theme,'dark');
  blocked.$('[data-bookmark]').click();assert.equal(blocked.$('[data-bookmark]').getAttribute('aria-pressed'),'true');
  blocked.$('[data-open-search]').click();await settled();assert.equal(blocked.$$('.search-result').length,8);
  assert.deepEqual(blocked.errors,[]);
});
test('failed search index has a working retry',async t=>{
  const f=await fixture(t,{failIndex:true});f.$('[data-open-search]').click();await settled();
  assert(f.$('#retry-search'));f.enableIndex();f.$('#retry-search').click();await settled();
  assert.equal(f.$$('.search-result').length,8);assert.deepEqual(f.errors,[]);
});
test('RSS and sitemap are valid XML with complete entries',async()=>{
  const rss=new JSDOM(await readFile(new URL('feed.xml',root),'utf8'),{contentType:'application/xml'});
  assert.equal(rss.window.document.querySelectorAll('item').length,8);rss.window.close();
  const sitemap=new JSDOM(await readFile(new URL('sitemap.xml',root),'utf8'),{contentType:'application/xml'});
  assert.equal(sitemap.window.document.querySelectorAll('url').length,11);sitemap.window.close();
});
