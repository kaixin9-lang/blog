import { DatabaseSync } from 'node:sqlite';
import { readFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { sha256 } from '../worker/auth.mjs';
import { fetchRequest } from '../worker/index.mjs';
const schema=(await Promise.all(['0001_blog_posts.sql','0002_author_auth.sql'].map(name=>readFile(new URL('../migrations/'+name,import.meta.url),'utf8')))).join('\n');
export const origin='https://footprints.test';
export const password='Local-test-password-2026!';
export const post={title:'本地验证文章',category:'tech',date:'2026-10-13',image:'desk.jpg',excerpt:'草稿与公开版本验证',tags:['技术'],slug:'local-verification',markdown:'## 正文\n\n这是本地验证内容。'};
export function request(path,{data,cookie,headers={},method,raw,ip='192.0.2.1'}={}) {
  const body=raw??(data===undefined?undefined:JSON.stringify(data));
  return new Request(origin+path,{method:method??(body===undefined?'GET':'POST'),headers:{...(body===undefined?{}:{Origin:origin,'Content-Type':'application/json','X-Footprints-Editor':'1'}),'CF-Connecting-IP':ip,...(cookie?{Cookie:cookie}:{}),...headers},...(body===undefined?{}:{body})});
}
export async function fixture(t) {
  const sqlite=new DatabaseSync(':memory:');sqlite.exec(schema);t.after(()=>sqlite.close());
  function statement(sql,args=[]) {return {bind(...values){return statement(sql,values);},async first(){return sqlite.prepare(sql).get(...args)??null;},async all(){return {results:sqlite.prepare(sql).all(...args)};},async run(){return {success:true,meta:{changes:Number(sqlite.prepare(sql).run(...args).changes)}};}};}
  const token=randomBytes(24).toString('base64url');
  const env={DB:{prepare:sql=>statement(sql)},SESSION_SECRET:randomBytes(32).toString('base64url'),SETUP_TOKEN_HASH:await sha256(token),ASSETS:{fetch:async()=>new Response('asset')}};
  return {sqlite,env,token,call:(path,options)=>fetchRequest(request(path,options),env)};
}
export function cookieFrom(response){return response.headers.get('Set-Cookie')?.split(';')[0];}
