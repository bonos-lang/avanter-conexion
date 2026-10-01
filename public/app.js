const $=id=>document.getElementById(id);
let accounts=[],laboratories=[],working=false;
async function api(path,body){
 const response=await fetch(path,{method:body===undefined?'GET':'POST',headers:body===undefined?{}:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),cache:'no-store',signal:AbortSignal.timeout(85000)});
 if(!response.headers.get('content-type')?.includes('application/json'))throw new Error('El servidor no está disponible. Volvé a probar en un momento.');
 const data=await response.json();
 if(!response.ok){if(response.status===401&&path!=='/api/login')showAuth();throw new Error(data.error||'No se pudo completar la operación.');}return data;
}
function showAuth(){accounts=[];clearResults();$('account-form').reset();$('account-form').hidden=true;$('dashboard').hidden=true;$('logout').hidden=true;$('auth-panel').hidden=false;$('account-count').textContent='Acceso privado';$('sales-panel').hidden=true;$('sales-output').hidden=true;$('sales-labs').replaceChildren();$('sales-days').replaceChildren();$('open-prices').hidden=true;window.clearMetrics();}
function clearResults(){laboratories=[];render();$('table').hidden=true;$('search').disabled=true;$('search').value='';$('updated').textContent='';$('count').textContent='Sin consultar';}
function updateAccounts(selected){$('account').replaceChildren(new Option('Elegir una cuenta',''));for(const a of accounts)$('account').add(new Option(a.name,a.id));$('account').value=selected||'';$('account-count').textContent=`${accounts.length} de 11 cuentas`;controls();}
function controls(){for(const id of ['consult','edit-account'])$(id).disabled=working||salesRunning||!$('account').value;$('new-account').disabled=working||salesRunning||accounts.length>=11;$('save-account').disabled=working||salesRunning;$('account').disabled=working||salesRunning;$('sales-submit').disabled=working||salesRunning;$('import-history').disabled=working||salesRunning;}
async function loadAccounts(selected){accounts=(await api('/api/accounts')).accounts;updateAccounts(selected);$('auth-panel').hidden=true;$('dashboard').hidden=false;$('logout').hidden=false;$('sales-panel').hidden=false;updateSalesAccounts();$('open-prices').hidden=false;await loadHistory();}
function render(){const query=$('search').value.trim().toLocaleLowerCase('es');const filtered=laboratories.filter(l=>`${l.nombre} ${l.codigo}`.toLocaleLowerCase('es').includes(query));$('rows').replaceChildren();for(const lab of filtered){const row=document.createElement('tr');for(const value of [lab.nombre,lab.codigo]){const cell=document.createElement('td');cell.textContent=value;row.append(cell);}const cell=document.createElement('td'),badge=document.createElement('span');badge.className='badge'+(lab.adherido?' yes':'');badge.textContent=lab.adherido?'Adherido':'Sin adherir';cell.append(badge);row.append(cell);$('rows').append(row);}$('count').textContent=`${filtered.length} de ${laboratories.length}`;}
function display(data){laboratories=data.laboratorios;updateSalesLabs(laboratories);$('search').disabled=false;$('table').hidden=false;render();$('updated').textContent=`Consultado el ${new Date(data.consultadoEn).toLocaleString('es-AR')}`;}
async function operation(action,message){working=true;controls();clearResults();$('results').setAttribute('aria-busy','true');$('status').className='';$('status').textContent=message;try{await action();}catch(error){$('status').className='error';$('status').textContent=error.name==='TimeoutError'?'La consulta demoró demasiado. Volvé a probar.':error.message;}finally{working=false;controls();$('results').setAttribute('aria-busy','false');}}
$('auth-form').addEventListener('submit',async event=>{event.preventDefault();const body={email:$('panel-email').value.trim(),password:$('panel-password').value};$('panel-password').value='';$('auth-submit').disabled=true;$('auth-status').textContent='Ingresando…';try{await api('/api/login',body);await loadAccounts();$('auth-status').textContent='';}catch(error){$('auth-status').textContent=error.message;}finally{$('auth-submit').disabled=false;}});
$('logout').addEventListener('click',async()=>{try{await api('/api/logout',{});showAuth();$('auth-status').textContent='Sesión cerrada.';}catch(error){$('status').textContent=error.message;}});
$('account').addEventListener('change',()=>{clearResults();$('account-form').reset();$('email').readOnly=false;$('account-form').hidden=true;$('status').textContent='Consultá los laboratorios de la cuenta seleccionada.';controls();});
$('new-account').addEventListener('click',()=>{$('account-form').reset();$('email').readOnly=false;$('account-form').hidden=false;$('account-name').focus();});
$('edit-account').addEventListener('click',()=>{const a=accounts.find(a=>a.id===$('account').value);if(!a)return;$('account-form').reset();$('account-name').value=a.name;$('email').value=a.email;$('email').readOnly=true;$('account-form').hidden=false;$('password').focus();});
$('cancel-account').addEventListener('click',()=>{$('account-form').reset();$('account-form').hidden=true;});
$('account-form').addEventListener('submit',event=>{event.preventDefault();const body={name:$('account-name').value.trim(),email:$('email').value.trim(),password:$('password').value};$('password').value='';operation(async()=>{const data=await api('/api/accounts',body);await loadAccounts(data.account.id);$('account-form').reset();$('account-form').hidden=true;display(data);$('status').textContent=`Cuenta guardada: ${data.account.name}. Podés volver a consultarla sin ingresar su contraseña.`;},'Verificando la cuenta con Avanter…');});
$('consult').addEventListener('click',()=>{const accountId=$('account').value;operation(async()=>{display(await api('/api/laboratorios',{accountId}));$('status').textContent=`Consulta completada: ${laboratories.length} laboratorios.`;},'Consultando Avanter con la cuenta guardada…');});
$('search').addEventListener('input',render);
(async()=>{try{const data=await api('/api/session');if(data.authenticated)await loadAccounts();else $('auth-status').textContent='';}catch(error){$('auth-status').textContent=error.message;}})();

function updateSalesAccounts(){const selected=$('sales-account').value;$('sales-account').replaceChildren(new Option('Todas las cuentas','todos'));for(const a of accounts)$('sales-account').add(new Option(a.name,a.id));$('sales-account').value=accounts.some(a=>a.id===selected)?selected:'todos';}
function updateSalesLabs(labs){const selected=$('sales-lab').value,existing=new Map(Array.from($('sales-lab').options).filter(o=>o.value!=='todos').map(o=>[o.value,o.text]));for(const lab of labs)existing.set(lab.codigo,lab.nombre);$('sales-lab').replaceChildren(new Option('Todos los adheridos','todos'));for(const [code,name] of [...existing].sort((a,b)=>a[1].localeCompare(b[1],'es')))$('sales-lab').add(new Option(name,code));$('sales-lab').value=existing.has(selected)?selected:'todos';}
const money=value=>new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS'}).format(value);
function salesRow(target,values){const row=document.createElement('tr');for(const v of values){const td=document.createElement('td');td.textContent=v;row.append(td);}target.append(row);}
function showSales(results,errors){let units=0,gross=0,refund=0;const daily=new Map();$('sales-labs').replaceChildren();$('sales-days').replaceChildren();for(const result of results){units+=result.unidades;gross+=Math.round(result.ventaBruta*100);refund+=Math.round(result.reembolso*100);salesRow($('sales-labs'),[result.farmacia,result.nombre,result.unidades,money(result.ventaBruta),money(result.reembolso)]);for(const day of result.porDia){const current=daily.get(day.fecha)||{unidades:0,ventaBruta:0};current.unidades+=day.unidades;current.ventaBruta+=Math.round(day.ventaBruta*100);daily.set(day.fecha,current);}}$('sales-units').textContent=units;$('sales-gross').textContent=money(gross/100);$('sales-refund').textContent=money(refund/100);for(const [fecha,d] of [...daily].sort((a,b)=>a[0].localeCompare(b[0])))salesRow($('sales-days'),[fecha,d.unidades,money(d.ventaBruta/100)]);$('sales-errors').textContent=errors.length?'Consulta parcial. '+errors.join(' · '):'';$('sales-output').hidden=false;window.renderMetrics(results);}
let salesRunning=false;
async function loadHistory(){
 $('sales-status').textContent='Leyendo el historial guardado…';
 try{
  const data=await api('/api/history',{accountId:$('sales-account').value,laboratorio:$('sales-lab').value,desde:$('sales-from').value,hasta:$('sales-to').value});
  if($('dashboard').hidden)return;
  updateSalesLabs(data.laboratorios.map(l=>({codigo:l.laboratorio,nombre:l.nombre})));
  showSales(data.laboratorios,[]);if(!data.snapshots)$('sales-output').hidden=true;
  $('sales-status').textContent=data.updatedAt?'Historial guardado. Última actualización: '+new Date(data.updatedAt).toLocaleString('es-AR')+'. Datos más antiguos del período: '+new Date(data.oldestUpdate).toLocaleString('es-AR')+'.':'Todavía no hay datos importados para este período. Iniciá la importación.';
 }catch(error){$('sales-status').textContent=error.message;}
}
$('sales-form').addEventListener('submit',async event=>{event.preventDefault();if(salesRunning)return;salesRunning=true;controls();try{await loadHistory();}finally{salesRunning=false;controls();}});
$('import-history').addEventListener('click',async()=>{
 if(salesRunning)return;salesRunning=true;controls();$('import-history').disabled=true;
 const errors=[];let count=0;const now=formatLocal(new Date()),cutoff=new Date(Date.now()-90*86400000).toISOString().slice(0,7);
 try{
  for(const account of accounts){
   await new Promise(r=>setTimeout(r,3100));
   let labs;try{labs=(await api('/api/laboratorios',{accountId:account.id})).laboratorios.filter(l=>l.adherido);}catch(e){errors.push(account.name+': '+e.message);continue;}
   for(let month='2025-01';month<=now.slice(0,7);){
    const ids=new Set((await api('/api/import-status',{month})).ids);
    for(const lab of labs){
     if(month<cutoff&&ids.has(account.id+'_'+lab.codigo))continue;
     if($('dashboard').hidden)throw new Error('Sesión cerrada. La importación puede retomarse.');
     $('sales-status').textContent='Importando '+account.name+' · '+lab.nombre+' · '+month+' ('+count+' meses guardados)…';
     await new Promise(r=>setTimeout(r,3100));
     try{await api('/api/import',{accountId:account.id,laboratorio:lab.codigo,month});count++;}catch(e){errors.push(account.name+' · '+lab.nombre+' · '+month+': '+e.message);}
    }
    const d=new Date(month+'-01T00:00:00Z');d.setUTCMonth(d.getUTCMonth()+1);month=d.toISOString().slice(0,7);
   }
  }
  await loadHistory();$('sales-status').textContent='Importación finalizada: '+count+' meses guardados. '+(errors.length?errors.length+' consultas fallaron. Podés retomarlas con el mismo botón.':'');$('sales-errors').textContent=errors.join(' · ');
 }catch(e){$('sales-status').textContent=e.message;}
 finally{salesRunning=false;$('import-history').disabled=false;controls();}
});
const initialDate=new Date(),formatLocal=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
$('sales-from').value=formatLocal(new Date(initialDate.getFullYear(),initialDate.getMonth()-1,1));$('sales-to').value=formatLocal(new Date(initialDate.getFullYear(),initialDate.getMonth(),0));

