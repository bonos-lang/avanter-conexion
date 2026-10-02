const $=id=>document.getElementById(id);
let accounts=[],laboratories=[],working=false,userRole='admin';
async function api(path,body){
 const response=await fetch(path,{method:body===undefined?'GET':'POST',headers:body===undefined?{}:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),cache:'no-store',signal:AbortSignal.timeout(85000)});
 if(!response.headers.get('content-type')?.includes('application/json'))throw new Error('El servidor no está disponible. Volvé a probar en un momento.');
 const data=await response.json();
 if(!response.ok){if(response.status===401&&path!=='/api/login')showAuth();throw new Error(data.error||'No se pudo completar la operación.');}return data;
}
function showAuth(){window.Menu?.reset();window.AvanterChat?.reset();accounts=[];clearResults();$('account-form').reset();$('account-form').hidden=true;$('dashboard').hidden=true;$('logout').hidden=true;$('auth-panel').hidden=false;$('account-count').textContent='Acceso privado';$('sales-panel').hidden=true;$('sales-output').hidden=true;$('sales-labs').replaceChildren();$('sales-days').replaceChildren();window.clearMetrics();}
function clearResults(){laboratories=[];render();$('table').hidden=true;$('search').disabled=true;$('search').value='';$('updated').textContent='';$('count').textContent='Sin consultar';}
function updateAccounts(selected){$('account').replaceChildren(new Option('Elegir una cuenta',''));for(const a of accounts)$('account').add(new Option(a.name,a.id));$('account').value=selected||'';$('account-count').textContent=userRole==='admin'?`${accounts.length} de 11 cuentas`:`Solo lectura · ${accounts.length} farmacias`;controls();}
function controls(){for(const b of document.querySelectorAll('[data-view]'))b.disabled=working||salesRunning;for(const id of ['sales-account','sales-lab','sales-period','sales-from','sales-to','compare-mode','compare-month'])$(id).disabled=working||salesRunning;for(const id of ['consult','edit-account'])$(id).disabled=working||salesRunning||!$('account').value;$('new-account').disabled=working||salesRunning||accounts.length>=11;$('save-account').disabled=working||salesRunning;$('account').disabled=working||salesRunning;$('sales-submit').disabled=working||salesRunning;$('import-history').disabled=working||salesRunning;}
async function loadAccounts(selected){const data=await api('/api/accounts');accounts=data.accounts;userRole=data.role||'admin';updateAccounts(selected);$('auth-panel').hidden=true;$('dashboard').hidden=userRole!=='admin';$('maintenance').hidden=userRole!=='admin';$('logout').hidden=false;$('sales-panel').hidden=false;updateSalesAccounts();window.Menu?.ready();await loadHistory();}
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
function updateSalesLabs(labs){const selected=$('sales-lab').value,existing=new Map(Array.from($('sales-lab').options).filter(o=>o.value!=='todos').map(o=>[o.value,o.text]));for(const lab of labs)existing.set(lab.codigo,lab.nombre);$('sales-lab').replaceChildren(new Option('Todos los laboratorios','todos'));for(const [code,name] of [...existing].sort((a,b)=>a[1].localeCompare(b[1],'es')))$('sales-lab').add(new Option(name,code));$('sales-lab').value=existing.has(selected)?selected:'todos';}
const money=value=>new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS'}).format(value);
function salesRow(target,values){const row=document.createElement('tr');for(const v of values){const td=document.createElement('td');td.textContent=v;row.append(td);}target.append(row);}
function showSales(results,errors){const gross=results.reduce((s,r)=>s+Math.round(r.ventaBruta*100),0),refund=results.reduce((s,r)=>s+Math.round(r.reembolso*100),0);$('sales-units').textContent=results.reduce((s,r)=>s+r.unidades,0);$('sales-gross').textContent=money(gross/100);$('sales-refund').textContent=money(refund/100);$('sales-errors').textContent=errors.join(' · ');$('sales-output').hidden=false;window.renderMetrics(results,{summary:window.Menu?.view()==='summary'});}
let salesRunning=false;
async function loadHistory(){
 applyPeriod();
 window.clearComparison();
 $('comparison-status').textContent='';
 $('sales-output').hidden=true;
 $('sales-status').textContent='Leyendo el historial guardado…';
 try{
  const data=await api('/api/history',{accountId:$('sales-account').value,laboratorio:$('sales-lab').value,desde:$('sales-from').value,hasta:$('sales-to').value,aggregate:true});
  if($('sales-panel').hidden)return;
  updateSalesLabs(data.laboratorios.map(l=>({codigo:l.laboratorio,nombre:l.nombre})));
  showSales(data.laboratorios,[]);if(!data.snapshots)$('sales-output').hidden=true;
  window.Menu?.invalidate();
  if(window.Menu?.view()==='alerts')await loadComparison();
  if(window.Menu?.view()==='home')await window.Menu.loadEvolution();
  if(window.Menu?.view()==='summary')window.Menu.renderDetail();
  $('sales-status').textContent=data.updatedAt?'Historial guardado. Última actualización: '+new Date(data.updatedAt).toLocaleString('es-AR')+'. Datos más antiguos del período: '+new Date(data.oldestUpdate).toLocaleString('es-AR')+'.':'Todavía no hay datos importados para este período. Iniciá la importación.';
 }catch(error){$('sales-status').textContent=error.message;}
}
$('sales-form').addEventListener('submit',async event=>{event.preventDefault();if(salesRunning)return;salesRunning=true;controls();try{await loadHistory();}finally{salesRunning=false;controls();}});
$('import-history').addEventListener('click',async()=>{
 if(salesRunning)return;salesRunning=true;controls();$('import-history').disabled=true;
 const errors=[],monthStatus=new Map();let count=0;const now=formatLocal(new Date()),cutoff=new Date(Date.now()-90*86400000).toISOString().slice(0,7);
 try{
  for(const account of accounts){
   await new Promise(r=>setTimeout(r,3100));
   let labs;try{labs=(await api('/api/laboratorios',{accountId:account.id})).laboratorios.filter(l=>l.adherido);}catch(e){errors.push(account.name+': '+e.message);continue;}
   for(let month='2025-01';month<=now.slice(0,7);){
    if(!monthStatus.has(month))monthStatus.set(month,new Set((await api('/api/import-status',{month})).ids));
    const ids=monthStatus.get(month);
    for(const lab of labs){
     if(month<cutoff&&ids.has(account.id+'_'+lab.codigo))continue;
     if($('dashboard').hidden)throw new Error('Sesión cerrada. La importación puede retomarse.');
     $('sales-status').textContent='Importando '+account.name+' · '+lab.nombre+' · '+month+' ('+count+' meses guardados)…';
     await new Promise(r=>setTimeout(r,3100));
     try{await api('/api/import',{accountId:account.id,laboratorio:lab.codigo,month});count++;ids.add(account.id+'_'+lab.codigo);}catch(e){errors.push(account.name+' · '+lab.nombre+' · '+month+': '+e.message);}
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


const periodLabel=month=>new Intl.DateTimeFormat('es-AR',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(month+'-01T00:00:00Z'));
const currentMonth=formatLocal(initialDate).slice(0,7),previousMonth=$('sales-from').value.slice(0,7);
for(let m=currentMonth;m>='2025-01';){$('sales-period').add(new Option(periodLabel(m),m));const d=new Date(m+'-01T00:00:00Z');d.setUTCMonth(d.getUTCMonth()-1);m=d.toISOString().slice(0,7);}
$('sales-period').add(new Option('Todos los períodos','todos'));$('sales-period').add(new Option('Rango de fechas personalizado','personalizado'));$('sales-period').value=previousMonth;
function applyPeriod(){
 const value=$('sales-period').value,custom=value==='personalizado';
 for(const box of document.querySelectorAll('.custom-date'))box.hidden=!custom;
 $('sales-from').required=custom;$('sales-to').required=custom;
 if(custom)return;
 if(value==='todos'){$('sales-from').value='2025-01-01';$('sales-to').value=formatLocal(new Date());return;}
 const end=new Date(value+'-01T00:00:00Z');end.setUTCMonth(end.getUTCMonth()+1);end.setUTCDate(0);
 $('sales-from').value=value+'-01';$('sales-to').value=end.toISOString().slice(0,10)>formatLocal(new Date())?formatLocal(new Date()):end.toISOString().slice(0,10);
}
$('sales-period').addEventListener('change',applyPeriod);applyPeriod();

for(const id of ['sales-from','sales-to']){$(id).min='2025-01-01';$(id).max=formatLocal(new Date());}

for(const option of $('sales-period').options)if(/^\d{4}-\d{2}$/.test(option.value))$('compare-month').add(new Option(option.text,option.value));
$('compare-month').value=previousMonth;
const dateLabel=d=>new Date(d+'T00:00:00Z').toLocaleDateString('es-AR',{timeZone:'UTC'});
function yearAgo(value){const [year,month,day]=value.split('-').map(Number),last=new Date(Date.UTC(year-1,month,0)).getUTCDate();return (year-1)+'-'+String(month).padStart(2,'0')+'-'+String(Math.min(day,last)).padStart(2,'0');}
async function loadComparison(){
 const mode=$('compare-mode').value;if(mode==='none'){$('comparison-status').textContent='Evolución mensual del período seleccionado.';return;}
 const desde=$('sales-from').value,hasta=$('sales-to').value;
 let from=yearAgo(desde),to=yearAgo(hasta);
 if(mode==='month'){from=$('compare-month').value+'-01';const d=new Date(from+'T00:00:00Z');d.setUTCMonth(d.getUTCMonth()+1);d.setUTCDate(0);to=d.toISOString().slice(0,10);if(to>formatLocal(new Date()))to=formatLocal(new Date());}
 if(from<'2025-01-01'){$('comparison-status').textContent='La referencia incluye fechas anteriores a enero de 2025. No hay historial importado para comparar ese período.';return;}
 const currentLabel=$('sales-period').value==='personalizado'?dateLabel(desde)+' al '+dateLabel(hasta):$('sales-period').selectedOptions[0].text;
 const previousLabel=from.slice(0,7)===to.slice(0,7)?periodLabel(from.slice(0,7)):dateLabel(from)+' al '+dateLabel(to);
 try{const data=await api('/api/history',{accountId:$('sales-account').value,laboratorio:$('sales-lab').value,desde:from,hasta:to,aggregate:true});if($('sales-panel').hidden)return;if(!data.snapshots){$('comparison-status').textContent='No hay historial guardado para '+previousLabel+'.';return;}
 const fullMonths=desde.endsWith('-01')&&hasta===new Date(Date.UTC(Number(hasta.slice(0,4)),Number(hasta.slice(5,7)),0)).toISOString().slice(0,10)&&from.endsWith('-01')&&to===new Date(Date.UTC(Number(to.slice(0,4)),Number(to.slice(5,7)),0)).toISOString().slice(0,10);
 const equalDuration=(from.slice(0,7)===to.slice(0,7)&&desde.slice(0,7)===hasta.slice(0,7)&&fullMonths)||(Date.parse(hasta)-Date.parse(desde)===Date.parse(to)-Date.parse(from));
 $('comparison-status').textContent=currentLabel+' frente a '+previousLabel+'.'+(!equalDuration?' Los períodos tienen distinta duración; sus importes no son directamente equivalentes.':'');
 window.renderComparison(data.laboratorios,currentLabel,previousLabel,equalDuration);
 }catch(error){$('comparison-status').textContent='No se pudo cargar la referencia: '+error.message;}
}
$('compare-mode').addEventListener('change',()=>{$('compare-month-wrap').hidden=$('compare-mode').value!=='month';window.clearComparison();loadComparison();});
$('compare-month').addEventListener('change',()=>{window.clearComparison();loadComparison();});
