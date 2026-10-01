// Runs only in the private Actions environment; never print credentials or cookies.
const base=(process.env.DASHBOARD_URL||'https://avanter-conexion.onrender.com').replace(/\/$/,'');
if(base!=='https://avanter-conexion.onrender.com')throw new Error('Destino de sincronización no autorizado.');
if(!process.env.DASHBOARD_EMAIL||!process.env.DASHBOARD_PASSWORD)throw new Error('Configurá los secrets DASHBOARD_EMAIL y DASHBOARD_PASSWORD en GitHub.');
let cookie='';
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function api(path,body){
 for(let attempt=0;attempt<4;attempt++){
  let response;
  try{response=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:{cookie,...(body===undefined?{}:{'Content-Type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(85000),redirect:'error'});}catch{if(attempt<3){await pause(15000);continue;}throw new Error('No se pudo conectar con Render.');}
  const renewed=response.headers.get('set-cookie');if(renewed)cookie=renewed.split(';')[0];
  if([429,502,503,504].includes(response.status)&&attempt<3){await pause(15000);continue;}
  if(!response.ok)throw new Error('Solicitud fallida ('+response.status+') en '+path);
  return response.json();
 }
}
await api('/api/login',{email:process.env.DASHBOARD_EMAIL,password:process.env.DASHBOARD_PASSWORD});
const accounts=(await api('/api/accounts')).accounts;
const now=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Argentina/Buenos_Aires'}).format(new Date());
const cutoff=new Date(Date.parse(now)-90*86400000).toISOString().slice(0,7);
let imported=0,failed=0;
for(const account of accounts){
 await pause(3100);
 let labs;try{labs=(await api('/api/laboratorios',{accountId:account.id})).laboratorios.filter(l=>l.adherido);}catch{failed++;console.log('No se pudo consultar una cuenta; se conservan sus datos.');continue;}
 for(let month='2025-01';month<=now.slice(0,7);){
  const ids=new Set((await api('/api/import-status',{month})).ids);
  for(const lab of labs){
   if(month<cutoff&&ids.has(account.id+'_'+lab.codigo))continue;
   await pause(3100);
   try{await api('/api/import',{accountId:account.id,laboratorio:lab.codigo,month});imported++;}catch{failed++;console.log('Un mes no se pudo importar; se conservan sus datos anteriores.');}
  }
  const d=new Date(month+'-01T00:00:00Z');d.setUTCMonth(d.getUTCMonth()+1);month=d.toISOString().slice(0,7);
 }
}
await api('/api/logout',{});
console.log(`Sincronización: ${imported} meses guardados; ${failed} consultas fallidas.`);
if(failed)process.exitCode=1;
