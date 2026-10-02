import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createApp} from './server.js';
import {createVault} from './lib/vault.js';
import {seal,unseal} from './lib/security.js';
import {AppError} from './lib/security.js';
import {createHistory} from './lib/history.js';
const key='test-only-encryption-key-1234567890',sessionKey='test-only-session-key-123456789012';
test('cifrado rechaza alteraciones y contexto incorrecto',()=>{
 const c=seal({password:'password-test-only'},key,'vault');assert.ok(!c.includes('password-test-only'));assert.equal(unseal(c,key,'vault').password,'password-test-only');assert.throws(()=>unseal(c,key,'session'));assert.throws(()=>unseal(c,key+'wrong','vault'));assert.throws(()=>unseal(c.slice(0,-4)+'AAAA',key,'vault'));
});

test('lector accede al historial del propietario pero no a credenciales ni modificaciones',async()=>{
 const firebase=storage(),docs=new Map();
 firebase.roleFor=uid=>uid==='admin'?'admin':'viewer';firebase.ownerUid=()=> 'admin';
 firebase.login=async()=>({uid:'viewer',idToken:'test-token',refreshToken:'test-refresh',tokenExpires:Date.now()+3600000,sessionExpires:Date.now()+28800000});
 firebase.writeSnapshot=async(_,month,id,cipher)=>docs.set(month+':'+id,{id,cipher});firebase.listSnapshots=async(_,month)=>[...docs].filter(([k])=>k.startsWith(month+':')).map(([,v])=>v);
 const currentMonth=new Date().toISOString().slice(0,7);await createHistory({firebase,encryptionKey:key}).save({uid:'admin'},{id:'one',name:'Centro'},{month:currentMonth,desde:currentMonth+'-01',hasta:currentMonth+'-01'},{laboratorio:'5010',nombre:'Lab',movimientos:[],porDia:[],unidades:0,reembolso:0,ventaBruta:0,registros:0});
 let vaultCalls=0;const vault={list:async()=>{vaultCalls++;throw new Error('No leer credenciales');}};
 const server=createApp({firebase,vault,encryptionKey:key,sessionSecret:sessionKey,intervalMs:0});await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;let cookie='';
 const post=(path,body)=>fetch(base+path,{method:'POST',headers:{cookie,'Content-Type':'application/json'},body:JSON.stringify(body)});
 try{const login=await post('/api/login',{email:'reader@example.test',password:'test'});cookie=login.headers.get('set-cookie').split(';')[0];
  const accounts=await (await fetch(base+'/api/accounts',{headers:{cookie}})).json();assert.equal(accounts.role,'viewer');assert.deepEqual(accounts.accounts,[{id:'one',name:'Centro'}]);assert.equal(vaultCalls,0);
  for(const route of ['/api/accounts','/api/import','/api/import-status','/api/laboratorios','/api/ventas'])assert.equal((await post(route,{})).status,403,route);
  const data=await (await post('/api/history',{accountId:'todos',laboratorio:'todos',desde:currentMonth+'-01',hasta:currentMonth+'-01'})).json();assert.equal(data.snapshots,1);
 }finally{await new Promise(r=>server.close(r));}
});

test('una importación fallida conserva el mes y el historial se lee sin consultar Avanter',async()=>{
 const firebase=storage(),docs=new Map();let fail=false,calls=0;
 firebase.writeSnapshot=async(_,month,id,cipher)=>docs.set(month+id,{id,cipher});
 firebase.listSnapshots=async(_,month)=>[...docs].filter(([k])=>k.startsWith(month)).map(([,v])=>v);
 const server=createApp({firebase,encryptionKey:key,sessionSecret:sessionKey,intervalMs:0,lookup:async()=>[],salesLookup:async()=>{calls++;if(fail)throw new AppError('Fallo de prueba',502);return {sinAdhesion:false,errores:[],laboratorios:[{laboratorio:'5010',nombre:'Prueba',unidades:0,ventaBruta:0,reembolso:0,registros:0,movimientos:[],porDia:[]}]};}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;let cookie='';
 const post=(path,body)=>fetch(base+path,{method:'POST',headers:{cookie,'Content-Type':'application/json'},body:JSON.stringify(body)});
 try{
  assert.equal((await post('/api/history',{desde:'2025-01-01',hasta:'2025-01-31'})).status,401);
  const login=await post('/api/login',{email:'admin@example.test',password:'test'});cookie=login.headers.get('set-cookie').split(';')[0];
  const a=(await (await post('/api/accounts',{name:'Centro',email:'test@example.test',password:'test'})).json()).account;
  const body={accountId:a.id,laboratorio:'5010',month:'2025-01'};
  assert.equal((await post('/api/import',body)).status,200);const original=[...docs.values()][0].cipher;
  fail=true;assert.equal((await post('/api/import',body)).status,502);assert.equal([...docs.values()][0].cipher,original);
  const data=await (await post('/api/history',{accountId:'todos',laboratorio:'todos',desde:'2025-01-01',hasta:'2025-01-31'})).json();
  assert.equal(data.snapshots,1);assert.equal(calls,2);
 }finally{await new Promise(r=>server.close(r));}
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
