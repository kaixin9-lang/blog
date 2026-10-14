(() => {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  const store = {
    get(key) { try { return localStorage.getItem(key); } catch { return null; } },
    set(key, value) { try { localStorage.setItem(key, value); return true; } catch { return false; } }
  };
  const escape = (text) => String(text).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const arrow = '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12h15m-6-6 6 6-6 6"/></svg>';
  let toastTimer;
  function toast(message) {
    const el = $('#toast'); el.textContent = message; el.classList.add('visible');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('visible'), 2600);
  }
  function themeState() {
    const dark = document.documentElement.dataset.theme === 'dark';
    const button = $('.theme-toggle');
    button.setAttribute('aria-pressed', String(dark));
    button.setAttribute('aria-label', dark ? '切换浅色模式' : '切换深色模式');
    button.title = dark ? '切换浅色模式' : '切换深色模式';
  }
  themeState();
  $('.theme-toggle')?.addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    store.set('footprints-theme', next); themeState();
  });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', event => {
    if (!store.get('footprints-theme')) { document.documentElement.dataset.theme = event.matches ? 'dark' : 'light'; themeState(); }
  });
  const menu = $('.menu-toggle');
  const mobileNav = $('#mobile-nav');
  menu?.addEventListener('click', () => {
    const open = menu.getAttribute('aria-expanded') !== 'true';
    mobileNav.hidden = !open; menu.setAttribute('aria-expanded', String(open)); menu.setAttribute('aria-label', open ? '收起导航' : '展开导航');
  });
  $$('#mobile-nav a').forEach(a => a.addEventListener('click', () => { mobileNav.hidden = true; menu.setAttribute('aria-expanded','false'); menu.setAttribute('aria-label','展开导航'); }));
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && menu?.getAttribute('aria-expanded') === 'true') { mobileNav.hidden = true; menu.setAttribute('aria-expanded','false'); menu.setAttribute('aria-label','展开导航'); menu.focus(); }
  });

  let saved;
  try { const data = JSON.parse(store.get('footprints-saved') || '[]'); saved = new Set(Array.isArray(data) ? data.filter(x => typeof x === 'string') : []); } catch { saved = new Set(); }
  function syncBookmarks() {
    $$('[data-bookmark]').forEach(button => {
      const active = saved.has(button.dataset.bookmark);
      button.dataset.originalLabel ||= button.getAttribute('aria-label');
      button.classList.toggle('is-saved', active);
      button.setAttribute('aria-pressed', String(active));
      button.setAttribute('aria-label', active ? button.dataset.originalLabel.replace('收藏', '取消收藏') : button.dataset.originalLabel);
      const label = button.querySelector('span');
      if (label) label.textContent = active ? '已收藏' : '收藏';
      button.title = active ? '取消收藏' : '收藏这篇文章';
    });
  }
  syncBookmarks();
  $$('[data-bookmark]').forEach(button => button.addEventListener('click', () => {
    const slug = button.dataset.bookmark;
    const wasSaved = saved.has(slug);
    if (wasSaved) saved.delete(slug); else saved.add(slug);
    const stored = store.set('footprints-saved', JSON.stringify(Array.from(saved)));
    syncBookmarks(); toast(stored ? (wasSaved ? '已取消收藏' : '已收藏，可以在搜索中查看') : '本次收藏已更新，浏览器未允许保存');
  }));

  const cards = $$('#post-list .post-card');
  let category = 'all';
  let expanded = false;
  function filter(updateUrl = false) {
    const matching = cards.filter(card => category === 'all' || card.dataset.category === category);
    cards.forEach(card => { card.hidden = !matching.includes(card) || (!expanded && matching.indexOf(card) >= 6); });
    $$('[data-filter]').forEach(button => { const active = button.dataset.filter === category; button.classList.toggle('selected', active); button.setAttribute('aria-pressed', String(active)); });
    if ($('#filter-caption')) $('#filter-caption').textContent = matching.length + ' 篇记录';
    const more = $('#load-more');
    if (more) {
      more.hidden = expanded || matching.length <= 6;
      if (matching.length > 6) more.innerHTML = '再看 ' + (matching.length - 6) + ' 篇 ' + arrow;
    }
    if ($('#list-end')) $('#list-end').hidden = !expanded && matching.length > 6;
    if (updateUrl) {
      const url = new URL(location.href);
      if (category === 'all') url.searchParams.delete('category'); else url.searchParams.set('category',category);
      history.replaceState(null,'',url);
    }
  }
  if (cards.length) {
    const requested = new URLSearchParams(location.search).get('category');
    category = ['life','tech'].includes(requested) ? requested : 'all';
    filter();
    $$('[data-filter]').forEach(button => button.addEventListener('click', () => { category = button.dataset.filter; expanded = false; filter(true); }));
    $('#load-more')?.addEventListener('click', () => { expanded = true; filter(); cards[6]?.querySelector('h3 a')?.focus({preventScroll:true}); });
    addEventListener('popstate', () => { const requested = new URLSearchParams(location.search).get('category'); category = ['life','tech'].includes(requested) ? requested : 'all'; expanded = false; filter(); });
  }

  const dialog = $('#search-dialog');
  const input = $('#search-input');
  let scope = 'all';
  let selected = -1;
  let postPromise;
  async function loadPosts() {
    if (!postPromise) {
      postPromise = fetch('/posts.json').then(response => {
        if (!response.ok) throw new Error('Index unavailable');
        return response.json();
      }).then(posts => { if (!Array.isArray(posts)) throw new Error('Index invalid'); return posts; }).catch(error => { postPromise = null; throw error; });
    }
    return postPromise;
  }
  function resultFocus(index) {
    const results = $$('.search-result');
    if (!results.length) return;
    selected = (index + results.length) % results.length;
    results.forEach((result, i) => result.classList.toggle('focused',i === selected));
    results[selected].scrollIntoView({block:'nearest'});
  }
  async function renderSearch() {
    $('#search-status').textContent = '正在寻找文字…';
    try {
      const posts = await loadPosts();
      const query = input.value.trim().toLocaleLowerCase();
      const matches = posts.filter(p => {
        const searchable = [p.title,p.excerpt,p.categoryLabel,...p.tags,p.text].join(' ').toLocaleLowerCase();
        return (scope !== 'saved' || saved.has(p.slug)) && query.split(/\s+/).every(word => searchable.includes(word));
      });
      selected = -1;
      $('#search-status').textContent = (query ? '找到 ' : (scope === 'saved' ? '已收藏 ' : '共有 ')) + matches.length + ' 篇文章';
      $('#search-results').innerHTML = matches.length ? matches.map(p => '<a class="search-result" href="/posts/' + encodeURIComponent(p.slug) + '/"><div><strong>' + escape(p.title) + '</strong><span>' + escape(p.categoryLabel) + ' · ' + escape(p.date.replaceAll('-','.')) + '</span></div>' + arrow + '</a>').join('') :
        '<div class="search-empty"><strong>' + (scope === 'saved' && !query ? '把喜欢的文字，留在这里。' : '还没有找到这段文字。') + '</strong>' + (scope === 'saved' && !query ? '点击文章旁的书签，就能在这里再次读到。' : '试试“生活”“CSS”或“Git”，也可以换一个关键词。') + '</div>';
    } catch {
      $('#search-results').innerHTML = '';
      $('#search-status').innerHTML = '文章索引暂时未加载。<button id="retry-search">重试</button> 或 <a href="/archive/">查看文章归档</a>';
      $('#retry-search')?.addEventListener('click', renderSearch);
    }
  }
  function openSearch(query = '', nextScope = 'all') {
    input.value = query; scope = nextScope;
    $$('[data-search-scope]').forEach(button => { const active = button.dataset.searchScope === scope; button.classList.toggle('selected',active); button.setAttribute('aria-pressed',String(active)); });
    if (!dialog.open) dialog.showModal();
    document.body.classList.add('modal-open'); input.focus(); renderSearch();
  }
  $$('[data-open-search]').forEach(button => button.addEventListener('click', () => openSearch()));
  $('[data-close-search]')?.addEventListener('click', () => dialog.close());
  dialog?.addEventListener('close', () => document.body.classList.remove('modal-open'));
  dialog?.addEventListener('click', e => { if (e.target === dialog) dialog.close(); });
  input?.addEventListener('input',renderSearch);
  $$('[data-search-scope]').forEach(button => button.addEventListener('click', () => {
    scope = button.dataset.searchScope;
    $$('[data-search-scope]').forEach(b => { const active = b === button; b.classList.toggle('selected',active); b.setAttribute('aria-pressed',String(active)); });
    renderSearch();
  }));
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); if(dialog.open) input.focus(); else openSearch(); }
    if (!dialog.open || e.isComposing) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); resultFocus(selected + (e.key === 'ArrowDown' ? 1 : -1)); }
    if (e.key === 'Enter' && document.activeElement === input) { const results = $$('.search-result'); const link = results[Math.max(selected,0)]; if(link) { e.preventDefault(); location.assign(link.href); } }
  });
  $$('[data-search-tag]').forEach(button => button.addEventListener('click',() => openSearch(button.dataset.searchTag)));

  $('[data-share]')?.addEventListener('click',async () => {
    const url = location.origin + location.pathname;
    try { await navigator.clipboard.writeText(url); toast('文章链接已复制'); }
    catch {
      const fallback = $('#copy-dialog'); $('#copy-url').value = url; fallback.showModal(); $('#copy-url').select();
      document.body.classList.add('modal-open');
    }
  });
  $('[data-close-copy]')?.addEventListener('click', () => $('#copy-dialog').close());
  $('#copy-dialog')?.addEventListener('close', () => document.body.classList.remove('modal-open'));
  $$('[data-copy-code]').forEach(button => button.addEventListener('click',async () => {
    const code = button.parentElement.querySelector('code');
    try { await navigator.clipboard.writeText(code.textContent); button.textContent = '已复制'; toast('代码已复制'); setTimeout(() => button.textContent = '复制',2000); }
    catch { const range = document.createRange(); range.selectNodeContents(code); const selection = getSelection(); selection.removeAllRanges(); selection.addRange(range); toast('已选中代码，请手动复制'); }
  }));
  const progress = $('.reading-progress>span');
  if (progress) {
    const update = () => { const range = document.documentElement.scrollHeight - innerHeight; progress.style.width = Math.max(0,Math.min(100,range > 0 ? scrollY/range*100 : 100)) + '%'; };
    addEventListener('scroll',update,{passive:true}); addEventListener('resize',update); update();
  }
  const sections = $$('.article-content section, .article-content > h2[id], .article-content > h3[id]');
  if (sections.length && 'IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) if(entry.isIntersecting) $$('.article-toc nav a').forEach(a => a.classList.toggle('active',a.hash === '#'+entry.target.id));
    },{rootMargin:'-100px 0px -55% 0px'});
    sections.forEach(s => observer.observe(s));
  }
})();
