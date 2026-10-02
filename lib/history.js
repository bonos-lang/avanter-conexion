import {compactMovements} from './report-summary.js';
import {gzipSync,gunzipSync} from 'node:zlib';
import {seal,unseal,AppError} from './security.js';
export const today=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Argentina/Buenos_Aires'}).format(new Date());
export function months(desde,hasta){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(desde||'')||!/^\d{4}-\d{2}-\d{2}$/.test(hasta||'')||desde>hasta||desde<'2025-01-01'||hasta>today())throw new AppError('Elegí fechas desde enero de 2025 hasta hoy.',400);
 for(const d of [desde,hasta])if(Number.isNaN(Date.parse(d))||new Date(d).toISOString().slice(0,10)!==d)throw new AppError('Fecha inválida.',400);
 const result=[];let d=new Date(desde.slice(0,7)+'-01T00:00:00Z');
 while(d.toISOString().slice(0,7)<=hasta.slice(0,7)){const month=d.toISOString().slice(0,7);d.setUTCMonth(d.getUTCMonth()+1);result.push({month,desde:month+'-01',hasta:new Date(d-86400000).toISOString().slice(0,10)});}
 return result;
}
export function createHistory({firebase,encryptionKey}){
 const context=(uid,month,id)=>`avanter-sales:${uid}:${month}:${id}`;
 return {
  async catalog(session){
   // Account display names are derived from sales. A viewer never reads the vault.
   const ranges=months('2025-01-01',today()).reverse();
   for(const range of ranges){const docs=await firebase.listSnapshots(session,range.month);if(!docs.length)continue;const accounts=new Map();for(const doc of docs){const encoded=unseal(doc.cipher,encryptionKey,context(session.storageUid||session.uid,range.month,doc.id));const saved=JSON.parse(gunzipSync(Buffer.from(encoded.packed,'base64'),{maxOutputLength:32*1024*1024}).toString());accounts.set(saved.accountId,{id:saved.accountId,name:saved.farmacia});}return [...accounts.values()];}
   return [];
  },
  async save(session,account,range,result){
   const id=account.id+'_'+result.laboratorio;
   const value={accountId:account.id,farmacia:account.name,desde:range.desde,hasta:range.hasta,updatedAt:new Date().toISOString(),result};
   const packed=gzipSync(JSON.stringify(value)).toString('base64');
   const cipher=seal({packed},encryptionKey,context(session.storageUid||session.uid,range.month,id));
   if(Buffer.byteLength(cipher)>900000)throw new AppError('Este mes supera el tamaño admitido. No se reemplazaron los datos anteriores.',413);
   await firebase.writeSnapshot(session,range.month,id,cipher);
  },
  async report(session,filters){
   const ranges=months(filters.desde,filters.hasta),laboratorios=[],updates=[];
   for(const range of ranges){
    const docs=await firebase.listSnapshots(session,range.month);
    for(const doc of docs){
     const encoded=unseal(doc.cipher,encryptionKey,context(session.storageUid||session.uid,range.month,doc.id));
     const saved=JSON.parse(gunzipSync(Buffer.from(encoded.packed,'base64'),{maxOutputLength:32*1024*1024}).toString());
     if(filters.accountId!=='todos'&&saved.accountId!==filters.accountId)continue;
     const original=saved.result;if(filters.laboratorio!=='todos'&&original.laboratorio!==filters.laboratorio)continue;
     updates.push(saved.updatedAt);
     const rows=original.movimientos.filter(m=>m.fecha>=filters.desde&&m.fecha<=filters.hasta);
     const daily=new Map();for(const m of rows){const d=daily.get(m.fecha)||{fecha:m.fecha,unidades:0,ventaBruta:0};d.unidades+=m.cantidad;d.ventaBruta+=Math.round(m.pvp*100)*m.cantidad;daily.set(m.fecha,d);}
     const full=filters.desde<=saved.desde&&filters.hasta>=saved.hasta;
     const reembolso=full?original.reembolso:rows.reduce((s,m)=>s+(m.reembolsoConIva??0),0);
     if(!full&&rows.some(m=>m.reembolsoConIva==null))throw new AppError('Este período requiere el reembolso por movimiento. Elegí meses completos.',422);
     const displayRows=(filters.aggregate||ranges.length>3)?compactMovements(rows):rows;
     if(!filters.aggregate&&ranges.length<=3&&laboratorios.reduce((n,l)=>n+l.movimientos.length,0)+rows.length>150000)throw new AppError('El período contiene demasiados movimientos. Elegí menos meses o una farmacia.',413);
     laboratorios.push({...original,farmacia:saved.farmacia,accountId:saved.accountId,movimientos:displayRows,registros:rows.length,unidades:rows.reduce((s,m)=>s+m.cantidad,0),ventaBruta:rows.reduce((s,m)=>s+Math.round(m.pvp*100)*m.cantidad,0)/100,reembolso,porDia:[...daily.values()].map(d=>({...d,ventaBruta:d.ventaBruta/100}))});
    }
   }
   return {laboratorios,updatedAt:updates.sort().at(-1)||null,oldestUpdate:updates.sort()[0]||null,snapshots:laboratorios.length};
  }
 };
}

