import { renderMarkdown } from './markdown.mjs';
export function createRenderer(posts, site) {
const labels = { life: '生活随笔', tech: '技术手记' };
const e = (s) => String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const paths = {
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/>',
  moon: '<path d="M20 14a8.5 8.5 0 0 1-10-10 8.5 8.5 0 1 0 10 10Z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
  arrow: '<path d="M4 12h15m-6-6 6 6-6 6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  bookmark: '<path d="M6 4h12v17l-6-4-6 4Z"/>',
  leaf: '<path d="M19 3c-9 0-15 3-15 10a6 6 0 0 0 6 6c7 0 10-7 9-16Z"/><path d="m3 21 11-11"/>',
  code: '<path d="m7 6-6 6 6 6m10-12 6 6-6 6m-3-15-4 18"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  rss: '<circle cx="5" cy="19" r="1"/><path d="M4 11a9 9 0 0 1 9 9M4 4a16 16 0 0 1 16 16"/>',
  up: '<path d="M12 20V4m-6 6 6-6 6 6"/>',
  share: '<path d="M12 16V3m-5 5 5-5 5 5M5 13v7h14v-7"/>',
  flower: '<path d="M12 10C3-2-4 12 9 12-2 19 11 28 12 15c4 13 16 4 3-3 13-1 5-15-3-2Z"/>',
  check: '<path d="m5 12 4 4L19 6"/>'
};
const icon = (name, cls = '') => '<svg class="icon ' + cls + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (paths[name] || '') + '</svg>';
const date = (d) => d.replaceAll('-', '.');
const text = (p) => p.markdown !== undefined ? renderMarkdown(p.markdown).text : p.sections.map(s => [s.title, ...s.paragraphs, s.code || ''].join(' ')).join(' ');
const minutes = (p) => Math.max(2, Math.ceil(text(p).replace(/\s/g, '').length / 300));
const href = (p) => '/posts/' + p.slug + '/';
const count = (c) => posts.filter(p => p.category === c).length;
const badge = (p) => '<span class="category-badge ' + p.category + '">' + labels[p.category] + '</span>';
const avatar = (cls = '') => '<span class="avatar ' + cls + '" aria-label="vi 的头像">vi<span class="avatar-sprout">' + icon('leaf') + '</span></span>';

function card(p, hidden = false) {
  return '<article class="post-card" data-category="' + p.category + '" data-slug="' + p.slug + '"' + (hidden ? ' hidden' : '') + '>' +
    '<a class="card-photo" href="' + href(p) + '" tabindex="-1" aria-hidden="true"><img src="/assets/' + p.image + '" alt="" width="900" height="600" loading="lazy" decoding="async"></a>' +
    '<div class="card-body"><div class="card-meta">' + badge(p) + '<time datetime="' + p.date + '">' + date(p.date) + '</time></div>' +
    '<h3><a href="' + href(p) + '">' + e(p.title) + '</a></h3><p>' + e(p.excerpt) + '</p>' +
    '<div class="card-bottom"><span>' + icon('clock') + minutes(p) + ' 分钟阅读' + (p.demo ? '<span class="demo-label">示例</span>' : '') + '</span><button class="icon-button bookmark-button" data-bookmark="' + p.slug + '" aria-label="收藏：' + e(p.title) + '" aria-pressed="false">' + icon('bookmark') + '</button></div></div></article>';
}

function header(active) {
  const nav = [['home', '/', '首页'], ['posts', '/#journal', '文章'], ['archive', '/archive/', '归档'], ['about', '/about/', '关于'], ['write', '/write/', '写作']];
  return '<a class="skip-link" href="#main">跳到正文</a><header class="site-header" id="top"><div class="container header-inner">' +
    '<a class="brand" href="/" aria-label="Footprints 首页"><img src="/assets/favicon.svg" alt="" width="38" height="38"><span>Footprints<small>vi 的生活与技术</small></span></a>' +
    '<nav class="desktop-nav" aria-label="主导航">' + nav.map(([id, url, label]) => '<a href="' + url + '"' + (id === active ? ' class="active" aria-current="page"' : '') + '>' + label + '</a>').join('') + '</nav>' +
    '<div class="header-actions"><button class="icon-button" data-open-search aria-label="搜索文章" title="搜索文章（Ctrl / ⌘ K）">' + icon('search') + '</button><span class="action-divider"></span><button class="icon-button theme-toggle" aria-label="切换深色模式" aria-pressed="false" title="切换主题">' + icon('moon', 'moon-icon') + icon('sun', 'sun-icon') + '</button><button class="icon-button menu-toggle" aria-label="展开导航" aria-controls="mobile-nav" aria-expanded="false">' + icon('menu') + '</button></div></div>' +
    '<nav id="mobile-nav" class="mobile-nav" aria-label="手机导航" hidden>' + nav.map(([, url, label]) => '<a href="' + url + '">' + label + '</a>').join('') + '</nav></header>';
}

function footer() {
  return '<footer class="site-footer"><div class="container footer-inner"><div><a class="footer-brand" href="/">Footprints<span class="tiny-leaf">' + icon('leaf') + '</span></a><p>一步一页，记录来时的路。</p></div><div class="footer-right"><div><a href="/feed.xml" target="_blank" rel="noopener">' + icon('rss') + 'RSS 订阅</a><a href="#top">' + icon('up') + '返回顶部</a></div><span>© 2026 vi · 每一个足迹，都值得留下</span></div></div></footer>' +
    '<dialog id="search-dialog" aria-labelledby="search-title"><div class="search-top"><h2 id="search-title">寻找一段文字</h2><button class="icon-button" data-close-search aria-label="关闭搜索">' + icon('close') + '</button></div>' +
    '<div class="search-field">' + icon('search') + '<input id="search-input" type="search" placeholder="搜索标题、内容或标签…" aria-label="搜索关键词" autocomplete="off"><kbd>Esc</kbd></div>' +
    '<div class="search-tabs" role="group" aria-label="搜索范围"><button class="selected" data-search-scope="all" aria-pressed="true">全部文章</button><button data-search-scope="saved" aria-pressed="false">' + icon('bookmark') + '我的收藏</button></div>' +
    '<p id="search-status" class="search-status" aria-live="polite"></p><div id="search-results"></div><div class="search-footer">输入关键词，让记忆有迹可循。<span>↑ ↓ 选择 · Enter 阅读</span></div></dialog>' +
    '<dialog id="copy-dialog" aria-labelledby="copy-title"><h2 id="copy-title">复制文章链接</h2><p>复制下面的地址，就可以分享这篇文章。</p><input id="copy-url" readonly aria-label="文章地址"><button class="primary-button" data-close-copy>完成</button></dialog><div id="toast" role="status" aria-live="polite"></div>';
}

function shell({ title, description = site.description, url = '/', active = 'home', content, image = '/assets/lake.jpg', article = null }) {
  const canonical = site.origin + url;
  const schema = article ? { '@context':'https://schema.org', '@type':'BlogPosting', headline:article.title, description:article.excerpt, datePublished:article.date, author:{ '@type':'Person', name:site.author }, image:site.origin + '/assets/' + article.image, mainEntityOfPage:canonical } : { '@context':'https://schema.org', '@type':'Blog', name:site.name, description:site.description, url:site.origin, author:{ '@type':'Person', name:site.author } };
  return '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><meta name="theme-color" content="#315a46">' +
    '<title>' + e(title) + '</title><meta name="description" content="' + e(description) + '"><link rel="canonical" href="' + canonical + '"><meta property="og:type" content="' + (article ? 'article' : 'website') + '"><meta property="og:title" content="' + e(title) + '"><meta property="og:description" content="' + e(description) + '"><meta property="og:url" content="' + canonical + '"><meta property="og:image" content="' + site.origin + image + '"><meta property="og:locale" content="zh_CN"><meta name="twitter:card" content="summary_large_image">' +
    '<link rel="icon" type="image/svg+xml" href="/assets/favicon.svg"><link rel="alternate" type="application/rss+xml" title="Footprints RSS" href="/feed.xml"><link rel="stylesheet" href="/style.css">' +
    '<script>try{var t=localStorage.getItem("footprints-theme");document.documentElement.dataset.theme=t==="light"||t==="dark"?t:matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}catch(e){document.documentElement.dataset.theme=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}</script>' +
    '<script type="application/ld+json">' + JSON.stringify(schema).replaceAll('<', '\\u003c') + '</script><script src="/app.js" defer></script></head><body>' +
    header(active) + '<main id="main" tabindex="-1">' + content + '</main>' + footer() +
    '<noscript><style>.post-card[hidden]{display:block!important}.filter-tabs,.load-more,.header-actions,.bookmark-button,.article-tools{display:none}</style></noscript></body></html>';
}

function sidebar() {
  return '<aside class="home-sidebar" aria-label="博客介绍"><section class="profile-card"><div class="profile-top">' + avatar() + '<span class="hello-note">Hello, friend.</span></div><h3>你好，我是 vi<span class="small-dot">.</span></h3><p>记录生活里的小事，<br>也记录和技术打交道的日子。<br>很高兴，在这里遇见你。</p><a class="text-link" href="/about/">多了解一点 ' + icon('arrow') + '</a><div class="profile-deco">' + icon('leaf') + '</div></section>' +
    '<section class="topic-list"><h3>写些什么</h3><a href="/?category=life#journal"><span>' + icon('leaf') + '生活随笔</span><span>' + count('life') + ' 篇</span></a><a href="/?category=tech#journal"><span>' + icon('code') + '技术手记</span><span>' + count('tech') + ' 篇</span></a></section>' +
    '<div class="sidebar-note"><span class="quote-mark">“</span><p>生活不是赶路，<br>而是感受路。</p><span>留给自己的一句话</span></div><a class="rss-card" href="/feed.xml" target="_blank" rel="noopener"><span>' + icon('rss') + '</span><div><strong>用 RSS 保持相遇</strong><small>更新时，再来读一读。</small></div>' + icon('arrow') + '</a></aside>';
}

function home() {
  return '<section class="hero"><div class="container hero-inner"><div class="hero-copy"><div class="hero-greeting"><span></span>一个记录生活与技术的小角落</div><h1>生活留下足迹，<br>思考自有回声。</h1><p>收集日常里的微光，记下探索中的灵感。<br>走过的路，想过的事，都在这里慢慢成文。</p><div class="hero-buttons"><a class="primary-button" href="#journal">读一读最近的文章 ' + icon('arrow') + '</a><a class="secondary-link" href="/about/">关于我</a></div><div class="hero-signoff">' + icon('leaf') + '<span>认真生活，保持好奇。</span><span class="signature">vi</span></div></div>' +
    '<figure class="postcard"><div class="postcard-image"><img src="/assets/lake.jpg" alt="青绿的湖水倒映着树林与连绵的山峰" width="1200" height="800" fetchpriority="high"></div><figcaption><span>走过的路，都算数。</span><span>Footprints, by vi</span></figcaption><div class="postcard-tape"></div></figure></div></section>' +
    '<section class="container journal-section" id="journal" aria-labelledby="journal-title"><div class="section-header"><div><h2 id="journal-title">' + icon('flower') + '最近的文字</h2><p>一些生活的片刻，一些技术的思考。</p></div><a class="text-link archive-link" href="/archive/">翻阅所有足迹 ' + icon('arrow') + '</a></div><div class="journal-layout"><div class="journal-main"><div class="filter-tabs" role="group" aria-label="文章分类"><button data-filter="all" aria-pressed="true" class="selected">全部<span>' + posts.length + '</span></button><button data-filter="life" aria-pressed="false">生活随笔</button><button data-filter="tech" aria-pressed="false">技术手记</button><span class="filter-caption" id="filter-caption">' + posts.length + ' 篇记录</span></div>' +
    '<div class="posts-grid" id="post-list" aria-live="polite">' + posts.map((p, i) => card(p, i >= 6)).join('') + '</div><div class="more-wrap"><button class="load-more" id="load-more">再看两篇 ' + icon('arrow') + '</button><p id="list-end" hidden>暂时就这些，下一个足迹正在路上。</p></div></div>' + sidebar() + '</div></section>' +
    '<section class="container closing-note"><span>' + icon('leaf') + '</span><p>不用走得很快，<br class="mobile-break">也能留下自己的足迹。</p><small>感谢你，读到这里。</small></section>';
}

function archive() {
  const groups = Map.groupBy(posts, p => p.date.slice(0, 7));
  return '<div class="container inner-page"><div class="page-heading"><span class="page-kicker">' + icon('clock') + '时间里的足迹</span><h1>文章归档</h1><p>把走过的日子，按时间慢慢收藏。这里共有 ' + posts.length + ' 篇文章。</p></div><div class="archive-layout"><div class="timeline">' +
    Array.from(groups, ([month, entries]) => '<section class="archive-month"><h2>' + Number(month.slice(5)) + ' 月 <span>' + month.slice(0, 4) + '</span><small>' + entries.length + ' 篇</small></h2>' + entries.map(p => '<a class="archive-row" href="' + href(p) + '"><time datetime="' + p.date + '">' + p.date.slice(5).replace('-', '.') + '</time><div><h3>' + e(p.title) + '</h3><span>' + labels[p.category] + (p.demo ? ' · 示例文章' : '') + '</span></div>' + icon('arrow') + '</a>').join('') + '</section>').join('') +
    '</div>' + sidebar() + '</div></div>';
}

function about() {
  return '<div class="container inner-page about-page"><div class="about-intro"><div class="about-copy"><span class="page-kicker">' + icon('leaf') + '关于这个小角落</span>' + avatar('large-avatar') + '<h1>你好，我是 vi。</h1><p class="about-lead">生活里做一个观察者，<br>技术里做一个探索者。</p><p>这里是 <strong>Footprints</strong>，中文是“足迹”。<br>我想用它留住生活的片刻，也记录探索技术时的想法。</p><p>有些文字写给未来的自己，<br>如果也刚好被你读到，那就是一次美好的相遇。</p><a class="primary-button" href="/#journal">从一篇文章开始 ' + icon('arrow') + '</a></div><figure class="about-photo"><img src="/assets/forest.jpg" alt="一条走向林间的小路" width="900" height="600"><figcaption>每一步，都有自己的风景。</figcaption></figure></div>' +
    '<div class="about-topics"><section><span class="about-topic-icon">' + icon('leaf') + '</span><h2>关于生活</h2><p>留意那些普通的日子。写散步时的风、阅读时的一句话，以及生活里值得记住的小事。</p><a class="text-link" href="/?category=life#journal">读生活随笔 ' + icon('arrow') + '</a></section><section><span class="about-topic-icon">' + icon('code') + '</span><h2>关于技术</h2><p>记录一个问题如何被解决，一个想法如何被做出来。把学到的东西讲清楚，也给下一次探索留个路标。</p><a class="text-link" href="/?category=tech#journal">读技术手记 ' + icon('arrow') + '</a></section></div>' +
    '<div class="about-footnote"><p>这个博客的初始文章为示例内容，已在文章中标注。新的足迹，会慢慢写下。</p><p>摄影来自 <a href="https://unsplash.com/" target="_blank" rel="noopener">Unsplash</a>，具体摄影师与图片来源记录在项目说明中。</p></div></div>';
}

function article(p) {
  const md = p.markdown !== undefined ? renderMarkdown(p.markdown) : null;
  const toc = md ? md.toc : p.sections.map((s,i) => ({id:'section-' + (i+1),title:s.title}));
  const related = posts.filter(q => q.category === p.category && q.slug !== p.slug).slice(0, 2);
  return '<div class="reading-progress" aria-hidden="true"><span></span></div><div class="container article-page"><a class="back-link" href="/#journal">‹ 返回文章列表</a><header class="article-heading"><div class="article-meta">' + badge(p) + '<time datetime="' + p.date + '">' + date(p.date) + '</time><span>' + icon('clock') + minutes(p) + ' 分钟阅读</span></div><h1>' + e(p.title) + '</h1><p>' + e(p.excerpt) + '</p><div class="article-byline">' + avatar('mini-avatar') + '<span>vi</span><span class="byline-caption">把足迹，写成文字。</span><div class="article-tools"><button class="small-button" data-bookmark="' + p.slug + '" aria-label="收藏文章" aria-pressed="false">' + icon('bookmark') + '<span>收藏</span></button><button class="small-button" data-share>' + icon('share') + '分享</button></div></div></header>' +
    '<img class="article-cover" src="/assets/' + p.image + '" alt="' + e(p.alt) + '" width="1200" height="600" fetchpriority="high"><div class="reading-layout"><article class="article-content">' +
    (p.demo ? '<p class="demo-notice">这是一篇示例文章，用于展示博客的阅读体验。</p>' : '') +
    (md ? md.html : p.sections.map((s, i) => '<section id="section-' + (i+1) + '"><h2>' + e(s.title) + '</h2>' + s.paragraphs.map(t => '<p>' + e(t) + '</p>').join('') + (s.code ? '<div class="code-block"><button class="code-copy" data-copy-code aria-label="复制代码">复制</button><pre><code>' + e(s.code) + '</code></pre></div>' : '') + '</section>').join('')) +
    '<div class="article-tags">' + p.tags.map(tag => '<button data-search-tag="' + e(tag) + '"># ' + e(tag) + '</button>').join('') + '</div><div class="article-end">' + icon('leaf') + '<p>感谢阅读，愿你也拥有值得记录的一天。</p></div></article><aside class="article-toc"><h2>这篇文章里</h2><nav aria-label="文章目录">' + toc.map(s => '<a href="#' + s.id + '">' + e(s.title) + '</a>').join('') + '</nav><a class="toc-back" href="#top">回到开头 ' + icon('up') + '</a></aside></div>' +
    '<section class="related-posts"><h2>再留一会儿</h2><p>也许，你还会喜欢这些文字。</p><div class="posts-grid">' + related.map(p => card(p)).join('') + '</div></section></div>';
}

return { shell, home, archive, about, article, card, icon, e, text, labels, href };
}
