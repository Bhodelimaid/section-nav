// vanilla js. builds a section nav from h2 headings and excludes H3. Handles smooth scroll with header offset and scrollspy
// Also handles smooth scroll with header offset + scrollspy.
// - Curated blocks already use <h2 class="collection--category" id="..."> (keeps IDs).
// - Copy H2 (such as <h2 class="wp-block-heading"></h2>) but may lack IDs so we create stable slugs.

(function () {
  const CONFIG = {
    CONTENT_SELECTOR: '.content',            
    DESKTOP_NAV_ID: 'section-nav',           
    MOBILE_NAV_ID: 'section-nav-mobile',     
    TITLE_TEXT: 'On this page',
    MIN_HEADING_TEXT_LEN: 2                 
  };

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function slugify(text) {
    return (text || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')                  
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      || 'section';
  }

  function getHeaderOffset() {
    let offset = 0;
    const candidates = ['.top-panel--fixed', '.header.sticky-header'];
    candidates.forEach(sel => {
      const el = $(sel);
      if (!el) return;
      const style = getComputedStyle(el);
      if (style.position === 'fixed' || style.position === 'sticky') {
        offset += el.offsetHeight || 0;
      }
    });
    return offset;
  }

  function setHeaderOffsetCSS() {
    const offset = getHeaderOffset();
    document.documentElement.style.setProperty('--header-offset', `${offset}px`);
    return offset;
  }

  function smoothScrollToId(id) {
    const target = document.getElementById(id);
    if (!target) return;
    const headerOffset = getHeaderOffset();
    const rect = target.getBoundingClientRect();
    const absoluteTop = rect.top + window.scrollY;
    const to = Math.max(absoluteTop - headerOffset - 8, 0);
    window.scrollTo({ top: to, behavior: 'smooth' });
  }

  function createIfMissing(id, html) {
    let el = document.getElementById(id);
    if (!el) {
      el = document.createElement('div');
      el.id = id;
      el.innerHTML = html;
      const content = $(CONFIG.CONTENT_SELECTOR);
      if (content) content.prepend(el);
    }
    return el;
  }

  function ensureUniqueId(base, used) {
    let id = base;
    let n = 2;
    while (used.has(id)) {
      id = `${base}-${n++}`;
    }
    used.add(id);
    return id;
  }

  function collectSections() {
    const scope = $(CONFIG.CONTENT_SELECTOR);
    if (!scope) return [];

    const h2s = $$('h2', scope);
    const usedIds = new Set();
    const sections = [];

    h2s.forEach(h2 => {
      // Fallback to skip empty or ultra-short headings. Content team should know about this and avoid 
      const label = (h2.textContent || '').trim();
      if (!label || label.length < CONFIG.MIN_HEADING_TEXT_LEN) return;

      // Keep existing id if stable; otherwise assign a slug
      let id = h2.getAttribute('id');
      if (!id || id.trim() === '') {
        id = slugify(label);
        id = ensureUniqueId(id, usedIds);
        h2.id = id;
      } else {
        // Ensure uniqueness if duplicates exist
        id = ensureUniqueId(id, usedIds);
        if (id !== h2.id) h2.id = id;
      }

      sections.push({
        id,
        label,
        el: h2
      });
    });

    return sections;
  }

  // ————— UI builders —————
  function buildDesktopNav(sections) {
    const container = createIfMissing(
      CONFIG.DESKTOP_NAV_ID,
      `<aside class="section-nav" aria-label="Section navigation">
         <div class="section-nav__title">${CONFIG.TITLE_TEXT}</div>
         <ul class="section-nav__list" role="list"></ul>
       </aside>`
    );
    const list = container.querySelector('.section-nav__list');
    list.innerHTML = '';

    sections.forEach(s => {
      const li = document.createElement('li');
      li.className = 'section-nav__item';
      const a = document.createElement('a');
      a.className = 'section-nav__link';
      a.href = `#${s.id}`;
      a.textContent = s.label;
      a.addEventListener('click', (e) => {
        e.preventDefault();
        smoothScrollToId(s.id);
      });
      li.appendChild(a);
      list.appendChild(li);
    });

    return container;
  }

  function buildMobileChips(sections) {
    const container = createIfMissing(
      CONFIG.MOBILE_NAV_ID,
      `<nav class="section-nav-mobile" aria-label="Section navigation (mobile)">
         <div class="section-nav-mobile__row"></div>
       </nav>`
    );
    const row = container.querySelector('.section-nav-mobile__row');
    row.innerHTML = '';

    sections.forEach(s => {
      const a = document.createElement('a');
      a.className = 'section-chip';
      a.href = `#${s.id}`;
      a.textContent = s.label;
      a.addEventListener('click', (e) => {
        e.preventDefault();
        smoothScrollToId(s.id);
      });
      row.appendChild(a);
    });

    return container;
  }

  // ————— Scrollspy —————
  function setupScrollspy(sections) {
    const idToLinks = new Map();

    // Map id → matching links (desktop + mobile)
    sections.forEach(s => {
      const links = $$(`a[href="#${s.id}"]`);
      idToLinks.set(s.id, links);
    });

    function setActive(id) {
      // clear
      $$('.section-nav__link.is-active, .section-chip.is-active')
        .forEach(el => el.classList.remove('is-active'));
      // set
      const links = idToLinks.get(id) || [];
      links.forEach(el => el.classList.add('is-active'));
    }

    // Use IntersectionObserver with a top offset (rootMargin) so "active" switches a bit earlier
    const headerOffset = getHeaderOffset();
    const observer = new IntersectionObserver(
      (entries) => {
        // pick the most visible heading above the fold
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const id = entry.target.id;
            if (id) setActive(id);
          }
        });
      },
      {
        root: null,
        // Trigger when heading crosses ~ (header + 24px) from top
        rootMargin: `-${headerOffset + 24}px 0px -70% 0px`,
        threshold: [0, 1.0]
      }
    );

    sections.forEach(s => observer.observe(s.el));

    // Also update CSS var on resize (header height might change)
    const ro = new ResizeObserver(() => setHeaderOffsetCSS());
    const hdr1 = $('.top-panel--fixed');
    const hdr2 = $('.header.sticky-header');
    if (hdr1) ro.observe(hdr1);
    if (hdr2) ro.observe(hdr2);

    if (sections[0]) setActive(sections[0].id);
  }

  function init() {
    setHeaderOffsetCSS();
    const sections = collectSections();
    if (!sections.length) return;

    buildDesktopNav(sections);
    buildMobileChips(sections);
    setupScrollspy(sections);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
