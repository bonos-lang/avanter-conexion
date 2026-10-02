import {months} from './history.js';
import {AppError} from './security.js';
export function priceHistory(report,filters){
 const periods=months(filters.desde,filters.hasta).map(r=>r.month),map=new Map(),query=(filters.search||'').trim().normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase();
 for(const lab of report.laboratorios)for(const m of lab.movimientos){
  const text=`${m.codigo} ${m.producto} ${m.presentacion||''}`.normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase();if(!text.includes(query))continue;
  const key=JSON.stringify([lab.accountId,lab.laboratorio,m.codigo,m.producto,m.presentacion]);
  if(!map.has(key))map.set(key,{codigo:m.codigo,producto:`${m.producto} ${m.presentacion||''}`.trim(),laboratorio:lab.nombre,sucursal:lab.farmacia,observados:new Map()});
  const row=map.get(key),date=m.ultimaFecha||m.fecha,month=date.slice(0,7),price=m.ultimoPvp??m.pvp,old=row.observados.get(month);
  if(!old||date>old.fecha||date===old.fecha&&price>old.precio)row.observados.set(month,{fecha:date,precio:price});
 }
 const all=[...map.values()].sort((a,b)=>a.producto.localeCompare(b.producto,'es')||a.sucursal.localeCompare(b.sucursal,'es'));
 const offset=filters.offset||0;
 const rows=all.slice(offset,offset+50).map(({observados,...row})=>({...row,meses:periods.map((month,i)=>{const current=observados.get(month),prior=i?observados.get(periods[i-1]):null;return {mes:month,precio:current?.precio??null,fecha:current?.fecha??null,variacion:current&&prior?.precio>0?Math.round((current.precio/prior.precio-1)*10000)/100:null};})}));
 return {periods,rows,total:all.length,nextOffset:offset+rows.length<all.length?offset+rows.length:null,updatedAt:report.updatedAt,oldestUpdate:report.oldestUpdate};
}
export function validatePrices(filters){
 months(filters.desde,filters.hasta);
 if(typeof filters.accountId!=='string'||filters.accountId.length>80||typeof filters.laboratorio!=='string'||filters.laboratorio.length>80||typeof filters.search!=='string'||filters.search.length>120||!Number.isInteger(filters.offset||0)||(filters.offset||0)<0||(filters.offset||0)>50000)throw new AppError('Filtros de precios inválidos.',400);
}
