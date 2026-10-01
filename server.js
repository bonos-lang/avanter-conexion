import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {getLaboratories,AvanterError} from './lib/avanter.js';
import {AppError,seal,unseal} from './lib/security.js';
import {createFirebase} from './lib/firebase.js';
import {createVault} from './lib/vault.js';
import {createHistory,months,today} from './lib/history.js';
import {getSales,validateRange} from './lib/sales.js';
const publicDir=fileURLToPath(new URL('./public/',import.meta.url));
const files=new Map([['/',['index.html','text/html']],['/index.html',['index.html','text/html']],['/metrics.js',['metrics.js','application/javascript']],['/app.js',['app.js','application/javascript']],['/styles.css',['styles.css','text/css']]]);
export function createApp({lookup=getLaboratories,salesLookup=getSales,intervalMs=3000,firebase=createFirebase({projectId:process.env.FIREBASE_PROJECT_ID,apiKey:process.env.FIREBASE_API_KEY,adminUid:process.env.DASHBOARD_ADMIN_UID}),vault,sessionSecret=process.env.SESSION_SECRET,encryptionKey=process.env.ENCRYPTION_KEY,secureCookies=process.env.NODE_ENV==='production'}={}) {
  vault ||= createVault({firebase,encryptionKey});
  const history=createHistory({firebase,encryptionKey});
  let busy=false,nextRequestAt=0;
  const attempts=new Map();
  const ready=()=>firebase.configured() && sessionSecret?.length>=32 && encryptionKey?.length>=32;
  return createServer(async(req,res)=>{
    res.setHeader('Cache-Control','no-store'); res.setHeader('X-Content-Type-Options','nosniff'); res.setHeader('Referrer-Policy','no-referrer');
    res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; form-action 'self'; base-uri 'none'");
    const json=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(data));};
    const cookie=(session)=>res.setHeader('Set-Cookie',`avanter_session=${session?seal(session,sessionSecret,'dashboard-session'):''}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${session?Math.max(0,Math.floor((session.sessionExpires-Date.now())/1000)):0}${secureCookies?'; Secure':''}`);
    const path=new URL(req.url,'http://localhost').pathname;
    if(path==='/health' && req.method==='GET') return json(200,{ok:true});
    if(files.has(path) && ['GET','HEAD'].includes(req.method)) {
      try {const [name,type]=files.get(path);const content=await readFile(resolve(publicDir,name));res.writeHead(200,{'Content-Type':`${type}; charset=utf-8`});return res.end(req.method==='HEAD'?undefined:content);}catch{return json(500,{error:'No se pudo cargar la página.'});}
    }
    const routes=new Map([['/api/session','GET'],['/api/login','POST'],['/api/logout','POST'],['/api/accounts','GET,POST'],['/api/laboratorios','POST'],['/api/ventas','POST'],['/api/history','POST'],['/api/import','POST'],['/api/import-status','POST']]);
    if(!routes.has(path)) return json(404,{error:'Ruta inexistente.'});
    if(!routes.get(path).split(',').includes(req.method)){res.setHeader('Allow',routes.get(path));return json(405,{error:'Método no permitido.'});}
    try {
      if(!ready()) throw new AppError('Falta completar la configuración del acceso privado y del almacenamiento cifrado.',503);
      let body={};
      if(req.method==='POST') {
        const origin=req.headers.origin;
        if(req.headers['sec-fetch-site']==='cross-site' || (origin && new URL(origin).host!==req.headers.host)) throw new AppError('La solicitud debe hacerse desde esta página.',403);
        if(!/^application\/json\b/i.test(req.headers['content-type']||'')) throw new AppError('Se requiere JSON.',415);
        let size=0;const chunks=[];
        for await(const chunk of req){size+=chunk.length;if(size>8192)throw new AppError('Solicitud demasiado grande.',413);chunks.push(chunk);}
        try {body=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new AppError('JSON inválido.',400);}
        if(!body || Array.isArray(body) || typeof body!=='object')throw new AppError('Solicitud inválida.',400);
      }
      if(path==='/api/logout'){cookie(null);return json(200,{ok:true});}
      const credentials=()=>{
        if(typeof body.email!=='string'||!body.email.trim()||body.email.length>254||typeof body.password!=='string'||!body.password||body.password.length>1024)throw new AppError('Completá el email y la contraseña.',400);
      };
      if(path==='/api/login') {
        credentials();
        // Bound memory and throttle per trusted Render proxy IP / local socket.
        const ip=secureCookies?String(req.headers['x-forwarded-for']||req.socket.remoteAddress).split(',').at(-1).trim():req.socket.remoteAddress;
        for(const [key,value] of attempts)if(value.until<Date.now())attempts.delete(key);
        if(attempts.size>=1000&&!attempts.has(ip))throw new AppError('Esperá unos minutos para iniciar sesión.',429);
        const attempt=attempts.get(ip)||{count:0,until:Date.now()+15*60*1000};
        if(attempt.count>=5)throw new AppError('Demasiados intentos. Volvé a probar en 15 minutos.',429);
        attempt.count++;attempts.set(ip,attempt);
        const session=await firebase.login(body.email.trim(),body.password);cookie(session);attempts.delete(ip);return json(200,{authenticated:true});
      }
      const encoded=String(req.headers.cookie||'').split(';').map(v=>v.trim()).find(v=>v.startsWith('avanter_session='))?.slice(16);
      let session;
      try {if(encoded)session=unseal(encoded,sessionSecret,'dashboard-session');}catch{}
      if(!session || session.sessionExpires<=Date.now()) {
        cookie(null);if(path==='/api/session')return json(200,{authenticated:false});
        throw new AppError('Iniciá sesión en el panel.',401);
      }
      if(session.tokenExpires<=Date.now()+60000){session=await firebase.refresh(session);cookie(session);}
      if(path==='/api/session')return json(200,{authenticated:true});
      if(path==='/api/accounts' && req.method==='GET')return json(200,{accounts:await vault.list(session)});
      if(path==='/api/import-status'){
        months(body.month+'-01',body.month+'-01');
        return json(200,{ids:(await firebase.listSnapshots(session,body.month)).map(d=>d.id)});
      }
      if(path==='/api/history')return json(200,await history.report(session,body));
      if(path==='/api/import'){
        const ranges=months(body.month+'-01',body.month+'-01');
        if(ranges.length!==1)throw new AppError('Mes inválido.',400);
        body.desde=ranges[0].desde;body.hasta=ranges[0].hasta>today()?today():ranges[0].hasta;
        validateRange(body);if(body.laboratorio==='todos')throw new AppError('Importá un laboratorio por solicitud.',400);
      }
      if(path==='/api/ventas'){validateRange(body);if(body.laboratorio==='todos')throw new AppError('Consultá un laboratorio por solicitud.',400);}
      if(busy || Date.now()<nextRequestAt)throw new AppError('Hay una consulta en curso. Esperá unos segundos.',429);
      busy=true;nextRequestAt=Date.now()+intervalMs;
      try {
        if(path==='/api/accounts') {
          credentials();if(typeof body.name!=='string'||!body.name.trim()||body.name.length>80)throw new AppError('Ingresá un nombre para la farmacia.',400);
          const laboratorios=await lookup(body.email.trim(),body.password);
          const account=await vault.add(session,body);
          return json(200,{account,laboratorios,consultadoEn:new Date().toISOString()});
        }
        if(typeof body.accountId!=='string'||body.accountId.length>80)throw new AppError('Elegí una cuenta guardada.',400);
        const account=await vault.get(session,body.accountId);
        if(path==='/api/import'){
          const data=await salesLookup(account.email,account.password,body);
          if(data.errores.length||data.sinAdhesion||data.laboratorios.length!==1)throw new AppError('No se importó este mes: Avanter no devolvió un resultado completo. Se conservó el historial anterior.',502);
          await history.save(session,account,{month:body.month,desde:body.desde,hasta:body.hasta},data.laboratorios[0]);
          return json(200,{ok:true,updatedAt:new Date().toISOString()});
        }
        if(path==='/api/ventas')return json(200,{...await salesLookup(account.email,account.password,body),consultadoEn:new Date().toISOString()});
        return json(200,{laboratorios:await lookup(account.email,account.password),consultadoEn:new Date().toISOString()});
      }finally{busy=false;}
    }catch(error){
      // Never log upstream errors or request bodies: they can contain credentials.
      const known=error instanceof AppError || error instanceof AvanterError;
      if(!res.writableEnded)json(known?error.status:502,{error:known?error.message:'No se pudo completar la operación. Intentá nuevamente.'});
    }
  });
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
 const server=createApp();server.requestTimeout=90000;server.listen(Number(process.env.PORT||3000),'0.0.0.0',()=>console.log('Avanter Cuentas disponible'));
}

