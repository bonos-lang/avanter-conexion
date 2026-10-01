import {createAvanterSession,parseLaboratoryApi,AvanterError} from './avanter.js';
export function validateRange({desde,hasta,laboratorio}) {
 const valid=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
 if(!valid(desde)||!valid(hasta)||desde>hasta)throw new AvanterError('Ingresá un rango de fechas válido.',400);
 if((Date.parse(hasta)-Date.parse(desde))/86400000>92)throw new AvanterError('Consultá hasta 93 días por vez.',400);
 if(laboratorio!=='todos' && !/^\d{1,8}$/.test(laboratorio||''))throw new AvanterError('Elegí un laboratorio.',400);
 return {desde,hasta,laboratorio};
}
const numeric=(value,label)=>{
 if(typeof value==='string'&&/^-?\d+(\.\d+)?$/.test(value.trim()))value=Number(value);
 if(typeof value!=='number'||!Number.isFinite(value))throw new AvanterError(`Avanter devolvió un valor inválido de ${label}.`);
 return value;
};
function date(value){
 if(typeof value!=='string')throw new AvanterError('Avanter devolvió una fecha inválida.');
 const m=value.match(/^(\d{2})-(\d{2})-(\d{4})$/);const result=m?`${m[3]}-${m[2]}-${m[1]}`:value.slice(0,10);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(result)||Number.isNaN(Date.parse(result))||new Date(result).toISOString().slice(0,10)!==result)throw new AvanterError('Avanter devolvió una fecha inválida.');
 return result;
}
export function parseSales(data,lab,range) {
 if(data?.isSuccess!==true||!Array.isArray(data.result))throw new AvanterError('Avanter no pudo devolver los consumos de este laboratorio.');
 const daily=new Map();let unidades=0,ventaBruta=0;
 for(const item of data.result){
  const fecha=date(item.fecha);if(fecha<range.desde||fecha>range.hasta)throw new AvanterError('Avanter devolvió movimientos fuera del período solicitado.');
  const cantidad=numeric(item.cantidad,'cantidad'),pvp=numeric(item.pvp,'precio público');unidades+=cantidad;ventaBruta+=Math.round(pvp*100)*cantidad;
  const day=daily.get(fecha)||{fecha,unidades:0,ventaBruta:0};day.unidades+=cantidad;day.ventaBruta+=Math.round(pvp*100)*cantidad;daily.set(fecha,day);
 }
 const reported=data.result[0];
 const reembolso=reported?numeric(reported.totalaReembolsar,'reembolso total'):0;
 if(reported&&numeric(reported.totalUnidades,'unidades totales')!==unidades)throw new AvanterError('El total de unidades de Avanter no coincide con sus movimientos.');
 return {laboratorio:lab.codigo,nombre:lab.nombre,unidades,ventaBruta:ventaBruta/100,reembolso,registros:data.result.length,porDia:[...daily.values()].sort((a,b)=>a.fecha.localeCompare(b.fecha)).map(d=>({...d,ventaBruta:d.ventaBruta/100}))};
}
export async function getSales(email,password,filters){
 const range=validateRange(filters),readApi=await createAvanterSession(email,password);
 const labs=parseLaboratoryApi(await readApi('/api/Inicio/getLaboratoriosActivos?tipo='),await readApi('/api/Inicio/getTarjetasPrestador'));
 const selected=range.laboratorio==='todos'?labs.filter(l=>l.adherido):labs.filter(l=>l.codigo===range.laboratorio&&l.adherido);
 if(range.laboratorio!=='todos'&&!selected.length)return {laboratorios:[],errores:[],sinAdhesion:true};
 const laboratorios=[],errores=[];
 for(const lab of selected){
  const query=new URLSearchParams({desde:range.desde,hasta:range.hasta,laboratorio:lab.codigo,marcaP:'-1',cbP:'',motivo:'-1',refN:'0'});
  try{laboratorios.push(parseSales(await readApi('/api/Consumos/getConsumos?'+query),lab,range));}
  catch(error){errores.push({laboratorio:lab.nombre,error:error instanceof AvanterError?error.message:'No se pudo consultar este laboratorio.'});}
 }
 return {laboratorios,errores,sinAdhesion:false};
}
