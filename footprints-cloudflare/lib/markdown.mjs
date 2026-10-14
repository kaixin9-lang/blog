import MarkdownIt from 'markdown-it';
const escape = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const md = new MarkdownIt({ html:false, breaks:true, linkify:false });
md.renderer.rules.fence = (tokens, i) => '<div class="code-block"><button class="code-copy" data-copy-code aria-label="复制代码">复制</button><pre><code>' + escape(tokens[i].content) + '</code></pre></div>';
md.renderer.rules.image = (tokens,i) => {
  const token=tokens[i];
  return '<img src="'+escape(token.attrGet('src'))+'" alt="'+escape(token.content)+'" loading="lazy" decoding="async">';
};
export function renderMarkdown(source) {
  const tokens=md.parse(String(source),{}), toc=[];
  for(const token of tokens)if((token.type==='heading_open'||token.type==='heading_close')&&token.tag==='h1')token.tag='h2';
  for(let i=0;i<tokens.length;i++) if(tokens[i].type==='heading_open') {
    const id='heading-'+(toc.length+1);
    tokens[i].attrSet('id',id);
    toc.push({id,title:tokens[i+1]?.content??''});
  }
  return {html:md.renderer.render(tokens,md.options,{}),toc,text:tokens.filter(t=>['inline','fence','code_block'].includes(t.type)).map(t=>t.content).join(' ')};
}
