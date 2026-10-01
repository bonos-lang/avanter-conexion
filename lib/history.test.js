import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHistory,months} from './history.js';
test('divide el historial en meses completos y valida fechas',()=>{
 assert.deepEqual(months('2025-01-15','2025-02-03'),[{month:'2025-01',desde:'2025-01-01',hasta:'2025-01-31'},{month:'2025-02',desde:'2025-02-01',hasta:'2025-02-28'}]);
 assert.throws(()=>months('2025-02-30','2025-03-01'));assert.throws(()=>months('2024-01-01','2025-01-01'));
});
test('persiste cifrado, reemplaza el mes sin duplicados y filtra fechas/cuentas',async()=>{
 const docs=new Map(),firebase={writeSnapshot:async(_,month,id,cipher)=>docs.set(month+':'+id,{id,cipher}),listSnapshots:async(_,month)=>[...docs].filter(([k])=>k.startsWith(month+':')).map(([,v])=>v)};
 const make=()=>createHistory({firebase,encryptionKey:'test-history-key-12345678901234567890'}),session={uid:'admin'},account={id:'one',name:'Farmacia prueba'};
 const result={laboratorio:'5010',nombre:'Laboratorio',unidades:3,ventaBruta:300,reembolso:75,registros:2,movimientos:[{fecha:'2025-01-01',cantidad:1,pvp:100,reembolsoConIva:25},{fecha:'2025-01-20',cantidad:2,pvp:100,reembolsoConIva:50}],porDia:[]};
 const range={month:'2025-01',desde:'2025-01-01',hasta:'2025-01-31'};
 await make().save(session,account,range,result);await make().save(session,account,range,result);
 assert.equal(docs.size,1);assert.ok(![...docs.values()][0].cipher.includes('Farmacia prueba'));
 const filters={accountId:'todos',laboratorio:'todos',desde:'2025-01-01',hasta:'2025-01-31'};
 let report=await make().report(session,filters);assert.equal(report.laboratorios.length,1);assert.equal(report.laboratorios[0].reembolso,75);assert.equal(report.laboratorios[0].unidades,3);
 report=await make().report(session,{...filters,hasta:'2025-01-10'});assert.equal(report.laboratorios[0].unidades,1);assert.equal(report.laboratorios[0].reembolso,25);
 assert.equal((await make().report(session,{...filters,accountId:'other'})).laboratorios.length,0);
 const wrong=make();await assert.rejects(()=>wrong.report({uid:'other'},filters));
});
