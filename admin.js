// ============================================================
//  Panel de administración · uso exclusivo de WishfulLion6770
//  La sesión es una cookie httpOnly: este JS nunca ve el token.
// ============================================================
const app = $('#app');
let tab = 'orders', filter = '';
const STATUS = { pendiente: 'Pendiente', en_proceso: 'En proceso', completado: 'Completado', cancelado: 'Cancelado' };
const opts = (pairs, cur) => pairs.map(([v, t]) => `<option value="${v}" ${v === cur ? 'selected' : ''}>${t}</option>`).join('');
const fail = err => (err.status === 401 && !$('#login') ? login() : toast(err.message, false));

function login() {
  app.innerHTML = `<form id="login" class="card fade mx-auto mt-24 max-w-sm space-y-3 !p-6">
    <h1 class="text-2xl font-bold text-neon-cyan">🔐 Acceso privado</h1>
    <input name="username" class="inp" placeholder="Usuario" autocomplete="username" required>
    <input name="password" type="password" class="inp" placeholder="Contraseña" autocomplete="current-password" required>
    <button class="btn btn-cyan w-full">Entrar</button></form>`;
}

// ---------- Pestaña: pedidos y comprobantes ----------
const ordersTab = list => `<div class="flex flex-wrap gap-2">${[['', 'Todos'], ['pendiente', 'Pendientes'], ['en_proceso', 'En proceso'], ['completado', 'Completados'], ['cancelado', 'Cancelados']]
  .map(([v, t]) => `<button data-filter="${v}" class="btn !py-1 ${filter === v ? 'btn-orange' : 'bg-white/10'}">${t}</button>`).join('')}</div>
  <div class="mt-4 space-y-3">${list.map(o => `<div class="card flex flex-wrap items-center gap-4">
    <a href="/api/admin/orders/${o.id}/proof" target="_blank" rel="noopener"><img loading="lazy" src="/api/admin/orders/${o.id}/proof" alt="Comprobante" class="h-24 w-20 rounded-lg bg-black/40 object-cover"></a>
    <div class="min-w-0 flex-1"><b>${esc(o.code)}</b> · ${esc(o.game)} · ${esc(o.package)} · <span class="text-neon-mint">${bs(o.price_bs)}</span>
      <div class="text-slate-300">ID ${esc(o.player_id)}${o.zone ? ' (' + esc(o.zone) + ')' : ''} · ${esc(o.nickname)}</div>
      <div class="text-sm text-slate-500">${new Date(o.created_at).toLocaleString('es-BO', { timeZone: 'America/La_Paz' })}</div></div>
    <select data-order="${o.id}" class="inp !w-auto">${opts(Object.entries(STATUS), o.status)}</select></div>`).join('') || '<p class="text-slate-400">Sin pedidos.</p>'}</div>`;

// ---------- Pestaña: juegos, paquetes y precios ----------
const catalogTab = games => `<details class="card"><summary class="cursor-pointer font-bold text-neon-cyan">➕ Agregar videojuego</summary>
  <form id="newGame" class="mt-3 grid gap-3 md:grid-cols-3">
    <input name="name" class="inp" placeholder="Nombre del juego" required>
    <input name="id_label" class="inp" placeholder="Campo de ID (ej. Player ID)">
    <input name="extra_field" class="inp" placeholder="Campo extra (ej. Zone ID), opcional">
    <input name="currency_name" class="inp" placeholder="Moneda del juego (Diamantes, Bonds...)">
    <select name="tag" class="inp">${opts([['', 'Sin etiqueta'], ['nuevo', 'Nuevo juego'], ['oferta', 'Oferta especial'], ['proximamente', 'Próximamente (aún no se vende)']], '')}</select>
    <input name="cover" type="file" accept="image/png,image/jpeg,image/webp" class="inp">
    <button class="btn btn-cyan md:col-span-3">Crear juego</button></form></details>
  ${games.map(g => `<div class="card mt-4" data-game="${g.id}" data-active="${g.active}">
    <div class="flex flex-wrap items-center gap-3">${g.cover ? `<img src="${esc(g.cover)}" alt="" class="h-14 w-14 rounded-xl object-cover">` : ''}<b class="text-xl">${esc(g.name)}</b>
      <select data-tag class="inp !w-auto">${opts([['', 'Sin etiqueta'], ['nuevo', 'Nuevo'], ['oferta', 'Oferta'], ['proximamente', 'Próximamente']], g.tag || '')}</select>
      <button data-act="toggleGame" class="btn !py-1 ${g.active ? 'btn-cyan' : 'bg-white/10'}">${g.active ? 'Visible en la web' : 'Oculto'}</button>
      <label class="btn cursor-pointer bg-white/10 !py-1">Cambiar portada<input type="file" data-cover accept="image/png,image/jpeg,image/webp" hidden></label></div>
    <div class="mt-3 space-y-2">${g.packages.map(p => `<div class="flex flex-wrap gap-2" data-pkg="${p.id}" data-active="${p.active}">
      <input data-f="label" class="inp !w-44 flex-1" value="${esc(p.label)}">
      <input data-f="price" type="number" step="any" min="0" class="inp !w-28" value="${p.price_bs}">
      <button data-act="savePkg" class="btn btn-cyan !py-1">Guardar</button>
      <button data-act="hidePkg" class="btn bg-white/10 !py-1">${p.active ? 'Ocultar' : 'Mostrar'}</button>
      <button data-act="delPkg" class="btn bg-white/10 !py-1 text-neon-orange">Eliminar</button></div>`).join('')}
      <div class="flex flex-wrap gap-2" data-new>
        <input data-f="label" class="inp !w-44 flex-1" placeholder="Nuevo paquete (ej. 520 + 40)">
        <input data-f="price" type="number" step="any" min="0" class="inp !w-28" placeholder="Bs.">
        <button data-act="addPkg" class="btn btn-orange !py-1">Agregar</button></div></div></div>`).join('')}`;

// ---------- Dashboard ----------
async function panel() {
  const [s, games, orders] = await Promise.all([api('/api/admin/stats'), api('/api/admin/games'), api('/api/admin/orders?status=' + filter)]);
  const stat = (t, v, c = 'text-3xl') => `<div class="card"><div class="text-slate-400">${t}</div><div class="${c} font-bold text-neon-cyan">${v}</div></div>`;
  const tabBtn = (id, t) => `<button data-tab="${id}" class="btn ${tab === id ? 'btn-cyan' : 'bg-white/10'}">${t}</button>`;
  app.innerHTML = `<div class="fade"><div class="flex items-center justify-between">
    <h1 class="text-2xl font-bold text-neon-cyan">WishfulLion6770 · Panel</h1><button data-act="logout" class="text-neon-orange underline">Salir</button></div>
    <div class="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">${stat('Ventas de hoy', bs(s.salesToday))}${stat('Pedidos pendientes', s.pending)}${stat('Recargas completadas', s.completed)}
      ${stat('Más solicitados', s.top.map(t => `${esc(t.name)} (${t.n})`).join('<br>') || '—', 'text-lg')}</div>
    <details class="card mt-4"><summary class="cursor-pointer font-bold text-neon-cyan">¿Cómo uso mi panel?</summary><ol class="mt-3 list-decimal space-y-1 pl-5 text-slate-300"><li>Pedidos: toca la miniatura para ver el comprobante y revisa que el monto coincida.</li><li>Cambia el estado a En proceso y, cuando entregues la recarga, a Completado: el cliente lo ve en su pantalla.</li><li>Juegos y precios: edita el nombre o el precio de un paquete y pulsa Guardar; se ve al instante en la tienda.</li><li>Agregar videojuego: pon nombre, portada y el nombre del campo de ID. La etiqueta Próximamente lo anuncia sin venderlo.</li><li>Ocultar desactiva un juego o paquete sin borrarlo.</li></ol></details>
    <div class="mt-6 flex gap-2">${tabBtn('orders', 'Pedidos')}${tabBtn('catalog', 'Juegos y precios')}</div>
    <div class="mt-4">${tab === 'orders' ? ordersTab(orders) : catalogTab(games)}</div></div>`;
}

// ---------- Acciones ----------
app.onclick = async e => {
  const b = e.target.closest('button'); if (!b) return;
  const d = b.dataset, card = b.closest('[data-game]'), row = b.closest('[data-pkg]');
  const f = (r, k) => r.querySelector(`[data-f=${k}]`).value;
  try {
    if (d.tab) tab = d.tab;
    else if ('filter' in d) filter = d.filter;
    else if (d.act === 'logout') { await api('/api/admin/logout', 'POST'); return login(); }
    else if (d.act === 'toggleGame') await api('/api/admin/games/' + card.dataset.game, 'PATCH', { active: card.dataset.active !== '1' });
    else if (d.act === 'savePkg') await api('/api/admin/packages/' + row.dataset.pkg, 'PATCH', { label: f(row, 'label'), price_bs: f(row, 'price') });
    else if (d.act === 'hidePkg') await api('/api/admin/packages/' + row.dataset.pkg, 'PATCH', { active: row.dataset.active !== '1' });
    else if (d.act === 'delPkg') { if (!confirm('¿Eliminar este paquete?')) return; await api('/api/admin/packages/' + row.dataset.pkg, 'DELETE'); }
    else if (d.act === 'addPkg') { const r = b.closest('[data-new]'); await api('/api/admin/packages', 'POST', { game_id: card.dataset.game, label: f(r, 'label'), price_bs: f(r, 'price') }); }
    else return;
    if (d.act) toast('Guardado ✔');
    await panel();
  } catch (err) { fail(err); }
};
app.onsubmit = async e => {
  e.preventDefault();
  try {
    if (e.target.id === 'login') { await api('/api/admin/login', 'POST', Object.fromEntries(new FormData(e.target))); await panel(); }
    else if (e.target.id === 'newGame') { await api('/api/admin/games', 'POST', new FormData(e.target)); toast('Juego creado ✔'); await panel(); }
  } catch (err) { fail(err); }
};
app.onchange = async e => {                                       // cambiar estado de pedido (el cliente lo ve en su pantalla) o etiqueta
  const t = e.target;
  try {
    if (t.dataset.order) await api('/api/admin/orders/' + t.dataset.order, 'PATCH', { status: t.value });
    else if ('cover' in t.dataset) {
      if (!t.files[0]) return;
      const fd = new FormData(); fd.append('cover', t.files[0]);
      await api('/api/admin/games/' + t.closest('[data-game]').dataset.game, 'PATCH', fd); await panel();
    }
    else if ('tag' in t.dataset) await api('/api/admin/games/' + t.closest('[data-game]').dataset.game, 'PATCH', { tag: t.value });
    else return;
    toast('Guardado ✔');
  } catch (err) { fail(err); }
};
api('/api/admin/me').then(panel).catch(login);
