import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { posts } from '../content/posts.mjs';
const root = fileURLToPath(new URL('../test-results/static/', import.meta.url));
const site = JSON.parse(await readFile(new URL('../content/site.json', import.meta.url), 'utf8'));
const files = [];
async function walk(dir) {
  for (const entry of await readdir(dir, {withFileTypes:true})) {
    const target = path.join(dir,entry.name);
    if (entry.isDirectory()) await walk(target); else files.push(target);
  }
}
await walk(root);
assert.equal(new Set(posts.map(p => p.slug)).size,posts.length,'Article slugs must be unique');
assert(posts.every(p => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(p.slug) && ['life','tech'].includes(p.category)),'Valid article identifiers');
let links = 0, images = 0;
const htmlFiles = files.filter(f => f.endsWith('.html'));
for (const file of htmlFiles) {
  const html = await readFile(file,'utf8');
  assert.equal((html.match(/<h1(?:\s|>)/g) || []).length,1,'One main heading: '+file);
  assert(html.includes('lang="zh-CN"') && html.includes('name="viewport"'),'Language and responsive metadata');
  assert(html.includes('rel="canonical" href="'+site.origin),'Canonical origin');
  for (const match of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    if (!match[1].startsWith('/') || match[1].startsWith('//')) continue;
    const url = new URL(match[1].replaceAll('&amp;','&'),site.origin);
    let target = path.join(root,decodeURIComponent(url.pathname));
    const metadata = await stat(target);
    if (metadata.isDirectory()) target = path.join(target,'index.html');
    assert((await stat(target)).isFile(),'Local resource exists: '+url.pathname);
    links++;
  }
  for (const match of html.matchAll(/<img\b[^>]*>/g)) {
    assert(/\balt="/.test(match[0]) && /\bwidth="/.test(match[0]) && /\bheight="/.test(match[0]),'Accessible, dimensioned image');
    images++;
  }
  const jsonLd = html.match(/<script type="application\/ld\+json">([^]*?)<\/script>/);
  assert(jsonLd && JSON.parse(jsonLd[1])['@context']==='https://schema.org','Valid structured metadata');
}
assert.equal(htmlFiles.length,posts.length+5,'All routes generated including the writing entry');
const index = JSON.parse(await readFile(path.join(root,'posts.json'),'utf8'));
assert.equal(index.length,posts.length,'Complete search index');
assert(index.every(p => p.title && p.text && p.categoryLabel),'Search covers complete article content');
const feed = await readFile(path.join(root,'feed.xml'),'utf8');
assert.equal((feed.match(/<item>/g)||[]).length,posts.length,'RSS contains every article');
const sitemap = await readFile(path.join(root,'sitemap.xml'),'utf8');
assert.equal((sitemap.match(/<url>/g)||[]).length,posts.length+3,'Sitemap covers public content');
console.log(JSON.stringify({result:'passed',html_pages:htmlFiles.length,checked_local_links:links,accessible_images:images,search_articles:index.length,rss_items:posts.length}));
