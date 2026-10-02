import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const scope={};vm.runInNewContext(await readFile(new URL('../public/commercial.js',import.meta.url),'utf8'),scope);
const report=(n,id='one')=>[{accountId:id,laboratorio:'5010',nombre:'Lab',movimientos:n?[{cantidad:n,codigo:'123',producto:'Producto',presentacion:'50 ml'}]:[]}];
test('señala caída de unidades del 10% con datos comparables',()=>{
 const data=scope.Commercial.opportunities(report(18),report(20),{threshold:10});assert.equal(data.pairs,1);assert.ok(Math.abs(data.change+10)<.00001);assert.equal(data.messages.length,2);assert.equal(data.messages[0].previous,20);assert.equal(data.messages[0].current,18);
});
test('no recomienda ofertas por ausencia de cobertura o distinta duración',()=>{
 assert.equal(scope.Commercial.opportunities(report(0,'other'),report(30),{threshold:10}).messages.length,0);
 assert.equal(scope.Commercial.opportunities(report(0),report(30),{threshold:10,equalDuration:false}).messages.length,0);
});
test('detecta producto sin movimiento cuando la combinación sí tiene datos',()=>{
 const data=scope.Commercial.opportunities(report(0),report(30),{threshold:10});assert.equal(data.messages.length,2);assert.equal(data.messages[0].current,0);assert.equal(data.change,-100);
});
