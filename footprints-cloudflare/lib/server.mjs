import { posts as examples } from '../content/posts.mjs';
import siteConfig from '../content/site.json' with { type:'json' };
import { createRenderer } from './render.mjs';
import { renderMarkdown } from './markdown.mjs';
import { writingPage } from './writing-page.mjs';

const covers = {'coffee.jpg':'咖啡与笔记本','forest.jpg':'安静的林间小路','desk.jpg':'电脑与工作桌','mountains.jpg':'连绵的山峰','lake.jpg':'山间湖泊'};
const reserved = new Set(examples.map(p=>p.slug));
const headers = {'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin','X-Frame-Options':'SAMEORIGIN'};
class HttpError extends Error { constructor(status,message){super(message);this.status=status;} }
const fail=(status,message)=>{throw new HttpError(status,message);};
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{...headers,'Content-Type':'application/json; charset=utf-8'}});
const html=(body,status=200)=>new Response(body,{status,headers:{...headers,'Content-Type':'text/html; charset=utf-8'}});
const xml=(body)=>new Response(body,{headers:{...headers,'Content-Type':'application/xml; charset=utf-8'}});

export function authorIdentity(request,env) {
  const id=request.headers.get('oai-authenticated-user-id');
  const email=request.headers.get('oai-authenticated-user-email')?.trim().toLowerCase();
  return id && email && env.AUTHOR_EMAIL && email===env.AUTHOR_EMAIL.trim().toLowerCase() ? {id} : null;
}
function requireAuthor(request,env) {
  if(!env.AUTHOR_EMAIL) fail(503,'作者权限尚未配置，请稍后重试。');
  if(!request.headers.get('oai-authenticated-user-id')) fail(401,'请先登录作者账号。');
  const author=authorIdentity(request,env);
  if(!author) fail(403,'这个账号没有写作权限，请使用博客作者的账号登录。');
  return author;
}
function requireWriteOrigin(request) {
  if(request.headers.get('origin')!==new URL(request.url).origin || request.headers.get('sec-fetch-site')==='cross-site' || request.headers.get('x-footprints-editor')!=='1') fail(403,'请从本站的写作页面提交。');
  if(!request.headers.get('content-type')?.startsWith('application/json')) fail(415,'请使用 JSON 提交文章。');
}
async function body(request) {
  if(Number(request.headers.get('content-length'))>200000) fail(413,'文章过长，请控制在 5 万字以内。');
  const reader=request.body?.getReader();
  if(!reader) fail(400,'没有收到文章内容。');
  let size=0,parts=[];
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>200000){await reader.cancel();fail(413,'文章过长，请控制在 5 万字以内。');}parts.push(value);}
  const bytes=new Uint8Array(size);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.byteLength;}
  let data;try{data=JSON.parse(new TextDecoder().decode(bytes));}catch{fail(400,'文章数据格式不正确。');}
  if(!data||typeof data!=='object'||Array.isArray(data))fail(400,'文章数据格式不正确。');
  return data;
}
function field(value,name,max,required=true) {
  if(typeof value!=='string') fail(400,name+'格式不正确。');
  const result=value.trim();
  if((required&&!result)||result.length>max) fail(400,name+'不能为空或超过 '+max+' 个字符。');
  return result;
}
export function validatePost(input,{publishing=false,id}={}) {
  if(!input||typeof input!=='object'||Array.isArray(input)) fail(400,'文章数据格式不正确。');
  const title=field(input.title,'标题',120);
  const markdown=field(input.markdown??'','正文',50000,publishing);
  const category=input.category;
  if(!['life','tech'].includes(category)) fail(400,'请选择生活随笔或技术手记。');
  const date=field(input.date,'日期',10);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date+'T00:00:00Z').toISOString().slice(0,10)!==date) fail(400,'请填写有效的文章日期。');
  const slug=input.slug?field(input.slug,'文章地址',80):'note-'+id;
  if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) fail(400,'文章地址只能使用小写字母、数字和单个连字符。');
  if(reserved.has(slug)) fail(409,'这个文章地址已被示例文章使用，请换一个。');
  const image=input.image??'coffee.jpg';
  if(!Object.hasOwn(covers,image)) fail(400,'请选择可用的封面。');
  if(!Array.isArray(input.tags)||input.tags.length>8) fail(400,'最多填写 8 个标签。');
  const tags=[...new Set(input.tags.map(t=>field(t,'标签',24)))];
  const plain=renderMarkdown(markdown).text;
  const excerpt=field(input.excerpt??'','摘要',280,false)||plain.slice(0,140);
  return {slug,title,category,date,image,alt:covers[image],excerpt,tags,markdown,demo:false};
}
function db(env){if(!env.DB)fail(503,'文章存储尚未就绪，请稍后重试。');return env.DB;}
async function rowFor(env,id,authorId) {
  return db(env).prepare('SELECT * FROM blog_posts WHERE id = ? AND author_id = ?').bind(id,authorId).first();
}
function editorRow(row){return {id:row.id,version:row.version,post:JSON.parse(row.draft_json),published:!!row.published_json,updatedAt:row.updated_at,publishedAt:row.published_json?JSON.parse(row.published_json).publishedAt:null};}
async function publicPosts(env) {
  const {results}=await db(env).prepare('SELECT published_json FROM blog_posts WHERE published_json IS NOT NULL').all();
  return [...results.map(row=>JSON.parse(row.published_json)),...examples].sort((a,b)=>b.date.localeCompare(a.date)||(b.publishedAt??'').localeCompare(a.publishedAt??''));
}
async function savePost(request,env,author,publishing) {
  requireWriteOrigin(request);const data=await body(request);
  const id=field(data.id,'草稿标识',36);
  if(!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(id))fail(400,'草稿标识不正确。');
  if(!Number.isInteger(data.version)||data.version<0)fail(400,'文章版本不正确。');
  const post=validatePost(data.post,{publishing,id});
  const existing=await rowFor(env,id,author.id),now=new Date().toISOString();
  if(existing && existing.slug!==post.slug)fail(409,'保存后文章地址固定，请保持原地址。');
  if(existing && existing.version!==data.version)fail(409,'这篇文章已在其他页面更新。请先导出当前文字，再重新载入最新版本。');
  if(!existing && data.version!==0)fail(409,'文章不存在或已经删除。请新建文章后保存。');
  if(publishing)post.publishedAt=existing?.published_json?JSON.parse(existing.published_json).publishedAt:now;
  const draft=JSON.stringify(post);
  let result;
  try {
    if(existing)result=await db(env).prepare(publishing
      ? 'UPDATE blog_posts SET draft_json = ?, published_json = ?, version = version + 1, updated_at = ? WHERE id = ? AND author_id = ? AND version = ?'
      : 'UPDATE blog_posts SET draft_json = ?, version = version + 1, updated_at = ? WHERE id = ? AND author_id = ? AND version = ?')
      .bind(...(publishing?[draft,draft,now,id,author.id,data.version]:[draft,now,id,author.id,data.version])).run();
    else result=await db(env).prepare('INSERT INTO blog_posts (id,slug,author_id,draft_json,published_json,version,created_at,updated_at) VALUES (?,?,?,?,?,1,?,?)').bind(id,post.slug,author.id,draft,publishing?draft:null,now,now).run();
  }catch(error){if(/UNIQUE|constraint/i.test(error.message))fail(409,'文章地址或草稿已存在，请重新载入或更换地址。');throw error;}
  if(result.meta.changes!==1)fail(409,'文章已在其他页面更新，请重新载入。');
  return json(editorRow(await rowFor(env,id,author.id)),existing?200:201);
}
async function admin(request,env,url) {
  const site={...siteConfig,origin:url.origin};
  const author=requireAuthor(request,env);
  if(url.pathname==='/api/admin/posts'&&request.method==='GET') {
    const {results}=await db(env).prepare('SELECT * FROM blog_posts WHERE author_id = ? ORDER BY updated_at DESC').bind(author.id).all();
    return json({posts:results.map(editorRow)});
  }
  if(url.pathname==='/api/admin/posts'&&request.method==='POST')return savePost(request,env,author,false);
  if(url.pathname==='/api/admin/publish'&&request.method==='POST')return savePost(request,env,author,true);
  if(url.pathname==='/api/admin/preview'&&request.method==='POST') {
    requireWriteOrigin(request);const data=await body(request);
    const post=validatePost(data.post,{id:'preview'});
    const r=createRenderer([],site);
    return json({html:r.shell({title:post.title+' · 预览',url:'/write/',active:'write',content:r.article(post),article:post,image:'/assets/'+post.image}).replace('<head>','<head><meta name="robots" content="noindex,nofollow">')});
  }
  if(url.pathname==='/api/admin/unpublish'&&request.method==='POST') {
    requireWriteOrigin(request);const data=await body(request);
    if(typeof data.id!=='string'||!Number.isInteger(data.version))fail(400,'文章标识不正确。');
    const result=await db(env).prepare('UPDATE blog_posts SET published_json = NULL, version = version + 1, updated_at = ? WHERE id = ? AND author_id = ? AND version = ?').bind(new Date().toISOString(),data.id,author.id,data.version).run();
    if(result.meta.changes!==1)fail(409,'文章版本已更新，请重新载入。');
    return json(editorRow(await rowFor(env,data.id,author.id)));
  }
  if(url.pathname==='/api/admin/delete'&&request.method==='POST') {
    requireWriteOrigin(request);const data=await body(request);
    if(typeof data.id!=='string'||!Number.isInteger(data.version))fail(400,'草稿标识不正确。');
    const result=await db(env).prepare('DELETE FROM blog_posts WHERE id = ? AND author_id = ? AND version = ? AND published_json IS NULL').bind(data.id,author.id,data.version).run();
    if(result.meta.changes!==1)fail(409,'只能删除未发布且版本未改变的草稿。');
    return json({deleted:true});
  }
  fail(405,'这个操作暂不支持。');
}

export async function handleRequest(request,env) {
  try {
    const site={...siteConfig,origin:new URL(request.url).origin};
    const url=new URL(request.url),path=url.pathname.replace(/\/+$/,'')||'/';
    if(path==='/api/session'&&request.method==='GET')return json({signedIn:!!request.headers.get('oai-authenticated-user-id'),canWrite:!!authorIdentity(request,env),configured:!!env.AUTHOR_EMAIL});
    if(url.pathname.startsWith('/api/admin/'))return await admin(request,env,url);
    if(!['GET','HEAD'].includes(request.method))fail(405,'这个操作暂不支持。');
    const r=createRenderer([],site);
    if(path==='/write')return html(r.shell({title:'写作 · Footprints',url:'/write/',active:'write',content:writingPage(r,request,env,authorIdentity)}).replace('<head>','<head><meta name="robots" content="noindex,nofollow">').replace('</head>','<link rel="stylesheet" href="/editor.css"><script src="/editor.js" defer></script></head>'));
    if(path==='/about')return html(r.shell({title:'关于 vi · Footprints',url:'/about/',active:'about',content:r.about()}));
    const publicRoutes=path==='/'||path==='/archive'||path==='/posts.json'||path==='/feed.xml'||path==='/sitemap.xml'||/^\/posts\/[a-z0-9-]+$/.test(path);
    if(publicRoutes) {
      const posts=await publicPosts(env),render=createRenderer(posts,site);
      if(path==='/')return html(render.shell({title:'Footprints · vi 的生活与技术',content:render.home()}));
      if(path==='/archive')return html(render.shell({title:'文章归档 · Footprints',url:'/archive/',active:'archive',content:render.archive()}));
      if(path==='/posts.json')return json(posts.map(p=>({slug:p.slug,title:p.title,category:p.category,categoryLabel:render.labels[p.category],excerpt:p.excerpt,tags:p.tags,date:p.date,text:render.text(p)})));
      if(path==='/feed.xml')return xml('<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Footprints · vi 的生活与技术</title><link>'+site.origin+'</link><description>'+render.e(site.description)+'</description><language>zh-CN</language>'+posts.map(p=>'<item><title>'+render.e(p.title)+(p.demo?'（示例）':'')+'</title><link>'+site.origin+render.href(p)+'</link><guid>'+site.origin+render.href(p)+'</guid><description>'+render.e(p.excerpt)+'</description><pubDate>'+new Date(p.date+'T00:00:00+08:00').toUTCString()+'</pubDate></item>').join('')+'</channel></rss>');
      if(path==='/sitemap.xml')return xml('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+['/','/about/','/archive/',...posts.map(render.href)].map(p=>'<url><loc>'+site.origin+p+'</loc></url>').join('')+'</urlset>');
      const post=posts.find(p=>'/posts/'+p.slug===path);
      if(post)return html(render.shell({title:post.title+' · Footprints',description:post.excerpt,url:render.href(post),active:'posts',content:render.article(post),article:post,image:'/assets/'+post.image}));
    }
    return html(r.shell({title:'这一页还没有留下足迹 · Footprints',url:'/404.html',content:'<div class="container not-found"><span>404</span><h1>这一页，还没有留下足迹。</h1><p>文章可能尚未发布或链接已改变。</p><a class="primary-button" href="/">回到首页</a></div>'}),404);
  } catch(error) {
    if(error instanceof HttpError)return json({error:error.message},error.status);
    console.error('Footprints storage request failed:',error.name);
    return json({error:'文章存储暂时不可用，请稍后重试。'},503);
  }
}
