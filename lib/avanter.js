import {load} from 'cheerio';
import makeFetchCookie from 'fetch-cookie';
import {CookieJar} from 'tough-cookie';

const ORIGIN = 'https://farmacias.avanter.com.ar';
const LOGIN = '/Identity/Account/Login';
export class AvanterError extends Error {
  constructor(message, status = 502) { super(message); this.status = status; }
}

// This is an adapter for the observed web portal, not a documented public API.
export function parseLaboratories(html) {
  const $ = load(html);
  const rows = new Map();
  $('a[href]').each((_, link) => {
    const href = $(link).attr('href');
    const url = new URL(href, ORIGIN);
    if (url.origin !== ORIGIN || !/^\/Prestador\/(MenuLabo|AdherirFarmacia)\/?$/i.test(url.pathname)) return;
    const code = url.searchParams.get('codlab');
    if (!code || !/^\d+$/.test(code)) return;
    let parent = $(link);
    let name = '';
    for (let depth = 0; depth < 6 && parent.length; depth++, parent = parent.parent()) {
      const images = parent.find('img[alt]');
      if (images.length === 1) { name = images.first().attr('alt')?.trim() || ''; if (name) break; }
      if (images.length > 1) break;
    }
    if (!name) throw new AvanterError('El formato del listado cambió: no se pudo identificar un laboratorio.');
    rows.set(code, {codigo: code, nombre: name, adherido: /\/MenuLabo/i.test(url.pathname)});
  });
  if (!rows.size) throw new AvanterError('Avanter no devolvió un listado reconocible de laboratorios.');
  return [...rows.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}

export async function getLaboratories(email, password) {
  // Separate jar per request/account; never persist passwords or session cookies.
  const sessionFetch = makeFetchCookie(fetch, new CookieJar());
  const request = async (path, options = {}) => {
    const response = await sessionFetch(ORIGIN + path, {...options, signal: AbortSignal.timeout(20000)});
    if (!response.ok) throw new AvanterError(response.status === 403
      ? 'Avanter rechazó el acceso desde el servidor. Hay que revisar la integración con Avanter.'
      : 'Avanter no pudo responder a la consulta.');
    if (new URL(response.url).origin !== ORIGIN) throw new AvanterError('Avanter redirigió a un destino inesperado.');
    return response;
  };
  const page = await request(LOGIN);
  const $ = load(await page.text());
  const token = $('input[name="__RequestVerificationToken"]').attr('value');
  if (!token) throw new AvanterError('No se encontró el token del formulario de acceso de Avanter.');
  const body = new URLSearchParams({'Input.Email': email, 'Input.Password': password, '__RequestVerificationToken': token});
  const signedIn = await request(LOGIN, {method: 'POST', headers: {'Content-Type': 'application/x-www-form-urlencoded'}, body});
  const signedInHtml = await signedIn.text();
  if (new URL(signedIn.url).pathname.toLowerCase().includes('/identity/') || load(signedInHtml)('input[name="Input.Password"]').length) {
    throw new AvanterError('Avanter no aceptó el ingreso. Revisá el email y la contraseña o si la cuenta requiere un paso adicional.', 401);
  }
  const list = await request('/prestador/index');
  if (new URL(list.url).pathname.toLowerCase().includes('/identity/')) throw new AvanterError('La sesión de Avanter no quedó autenticada.', 401);
  return parseLaboratories(await list.text());
}
