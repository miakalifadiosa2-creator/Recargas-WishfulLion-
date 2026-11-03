// Utilidades compartidas por la web pública y el panel
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);   // evita XSS al pintar datos
const bs = n => +Number(n).toFixed(2) + ' Bs.';
async function api(url, method = 'GET', body) {
  const raw = body === undefined || body instanceof FormData;                          // FormData: el navegador pone el Content-Type
  const r = await fetch(url, { method, body: raw ? body : JSON.stringify(body), headers: raw ? {} : { 'Content-Type': 'application/json' } });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(d.error || 'Error de conexión'), { status: r.status });
  return d;
}
function toast(msg, ok = true) {
  const t = $('#toast'), c = ok ? 'border-neon-mint text-neon-mint' : 'border-neon-orange text-neon-orange';
  t.innerHTML = `<div class="fade rounded-xl border bg-ink px-5 py-3 font-bold shadow-lg ${c}">${esc(msg)}</div>`;
  clearTimeout(toast.t); toast.t = setTimeout(() => (t.innerHTML = ''), 4000);
}
