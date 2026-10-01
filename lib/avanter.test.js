import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseLaboratories, checkLoginResponse} from './avanter.js';

test('acepta success JSON aunque la URL de respuesta siga siendo Login', () => {
  assert.doesNotThrow(() => checkLoginResponse(JSON.stringify({success:true,returnUrl:'/prestador/index'}), 'application/json; charset=utf-8', 'https://farmacias.avanter.com.ar/Identity/Account/Login'));
});
test('distingue rechazo explícito de respuestas de autenticación desconocidas', () => {
  assert.throws(() => checkLoginResponse('{"success":false}', 'application/json', 'https://farmacias.avanter.com.ar/Identity/Account/Login'), e => e.status === 401);
  assert.throws(() => checkLoginResponse('{"otro":true}', 'application/json', 'https://farmacias.avanter.com.ar/Identity/Account/Login'), e => e.status === 502);
});

test('incluye adheridos y no adheridos, ignora enlaces externos y elimina duplicados', () => {
  // Synthetic fixture based on the observed portal links; not a captured API response.
  const html = `<div><img alt="LOREAL"><a href="/Prestador/MenuLabo?codlab=5010">Área de consulta</a></div>
    <div><img alt="DOVE"><a href="/Prestador/AdherirFarmacia?codlab=5030">Adherir Farmacia</a></div>
    <div><img alt="LOREAL"><a href="/Prestador/MenuLabo?codlab=5010">Área de consulta</a></div>
    <div><img alt="Externo"><a href="https://otro.example/Prestador/MenuLabo?codlab=9999">Otro</a></div>`;
  assert.deepEqual(parseLaboratories(html), [{codigo:'5030',nombre:'DOVE',adherido:false},{codigo:'5010',nombre:'LOREAL',adherido:true}]);
});
test('no confunde una página de acceso o formato desconocido con un listado vacío', () => {
  assert.throws(() => parseLaboratories('<form>Iniciar sesión</form>'), /listado reconocible/);
  assert.throws(() => parseLaboratories('<a href="/Prestador/MenuLabo?codlab=5010">Consulta</a>'), /formato del listado/);
});
