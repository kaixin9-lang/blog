(() => {
  'use strict';
  if(!document.querySelector('[data-writing-workspace]'))return;
  const $=s=>document.querySelector(s),$$=s=>Array.from(document.querySelectorAll(s));
  const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const backupKey='footprints-writing-backup-v1';
  let rows=[],scope='draft',current,dirty=false,busy=false,recovery;
  const today=()=>new Date(Date.now()+8*3600000).toISOString().slice(0,10);
  const fields=['title','category','date','image','excerpt','markdown','tags','slug'];
  const selectors={title:'#article-title',category:'#article-category',date:'#article-date',image:'#article-image',excerpt:'#article-excerpt',markdown:'#article-body',tags:'#article-tags',slug:'#article-slug'};
  function status(message,error=false){$('#editor-status').textContent=message;$('#editor-status').classList.toggle('editor-error',error);}
  function values(){return Object.fromEntries(fields.map(name=>[name,name==='tags'?$(selectors[name]).value.split(/[,，]/).map(t=>t.trim()).filter(Boolean):$(selectors[name]).value]));}
  function remember(){try{localStorage.setItem(backupKey,JSON.stringify({...current,post:values()}));return true;}catch{return false;}}
  function forget(){try{localStorage.removeItem(backupKey);}catch{}recovery=null;$('#recovery-banner').hidden=true;}
  function labels(){
    $('#editor-state').textContent=current.published?'已发布 · 可继续修改':current.version?'云端草稿':'新文章';
    $('#article-slug').readOnly=current.version>0;
    $('#article-url').textContent=current.post.slug?'/posts/'+current.post.slug+'/':'';
    $('#publish-article').innerHTML=(current.published?'更新发布':'发布文章')+' <span aria-hidden="true">→</span>';
    $('#read-published').hidden=!current.published;$('#read-published').href='/posts/'+current.post.slug+'/';
    $('#unpublish-article').hidden=!current.published;$('#delete-draft').hidden=!current.version||current.published;
  }
  function fill(row){
    current=JSON.parse(JSON.stringify(row));
    for(const name of fields)$(selectors[name]).value=name==='tags'?(row.post.tags??[]).join('，'):row.post[name]??'';
    dirty=false;labels();count();renderList();
    status(row.version?'已从云端载入。'+(row.published?'保存草稿只保留修改，点击“更新发布”才会更新公开文章。':'可以继续写，准备好后再发布。'):'新文章尚未保存。保存草稿后，可以换设备继续写。');
  }
  function fresh(){fill({id:crypto.randomUUID(),version:0,published:false,post:{title:'',category:'life',date:today(),image:'coffee.jpg',excerpt:'',markdown:'',tags:[],slug:''}});}
  function count(){$('#word-count').textContent=$('#article-body').value.replace(/\s/g,'').length+' 字';$('#cover-preview').src='/assets/'+$('#article-image').value;}
  function renderList(){
    $('#draft-count').textContent=rows.filter(r=>!r.published).length;$('#published-count').textContent=rows.filter(r=>r.published).length;
    const visible=rows.filter(r=>r.published===(scope==='published'));
    $('#draft-list').innerHTML=visible.length?visible.map(row=>'<button type="button" class="draft-entry'+(row.id===current?.id?' selected':'')+'" data-draft-id="'+escape(row.id)+'"><strong>'+escape(row.post.title)+'</strong><small>'+escape(row.post.date)+' · '+(row.post.category==='life'?'生活随笔':'技术手记')+'</small></button>').join(''):'<p class="draft-empty">'+(scope==='draft'?'还没有草稿。<br>从一篇新的足迹开始吧。':'还没有发布的文章。<br>准备好后，让文字与读者见面。')+'</p>';
    $$('[data-draft-id]').forEach(button=>button.addEventListener('click',()=>{if(busy||!canLeave())return;forget();fill(rows.find(row=>row.id===button.dataset.draftId));}));
  }
  function canLeave(){return !dirty||confirm('当前文字尚未保存。要放弃修改并切换文章吗？');}
  async function api(path,data){
    const response=await fetch(path,{credentials:'same-origin',...(data?{method:'POST',headers:{'Content-Type':'application/json','X-Footprints-Editor':'1'},body:JSON.stringify(data)}:{})});
    let result;try{result=await response.json();}catch{throw new Error('没有收到有效的服务响应。请保留文字，稍后重试。');}
    if(!response.ok)throw new Error(result.error||'暂时无法完成操作，请稍后重试。');return result;
  }
  function lock(value){busy=value;$('#article-fields').disabled=value;['save-draft','publish-article','preview-article','new-article','unpublish-article','delete-draft','recover-writing','discard-recovery'].forEach(id=>$('#'+id).disabled=value);}
  async function load(){
    $('#retry-drafts').hidden=true;
    try{rows=(await api('/api/admin/posts')).posts;renderList();}
    catch(error){$('#draft-list').innerHTML='<p class="draft-empty">文章列表暂时未加载。请重试。</p>';$('#retry-drafts').hidden=false;status(error.message,true);}
  }
  function valid(publish){
    if(!$('#article-form').reportValidity())return false;
    if(publish&&!$('#article-body').value.trim()){status('写一点正文，再发布这篇文章。',true);$('#article-body').focus();return false;}return true;
  }
  async function save(publish=false){
    if(busy||!valid(publish))return;
    remember();lock(true);status(publish?'正在发布文章…':'正在保存到云端…');
    try{
      const row=await api(publish?'/api/admin/publish':'/api/admin/posts',{id:current.id,version:current.version,post:values()});
      rows=[row,...rows.filter(r=>r.id!==row.id)];if(publish){scope='published';setScope();}
      fill(row);forget();status(publish?'已发布。首页、搜索和归档已经更新。':'草稿已保存到云端。'+(row.published?'公开文章保持原来的内容，准备好后点击“更新发布”。':''));
    }catch(error){status(error.message+' 当前文字已保留，请勿关闭页面。',true);}finally{lock(false);}
  }
  function setScope(){
    $$('[data-draft-scope]').forEach(button=>{const selected=button.dataset.draftScope===scope;button.classList.toggle('selected',selected);button.setAttribute('aria-pressed',String(selected));});renderList();
  }
  function changed(){dirty=true;count();const backedUp=remember();status(backedUp?'有未保存的修改。文字已在当前浏览器备份，点击“保存草稿”同步到云端。':'文字尚未保存；浏览器未允许本地备份，请及时保存草稿。',!backedUp);}
  $('#article-form').addEventListener('submit',e=>{e.preventDefault();save();});$('#article-form').addEventListener('input',changed);$('#article-form').addEventListener('change',changed);
  $('#new-article').addEventListener('click',()=>{if(busy||!canLeave())return;forget();scope='draft';setScope();fresh();$('#article-title').focus();});
  $('#retry-drafts').addEventListener('click',load);$$('[data-draft-scope]').forEach(button=>button.addEventListener('click',()=>{scope=button.dataset.draftScope;setScope();}));
  $('#save-draft').addEventListener('click',()=>save(false));$('#publish-article').addEventListener('click',()=>save(true));
  $('#preview-article').addEventListener('click',async()=>{
    if(busy||!valid(false))return;lock(true);status('正在生成阅读预览…');
    try{
      const result=await api('/api/admin/preview',{post:values()}),base='<base href="'+escape(location.origin+'/')+'">',theme=document.documentElement.dataset.theme||'light';
      $('#article-preview').srcdoc=result.html.replace('<head>','<head>'+base).replace('<html lang="zh-CN">','<html lang="zh-CN" data-theme="'+theme+'">');
      $('#preview-dialog').showModal();status('预览已生成，文章尚未发布。');
    }catch(error){status(error.message,true);}finally{lock(false);}
  });
  $('#close-preview').addEventListener('click',()=>$('#preview-dialog').close());$('#preview-dialog').addEventListener('click',e=>{if(e.target===$('#preview-dialog'))$('#preview-dialog').close();});
  $('#export-writing').addEventListener('click',()=>{
    const post=values(),blob=new Blob([JSON.stringify({format:'footprints-writing-v1',post},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');
    link.href=url;link.download=(post.slug||'footprints-draft')+'.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);status('文字备份已导出，包含标题、正文、标签和封面设置。');
  });
  $('#unpublish-article').addEventListener('click',async()=>{
    if(busy||!confirm('取消发布后，读者将无法访问这篇文章。你的草稿会保留。继续吗？'))return;lock(true);
    try{const row=await api('/api/admin/unpublish',{id:current.id,version:current.version});rows=[row,...rows.filter(r=>r.id!==row.id)];current.version=row.version;current.published=false;scope='draft';setScope();labels();if(dirty)remember();status('已取消发布。文章仍保留在草稿中。');}
    catch(error){status(error.message,true);}finally{lock(false);}
  });
  $('#delete-draft').addEventListener('click',async()=>{
    if(busy||!confirm('确定删除这篇云端草稿吗？可以先导出文字备份。'))return;lock(true);
    try{await api('/api/admin/delete',{id:current.id,version:current.version});rows=rows.filter(r=>r.id!==current.id);forget();fresh();status('草稿已删除。');}
    catch(error){status(error.message,true);}finally{lock(false);}
  });
  $$('[data-format]').forEach(button=>button.addEventListener('click',()=>{
    const input=$('#article-body'),start=input.selectionStart,end=input.selectionEnd,selection=input.value.slice(start,end);
    const formats={heading:'\n\n## '+(selection||'小标题')+'\n\n',bold:'**'+(selection||'重点文字')+'**',quote:'\n\n> '+(selection||'引用文字')+'\n\n',list:'\n\n- '+(selection||'第一项')+'\n- 第二项\n\n',code:'\n\n```\n'+(selection||'在这里写代码')+'\n```\n\n'};
    input.setRangeText(formats[button.dataset.format],start,end,'end');input.focus();changed();
  }));
  $('#recover-writing').addEventListener('click',()=>{if(busy||!recovery||!canLeave())return;fill(recovery);dirty=true;$('#recovery-banner').hidden=true;status('已恢复本地文字。请保存到云端；若版本冲突，先导出备份。');});$('#discard-recovery').addEventListener('click',forget);
  document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();save(false);}});
  addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
  fresh();try{const backup=JSON.parse(localStorage.getItem(backupKey)||'null');if(backup?.id&&Number.isInteger(backup.version)&&typeof backup.post?.markdown==='string'&&typeof backup.post?.title==='string'){recovery=backup;$('#recovery-banner').hidden=false;}}catch{}
  load();
})();
