/* lumo.js — full file
   Lumo framework loader + parsers (cont, blocky), theme, bg, back button, ztmf interception.
   Replace your existing lumo.js with this file.
*/
(function () {
  'use strict';

  // Public registry for background classes (bg/*.js should register into this)
  window.LumoBackgrounds = window.LumoBackgrounds || {};

  // DOM anchors
  const app = document.getElementById('app');
  const statusEl = document.getElementById('lumo-status');

  // runtime registries
  let currentBgInstances = []; // {name, instance, wrapper}
  let currentComponents = []; // {name, instance, el}

  const lumoScript = document.querySelector('script[src*="lumo.js"]');
  const LumoBaseUrl = lumoScript 
    ? lumoScript.src.replace(/lumo\.js(\?.*)?$/, '') 
    : (window.LUMO_BASE_URL || './'); // Запасной вариант: текущий каталог

  // single global click handler reference so we can remove/replace reliably
  let globalZtmfClickHandler = null;

  // ---- utilities ----
  function status(msg, show = true, timeout = 2200) {
    if (!statusEl) return;
    if (!show) { statusEl.style.display = 'none'; return; }
    statusEl.textContent = msg;
    statusEl.style.display = 'block';
    clearTimeout(statusEl._t);
    statusEl._t = setTimeout(() => statusEl.style.display = 'none', timeout);
  }

  function absoluteURL(base, path) {
    try {
      return new URL(path, base).toString();
    } catch (e) { return path; }
  }

  function baseFromUrl(url) {
    try {
      const u = new URL(url, location.href);
      u.pathname = u.pathname.replace(/\/[^/]*$/, '/');
      return u.toString();
    } catch (e) { return './'; }
  }

  // ---- ZTMF parsing helpers ----
  function splitZtmf(text) {
    const metaMatch = text.match(/<meta>([\s\S]*?)<\/meta>/i);
    const bodyMatch = text.match(/<body>([\s\S]*?)<\/body>/i);
    return {
      metaRaw: metaMatch ? metaMatch[1].trim() : '',
      bodyRaw: bodyMatch ? bodyMatch[1].trim() : ''
    };
  }

  function parseMetaKVs(metaRaw) {
    const kv = {};
    const re = /([a-zA-Z0-9_-]+)\s*=\s*"([^"]*)"/g;
    let m;
    while ((m = re.exec(metaRaw)) !== null) kv[m[1]] = m[2];
    const re2 = /([a-zA-Z0-9_-]+)\s*=\s*([^\s"'\n\r]+)/g;
    while ((m = re2.exec(metaRaw)) !== null) if (!kv.hasOwnProperty(m[1])) kv[m[1]] = m[2];
    return kv;
  }

  function extractInlineStyle(metaRaw) {
    const m = metaRaw.match(/style\s*\{([\s\S]*?)\}\s*$/i) || metaRaw.match(/style\s*\{([\s\S]*?)\}/i);
    if (!m) return null;
    const content = m[1].replace(/^\s*<style[^>]*>/i, '').replace(/<\/style>\s*$/i, '');
    return content.trim();
  }

  // ---- cont parser (existing, improved) ----
  function parseContInnerOrdered(inner) {
    const tokens = [];
    let i = 0;
    while (i < inner.length) {
      if (/\s/.test(inner[i])) { i++; continue; }

      if (inner.slice(i, i + 4).toLowerCase() === '<br>') {
        tokens.push({ type: 'br' });
        i += 4;
        continue;
      }

      const blockMatch = inner.slice(i).match(/^([a-zA-Z0-9_-]+)\s*\[/);
      if (blockMatch) {
        const name = blockMatch[1];
        let depth = 0;
        let j = i + blockMatch[0].length;
        while (j < inner.length) {
          if (inner[j] === '[') depth++;
          else if (inner[j] === ']') {
            if (depth === 0) break;
            depth--;
          }
          j++;
        }
        const content = inner.slice(i + blockMatch[0].length, j).trim();
        tokens.push({ type: 'block', name, html: content });
        i = j + 1;
        if (inner[i] === ',') i++;
        continue;
      }

      // raw until next comma (best-effort)
      let nextCommaIdx = -1;
      for (let k = i; k < inner.length; k++) {
        if (inner[k] === ',') { nextCommaIdx = k; break; }
        if (inner[k] === '[') {
          let depth = 0, kk = k + 1;
          while (kk < inner.length) {
            if (inner[kk] === '[') depth++;
            else if (inner[kk] === ']') {
              if (depth === 0) { k = kk; break; }
              depth--;
            }
            kk++;
          }
        }
      }
      if (nextCommaIdx === -1) {
        tokens.push({ type: 'raw', html: inner.slice(i).trim() });
        break;
      } else {
        tokens.push({ type: 'raw', html: inner.slice(i, nextCommaIdx).trim() });
        i = nextCommaIdx + 1;
      }
    }
    return tokens;
  }

  function processBody(bodyRaw) {
    let componentsSpec = null;
    const compMatch = bodyRaw.match(/components\s*=\s*([\s\S]*)$/i);
    if (compMatch) { componentsSpec = compMatch[1].trim(); bodyRaw = bodyRaw.slice(0, compMatch.index).trim(); }

    const contRe = /cont\s*\{\s*([\s\S]*?)\s*\}/i;
    const contMatch = bodyRaw.match(contRe);

    if (contMatch) {
      const inner = contMatch[1];
      const tokens = parseContInnerOrdered(inner);

      let htmlFinal = '<div class="cont">';

      for (const t of tokens) {
        if (!t) continue;

        if (t.type === 'br') {
          htmlFinal += '<br>';
          continue;
        }

        if (t.type === 'raw') {
          htmlFinal += t.html || '';
          continue;
        }

        if (t.type === 'block') {
          const n = (t.name || '').toLowerCase();

          if (n === 'center' || n === 'left' || n === 'right') {
            htmlFinal += `<div class="cont-header-${n}">${t.html || ''}</div><br>`;
            continue;
          }

          if (n === 'grid' || n === 'column') {
            const cls = n === 'grid' ? 'cont-links cont-grid' : 'cont-links cont-column';
            htmlFinal += `<div class="${cls}">${t.html || ''}</div>`;
            continue;
          }

          htmlFinal += `<div class="${t.name}">${t.html || ''}</div>`;
        }
      }

      htmlFinal += '</div>';
      bodyRaw = bodyRaw.replace(contRe, htmlFinal);
    }

    const blockRe = /([a-zA-Z0-9_-]+)\s*\{\s*([\s\S]*?)\s*\}/g;
    let html = bodyRaw.replace(blockRe, (full, name, inner) => `<div class="${name}">${inner ? inner.trim() : ''}</div>`);

    html = `<div class="lumo-body">${html}</div>`;
    return { html, componentsSpec };
  }

  // ---- blocky parser (new) ----
  // lightweight parser that converts the blocky syntax into nested divs
  function parseBlocky(bodyRaw) {
    let componentsSpec = null;
    const compMatch = bodyRaw.match(/components\s*=\s*([\s\S]*)$/i);
    if (compMatch) { componentsSpec = compMatch[1].trim(); bodyRaw = bodyRaw.slice(0, compMatch.index).trim(); }

    // normalize some common comma issues
    let src = bodyRaw.replace(/,\s*\]/g, ']').replace(/\[\s*,/g, '[');

    const reCurly = /([a-zA-Z0-9_-]+)\s*\{\s*([\s\S]*?)\s*\}/;
    const reSquare = /([a-zA-Z0-9_-]+)\s*\[\s*([\s\S]*?)\s*\]/;

    let iter = 0;
    // iterate replacing innermost blocks; this is simple but fits the given structure
    while ((reCurly.test(src) || reSquare.test(src)) && iter < 400) {
      iter++;
      src = src.replace(reCurly, (full, name, inner) => {
        const cleaned = inner.replace(/^\s*,\s*/, '').replace(/\s*,\s*$/, '');
        return `<div class="${name}">${cleaned}</div>`;
      });
      src = src.replace(reSquare, (full, name, inner) => {
        const cleaned = inner.replace(/^\s*,\s*/, '').replace(/\s*,\s*$/, '');
        return `<div class="${name}">${cleaned}</div>`;
      });
    }

    src = src.replace(/,\s*(?=<div)/g, '');

    const html = `<div class="app"><div class="container">${src}</div></div>`;
    return { html, componentsSpec };
  }

  // ---- styles loader / inline style injector ----
  function injectInlineStyle(cssText, id = 'lumo-inline-style') {
    if (!cssText) return;
    let s = document.getElementById(id);
    if (!s) { s = document.createElement('style'); s.id = id; document.head.appendChild(s); }
    s.textContent = cssText;
  }

  function loadStylesheet(href) {
    if (!href) return;
    const abs = absoluteURL(location.href, href);
    if ([...document.styleSheets].some(ss => ss.href && ss.href === abs)) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet'; link.href = abs; document.head.appendChild(link);
  }

  function setFavicon(href) {
    if (!href) return;
    const abs = absoluteURL(location.href, href);
    let link = document.querySelector('link[rel="icon"]') || document.querySelector('link[rel="shortcut icon"]');
    if (link) link.href = abs;
    else { link = document.createElement('link'); link.rel = 'icon'; link.href = abs; document.head.appendChild(link); }
  }

  // ---- bg loader (script injection) ----
  function loadBgScriptIfNeeded(name, baseUrl) {
    return new Promise((resolve) => {
      if (!name) return resolve();
      if (window.LumoBackgrounds && window.LumoBackgrounds[name]) return resolve();
      const scriptUrl = absoluteURL(LumoBaseUrl, `./bg/${name}.js`);
      if (document.querySelector(`script[data-lumo-bg="${name}"]`)) {
        const poll = setInterval(() => { if (window.LumoBackgrounds && window.LumoBackgrounds[name]) { clearInterval(poll); resolve(); } }, 80);
        setTimeout(() => { clearInterval(poll); resolve(); }, 5000);
        return;
      }
      const s = document.createElement('script');
      s.src = scriptUrl; s.defer = true; s.setAttribute('data-lumo-bg', name);
      s.onload = () => {
        const poll = setInterval(() => { if (window.LumoBackgrounds && window.LumoBackgrounds[name]) { clearInterval(poll); resolve(); } }, 60);
        setTimeout(() => { clearInterval(poll); resolve(); }, 5000);
      };
      s.onerror = () => { console.warn('Lumo: failed to load bg script', scriptUrl); resolve(); };
      document.body.appendChild(s);
    });
  }

  // ---- Theme component ----
  class LumoTheme {
    constructor(position = 'bottom-right') {
      this.position = position || 'bottom-right';
      this.switchEl = null;
      this.themeKey = 'lumo-theme';
      this.current = localStorage.getItem(this.themeKey) || 'light';
      this._onClick = this.toggle.bind(this);
    }

    _iconFor(theme) {
      // SVG для луны (темная тема)
      const moonSVG = `
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-moon">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
        </svg>
      `;

      // SVG для солнца (светлая тема)
      const sunSVG = `
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-sun">
          <circle cx="12" cy="12" r="5"></circle>
          <line x1="12" y1="1" x2="12" y2="3"></line>
          <line x1="12" y1="21" x2="12" y2="23"></line>
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
          <line x1="1" y1="12" x2="3" y2="12"></line>
          <line x1="21" y1="12" x2="23" y2="12"></line>
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
        </svg>
      `;
      
      return theme === 'dark' ? moonSVG : sunSVG;
    }
    
    _titleFor(theme) { return theme === 'dark' ? 'Тёмная тема' : 'Светлая тема'; }

    mount() {
      const btn = document.createElement('button');
      btn.className = 'lumo-theme-switch';
      btn.setAttribute('aria-label', 'Toggle theme');
      // Использование innerHTML для вставки SVG
      btn.innerHTML = this._iconFor(this.current); 
      btn.title = this._titleFor(this.current);

      const posClass = `lumo-theme-pos-${this.position.replace(/\s+/g,'-').toLowerCase()}`;
      btn.classList.add(posClass);

      document.body.appendChild(btn);
      this.switchEl = btn;
      this.applyTheme(this.current);
      btn.addEventListener('click', this._onClick);
    }

    toggle() {
      this.current = this.current === 'light' ? 'dark' : 'light';
      this.applyTheme(this.current);
      if (this.switchEl) {
        // Использование innerHTML для вставки SVG
        this.switchEl.innerHTML = this._iconFor(this.current); 
        this.switchEl.title = this._titleFor(this.current);
      }
      localStorage.setItem(this.themeKey, this.current);
    }

    applyTheme(theme) {
      document.body.dataset.theme = theme;
      document.body.classList.toggle('dark-mode', theme === 'dark');
      if (theme === 'light') {
        document.documentElement.style.setProperty('--bg-color', '#ffffff');
        document.documentElement.style.setProperty('--text-color', 'rgba(18,18,18,1)');
        document.documentElement.style.setProperty('--header-color', 'rgba(133, 133, 133, 1)');
      } else {
        document.documentElement.style.setProperty('--bg-color', 'rgba(18,18,18,1)');
        document.documentElement.style.setProperty('--text-color', 'rgba(230, 230, 230, 1)');
        document.documentElement.style.setProperty('--header-color', 'rgba(230, 230, 230, 1)');
      }
      document.documentElement.classList.toggle('lumo-dark', theme === 'dark');
    }

    destroy() {
      if (this.switchEl) {
        this.switchEl.removeEventListener('click', this._onClick);
        if (this.switchEl.parentNode) this.switchEl.parentNode.removeChild(this.switchEl);
        this.switchEl = null;
      }
      return Promise.resolve();
    }
  }

  // ---- lifecycle cleanup ----
  async function destroyAllBackgroundInstances() {
    for (const it of currentBgInstances) {
      try { if (it.instance && typeof it.instance.destroy === 'function') await it.instance.destroy(); } catch (e) { console.warn(e); }
      try { if (it.wrapper && it.wrapper.parentNode) it.wrapper.parentNode.removeChild(it.wrapper); } catch (e) {}
    }
    currentBgInstances = [];
    // destroy components
    for (const c of currentComponents) {
      try { if (c.instance && typeof c.instance.destroy === 'function') await c.instance.destroy(); }
      catch (e) { console.warn('component destroy err', e); }
      try { if (c.el && c.el.parentNode) c.el.parentNode.removeChild(c.el); } catch (e) {}
    }
    currentComponents = [];
  }

  // ---- components spec parser ----
  function parseComponentsSpec(spec) {
    if (!spec) return [];
    const parts = [];
    let depth = 0, cur = '', i = 0;
    while (i < spec.length) {
      const ch = spec[i];
      if (ch === '{') { depth++; cur += ch; }
      else if (ch === '}') { depth--; cur += ch; }
      else if (ch === ',' && depth === 0) { parts.push(cur.trim()); cur = ''; }
      else cur += ch;
      i++;
    }
    if (cur.trim()) parts.push(cur.trim());
    return parts.map(p => {
      const m = p.match(/^([a-zA-Z0-9_-]+)\s*(\{([\s\S]*)\})?$/i);
      if (!m) return null;
      return { name: m[1], inner: m[3] ? m[3].trim() : null };
    }).filter(Boolean);
  }

  // ---- render parsed ztmf content and initialize components ----
  async function renderParsed({ meta, inlineStyle, html, componentsSpec }, baseUrl) {
    // meta.type handling
    if (meta.type) {
      const t = String(meta.type).toLowerCase();
      if (t === 'html') {
        const redirect = meta.href || meta.url || meta.link;
        if (redirect) {
          const dest = absoluteURL(baseUrl, redirect);
          window.location.href = dest;
          return;
        } else {
          console.warn('Lumo: meta.type=html but no href/url/link provided');
        }
      }
      // 'main' and 'blocky' handled by parsing earlier
    }

    if (meta.title) document.title = meta.title;
    if (meta.icon) setFavicon(absoluteURL(baseUrl, meta.icon));
    if (meta.style) meta.style.split(',').map(s => s.trim()).forEach(s => loadStylesheet(absoluteURL(baseUrl, s)));
    if (inlineStyle) injectInlineStyle(inlineStyle);
    if (meta.rmb_menu !== undefined) {
      const val = String(meta.rmb_menu).toLowerCase();
      const shouldDisable = (val === 'false' || val === '0' || val === 'no' || val === 'off');
      if (shouldDisable) installDisableContextMenu();
    }

    // render html into app
    if (!app) {
      console.warn('Lumo: #app container not found, abort renderParsed');
      return;
    }
    app.innerHTML = html;

    // parse components and initialize them
    const components = parseComponentsSpec(componentsSpec || '');
    await destroyAllBackgroundInstances();

    for (const comp of components) {
      if (!comp) continue;

      // BACK button component
      if (comp.name === 'back') {
        const raw = (comp.inner || '').trim();
        const parts = raw.split(',').map(s => s.trim()).filter(Boolean);
        const pos = parts[0] || 'bottom-right';
        const target = parts[1] || 'index.ztmf';

        const btn = document.createElement('button');
        btn.className = 'lumo-back-button';
        btn.setAttribute('aria-label', 'Back');
        btn.textContent = '❮';
        btn.style.color = 'var(--text-color)';
        btn.title = 'Назад';

        const posClass = `lumo-theme-pos-${pos.replace(/\s+/g, '-').toLowerCase()}`;
        btn.classList.add(posClass);

        // shift left if placed on right (approx)
        const offsetPx = 70;
        const p = pos.toLowerCase();
        if (p.endsWith('-right') || p === 'right') {
          btn.style.right = offsetPx + 'px';
        } else if (p.endsWith('-left') || p === 'left') {
          btn.style.left = offsetPx + 'px';
        } else if (p === 'center' || p === 'top' || p === 'bottom') {
          btn.style.left = 'calc(50% - 70px)';
        } else {
          btn.style.right = offsetPx + 'px';
        }

        const onClickBack = (ev) => {
          ev.preventDefault();
          try {
            const ref = document.referrer || '';
            if (ref && ref !== location.href) {
              history.back();
              setTimeout(() => {
                // if didn't navigate, fallback
                if (location.href === ref || location.pathname.endsWith('/')) {
                  window.location.href = absoluteURL(baseUrl, target);
                }
              }, 300);
              return;
            }
          } catch (e) {}
          window.location.href = absoluteURL(baseUrl, target);
        };

        btn.addEventListener('click', onClickBack);
        document.body.appendChild(btn);

        currentComponents.push({
          name: 'back',
          instance: {
            destroy: async () => {
              try { btn.removeEventListener('click', onClickBack); } catch (e) {}
              try { if (btn.parentNode) btn.parentNode.removeChild(btn); } catch (e) {}
            }
          },
          el: btn
        });

        continue;
      }

      // THEME component
      if (comp.name === 'theme') {
        const pos = (comp.inner || 'bottom-right').trim();
        const el = document.createElement('div');
        document.body.appendChild(el);
        const themeInstance = new LumoTheme(pos);
        themeInstance.mount();
        currentComponents.push({ name: 'theme', instance: themeInstance, el });
        continue;
      }

      // BG component (HTML inner OR key:value specification)
      if (comp.name === 'bg' && comp.inner) {
        const inner = comp.inner.trim();

        if (inner.startsWith('<') || /<canvas\b/i.test(inner) || /<div\b/i.test(inner)) {
          const wrapper = document.createElement('div');
          wrapper.className = 'lumo-bg-wrapper';
          wrapper.style.position = 'fixed';
          wrapper.style.inset = '0';
          wrapper.style.zIndex = '-1';
          wrapper.style.pointerEvents = 'none';
          wrapper.innerHTML = inner;
          document.body.appendChild(wrapper);

          const canvases = wrapper.querySelectorAll('canvas[bg]');
          for (const c of canvases) {
            const bgName = c.getAttribute('bg');
            if (!c.width) c.width = window.innerWidth;
            if (!c.height) c.height = window.innerHeight;
            await loadBgScriptIfNeeded(bgName, baseUrl);
            const BgClass = window.LumoBackgrounds && window.LumoBackgrounds[bgName];
            if (typeof BgClass === 'function') {
              try {
                const instance = new BgClass(c, { baseUrl, meta });
                currentBgInstances.push({ name: bgName, instance, wrapper });
              } catch (err) { console.error('Lumo: bg init error', bgName, err); }
            } else {
              console.warn('Lumo: bg not found after load', bgName);
            }
          }
        } else {
          // parse simple key:value lists or lone values
          const parts = inner.split(',').map(s => s.trim()).filter(Boolean);
          for (const p of parts) {
            let m = p.match(/^([a-zA-Z0-9_-]+)\s*[:=]\s*(.+)$/);
            if (m) {
              const key = m[1].toLowerCase();
              const value = m[2].trim();
              if (key === 'color' || key === 'background' || key === 'bg') {
                document.body.style.background = value;
              } else if (key === 'class') {
                document.body.classList.add(value);
              } else {
                document.documentElement.style.setProperty(`--bg-${key}`, value);
              }
            } else {
              document.body.style.background = p;
            }
          }
          currentBgInstances.push({ name: 'color', instance: { destroy: async () => { document.body.style.background = ''; } }, wrapper: null });
        }
        continue;
      }

      // other components: inject raw inner HTML into #app
      if (comp.inner) {
        const container = document.createElement('div');
        container.className = `lumo-comp-${comp.name}`;
        container.innerHTML = comp.inner;
        app.appendChild(container);
        currentComponents.push({ name: comp.name, instance: null, el: container });
      }
    }

    // ensure link interception (use baseUrl so relative hrefs resolve correctly)
    attachZtmfLinkHandler(baseUrl, meta);
  }

  // ---- click handler: intercept .ztmf links and load via SPA ----
  function attachZtmfLinkHandler(baseUrl, meta = {}) {
    // remove old handler if present
    if (globalZtmfClickHandler) {
      try { document.removeEventListener('click', globalZtmfClickHandler); } catch (e) {}
      globalZtmfClickHandler = null;
    }

    function isLocalZtmf(href) {
      if (!href) return false;
      const hr = href.split('?')[0].split('#')[0].toLowerCase();
      return hr.endsWith('.ztmf');
    }
    function resolve(href) { return absoluteURL(baseUrl, href); }

    const handler = function ztmfClickHandler(e) {
      const a = e.target.closest && e.target.closest('a');
      if (!a) return;
      const href = a.getAttribute('href');
      if (!href) return;

      // ignore anchors and mailto/tel and javascript:
      if (href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:')) return;

      if (isLocalZtmf(href)) {
        e.preventDefault();
        const url = resolve(href);
        // load as SPA, and push history as index.html?file=FILENAME (safe for reload)
        loadZtmf(url, true).catch(err => { console.error(err); status('Ошибка загрузки ' + href); });
        return;
      }

      // allow normal navigation for HTML pages and external links
    };

    globalZtmfClickHandler = handler;
    document.addEventListener('click', globalZtmfClickHandler);
  }

  // ---- load ZTMF (core) ----
  async function loadZtmf(url, pushState = true) {
    status('Загружаю ' + url);
    const resp = await fetch(url, { cache: 'no-store' });
    if (!resp.ok) { status('Ошибка сети: ' + resp.status, true); throw new Error('Fetch error ' + resp.status); }
    const text = await resp.text();
    const { metaRaw, bodyRaw } = splitZtmf(text);
    const meta = parseMetaKVs(metaRaw);
    const inlineStyle = extractInlineStyle(metaRaw);

    // choose parser based on meta.type
    let html, componentsSpec;
    if (String(meta.type || '').toLowerCase() === 'blocky') {
      ({ html, componentsSpec } = parseBlocky(bodyRaw));
    } else {
      ({ html, componentsSpec } = processBody(bodyRaw));
    }

    const baseUrl = baseFromUrl(url);
    await renderParsed({ meta, inlineStyle, html, componentsSpec }, baseUrl);
    // Отправляем событие, чтобы внешние скрипты знали о завершении рендеринга
    document.dispatchEvent(new CustomEvent('lumo:contentRendered', {
        detail: { 
            url: url, 
            meta: meta, // Передаем метаданные, включая title
            pageName: meta.title || url
        }
    }));
    status('Загружено: ' + (meta.title || url));

    if (pushState) {
      try {
        // push a safe URL so reload doesn't fetch raw .ztmf
        const fname = (() => {
          try { return (new URL(url, location.href)).pathname.split('/').pop(); } catch (e) { return url; }
        })();
        const basePath = location.pathname.replace(/\/[^/]*$/, '/');
        const safeUrl = `${basePath}index.html?file=${encodeURIComponent(fname)}`;
        history.pushState({ lumo: url }, meta.title || '', safeUrl);
      } catch (e) { /* ignore pushState errors */ }
    }
  }

  // ---- disable context menu helper ----
  function installDisableContextMenu() {
    if (window.__lumo_rmb_disabled) return;
    function disableContext(e) { e.preventDefault(); return false; }
    document.addEventListener('contextmenu', disableContext, true);
    const observer = new MutationObserver(() => {});
    observer.observe(document.body, { childList: true, subtree: true });
    window.__lumo_rmb_disabled = true;
  }

  // ---- popstate handling ----
  window.addEventListener('popstate', (ev) => {
    const state = ev.state;
    if (state && state.lumo) loadZtmf(state.lumo, false).catch(e => console.error(e));
    else {
      // fallback: if query param file exists, load it
      const params = new URLSearchParams(window.location.search);
      const file = params.get('file');
      if (file) {
        const url = absoluteURL(location.href, file);
        loadZtmf(url, false).catch(()=>{});
      } else if (window.LUMO_START) {
        loadZtmf(window.LUMO_START, false).catch(()=>{});
      }
    }
  });

  // ---- initial load logic ----
  window.addEventListener('load', () => {
    try {
      const urlObj = new URL(location.href);
      const pathname = urlObj.pathname || '';
      // If user opened a .ztmf directly (e.g. http://host/anycraft.ztmf) redirect to index.html?file=...
      if (pathname.toLowerCase().endsWith('.ztmf')) {
        const file = pathname.split('/').pop();
        // build redirect to same directory index.html with file param
        const base = pathname.replace(/\/[^/]*$/, '/');
        const redirect = `${base}index.html?file=${encodeURIComponent(file)}`;
        // replace directly so browser doesn't add entry
        window.location.replace(redirect);
        return;
      }

      // If we are on index.html or root, check for ?file= param
      const params = new URLSearchParams(window.location.search);
      const fileParam = params.get('file');
      if (fileParam) {
        const targetUrl = absoluteURL(location.href, fileParam);
        loadZtmf(targetUrl, false).catch(err => console.error('initial file load failed', err));
        return;
      }

      // normal startup: load LUMO_START or default index.ztmf
      const start = window.LUMO_START || './index.ztmf';
      loadZtmf(start, false).catch(err => console.error('startup load failed', err));
    } catch (e) {
      // fail-safe fallback
      const start = window.LUMO_START || './index.ztmf';
      loadZtmf(start, false).catch(err => console.error('startup load failed', err));
    }
  });

  // ---- public API ----
  window.Lumo = {
    load: loadZtmf,
    destroyBackgrounds: destroyAllBackgroundInstances,
    status
  };

})();
