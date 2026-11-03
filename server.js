// ============================================================
//  WishfulLion6770 · Servidor (Express + PostgreSQL)
//  Sirve la web pública (/), el panel privado (/admin) y la API.
//  Todo lo que se guarda va a PostgreSQL: el disco del plan
//  gratuito de Render se borra al reiniciar.
// ============================================================
const path = require('path'), fs = require('fs'), crypto = require('crypto');
const ROOT = path.join(__dirname, '..');
try { process.loadEnvFile(path.join(ROOT, '.env')); } catch {}   // solo pruebas locales; en Render se usan sus variables de entorno

const express = require('express'), helmet = require('helmet'), rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs'), jwt = require('jsonwebtoken'), multer = require('multer'), { Pool } = require('pg');

// ---------- Configuración ----------
const { DATABASE_URL, ADMIN_PASSWORD, NODE_ENV, PORT = 3000 } = process.env;
const ADMIN_USER = process.env.ADMIN_USER || 'WishfulLion6770';
if (!DATABASE_URL) throw new Error('Falta DATABASE_URL (cadena de conexión de PostgreSQL)');
if (!ADMIN_PASSWORD || ADMIN_PASSWORD.length < 12) throw new Error('ADMIN_PASSWORD debe tener al menos 12 caracteres');
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(48).toString('hex');   // sin JWT_SECRET las sesiones se cierran al reiniciar
if (JWT_SECRET.length < 32) throw new Error('JWT_SECRET debe tener al menos 32 caracteres');
const PAY = { cta: process.env.PAY_CTA || '4230422-000-001', valid: process.env.PAY_VALID || '06 de octubre de 2028' };   // QR de altoke

// ---------- Base de datos ----------
const pool = new Pool({ connectionString: DATABASE_URL, max: 5 });
pool.on('error', e => console.error('PostgreSQL:', e.message));   // Neon cierra conexiones inactivas: no debe tumbar el servidor
const q = (text, params) => pool.query(text, params);
const one = async (text, params) => (await q(text, params)).rows[0];
const sqlFile = f => fs.readFileSync(path.join(ROOT, 'database', f), 'utf8');
const sid = v => String(v ?? '');
const num = v => (/^\d{1,9}$/.test(sid(v)) ? Number(v) : 0);       // ids numéricos seguros
const clean = (v, n = 60) => sid(v).trim().slice(0, n);
// Portada del juego: la subida desde el panel (con versión, para evitar caché viejo) o la imagen incluida en /assets/games
const COVER = "COALESCE(CASE WHEN cover_type IS NOT NULL THEN '/media/game/' || id || '?v=' || cover_ver END, cover_url)";

async function init() {
  await q(sqlFile('schema.sql'));
  if (!(await one('SELECT 1 FROM games LIMIT 1'))) await q(sqlFile('seed.sql'));
  // Único administrador. ADMIN_PASSWORD manda: si la cambias en Render, se actualiza al reiniciar.
  const a = await one('SELECT username, password_hash FROM admin WHERE id = 1');
  if (!a || a.username !== ADMIN_USER || !bcrypt.compareSync(ADMIN_PASSWORD, a.password_hash))
    await q(`INSERT INTO admin (id, username, password_hash) VALUES (1, $1, $2)
             ON CONFLICT (id) DO UPDATE SET username = EXCLUDED.username, password_hash = EXCLUDED.password_hash`,
      [ADMIN_USER, bcrypt.hashSync(ADMIN_PASSWORD, 11)]);
}

// ---------- App y seguridad ----------
const app = express();
if (process.env.TRUST_PROXY) app.set('trust proxy', Number(process.env.TRUST_PROXY));   // Render: 1
app.disable('x-powered-by');
app.use(helmet({ contentSecurityPolicy: { directives: {
  scriptSrc: ["'self'"],                                  // sin scripts inline ni de terceros
  styleSrc: ["'self'", 'https://fonts.googleapis.com'], fontSrc: ['https://fonts.gstatic.com'],
  imgSrc: ["'self'", 'data:'], upgradeInsecureRequests: null
} } }));
app.use(express.json({ limit: '20kb' }));
app.use('/api', (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
const limiter = (min, limit, opts = {}) => rateLimit({ windowMs: min * 60e3, limit, standardHeaders: true, legacyHeaders: false,
  message: { error: 'Demasiados intentos. Espera un momento.' }, ...opts });
const A = fn => (req, res, next) => fn(req, res, next).catch(next);   // los errores async llegan al manejador de errores
app.get('/healthz', (req, res) => res.send('ok'));                    // Render lo usa para saber si el servicio está vivo

// ---------- Imágenes: PNG/JPG/WEBP de hasta 4 MB, verificadas por su contenido y guardadas en PostgreSQL ----------
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 4 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => cb(/^image\/(png|jpeg|webp)$/.test(file.mimetype) ? null : new Error('Solo imágenes PNG, JPG o WEBP'), true) });
const imgType = b => (b[0] === 0x89 && b[1] === 0x50 ? 'image/png' : b[0] === 0xff && b[1] === 0xd8 ? 'image/jpeg'
  : b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP' ? 'image/webp' : null);

// ---------- Tiempo real (SSE): avisa a la web cuando el admin cambia algo ----------
const clients = new Set();
app.get('/api/events', (req, res) => {
  res.set({ 'Content-Type': 'text/event-stream', Connection: 'keep-alive' }); res.flushHeaders();
  clients.add(res); req.on('close', () => clients.delete(res));
});
const broadcast = () => clients.forEach(c => c.write('data: catalog\n\n'));
setInterval(() => clients.forEach(c => c.write(': ping\n\n')), 25000).unref();   // mantiene viva la conexión

// ============================================================
//  API PÚBLICA
// ============================================================
app.get('/api/config', (req, res) => res.json(PAY));

app.get('/api/games', A(async (req, res) => {
  const games = (await q(`SELECT id, slug, name, id_label, extra_field, currency_name, tag,
      ${COVER} AS cover FROM games WHERE active = 1 ORDER BY id`)).rows;
  const pk = (await q('SELECT id, game_id, label, image, price_bs FROM packages WHERE active = 1 ORDER BY price_bs')).rows;
  res.json(games.map(g => ({ ...g, packages: pk.filter(p => p.game_id === g.id) })));
}));

app.get('/media/game/:id', A(async (req, res) => {                       // portadas de los juegos (públicas)
  const g = await one('SELECT cover_data, cover_type FROM games WHERE id = $1', [num(req.params.id)]);
  g && g.cover_data ? res.set({ 'Content-Type': g.cover_type, 'Cache-Control': 'public, max-age=86400' }).send(g.cover_data) : res.sendStatus(404);
}));

// SIMULACIÓN del apodo: no existe una API oficial para consultarlo. Solo valida el formato del ID.
// Para producción, reemplaza `nick` por la consulta a un proveedor real.
const ID_RE = /^[A-Za-z0-9]{5,20}$/;
const nick = id => ['Juan', 'Asuna', 'Shadow', 'Lobo', 'Neo', 'Kira'][parseInt(id.slice(-1), 36) % 6] + '@' + id.slice(-4);
app.post('/api/verify-id', limiter(1, 60), A(async (req, res) => {
  const pid = sid(req.body.player_id);
  if (!ID_RE.test(pid) || !(await one("SELECT 1 FROM games WHERE id = $1 AND active = 1 AND tag IS DISTINCT FROM 'proximamente'", [num(req.body.game_id)]))) return res.status(400).json({ error: 'ID inválido' });
  res.json({ nickname: nick(pid), simulated: true });
}));

// Crear pedido: el PRECIO se lee siempre de la base de datos, nunca del navegador
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const newCode = () => 'WL-' + Array.from({ length: 6 }, () => CODE_CHARS[crypto.randomInt(CODE_CHARS.length)]).join('');
app.post('/api/orders', limiter(60, 120), upload.single('proof'), A(async (req, res) => {
  const b = req.body, pid = sid(b.player_id), zone = sid(b.zone), type = req.file && imgType(req.file.buffer);
  const p = await one(`SELECT p.id, p.price_bs, g.id AS gid, g.extra_field FROM packages p JOIN games g ON g.id = p.game_id
                       WHERE p.id = $1 AND g.id = $2 AND p.active = 1 AND g.active = 1 AND g.tag IS DISTINCT FROM 'proximamente'`, [num(b.package_id), num(b.game_id)]);
  if (!type || !p || !ID_RE.test(pid) || (p.extra_field && !/^\d{3,6}$/.test(zone))) return res.status(400).json({ error: 'Pedido incompleto o inválido' });
  const code = newCode();
  await q('INSERT INTO orders (code, game_id, package_id, player_id, zone, nickname, price_bs, proof, proof_type) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)',
    [code, p.gid, p.id, pid, zone, clean(b.nickname, 40), p.price_bs, req.file.buffer, type]);
  res.json({ code });
}));

app.get('/api/orders/:code', limiter(1, 300), A(async (req, res) => {    // el cliente consulta el estado con su código
  const o = await one(`SELECT o.code, o.status, o.price_bs, g.name AS game, p.label AS package FROM orders o
                       JOIN games g ON g.id = o.game_id JOIN packages p ON p.id = o.package_id WHERE o.code = $1`, [req.params.code.toUpperCase()]);
  o ? res.json(o) : res.status(404).json({ error: 'Pedido no encontrado' });
}));

// ============================================================
//  API PRIVADA (solo WishfulLion6770)
// ============================================================
const COOKIE = 'wl_admin', COOKIE_OPTS = { httpOnly: true, sameSite: 'strict', secure: NODE_ENV === 'production' };
const requireAdmin = (req, res, next) => {
  const raw = (req.headers.cookie || '').split('; ').find(c => c.startsWith(COOKIE + '='));
  try { jwt.verify(raw ? raw.slice(COOKIE.length + 1) : '', JWT_SECRET, { algorithms: ['HS256'] }); next(); }
  catch { res.status(401).json({ error: 'No autorizado' }); }
};
// Intentos fallidos: 8 por IP y 20 en total cada 15 min (frena la fuerza bruta aunque la IP real se oculte tras el proxy)
app.post('/api/admin/login', limiter(15, 8, { skipSuccessfulRequests: true }),
  limiter(15, 20, { skipSuccessfulRequests: true, keyGenerator: () => 'login' }), A(async (req, res) => {
    const a = await one('SELECT username, password_hash FROM admin WHERE id = 1');
    const ok = bcrypt.compareSync(sid(req.body.password), a.password_hash) && req.body.username === a.username;   // bcrypt siempre se ejecuta
    if (!ok) return res.status(401).json({ error: 'Credenciales incorrectas' });
    res.cookie(COOKIE, jwt.sign({ sub: 'admin' }, JWT_SECRET, { algorithm: 'HS256', expiresIn: '8h' }), { ...COOKIE_OPTS, maxAge: 8 * 3600e3 });
    res.json({ ok: true });
  }));
app.post('/api/admin/logout', (req, res) => { res.clearCookie(COOKIE, COOKIE_OPTS); res.json({ ok: true }); });

const adm = express.Router();
app.use('/api/admin', requireAdmin, adm);          // todo lo de abajo exige sesión de admin
adm.get('/me', (req, res) => res.json({ ok: true }));

adm.get('/stats', A(async (req, res) => {
  const today = "(updated_at AT TIME ZONE 'America/La_Paz')::date = (now() AT TIME ZONE 'America/La_Paz')::date";   // «hoy» en hora de Bolivia
  const n = async text => (await one(text)).n;
  res.json({
    salesToday: await n(`SELECT COALESCE(SUM(price_bs), 0)::float8 AS n FROM orders WHERE status = 'completado' AND ${today}`),
    pending: await n("SELECT COUNT(*)::int AS n FROM orders WHERE status = 'pendiente'"),
    completed: await n("SELECT COUNT(*)::int AS n FROM orders WHERE status = 'completado'"),
    top: (await q('SELECT g.name, COUNT(*)::int AS n FROM orders o JOIN games g ON g.id = o.game_id GROUP BY g.id ORDER BY n DESC LIMIT 3')).rows
  });
}));

// --- Juegos ---
adm.get('/games', A(async (req, res) => {
  const games = (await q(`SELECT id, slug, name, id_label, extra_field, currency_name, tag, active,
      ${COVER} AS cover FROM games ORDER BY id`)).rows;
  const pk = (await q('SELECT * FROM packages ORDER BY price_bs')).rows;
  res.json(games.map(g => ({ ...g, packages: pk.filter(p => p.game_id === g.id) })));
}));
const slugify = s => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const tagOf = t => (['nuevo', 'oferta', 'proximamente'].includes(t) ? t : null);
adm.post('/games', upload.single('cover'), A(async (req, res) => {
  const b = req.body, name = clean(b.name), type = req.file ? imgType(req.file.buffer) : null;
  if (!name || (req.file && !type)) return res.status(400).json({ error: 'Falta el nombre o la portada no es una imagen válida' });
  try {
    await q('INSERT INTO games (slug, name, cover_data, cover_type, id_label, extra_field, currency_name, tag) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
      [slugify(name) || crypto.randomBytes(3).toString('hex'), name, req.file ? req.file.buffer : null, type,
       clean(b.id_label) || 'Player ID', clean(b.extra_field) || null, clean(b.currency_name) || 'Diamantes', tagOf(b.tag)]);
  } catch (e) {
    if (e.code === '23505') return res.status(400).json({ error: 'Ya existe un juego con ese nombre' });
    throw e;
  }
  broadcast(); res.json({ ok: true });
}));
adm.patch('/games/:id', upload.single('cover'), A(async (req, res) => {   // ocultar/mostrar, etiqueta y cambiar portada
  const { active, tag } = req.body, id = num(req.params.id);
  if (req.file) {
    const type = imgType(req.file.buffer);
    if (!type) return res.status(400).json({ error: 'La portada no es una imagen válida' });
    await q('UPDATE games SET cover_data = $1, cover_type = $2, cover_ver = cover_ver + 1 WHERE id = $3', [req.file.buffer, type, id]);
  }
  if (active !== undefined) await q('UPDATE games SET active = $1 WHERE id = $2', [active ? 1 : 0, id]);
  if (tag !== undefined) await q('UPDATE games SET tag = $1 WHERE id = $2', [tagOf(tag), id]);
  broadcast(); res.json({ ok: true });
}));

// --- Paquetes y precios ---
const money = v => { const n = Math.round(Number(v) * 100) / 100; return n > 0 && n < 100000 ? n : NaN; };
adm.post('/packages', A(async (req, res) => {
  const { game_id, label, price_bs } = req.body, price = money(price_bs);
  if (!clean(label) || isNaN(price) || !(await one('SELECT 1 FROM games WHERE id = $1', [num(game_id)]))) return res.status(400).json({ error: 'Nombre, precio o juego inválido' });
  await q('INSERT INTO packages (game_id, label, price_bs) VALUES ($1,$2,$3)', [num(game_id), clean(label), price]);
  broadcast(); res.json({ ok: true });
}));
adm.patch('/packages/:id', A(async (req, res) => {
  const b = req.body, p = await one('SELECT * FROM packages WHERE id = $1', [num(req.params.id)]);
  if (!p) return res.sendStatus(404);
  const price = b.price_bs === undefined ? p.price_bs : money(b.price_bs);
  if (isNaN(price)) return res.status(400).json({ error: 'Precio inválido' });
  await q('UPDATE packages SET label = $1, price_bs = $2, active = $3 WHERE id = $4',
    [clean(b.label) || p.label, price, b.active === undefined ? p.active : b.active ? 1 : 0, p.id]);
  broadcast(); res.json({ ok: true });
}));
adm.delete('/packages/:id', A(async (req, res) => {
  const id = num(req.params.id);
  if (await one('SELECT 1 FROM orders WHERE package_id = $1 LIMIT 1', [id])) await q('UPDATE packages SET active = 0 WHERE id = $1', [id]);   // ya tiene pedidos: se oculta
  else await q('DELETE FROM packages WHERE id = $1', [id]);
  broadcast(); res.json({ ok: true });
}));

// --- Pedidos y comprobantes ---
const STATUS = ['pendiente', 'en_proceso', 'completado', 'cancelado'];
adm.get('/orders', A(async (req, res) => {
  const s = STATUS.includes(req.query.status) ? req.query.status : null;
  res.json((await q(`SELECT o.id, o.code, o.status, o.price_bs, o.player_id, o.zone, o.nickname, o.created_at, g.name AS game, p.label AS package
    FROM orders o JOIN games g ON g.id = o.game_id JOIN packages p ON p.id = o.package_id
    WHERE ($1::text IS NULL OR o.status = $1) ORDER BY o.id DESC LIMIT 200`, [s])).rows);
}));
adm.get('/orders/:id/proof', A(async (req, res) => {                     // el comprobante solo lo ve el admin autenticado
  const o = await one('SELECT proof, proof_type FROM orders WHERE id = $1', [num(req.params.id)]);
  o ? res.set({ 'Content-Type': o.proof_type, 'Cache-Control': 'private, max-age=86400' }).send(o.proof) : res.sendStatus(404);
}));
adm.patch('/orders/:id', A(async (req, res) => {                         // Pendiente → En proceso → Completado
  if (!STATUS.includes(req.body.status)) return res.status(400).json({ error: 'Estado inválido' });
  const r = await q('UPDATE orders SET status = $1, updated_at = now() WHERE id = $2', [req.body.status, num(req.params.id)]);
  r.rowCount ? res.json({ ok: true }) : res.sendStatus(404);
}));

// ---------- Archivos estáticos y errores ----------
app.use('/api', (req, res) => res.status(404).json({ error: 'No encontrado' }));
app.use('/assets', express.static(path.join(ROOT, 'assets'), { maxAge: '1d' }));
app.use(express.static(path.join(ROOT, 'frontend'), { extensions: ['html'] }));      // /admin → admin.html
app.use((err, req, res, next) => {
  const known = err instanceof multer.MulterError || err.status === 400 || /^Solo imágenes/.test(err.message);
  if (!known) console.error(err);
  res.status(known ? 400 : 500).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'La imagen supera los 4 MB' : known ? err.message : 'Error interno' });
});

init().then(() => app.listen(PORT, () => console.log(`WishfulLion6770 listo en el puerto ${PORT}`)))
  .catch(e => { console.error('No se pudo iniciar:', e); process.exit(1); });
