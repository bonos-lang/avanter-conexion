import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {getLaboratories, AvanterError} from './lib/avanter.js';

const files = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/index.html', ['index.html', 'text/html; charset=utf-8']],
  ['/app.js', ['app.js', 'application/javascript; charset=utf-8']],
  ['/styles.css', ['styles.css', 'text/css; charset=utf-8']]
]);
const publicDir = fileURLToPath(new URL('./public/', import.meta.url));

export function createApp({lookup = getLaboratories, intervalMs = 3000} = {}) {
  let busy = false;
  let nextRequestAt = 0;
  return createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; form-action 'self'; base-uri 'none'");
    const json = (status, data) => {res.writeHead(status, {'Content-Type': 'application/json; charset=utf-8'}); res.end(JSON.stringify(data));};
    const path = new URL(req.url, 'http://localhost').pathname;
    if (path === '/health' && req.method === 'GET') return json(200, {ok: true});
    if (files.has(path) && (req.method === 'GET' || req.method === 'HEAD')) {
      const [filename, contentType] = files.get(path);
      try { const data = await readFile(resolve(publicDir, filename)); res.writeHead(200, {'Content-Type': contentType}); return res.end(req.method === 'HEAD' ? undefined : data); }
      catch { return json(500, {error: 'No se pudo cargar la página.'}); }
    }
    if (path !== '/api/laboratorios') return json(404, {error: 'Ruta inexistente.'});
    if (req.method !== 'POST') {res.setHeader('Allow', 'POST'); return json(405, {error: 'Usá POST.'});}
    if (!/^application\/json\b/i.test(req.headers['content-type'] || '')) return json(415, {error: 'Se requiere JSON.'});
    if (req.headers['sec-fetch-site'] === 'cross-site') return json(403, {error: 'La consulta debe hacerse desde esta página.'});
    if (busy || Date.now() < nextRequestAt) {res.setHeader('Retry-After', '3'); return json(429, {error: 'Hay una consulta en curso. Esperá unos segundos y volvé a probar.'});}
    busy = true;
    nextRequestAt = Date.now() + intervalMs;
    try {
      let size = 0; const chunks = [];
      for await (const chunk of req) {
        size += chunk.length;
        if (size > 8192) {json(413, {error: 'Solicitud demasiado grande.'}); req.resume(); return;}
        chunks.push(chunk);
      }
      let body;
      try {body = JSON.parse(Buffer.concat(chunks).toString('utf8'));} catch {return json(400, {error: 'JSON inválido.'});}
      const {email, password} = body || {};
      if (typeof email !== 'string' || !email.trim() || email.length > 254 || typeof password !== 'string' || !password || password.length > 1024) return json(400, {error: 'Completá email y contraseña de Avanter.'});
      const laboratorios = await lookup(email.trim(), password);
      return json(200, {laboratorios, consultadoEn: new Date().toISOString()});
    } catch (error) {
      // Do not log request bodies, upstream errors, passwords, tokens or cookies.
      if (!res.writableEnded) json(error instanceof AvanterError ? error.status : 502, {error: error instanceof AvanterError ? error.message : 'No se pudo completar la consulta a Avanter. Intentá nuevamente.'});
    } finally {busy = false;}
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 3000);
  const server = createApp();
  server.requestTimeout = 90000;
  server.listen(port, '0.0.0.0', () => console.log(`Prueba de conexión disponible en puerto ${port}`));
}
