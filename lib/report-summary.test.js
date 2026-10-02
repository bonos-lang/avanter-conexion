import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {compactMovements} from './report-summary.js';
const scope={};vm.runInNewContext(await readFile(new URL('../public/report-utils.js',import.meta.url),'utf8'),scope);
const distribution=scope.ReportUtils.discountDistribution;
const row=(overrides={})=>({fecha:'2026-01-10',cantidad:2,pvp:100,producto:'Producto',presentacion:'10 ml',codigo:'123',porcentajeDescuento:20,descuento:40,referenciaConIva:80,reembolsoConIva:20,...overrides});
test('el conteo usa porcentajes exactos y movimientos, no unidades ni importe',()=>{
 const d=distribution([row(),row({cantidad:10,pvp:500}),row({porcentajeDescuento:25}),row({porcentajeDescuento:null})]);
 assert.equal(d.total,4);assert.equal(d.groups.length,3);assert.equal(d.groups[0].rate,20);assert.equal(d.groups[0].count,2);assert.equal(d.groups[1].rate,25);assert.equal(d.groups[2].rate,null);
});
test('consolidar períodos conserva dinero, operaciones y último precio observado',()=>{
 const rows=[row(),row({fecha:'2026-01-20',cantidad:3,pvp:150,descuento:90,referenciaConIva:120,reembolsoConIva:45}),row({porcentajeDescuento:30})];
 const compact=compactMovements(rows);assert.equal(compact.length,2);assert.equal(compact[0].operaciones,2);assert.equal(compact[0].cantidad,5);assert.equal(compact[0].bruto,650);assert.equal(compact[0].descuento,130);assert.equal(compact[0].reembolsoConIva,65);assert.equal(compact[0].referenciaConIva*5,520);assert.equal(compact[0].ultimoPvp,150);assert.equal(compact[0].ultimaFecha,'2026-01-20');
 assert.equal(distribution(compact).total,3);assert.equal(distribution(compact).groups[0].count,2);
});
test('un importe desconocido no se convierte en cero en el resumen',()=>{
 const compact=compactMovements([row(),row({descuento:null,referenciaConIva:null})]);assert.equal(compact[0].descuento,null);assert.equal(compact[0].referenciaConIva,null);assert.equal(distribution(compact).amount,null);
});
