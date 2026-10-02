import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createFirebase} from './firebase.js';
test('el lector usa el historial del administrador y no accede al vault ni escribe',async()=>{
 const calls=[];const firebase=createFirebase({projectId:'test',apiKey:'test',adminUid:'admin',viewerUids:['reader'],fetcher:async(url,options)=>{calls.push({url,options});return {ok:true,status:200,json:async()=>url.includes('signInWithPassword')?{localId:'reader',idToken:'reader-token',refreshToken:'reader-refresh',expiresIn:3600}:{documents:[]}};}});
 const session=await firebase.login('reader@example.test','test');assert.equal(session.role,'viewer');assert.equal(session.storageUid,'admin');
 await firebase.listSnapshots(session,'2026-01');assert.ok(calls.at(-1).url.includes('/avanterSales/admin/'));assert.equal(calls.at(-1).options.headers.Authorization,'Bearer reader-token');
 await assert.rejects(()=>firebase.readVault(session),{status:403});await assert.rejects(()=>firebase.writeVault(session,'cipher',null),{status:403});await assert.rejects(()=>firebase.writeSnapshot(session,'2026-01','test','cipher'),{status:403});assert.throws(()=>firebase.roleFor('unknown'),{status:403});
});
