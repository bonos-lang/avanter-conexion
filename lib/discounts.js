import {months} from './history.js';
import {AppError} from './security.js';
const round=n=>Math.round(n*100)/100;
export function validateDiscounts(q){
 months(q.desde,q.hasta);
 if(typeof q.accountId!=='string'||q.accountId.length>80||typeof q.laboratorio!=='string'||q.laboratorio.length>80)throw new AppError('Filtros de descuentos inválidos.',400);
}
export function discountHistory(report,q){
 const periods=months(q.desde,q.hasta).map(r=>r.month),totals=new Map(periods.map(m=>[m,{mes:m,operaciones:0,snapshots:0}])),rates=new Map(),detail=new Map();
 const empty=()=>({cantidad:0,importe:0});
 function accumulate(map,key,row,month){const item=map.get(key)||{rate:key,months:new Map()};const value=item.months.get(month)||empty();value.cantidad+=row.operaciones??1;value.importe=value.importe==null||row.descuento==null?null:value.importe+row.descuento;item.months.set(month,value);map.set(key,item);}
 for(const lab of report.laboratorios){
  const month=lab.mes||lab.movimientos[0]?.fecha.slice(0,7);if(!totals.has(month))continue;totals.get(month).snapshots++;
  const groupKey=JSON.stringify([lab.accountId,lab.laboratorio]);let group=detail.get(groupKey);
  if(!group){group={sucursal:lab.farmacia,laboratorio:lab.nombre,months:new Map(),rates:new Map()};detail.set(groupKey,group);}
  const total=group.months.get(month)||{operaciones:0,snapshots:0};total.snapshots++;group.months.set(month,total);
  for(const row of lab.movimientos){
   const rate=typeof row.porcentajeDescuento==='number'&&Number.isFinite(row.porcentajeDescuento)&&row.porcentajeDescuento>=0?row.porcentajeDescuento:null;
   totals.get(month).operaciones+=row.operaciones??1;total.operaciones+=row.operaciones??1;
   accumulate(rates,rate,row,month);accumulate(group.rates,rate,row,month);
  }
 }
 function series(rateMap,totalMap){return [...rateMap.values()].sort((a,b)=>a.rate==null?1:b.rate==null?-1:a.rate-b.rate).map(item=>({rate:item.rate,meses:periods.map(m=>{const total=totalMap.get(m),known=Boolean(total?.snapshots),v=item.months.get(m)||empty();return {mes:m,cantidad:known?v.cantidad:null,participacion:total?.operaciones?round(v.cantidad/total.operaciones*100):null,importe:known&&v.importe!=null?round(v.importe):null};})}));}
 return {periods,totals:[...totals.values()],series:series(rates,totals),detail:[...detail.values()].flatMap(g=>series(g.rates,g.months).map(s=>({sucursal:g.sucursal,laboratorio:g.laboratorio,...s}))),updatedAt:report.updatedAt,oldestUpdate:report.oldestUpdate};
}
