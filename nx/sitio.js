// NEXBYTE.pro — comportamiento común del sitio. Liviano a propósito: nada corre si no está a la vista.
(() => {
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const quieto = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ── Iconos propios: cada uno es un dibujo de 8 × 8 celdas (X = tinta, o = acento) ──
  const G = {
    codigo: '........|..X..X..|.X....X.|X..oo..X|X..oo..X|.X....X.|..X..X..|........',
    ciclo: '.XXXXo..|X....oo.|X....o..|X.......|.......X|..o....X|.oo....X|..oXXXX.',
    chispa: '...X....|...X....|..XoX...|XXoooXX.|..XoX...|...X..o.|...X.ooo|......o.',
    nodos: 'oo....XX|oo....XX|..X..X..|...XX...|...XX...|..X..X..|XX....oo|XX....oo',
    brujula: '..XXXX..|.X....X.|X....o.X|X...oo.X|X.oo...X|X.o....X|.X....X.|..XXXX..',
    pieza: '...oo...|...oo...|XXXXXXXX|X......X|X.....XX|X.....XX|X......X|XXXXXXXX',
    ok: '........|.......X|......XX|X....XX.|XX..XX..|.XXXX...|..XX....|........',
    candado: '..XXXX..|.X....X.|.X....X.|XXXXXXXX|XXXooXXX|XXXooXXX|XXXXXXXX|........',
    rayo: '....XX..|...XX...|..XX....|.XXXXXX.|....XX..|...XX...|..XX....|.XX.....',
    sobre: '........|XXXXXXXX|XX....XX|X.X..X.X|X..oo..X|X......X|XXXXXXXX|........',
    video: 'XXXXXXXX|X......X|X..o...X|X..oo..X|X..oo..X|X..o...X|X......X|XXXXXXXX',
    barras: '........|......X.|......X.|...X..X.|...X..X.|o..X..X.|o..X..X.|XXXXXXXX',
    hoja: 'XXXXXX..|X.....X.|X.oooo.X|X......X|X.oooo.X|X......X|X.oo...X|XXXXXXXX',
    capas: '...XX...|.XX..XX.|X......X|.XX..XX.|o..XX..o|.oo..oo.|...oo...|........',
    lista: '........|o.XXXXXX|........|o.XXXXXX|........|o.XXXX..|........|........',
    carpeta: '........|XXX.....|X..XXXXX|X......X|X.oooo.X|X......X|XXXXXXXX|........',
    subir: '...oo...|..oooo..|.o.oo.o.|...oo...|...oo...|X......X|X......X|XXXXXXXX',
    qr: 'XXX..XXX|X.X..X.X|XXX..XXX|...oo...|...oo.o.|XXX..o..|X.X...oo|XXX..o.o',
  };
  $$('[data-g]').forEach((n) => {
    const d = G[n.dataset.g]; if (!d) return;
    let r = '';
    d.split('|').forEach((fila, y) => [...fila].forEach((c, x) => { if (c !== '.') r += `<rect x="${x + .08}" y="${y + .08}" width=".84" height=".84"${c === 'o' ? ' class="a"' : ''}/>`; }));
    n.classList.add('glifo'); n.setAttribute('aria-hidden', 'true');
    if (n.dataset.g === 'ok' && n.classList.contains('chico')) { n.classList.add('trazo-ok'); n.innerHTML = '<svg viewBox="0 0 18 18"><path d="M3 9.5l4 4 8-9"/></svg>'; return; }
    n.innerHTML = `<svg viewBox="0 0 8 8" fill="currentColor">${r}</svg>`;
  });

  // ── El byte: ocho celdas que escriben en binario el número de la sección ──
  $$('.byte[data-n]').forEach((n) => {
    const bits = (+n.dataset.n).toString(2).padStart(8, '0');
    n.setAttribute('aria-hidden', 'true');
    n.innerHTML = [...bits].map((b, k) => `<i${b === '1' ? ' class="on"' : ''} style="--k:${k}"></i>`).join('');
  });

  // ── Aparición al entrar en pantalla ──
  const ver = $$('[data-ver], .l:not([data-ver] .l), .byte:not([data-ver] .byte)');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('visto'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -7% 0px', threshold: .08 });
    ver.forEach((n) => io.observe(n));
  } else ver.forEach((n) => n.classList.add('visto'));

  // ── Barra: se esconde al bajar, vuelve al subir; menú en celular ──
  const barra = $('.barra');
  if (barra) {
    let antes = scrollY, pend = false;
    addEventListener('scroll', () => {
      if (pend) return; pend = true;
      requestAnimationFrame(() => {
        const y = scrollY;
        if (!barra.classList.contains('abierta')) barra.classList.toggle('oculta', y > 260 && y > antes + 4 ? true : y < antes - 4 ? false : barra.classList.contains('oculta'));
        antes = y; pend = false;
      });
    }, { passive: true });
    const abre = $('.abre-menu', barra);
    if (abre) {
      const cerrar = () => { barra.classList.remove('abierta'); abre.setAttribute('aria-expanded', 'false'); document.body.style.overflow = ''; };
      abre.addEventListener('click', () => {
        const a = barra.classList.toggle('abierta');
        abre.setAttribute('aria-expanded', a); document.body.style.overflow = a ? 'hidden' : '';
      });
      $$('.menu a', barra).forEach((a) => a.addEventListener('click', cerrar));
      addEventListener('keydown', (e) => { if (e.key === 'Escape') cerrar(); });
    }
  }

  // ── Portada: una matriz de celdas sueltas que una pasada ordena. Eso es automatizar. ──
  const cv = $('canvas.matriz');
  if (cv && !quieto) {
    const ctx = cv.getContext('2d');
    let W, H, cols, filas, lado, azar, fase, vel, frente = -.15, visible = true, ultimo = 0, px = -999, py = -999;
    const medir = () => {
      const dpr = Math.min(devicePixelRatio || 1, 2);
      W = cv.clientWidth; H = cv.clientHeight; cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      lado = W < 700 ? 17 : 21; cols = Math.ceil(W / lado); filas = Math.ceil(H / lado);
      const n = cols * filas; azar = new Float32Array(n); fase = new Float32Array(n); vel = new Float32Array(n);
      for (let i = 0; i < n; i++) { azar[i] = Math.random(); fase[i] = Math.random() * 6.28; vel[i] = .6 + Math.random() * 1.6; }
    };
    const pintar = (t) => {
      requestAnimationFrame(pintar);
      if (!visible || document.hidden || t - ultimo < 33) return;
      const dt = Math.min(t - ultimo, 80); ultimo = t;
      frente += dt * .00013; if (frente > 1.75) frente = -.15;
      ctx.clearRect(0, 0, W, H);
      for (let c = 0; c < cols; c++) {
        const x = c / cols, d = frente - x;
        const orden = d > 0 ? Math.max(0, 1 - d * 1.35) : 0;
        ctx.fillStyle = `rgb(${43 - x * 9 | 0},${99 + x * 112 | 0},${240 - x * 2 | 0})`;
        for (let r = 0; r < filas; r++) {
          const i = c * filas + r;
          const suelto = azar[i] > .8 ? .06 + .24 * (.5 + .5 * Math.sin(t * .001 * vel[i] + fase[i])) : .035;
          const patron = (c + r * 2) % 7 < 2 ? .4 : .02;
          let a = suelto + (patron - suelto) * orden;
          if (d > 0 && d < .014) a = Math.max(a, .5);
          const dx = c * lado - px, dy = r * lado - py, dist = dx * dx + dy * dy;
          if (dist < 16900) a += (1 - dist / 16900) * .45;
          if (a < .02) continue;
          ctx.globalAlpha = a > 1 ? 1 : a;
          ctx.fillRect(c * lado + 3, r * lado + 3, lado - 6, lado - 6);
        }
      }
    };
    medir(); addEventListener('resize', medir);
    new IntersectionObserver((e) => { visible = e[0].isIntersecting; }).observe(cv);
    const zona = cv.parentElement;
    zona.addEventListener('pointermove', (e) => { const b = cv.getBoundingClientRect(); px = e.clientX - b.left; py = e.clientY - b.top; }, { passive: true });
    zona.addEventListener('pointerleave', () => { px = py = -999; });
    requestAnimationFrame(pintar);
  }

  // ── /aulas: el cronómetro del aula recién armada cuenta hasta su marca ──
  const crono = $('[data-crono]');
  if (crono && !quieto) {
    const total = +crono.dataset.crono, final = crono.textContent, f = (s) => `en ${Math.floor(s / 60)} min ${String(Math.floor(s % 60)).padStart(2, '0')} s`;
    crono.textContent = f(0);
    new IntersectionObserver((e, o) => {
      if (!e[0].isIntersecting) return; o.disconnect();
      const t0 = performance.now() + 500, dur = 3000;
      const paso = (t) => { const k = Math.max(0, Math.min(1, (t - t0) / dur)); if (k < 1) { crono.textContent = f(total * (1 - Math.pow(1 - k, 3))); requestAnimationFrame(paso); } else crono.textContent = final; };
      requestAnimationFrame(paso);
    }, { threshold: .3 }).observe(crono);
  }

  // ── /planes: el precio y el nombre entran con un gesto cada vez que cambian ──
  $$('[data-cambia]').forEach((n) => new MutationObserver(() => { n.classList.remove('cambia'); void n.offsetWidth; n.classList.add('cambia'); }).observe(n, { childList: true, characterData: true, subtree: true }));

  // ── Páginas legales: índice lateral armado con los títulos del propio documento ──
  const doc = $('.legal .container');
  if (doc) {
    const hs = $$('h2', doc); const sub = $('.subtitle', doc);
    if (hs.length > 2 && sub) {
      const nav = document.createElement('nav'); nav.className = 'indice'; nav.setAttribute('aria-label', 'Contenido de esta página');
      hs.forEach((h, i) => { h.id = h.id || `s${i + 1}`; const a = document.createElement('a'); a.href = `#${h.id}`; a.textContent = h.textContent; nav.append(a); });
      sub.after(nav);
      const enlaces = $$('a', nav);
      const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) enlaces.forEach((a) => a.classList.toggle('aqui', a.hash === `#${e.target.id}`)); }), { rootMargin: '-90px 0px -70% 0px' });
      hs.forEach((h) => io.observe(h));
    }
  }
})();
