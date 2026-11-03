// ============================================================
//  WishfulLion6770 · Web pública (SPA sin framework)
//  Todo viene de /api. Cuando el admin cambia algo, el servidor
//  avisa por SSE (/api/events) y esta página se actualiza sola.
// ============================================================
const app = $('#app');
let games = [], cfg = {}, query = '', st = {}, timer;        // st = estado del flujo de compra

// ---------- Íconos (SVG en línea, sin emojis) ----------
const ICO = {
  diamond: '<path d="M6 3h12l4 6-10 12L2 9zM2 9h20"/>',
  qr: '<path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h3v3h-3zM20 14v7h-3M14 20h3"/>',
  receipt: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>',
  coin: '<circle cx="12" cy="12" r="9"/><path d="M12 7v10M15 9.5h-4.5a1.8 1.8 0 0 0 0 3.5h3a1.8 1.8 0 0 1 0 3.5H9"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  game: '<path d="M6 8h12a4 4 0 0 1 4 4v2a3 3 0 0 1-5.2 2L15 14H9l-1.8 2A3 3 0 0 1 2 14v-2a4 4 0 0 1 4-4zM8 10v4M6 12h4"/>',
  trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H4v2a3 3 0 0 0 4 3M16 6h4v2a3 3 0 0 1-4 3M12 13v4M8 21h8"/>',
  check: '<path d="M5 12l5 5 9-10"/>'
};
const ico = (n, s = 20) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICO[n]}</svg>`;

const LABEL = {
  pendiente: ['Pendiente de verificación', 'text-slate-300'], en_proceso: ['En proceso', 'text-neon-cyan'],
  completado: ['¡Recarga completada!', 'text-neon-mint'], cancelado: ['Cancelado', 'text-neon-orange']
};
const STEPS = ['pendiente', 'en_proceso', 'completado'];
// Barra de progreso del pedido: Recibido → En proceso → Completado
const stepper = s => s === 'cancelado' ? '' : `<div class="mt-3 flex items-center">${STEPS.map((k, i) => {
  const on = STEPS.indexOf(s) >= i;
  return `<div class="flex items-center ${i ? 'flex-1' : ''}">${i ? `<div class="h-0.5 flex-1 ${on ? 'bg-neon-cyan' : 'bg-white/15'}"></div>` : ''}<div class="h-4 w-4 flex-none rounded-full ${on ? 'bg-neon-cyan shadow-[0_0_10px_#00e5ff]' : 'bg-white/15'}"></div></div>`;
}).join('')}</div><div class="mt-1 flex justify-between text-sm text-slate-400"><span>Recibido</span><span>En proceso</span><span>Completado</span></div>`;

// ---------- Piezas visuales ----------
const cardImg = g => g.cover
  ? `<img src="${esc(g.cover)}" alt="" loading="lazy" class="aspect-square w-full object-cover transition duration-500 group-hover:scale-110">`
  : `<div class="grid aspect-square w-full place-items-center bg-gradient-to-br from-neon-cyan/30 to-neon-orange/30 text-white/70">${ico('game', 48)}</div>`;
const tagBadge = t => ({ nuevo: '<span class="chip bg-neon-mint text-ink">Nuevo</span>', oferta: '<span class="chip bg-neon-orange text-ink">Oferta</span>' }[t] || '');
const gameCard = g => `<a href="#/juego/${esc(g.slug)}" class="card group block overflow-hidden !p-0">
  <div class="relative overflow-hidden">${cardImg(g)}<div class="absolute left-2 top-2">${tagBadge(g.tag)}</div></div>
  <div class="p-3"><div class="text-xl font-bold leading-tight">${esc(g.name)}</div>
  <div class="mt-1 flex items-center gap-1 text-base text-neon-cyan">${ico('diamond', 16)}${esc(g.currency_name)}</div></div></a>`;
const soonCard = g => `<div class="overflow-hidden rounded-2xl border border-white/10 bg-white/5"><div class="relative overflow-hidden">
  ${g.cover ? `<img src="${esc(g.cover)}" alt="" loading="lazy" class="aspect-square w-full object-cover grayscale">` : '<div class="aspect-square w-full bg-white/5"></div>'}
  <span class="chip absolute left-2 top-2 bg-white text-ink">Próximamente</span></div>
  <div class="p-3 text-xl font-bold leading-tight text-slate-300">${esc(g.name)}</div></div>`;
const SOON_EMPTY = `<div class="grid min-h-[200px] place-items-center rounded-2xl border-2 border-dashed border-neon-cyan/40 p-4 text-center">
  <div><div class="mx-auto grid h-12 w-12 place-items-center rounded-full bg-neon-cyan/15 text-neon-cyan">${ico('lock', 24)}</div>
  <div class="mt-2 text-xl font-bold">Más apps muy pronto</div><div class="text-sm text-slate-300">Estamos preparando nuevos juegos y recargas.</div></div></div>`;
const section = (title, list, id = '', empty = 'Aún no hay juegos disponibles.') =>
  `<h2 ${id ? `id="${id}" ` : ''}class="mb-3 mt-10 scroll-mt-24 text-2xl font-bold text-neon-cyan md:text-3xl">${title}</h2>` +
  (list.length ? `<div class="grid grid-cols-2 gap-4 md:grid-cols-4">${list.map(gameCard).join('')}</div>` : `<p class="text-slate-400">${empty}</p>`);
const soonSection = soon => `<h2 class="mb-3 mt-12 text-2xl font-bold text-neon-cyan md:text-3xl">Próximamente</h2>
  <div class="grid grid-cols-2 gap-4 md:grid-cols-4">${soon.map(soonCard).join('')}${SOON_EMPTY}</div>`;
const step = (n, title) => `<h2 class="mb-3 flex items-center gap-2 text-xl font-bold"><span class="grid h-8 w-8 place-items-center rounded-full bg-neon-cyan text-ink">${n}</span>${title}</h2>`;

// Portada principal: titular, botón y abanico con las portadas de los juegos
const hero = list => `<div class="hero relative overflow-hidden rounded-3xl border border-white/10 p-6 md:p-10 lg:min-h-[340px]">
  <div class="relative z-10 max-w-xl lg:max-w-md xl:max-w-xl">
    <span class="chip bg-neon-cyan text-ink">Recargas para gamers</span>
    <h1 class="glow-text mt-4 text-4xl font-bold leading-[1.05] md:text-5xl">Recarga tu juego en minutos y paga en Bolivianos</h1>
    <p class="mt-3 text-xl text-slate-300">Elige tu juego, paga con QR y sigue tu pedido.</p>
    <button data-act="go" class="btn btn-orange mt-6">Ver juegos</button>
  </div>
  <div class="relative z-0 mt-8 flex justify-center lg:absolute lg:right-12 lg:top-1/2 lg:mt-0 lg:-translate-y-1/2">${list.filter(g => g.cover).slice(0, 3).map((g, i) =>
    `<img src="${esc(g.cover)}" alt="" class="h-28 w-28 flex-none rounded-2xl border-2 border-white/25 object-cover shadow-[0_0_28px_#00e5ff55] lg:h-36 lg:w-36 xl:h-44 xl:w-44 ${['-rotate-6', 'z-10 scale-110', 'rotate-6'][i]} ${i ? '-ml-5' : ''}">`).join('')}</div></div>`;
const PERKS = `<div class="mt-4 grid gap-3 md:grid-cols-3">${[['qr', 'Pago por QR', 'Escanea y sube tu comprobante'], ['receipt', 'Sigue tu pedido', 'Tu código te muestra el estado'], ['coin', 'Precios en Bolivianos', 'Sin conversiones']].map(([i, t, d]) =>
  `<div class="box flex items-center gap-3"><div class="grid h-11 w-11 flex-none place-items-center rounded-xl bg-neon-cyan/15 text-neon-cyan">${ico(i, 24)}</div><div><div class="text-lg font-bold leading-tight">${t}</div><div class="text-sm text-slate-300">${d}</div></div></div>`).join('')}</div>`;
const HOWTO = `<h2 class="mb-3 mt-12 text-2xl font-bold text-neon-cyan md:text-3xl">Así de fácil</h2><div class="grid gap-4 md:grid-cols-3">${[['1', 'Pon tu ID', 'Elige tu juego y verifica tu cuenta.'], ['2', 'Elige tu paquete', 'Diamantes, pases y más, con precio en Bs.'], ['3', 'Paga con QR', 'Sube tu comprobante y sigue tu pedido.']].map(([n, t, d]) =>
  `<div class="box flex items-start gap-4"><div class="grid h-10 w-10 flex-none place-items-center rounded-full bg-neon-cyan text-xl font-bold text-ink shadow-[0_0_14px_#00e5ff80]">${n}</div><div><div class="text-xl font-bold">${t}</div><div class="text-slate-300">${d}</div></div></div>`).join('')}</div>`;

// ---------- Pantallas ----------
const views = {
  home() {
    const q = query.trim().toLowerCase(), live = games.filter(g => g.tag !== 'proximamente'), soon = games.filter(g => g.tag === 'proximamente');
    if (q) return `<section>${section('Resultados', live.filter(g => g.name.toLowerCase().includes(q)), 'juegos', 'No hay juegos con ese nombre.')}</section>`;
    const by = t => live.filter(g => g.tag === t);
    return `<section>${hero(live)}${PERKS}${section('Juegos populares', live, 'juegos')}${by('nuevo').length ? section('Nuevos juegos', by('nuevo')) : ''}${by('oferta').length ? section('Ofertas especiales', by('oferta')) : ''}${HOWTO}${soonSection(soon)}</section>`;
  },

  // Flujo de compra: 1) ID del jugador  2) paquete  3) pago por QR + comprobante
  buy(slug) {
    const g = games.find(x => x.slug === slug);
    if (!g || g.tag === 'proximamente') return '<p>Este juego no está disponible por ahora. <a class="text-neon-cyan" href="#/">Ver otros juegos</a></p>';
    if (st.gid !== g.id) st = { gid: g.id };                      // otro juego → flujo nuevo
    const pkg = g.packages.find(p => p.id === st.pkg), locked = ok => (ok ? '' : 'pointer-events-none opacity-40');
    const prog = st.nick ? (pkg ? (st.file ? 3 : 2) : 1) : 0;     // pasos completados
    return `<section class="mx-auto max-w-3xl space-y-8"><div><a href="#/" class="text-neon-cyan">← Juegos</a>
      <div class="mt-3 flex items-center gap-4">${g.cover ? `<img src="${esc(g.cover)}" alt="" class="h-24 w-24 flex-none rounded-2xl border border-white/20 object-cover shadow-[0_0_20px_#00e5ff40]">` : ''}
        <div class="min-w-0"><h1 class="text-3xl font-bold md:text-4xl">${esc(g.name)}</h1><div class="flex items-center gap-1 text-neon-cyan">${ico('diamond', 16)}${esc(g.currency_name)}</div></div></div>
      <div class="mt-4 flex gap-2" role="progressbar" aria-valuemin="0" aria-valuemax="3" aria-valuenow="${prog}" aria-label="Progreso de tu compra">${[0, 1, 2].map(i =>
        `<div class="h-2 flex-1 rounded-full transition-all duration-500 ${i < prog ? 'bg-neon-cyan shadow-[0_0_12px_#00e5ff]' : 'bg-white/10'}"></div>`).join('')}</div></div>
      <div>${step(1, 'Datos de usuario')}${st.nick
        ? `<p class="flex items-center gap-2 text-xl font-bold text-neon-mint">${ico('check', 22)}Jugador: ${esc(st.nick)}</p>
           <p class="text-sm text-slate-400">ID ${esc(st.pid)}${st.zone ? ' (' + esc(st.zone) + ')' : ''}. Revísalo bien: las recargas no se pueden revertir.</p>
           <button data-act="reset" class="mt-2 text-neon-orange underline">Cambiar ID</button>`
        : `<div class="flex flex-col gap-3 md:flex-row"><input id="pid" aria-label="${esc(g.id_label)}" class="inp" placeholder="${esc(g.id_label)}" autocomplete="off">
           ${g.extra_field ? `<input id="zone" aria-label="${esc(g.extra_field)}" class="inp md:w-44" placeholder="${esc(g.extra_field)}" autocomplete="off">` : ''}
           <button data-act="verify" class="btn btn-cyan">Verificar</button></div>`}</div>
      <div class="${locked(st.nick)}">${step(2, 'Elige tu paquete')}<div class="grid grid-cols-2 gap-3 md:grid-cols-3">
        ${g.packages.map(p => `<button data-pkg="${p.id}" class="card text-left ${p.id === st.pkg ? 'card-sel' : ''}">
          ${p.id === st.pkg ? `<span class="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-neon-orange text-ink">${ico('check', 14)}</span>` : ''}
          <div class="text-neon-cyan">${p.image ? `<img src="${esc(p.image)}" alt="" class="h-10">` : ico('diamond', 36)}</div>
          <div class="mt-1 text-xl font-bold">${esc(p.label)}</div><div class="font-bold text-neon-mint">${bs(p.price_bs)}</div></button>`).join('')}</div></div>
      <div class="${locked(pkg)}">${step(3, 'Pago por QR')}<div class="grid gap-4 md:grid-cols-2">
        <div class="box text-center"><img src="/assets/qr.jpg" alt="Código QR de pago altoke" class="mx-auto w-64 rounded-xl bg-white">
          <p class="mt-2 text-sm text-slate-300">altoke · CTA ${esc(cfg.cta)}${cfg.valid ? ' · Vigencia: ' + esc(cfg.valid) : ''}</p></div>
        <div><div id="drop" class="grid min-h-40 cursor-pointer place-items-center rounded-2xl border-2 border-dashed border-neon-cyan/50 p-4 text-center transition hover:bg-neon-cyan/10">
          ${st.file ? esc(st.file.name) + ' listo' : 'Arrastra tu comprobante aquí o toca para subirlo'}</div>
          <input id="proof" type="file" accept="image/png,image/jpeg,image/webp" hidden>
          <p class="mt-3 text-xl font-bold">Total: <span class="text-neon-orange">${pkg ? bs(pkg.price_bs) : '—'}</span></p>
          <button data-act="send" class="btn btn-orange mt-3 w-full" ${pkg && st.file ? '' : 'disabled'}>Confirmar y Enviar Pedido</button></div></div></div></section>`;
  },

  orders: () => `<section class="mx-auto max-w-2xl"><h1 class="mb-4 text-3xl font-bold">Mis pedidos</h1>
    <form class="flex gap-2"><input name="c" aria-label="Código del pedido" class="inp" placeholder="Código del pedido (WL-XXXXXX)" autocomplete="off"><button class="btn btn-cyan">Buscar</button></form>
    <div id="list" class="mt-6 space-y-3"></div></section>`,

  torneos: () => `<section class="py-16 text-center"><div class="mx-auto grid h-16 w-16 place-items-center rounded-full bg-neon-cyan/15 text-neon-cyan">${ico('trophy', 32)}</div>
    <h1 class="mt-4 text-3xl font-bold">Torneos</h1><p class="mt-2 text-slate-300">Próximamente: inscripciones y premios.</p></section>`
};

// ---------- Mis pedidos: consulta el estado cada 8 s y avisa cuando cambia ----------
const mine = () => { try { return JSON.parse(localStorage.wl_orders || '[]'); } catch { return []; } };
const remember = c => { try { localStorage.wl_orders = JSON.stringify([c, ...mine().filter(x => x !== c)].slice(0, 10)); } catch {} };
const seen = {};
function watch() {
  const draw = async () => {
    const box = $('#list'); if (!box) return;
    const rows = (await Promise.all(mine().map(c => api('/api/orders/' + c).catch(() => null)))).filter(Boolean);
    box.innerHTML = rows.map(o => `<div class="box"><div class="flex justify-between gap-2"><b>${esc(o.code)}</b>
      <span class="${LABEL[o.status][1]}">${LABEL[o.status][0]}</span></div>
      <div class="text-slate-300">${esc(o.game)} · ${esc(o.package)} · ${bs(o.price_bs)}</div>${stepper(o.status)}</div>`).join('') || '<p class="text-slate-400">Aún no tienes pedidos en este dispositivo.</p>';
    rows.forEach(o => { if (seen[o.code] && seen[o.code] !== o.status) toast(`Pedido ${o.code}: ${LABEL[o.status][0]}`); seen[o.code] = o.status; });
  };
  draw(); timer = setInterval(draw, 8000);
}

// ---------- Router ----------
function route(top) {
  clearInterval(timer);
  const [, name, arg] = location.hash.slice(1).split('/');
  app.innerHTML = ({ juego: () => views.buy(arg), pedidos: views.orders, torneos: views.torneos }[name] || views.home)();
  if (name === 'pedidos') watch();
  app.classList.remove('fade');
  if (top) { void app.offsetWidth; app.classList.add('fade'); scrollTo(0, 0); }    // animación solo al cambiar de pantalla
}

// ---------- Acciones (delegación de eventos) ----------
// Reduce la foto del comprobante (máx. 1200 px, JPG) para que suba rápido con datos móviles y ocupe poco en la base de datos
async function shrink(f) {
  try {
    const img = await createImageBitmap(f), k = Math.min(1, 1200 / Math.max(img.width, img.height));
    const c = Object.assign(document.createElement('canvas'), { width: Math.round(img.width * k), height: Math.round(img.height * k) });
    const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0, c.width, c.height);
    const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.75));
    return blob && blob.size < f.size ? new File([blob], 'comprobante.jpg', { type: 'image/jpeg' }) : f;
  } catch { return f; }
}
const setFile = async f => {
  if (!f) return;
  if (!/^image\/(png|jpeg|webp)$/.test(f.type) || f.size > 15e6) return toast('Sube una imagen PNG, JPG o WEBP', false);
  st.file = await shrink(f); route();
};
app.onclick = async e => {
  const t = e.target, btn = t.closest('button'), act = btn?.dataset.act, g = games.find(x => x.id === st.gid);
  try {
    if (btn?.dataset.pkg) { st.pkg = +btn.dataset.pkg; route(); }
    else if (t.closest('#drop')) $('#proof').click();
    else if (act === 'go') $('#juegos')?.scrollIntoView({ behavior: 'smooth' });
    else if (act === 'reset') { st = { gid: st.gid }; route(); }
    else if (act === 'verify') {                                  // validación del ID (simulada en el servidor)
      const pid = $('#pid').value.trim(), zone = $('#zone')?.value.trim() || '';
      if (g.extra_field && !zone) throw new Error('Falta el campo ' + g.extra_field);
      const r = await api('/api/verify-id', 'POST', { game_id: g.id, player_id: pid });
      st = { gid: g.id, pid, zone, nick: r.nickname }; route();
    } else if (act === 'send') {
      btn.disabled = true;
      const fd = new FormData();
      Object.entries({ game_id: g.id, package_id: st.pkg, player_id: st.pid, zone: st.zone, nickname: st.nick }).forEach(([k, v]) => fd.append(k, v));
      fd.append('proof', st.file);
      const { code } = await api('/api/orders', 'POST', fd);
      remember(code); st = {}; location.hash = '#/pedidos'; toast('¡Pedido enviado! Tu código: ' + code);
    }
  } catch (err) { toast(err.message, false); $('[data-act=send]')?.removeAttribute('disabled'); }
};
app.onchange = e => e.target.id === 'proof' && setFile(e.target.files[0]);
app.ondragover = e => e.preventDefault();
app.ondrop = e => { e.preventDefault(); e.target.closest('#drop') && setFile(e.dataTransfer.files[0]); };
app.onsubmit = async e => {                                       // buscar un pedido por código
  e.preventDefault();
  const c = new FormData(e.target).get('c').trim().toUpperCase();
  try { await api('/api/orders/' + encodeURIComponent(c)); remember(c); route(); } catch (err) { toast(err.message, false); }
};

// ---------- Arranque y tiempo real ----------
const load = async () => { [games, cfg] = await Promise.all([api('/api/games'), api('/api/config')]); };
$('#q').oninput = e => { query = e.target.value; location.hash && location.hash !== '#/' ? (location.hash = '#/') : route(); };
addEventListener('hashchange', () => route(true));
load().then(() => route(true)).catch(() => (app.innerHTML = '<p class="text-neon-orange">No se pudo cargar el catálogo. Intenta de nuevo.</p>'));
// Cada cambio del admin llega aquí; no se repinta si el cliente está escribiendo
new EventSource('/api/events').onmessage = () => load().then(() => document.activeElement?.matches('#app input') || route()).catch(() => {});
