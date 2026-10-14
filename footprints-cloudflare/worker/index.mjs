import { handleRequest } from '../lib/server.mjs';
import { createRenderer } from '../lib/render.mjs';
import siteConfig from '../content/site.json' with {type:'json'};
import { authAction,authorSession,authorSetupNeeded } from './auth.mjs';
import { authorPage } from './login-page.mjs';
export async function fetchRequest(request,env) {
  const url=new URL(request.url),path=url.pathname.replace(/\/+$/,'')||'/';
  if(path.startsWith('/assets/')||['/style.css','/app.js','/editor.css','/editor.js','/author.js'].includes(path))return env.ASSETS.fetch(request);
  if(path==='/robots.txt')return new Response('User-agent: *\nAllow: /\nDisallow: /write/\nDisallow: /author/\nDisallow: /api/admin/\nSitemap: '+url.origin+'/sitemap.xml\n',{headers:{'Content-Type':'text/plain; charset=utf-8'}});
  try{
    if(path==='/author/logout'||(['login','setup'].some(p=>path==='/author/'+p)&&request.method==='POST'))return await authAction(request,env);
    if(['/author/login','/author/setup'].includes(path)&&request.method==='GET') {
      const r=createRenderer([],{...siteConfig,origin:url.origin}),needed=await authorSetupNeeded(env);
      if(path==='/author/setup'&&!needed)return new Response(null,{status:303,headers:{Location:'/author/login','Cache-Control':'private, no-store'}});
      return new Response(r.shell({title:'作者登录 · Footprints',url:path,active:'write',content:authorPage(r,{setup:path==='/author/setup',needed})}).replace('<head>','<head><meta name="robots" content="noindex,nofollow"><meta name="referrer" content="no-referrer">').replace('</head>','<link rel="stylesheet" href="/editor.css"><script src="/author.js" defer></script></head>'),{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'private, no-store','Referrer-Policy':'no-referrer'}});
    }
    const headers=new Headers(request.headers);
    for(const name of Array.from(headers.keys()))if(name.startsWith('oai-authenticated-user-'))headers.delete(name);
    const session=await authorSession(request,env);
    if(session){headers.set('oai-authenticated-user-id',session.id);headers.set('oai-authenticated-user-email','author@footprints.internal');}
    return await handleRequest(new Request(request,{headers}),{...env,AUTHOR_EMAIL:'author@footprints.internal'});
  }catch(error){console.error(JSON.stringify({event:'worker_request_failed',error:error.name,path}));return new Response('服务暂时不可用，请稍后重试。',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'}});}
}
export default {fetch:fetchRequest};
