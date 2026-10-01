import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createApp} from './server.js';
import {AvanterError} from './lib/avanter.js';

test('sirve la página y conecta el endpoint con el adaptador sin guardar sesiones', async () => {
  const calls = [];
  const server = createApp({intervalMs: 0, lookup: async (...args) => {calls.push(args); return [{nombre:'DOVE',codigo:'5030',adherido:false}];}});
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const home = await fetch(base); assert.equal(home.status,200); assert.match(await home.text(),/Probar conexión/);
    const response = await fetch(base+'/api/laboratorios',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'prueba@example.test',password:'test-only'})});
    assert.equal(response.status,200); assert.equal(response.headers.get('cache-control'),'no-store');
    assert.equal((await response.json()).laboratorios[0].adherido,false);
    assert.deepEqual(calls,[['prueba@example.test','test-only']]);
    assert.equal((await fetch(base+'/api/laboratorios')).status,405);
    assert.equal((await fetch(base+'/server.js')).status,404);
  } finally {await new Promise(resolve => server.close(resolve));}
});

test('rechaza entradas incompletas y propaga login rechazado sin mostrar credenciales', async () => {
  const server = createApp({intervalMs:0,lookup:async()=>{throw new AvanterError('Ingreso rechazado',401);}});
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  const endpoint = `http://127.0.0.1:${server.address().port}/api/laboratorios`;
  const post = body => fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  try {
    assert.equal((await post({email:'test@example.test'})).status,400);
    const rejected = await post({email:'test@example.test',password:'secret-test-only'});
    assert.equal(rejected.status,401); assert.deepEqual(await rejected.json(),{error:'Ingreso rechazado'});
  } finally {await new Promise(resolve => server.close(resolve));}
});
