(function(root){
 const units=rows=>rows.reduce((s,r)=>s+r.cantidad,0);
 const key=r=>JSON.stringify([r.accountId,r.laboratorio]);
 const productKey=r=>JSON.stringify([r.codLaboratorio,r.codigo||r.producto,r.presentacion]);
 function group(rows,by){const result=new Map();for(const row of rows){const k=by(row),g=result.get(k)||{key:k,name:row.producto+' '+row.presentacion,lab:row.laboratorio,units:0};g.units+=row.cantidad;result.set(k,g);}return result;}
 root.Commercial={opportunities(current,previous,{threshold=20,equalDuration=true}={}){
  const a=new Set(current.map(key)),b=new Set(previous.map(key)),pairs=new Set([...a].filter(k=>b.has(k)));
  const flatten=results=>results.filter(r=>pairs.has(key(r))).flatMap(r=>r.movimientos.map(m=>({...m,accountId:r.accountId,codLaboratorio:r.laboratorio,laboratorio:r.nombre})));
  const now=flatten(current),before=flatten(previous),messages=[];
  const currentUnits=units(now),previousUnits=units(before),change=previousUnits>0?(currentUnits/previousUnits-1)*100:null;
  if(!equalDuration)return {messages:[],change:null,pairs:pairs.size,currentUnits,previousUnits,note:'Los períodos tienen diferente duración. Compará meses completos o rangos equivalentes para generar oportunidades.'};
  if(!pairs.size)return {messages:[],change:null,pairs:0,currentUnits,previousUnits,note:'No hay combinaciones de farmacia/laboratorio con datos en ambos períodos.'};
  const nowProducts=group(now,productKey),oldProducts=group(before,productKey);
  for(const [k,old] of oldProducts){const current=nowProducts.get(k),n=current?.units||0,delta=old.units>0?(n/old.units-1)*100:null;if(old.units>=10&&delta!=null&&delta<=-threshold+1e-9)messages.push({type:'Recuperación de producto',title:old.name+' · '+old.lab,previous:old.units,current:n,change:delta,action:'Evaluar una oferta para recuperar demanda. Confirmar stock, costo y margen antes de definir el precio.'});}
  const nowLabs=group(now,r=>r.codLaboratorio),oldLabs=group(before,r=>r.codLaboratorio);
  for(const [k,old] of oldLabs){const n=nowLabs.get(k)?.units||0,delta=old.units>0?(n/old.units-1)*100:null;if(old.units>=20&&delta!=null&&delta<=-threshold+1e-9)messages.push({type:'Recuperación de laboratorio',title:old.lab,previous:old.units,current:n,change:delta,action:'Revisar productos con caída y evaluar una campaña con el laboratorio.'});}
  messages.sort((a,b)=>(b.previous-b.current)-(a.previous-a.current));
  return {messages:messages.slice(0,12),change,pairs:pairs.size,currentUnits,previousUnits,note:pairs.size<Math.max(a.size,b.size)?'Comparación parcial: se usan solamente farmacias y laboratorios con datos en ambos períodos.':'Comparación de unidades en farmacias y laboratorios presentes en ambos períodos.'};
 }};
})(typeof window==='undefined'?globalThis:window);

