// Compress a monthly report for all-period queries without losing financial
// totals or the count of source movements. Prices remain observed prices.
export function compactMovements(rows){
 const groups=new Map();
 for(const m of rows){
  const key=JSON.stringify([m.producto,m.presentacion,m.codigo,m.porcentajeDescuento]);
  let g=groups.get(key);
  if(!g){g={...m,fecha:m.fecha.slice(0,7)+'-01',cantidad:0,bruto:0,descuento:0,reembolsoConIva:0,referenciaTotal:0,operaciones:0,ultimaFecha:m.fecha,ultimoPvp:m.pvp};groups.set(key,g);}
  g.cantidad+=m.cantidad;g.bruto+=Math.round(m.pvp*100)*m.cantidad/100;g.operaciones++;
  for(const [field,value] of [['descuento',m.descuento],['reembolsoConIva',m.reembolsoConIva],['referenciaTotal',m.referenciaConIva==null?null:m.referenciaConIva*m.cantidad]])g[field]=g[field]==null||value==null?null:g[field]+value;
  if(m.fecha>g.ultimaFecha||m.fecha===g.ultimaFecha&&m.pvp>g.ultimoPvp){g.ultimaFecha=m.fecha;g.ultimoPvp=m.pvp;}
 }
 return [...groups.values()].map(g=>({...g,pvp:g.cantidad?g.bruto/g.cantidad:0,referenciaConIva:g.cantidad&&g.referenciaTotal!=null?g.referenciaTotal/g.cantidad:null}));
}
