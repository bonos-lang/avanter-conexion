import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createApp} from './server.js';
import {createVault} from './lib/vault.js';
import {seal,unseal} from './lib/security.js';
const key='test-only-encryption-key-1234567890',sessionKey='test-only-session-key-123456789012';
test('cifrado rechaza alteraciones y contexto incorrecto',()=>{
 const c=seal({password:'password-test-only'},key,'vault');assert.ok(!c.includes('password-test-only'));assert.equal(unseal(c,key,'vault').password,'password-test-only');assert.throws(()=>unseal(c,key,'session'));assert.throws(()=>unseal(c,key+'wrong','vault'));assert.throws(()=>unseal(c.slice(0,-4)+'AAAA',key,'vault'));
});
const storage=()=>{let cipher=null,version=null;return {configured:()=>true,readVault:async()=>({cipher,version}),writeVault:async(_,value,v)=>{assert.equal(v,version);cipher=value;version='updated';},login:async()=>({uid:'admin',idToken:'test-token',refreshToken:'test-refresh',tokenExpires:Date.now()+3600000,sessionExpires:Date.now()+28800000})};};
test('persiste y recupera tras reiniciar sin revelar password al listar',async()=>{
 const firebase=storage(),session={uid:'admin'};let vault=createVault({firebase,encryptionKey:key});
 const a=await vault.add(session,{name:'Centro',email:'test@example.test',password:'secret-test-only'});assert.equal(a.password,undefined);assert.ok(!(await firebase.readVault()).cipher.includes('secret-test-only'));
 vault=createVault({firebase,encryptionKey:key});assert.deepEqual(await vault.list(session),[a]);assert.equal((await vault.get(session,a.id)).password,'secret-test-only');assert.equal((await vault.add(session,{name:'Centro 2',email:'TEST@example.test',password:'new-test-only'})).id,a.id);assert.equal((await vault.list(session)).length,1);
});
test('protege las consultas y usa solo credenciales del almacenamiento',async()=>{
 const calls=[],firebase=storage();const server=createApp({firebase,encryptionKey:key,sessionSecret:sessionKey,intervalMs:0,lookup:async(...args)=>{calls.push(args);return [{codigo:'5010',nombre:'LOREAL',adherido:false}];}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;let cookie='';
 const post=(path,body,headers={})=>fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json',cookie,...headers},body:JSON.stringify(body)});
 try{
 assert.equal((await fetch(base+'/api/accounts')).status,401);assert.equal((await post('/api/laboratorios',{email:'x',password:'y'})).status,401);
 const login=await post('/api/login',{email:'admin@example.test',password:'panel-test-only'});assert.equal(login.status,200);cookie=login.headers.get('set-cookie').split(';')[0];assert.match(login.headers.get('set-cookie'),/HttpOnly; SameSite=Strict/);assert.ok(!cookie.includes('test-token'));
 assert.equal((await post('/api/accounts',{},{Origin:'https://evil.example'})).status,403);
 const save=await post('/api/accounts',{name:'Centro',email:'farmacia@example.test',password:'avanter-test-only'});assert.equal(save.status,200);const data=await save.json();assert.equal(data.account.password,undefined);
 assert.ok(!(await (await fetch(base+'/api/accounts',{headers:{cookie}})).text()).includes('avanter-test-only'));
 assert.equal((await post('/api/laboratorios',{accountId:data.account.id})).status,200);assert.deepEqual(calls,[['farmacia@example.test','avanter-test-only'],['farmacia@example.test','avanter-test-only']]);
 assert.equal((await fetch(base+'/api/accounts',{headers:{cookie:cookie+'broken'}})).status,401);assert.equal((await fetch(base+'/lib/security.js')).status,404);
 assert.match((await post('/api/logout',{})).headers.get('set-cookie'),/Max-Age=0/);
 }finally{await new Promise(r=>server.close(r));}
});
