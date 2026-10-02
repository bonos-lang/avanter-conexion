import {test} from 'node:test';
import assert from 'node:assert/strict';
import {priceHistory,validatePrices} from './prices.js';
const filters={desde:'2025-01-01',hasta:'2025-04-30',accountId:'todos',laboratorio:'todos',search:'serum',offset:0};
test('último precio, empate mayor y variación solo entre meses consecutivos',()=>{
 const row=(fecha,pvp)=>({fecha,pvp,codigo:'7791',producto:'Sérum',presentacion:'50 ml'});
 const report={laboratorios:[{accountId:'a',laboratorio:'1',nombre:'Lab',farmacia:'Centro',movimientos:[row('2025-01-30',100),row('2025-01-30',120),row('2025-02-10',110),row('2025-02-28',132),row('2025-04-30',150)]}],updatedAt:null,oldestUpdate:null};
 const data=priceHistory(report,filters);assert.equal(data.total,1);assert.deepEqual(data.rows[0].meses.map(m=>m.precio),[120,132,null,150]);assert.deepEqual(data.rows[0].meses.map(m=>m.variacion),[null,10,null,null]);
 assert.equal(priceHistory(report,{...filters,search:'7791'}).total,1);assert.equal(priceHistory(report,{...filters,search:'otro'}).total,0);
});
test('usa precio observado en compacto y separa sucursales, base cero sin porcentaje',()=>{
 const lab=(id,prices)=>({accountId:id,laboratorio:'1',nombre:'Lab',farmacia:id,movimientos:prices.map(([fecha,pvp])=>({fecha:fecha.slice(0,7)+'-01',ultimaFecha:fecha,ultimoPvp:pvp,pvp:999,codigo:'1',producto:'Sérum',presentacion:''}))});
 const data=priceHistory({laboratorios:[lab('a',[['2025-01-15',0],['2025-02-20',120]]),lab('b',[['2025-01-30',180]])]},filters);assert.equal(data.total,2);assert.equal(data.rows[0].meses[1].variacion,null);assert.equal(data.rows[1].meses[0].precio,180);assert.throws(()=>validatePrices({...filters,offset:-1}));
});
