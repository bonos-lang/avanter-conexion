import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseSales,validateRange} from './sales.js';
const lab={codigo:'5010',nombre:'LOREAL'},range={desde:'2026-09-01',hasta:'2026-09-30',laboratorio:'5010'};
test('suma líneas y días sin duplicar totales repetidos de la API',()=>{
 const data={isSuccess:true,result:[{fecha:'01-09-2026',cantidad:2,pvp:100.25,totalUnidades:3,totalaReembolsar:40},{fecha:'2026-09-02T00:00:00',cantidad:1,pvp:'50.10',totalUnidades:3,totalaReembolsar:40}]};
 const result=parseSales(data,lab,range);assert.equal(result.unidades,3);assert.equal(result.ventaBruta,250.6);assert.equal(result.reembolso,40);assert.deepEqual(result.porDia,[{fecha:'2026-09-01',unidades:2,ventaBruta:200.5},{fecha:'2026-09-02',unidades:1,ventaBruta:50.1}]);
});
test('no convierte datos inválidos, errores ni totales discordantes en ventas cero',()=>{
 assert.throws(()=>parseSales({isSuccess:false,result:[]},lab,range));assert.throws(()=>parseSales({isSuccess:true,result:[{fecha:'01-09-2026',cantidad:1,pvp:'1.000,50',totalUnidades:1,totalaReembolsar:0}]},lab,range));assert.throws(()=>parseSales({isSuccess:true,result:[{fecha:'01-09-2026',cantidad:1,pvp:100,totalUnidades:2,totalaReembolsar:0}]},lab,range));assert.equal(parseSales({isSuccess:true,result:[]},lab,range).unidades,0);
});
test('valida fechas reales, orden y límite de período',()=>{
 assert.deepEqual(validateRange(range),range);for(const invalid of [{...range,desde:'2026-02-30'},{...range,hasta:'2026-08-31'},{...range,desde:'2026-01-01'},{...range,laboratorio:'../invalid'}])assert.throws(()=>validateRange(invalid));
});
