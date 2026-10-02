import {test} from 'node:test';
import assert from 'node:assert/strict';
import {discountHistory,validateDiscounts} from './discounts.js';
const q={desde:'2025-01-01',hasta:'2025-03-31',accountId:'todos',laboratorio:'todos'};
const lab=(mes,sucursal,rows)=>({mes,accountId:sucursal,farmacia:sucursal,laboratorio:'1',nombre:'Lab',movimientos:rows});
const row=(rate,ops,amount)=>({porcentajeDescuento:rate,operaciones:ops,cantidad:999,descuento:amount});
test('cuenta operaciones compactadas y calcula participación mensual y por sucursal',()=>{
 const data=discountHistory({laboratorios:[lab('2025-01','A',[row(10,2,20),row(20,3,60)]),lab('2025-01','B',[row(20,5,100)]),lab('2025-02','A',[row(20,4,80)])]},q);
 assert.deepEqual(data.series.map(s=>s.rate),[10,20]);const ten=data.series[0];assert.deepEqual(ten.meses[0],{mes:'2025-01',cantidad:2,participacion:20,importe:20});assert.equal(ten.meses[1].cantidad,0);assert.equal(ten.meses[2].cantidad,null);assert.equal(data.series[1].meses[0].cantidad,8);assert.equal(data.detail.find(d=>d.sucursal==='A'&&d.rate===10).meses[0].participacion,40);
});
test('no agrupa porcentajes diferentes ni convierte importes desconocidos en cero',()=>{
 const data=discountHistory({laboratorios:[lab('2025-01','A',[row(20,1,null),row(20.5,1,10),row(null,1,5)]),lab('2025-02','A',[])]},q);
 assert.deepEqual(data.series.map(s=>s.rate),[20,20.5,null]);assert.equal(data.series[0].meses[0].importe,null);assert.equal(data.series[0].meses[1].cantidad,0);assert.equal(data.series[0].meses[1].participacion,null);assert.throws(()=>validateDiscounts({...q,accountId:12}));
});
