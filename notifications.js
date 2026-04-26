/**
 * Notifications bell — versión web (autoinjectable).
 * Carga `/notifications.json` y muestra una campana flotante top-right
 * con badge rojo de no-leídas. Estado leído/no-leído en localStorage.
 *
 * Uso: <script defer src="/notifications.js"></script> en cualquier página.
 * No requiere markup previo — se inyecta solo.
 */
(function () {
  'use strict';

  const STORAGE_KEY = 'nexbyte_notif_read_ids';
  const JSON_URL = '/notifications.json';

  function getReadIds() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return Array.isArray(JSON.parse(raw)) ? JSON.parse(raw) : [];
    } catch { return []; }
  }
  function setReadIds(ids) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(ids)); } catch {}
  }
  function fmtDate(s) {
    try {
      const d = new Date(s);
      return d.toLocaleDateString('es-EC', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch { return s || ''; }
  }
  function escapeHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function injectStyles() {
    if (document.getElementById('nx-notif-styles')) return;
    const style = document.createElement('style');
    style.id = 'nx-notif-styles';
    style.textContent = `
      #nx-notif-wrap { position: fixed; top: 16px; right: 16px; z-index: 99998; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: none; }
      #nx-notif-btn { position: relative; background: rgba(15,23,42,0.85); border: 1px solid rgba(255,255,255,0.15); border-radius: 50%; width: 42px; height: 42px; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(0,0,0,0.35); padding: 0; transition: transform 0.15s, background 0.15s; backdrop-filter: blur(8px); }
      #nx-notif-btn:hover { transform: scale(1.05); background: rgba(15,23,42,0.95); }
      #nx-notif-btn svg { stroke: #E2E8F0; }
      #nx-notif-badge { display: none; position: absolute; top: -2px; right: -2px; background: #ef4444; color: #fff; font-size: 11px; font-weight: 700; line-height: 1; padding: 3px 6px; border-radius: 12px; min-width: 18px; text-align: center; border: 2px solid rgba(15,23,42,1); }
      #nx-notif-dropdown { position: absolute; top: 50px; right: 0; width: 340px; max-height: 460px; background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; box-shadow: 0 12px 28px rgba(0,0,0,0.18); overflow: hidden; display: none; }
      #nx-notif-dropdown .nx-head { padding: 12px 14px; border-bottom: 1px solid #f3f4f6; display: flex; justify-content: space-between; align-items: center; background: #f9fafb; }
      #nx-notif-dropdown .nx-head-title { font-size: 14px; font-weight: 600; color: #111827; }
      #nx-notif-mark-all { font-size: 12px; color: #1d4ed8; background: none; border: none; cursor: pointer; padding: 4px 6px; }
      #nx-notif-mark-all:hover { text-decoration: underline; }
      #nx-notif-list { overflow-y: auto; max-height: 400px; }
      .nx-notif-item { padding: 12px 14px; border-bottom: 1px solid #f3f4f6; cursor: pointer; transition: background 0.15s; }
      .nx-notif-item:last-child { border-bottom: none; }
      .nx-notif-item:hover { background: #f3f4f6 !important; }
      .nx-notif-item-title { font-size: 13px; font-weight: 600; color: #111827; margin-bottom: 4px; display: flex; align-items: center; gap: 6px; }
      .nx-notif-item-body { font-size: 12px; color: #4b5563; line-height: 1.45; margin-bottom: 6px; }
      .nx-notif-item-date { font-size: 11px; color: #9ca3af; }
      .nx-notif-dot { display: inline-block; width: 7px; height: 7px; background: #1d4ed8; border-radius: 50%; flex-shrink: 0; }
      .nx-notif-tag { display: inline-block; font-size: 9px; padding: 2px 7px; border-radius: 6px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 700; }
      .nx-notif-tag-promo { background: #fef3c7; color: #92400e; }
      .nx-notif-tag-release { background: #dbeafe; color: #1e40af; }
    `;
    document.head.appendChild(style);
  }

  function buildDom() {
    const wrap = document.createElement('div');
    wrap.id = 'nx-notif-wrap';
    wrap.innerHTML = `
      <button id="nx-notif-btn" type="button" aria-label="Notificaciones">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
        <span id="nx-notif-badge"></span>
      </button>
      <div id="nx-notif-dropdown">
        <div class="nx-head">
          <span class="nx-head-title">Notificaciones</span>
          <button id="nx-notif-mark-all" type="button">Marcar todas leídas</button>
        </div>
        <div id="nx-notif-list"></div>
      </div>
    `;
    document.body.appendChild(wrap);
    return wrap;
  }

  async function init() {
    injectStyles();

    let items = [];
    try {
      const res = await fetch(JSON_URL + '?t=' + Math.floor(Date.now() / 60000), { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      items = Array.isArray(data?.items) ? data.items : [];
      if (items.length === 0) return;
    } catch { return; }

    const wrap = buildDom();
    const btn = document.getElementById('nx-notif-btn');
    const badge = document.getElementById('nx-notif-badge');
    const dropdown = document.getElementById('nx-notif-dropdown');
    const list = document.getElementById('nx-notif-list');
    const markAll = document.getElementById('nx-notif-mark-all');

    let readIds = getReadIds();

    function render() {
      const unread = items.filter((it) => it?.id && !readIds.includes(it.id));
      if (unread.length > 0) {
        badge.textContent = unread.length > 9 ? '9+' : String(unread.length);
        badge.style.display = 'block';
      } else {
        badge.style.display = 'none';
      }
      const sorted = [...items].sort((a, b) => {
        const aRead = readIds.includes(a.id) ? 1 : 0;
        const bRead = readIds.includes(b.id) ? 1 : 0;
        if (aRead !== bRead) return aRead - bRead;
        return (b.date || '').localeCompare(a.date || '');
      });
      list.innerHTML = '';
      sorted.forEach((it) => {
        if (!it?.id) return;
        const isRead = readIds.includes(it.id);
        const item = document.createElement('div');
        item.className = 'nx-notif-item';
        item.style.background = isRead ? '#fff' : '#eff6ff';
        const typeTag = it.type === 'promo' ? '<span class="nx-notif-tag nx-notif-tag-promo">Promo</span>'
          : it.type === 'release' ? '<span class="nx-notif-tag nx-notif-tag-release">Versión</span>' : '';
        item.innerHTML = `
          <div class="nx-notif-item-title">
            ${isRead ? '' : '<span class="nx-notif-dot"></span>'}
            ${typeTag}
            <span>${escapeHtml(it.title || '')}</span>
          </div>
          <div class="nx-notif-item-body">${escapeHtml(it.body || '')}</div>
          <div class="nx-notif-item-date">${fmtDate(it.date)}</div>
        `;
        item.addEventListener('click', () => {
          if (!isRead) {
            readIds = [...readIds, it.id];
            setReadIds(readIds);
            render();
          }
          if (it.url) window.open(it.url, '_blank', 'noopener');
        });
        list.appendChild(item);
      });
    }

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = dropdown.style.display === 'block';
      dropdown.style.display = isOpen ? 'none' : 'block';
    });
    document.addEventListener('click', (e) => {
      if (!wrap.contains(e.target)) dropdown.style.display = 'none';
    });
    markAll.addEventListener('click', (e) => {
      e.stopPropagation();
      readIds = items.map((it) => it.id).filter(Boolean);
      setReadIds(readIds);
      render();
    });

    render();
    wrap.style.display = 'block';
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
