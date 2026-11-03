# WishfulLion6770 · Recargas de videojuegos

Tienda pública (`/`) + panel privado (`/admin`) en un solo enlace. Node.js, Express, PostgreSQL y Tailwind.

## Publicar en Render (resumen)
1. Sube el CONTENIDO de esta carpeta a un repositorio de GitHub (`package.json` debe quedar en la raíz).
2. Neon (console.neon.tech): crea un proyecto y copia la cadena de conexión (`postgresql://...`).
3. Render → New + → Blueprint → elige el repositorio. Pega `DATABASE_URL` y escribe `ADMIN_PASSWORD` (12+ caracteres). `JWT_SECRET` lo genera Render.

## Entrar a tu panel
1. Abre tu enlace y agrega `/admin` al final (no hay botón público).
2. Usuario `WishfulLion6770` y la contraseña que pusiste en `ADMIN_PASSWORD`.
3. Pedidos: mira el comprobante y cambia el estado. Juegos y precios: edita precios, agrega paquetes y juegos, cambia portadas y etiquetas (Nuevo, Oferta, Próximamente).
4. Para cambiar la contraseña: edita `ADMIN_PASSWORD` en Render y reinicia el servicio.

## Probar en tu computadora
`cp .env.example .env` (Windows: `copy`), completa `DATABASE_URL` y `ADMIN_PASSWORD`, luego `npm install` y `npm start` → http://localhost:3000

## Notas
- Las claves NUNCA van en el repositorio: se escriben en Render. `.env` está en `.gitignore`.
- Un único admin: bcrypt, cookie httpOnly + SameSite=Strict, límite de intentos y CSP.
- Las imágenes de `assets/games/` son arte de cada juego (pertenece a sus dueños): cámbialas desde el panel con «Cambiar portada» si hace falta. Blood Strike lleva una portada temporal.
- Los comprobantes solo se sirven al admin autenticado. Neon gratis da 0.5 GB.
- La verificación del apodo es una simulación: cámbiala en `backend/server.js` (`nick`) por un proveedor real.
