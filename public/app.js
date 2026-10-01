const $=id=>document.getElementById(id);
let accounts=[],laboratories=[],working=false;
async function api(path,body){
 const response=await fetch(path,{method:body===undefined?'GET':'POST',headers:body===undefined?{}:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),cache:'no-store',signal:AbortSignal.timeout(85000)});
 if(!response.headers.get('content-type')?.includes('application/json'))throw new Error('El servidor no está disponible. Volvé a probar en un momento.');
 const data=await response.json();
 if(!response.ok){if(response.status===401&&path!=='/api/login')showAuth();throw new Error(data.error||'No se pudo completar la operación.');}return data;
}
function showAuth(){accounts=[];clearResults();$('account-form').reset();$('account-form').hidden=true;$('dashboard').hidden=true;$('logout').hidden=true;$('auth-panel').hidden=false;$('account-count').textContent='Acceso privado';}
function clearResults(){laboratories=[];render();$('table').hidden=true;$('search').disabled=true;$('search').value='';$('updated').textContent='';$('count').textContent='Sin consultar';}
function updateAccounts(selected){$('account').replaceChildren(new Option('Elegir una cuenta',''));for(const a of accounts)$('account').add(new Option(a.name,a.id));$('account').value=selected||'';$('account-count').textContent=`${accounts.length} de 11 cuentas`;controls();}
function controls(){for(const id of ['consult','edit-account'])$(id).disabled=working||salesRunning||!$('account').value;$('new-account').disabled=working||salesRunning||accounts.length>=11;$('save-account').disabled=working||salesRunning;$('account').disabled=working||salesRunning;$('sales-submit').disabled=working||salesRunning;}
async function loadAccounts(selected){accounts=(await api('/api/accounts')).accounts;updateAccounts(selected);$('auth-panel').hidden=true;$('dashboard').hidden=false;$('logout').hidden=false;}
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
function showSales(results,errors){let units=0,gross=0,refund=0;const daily=new Map();$('sales-labs').replaceChildren();$('sales-days').replaceChildren();for(const result of results){units+=result.unidades;gross+=Math.round(result.ventaBruta*100);refund+=Math.round(result.reembolso*100);salesRow($('sales-labs'),[result.farmacia,result.nombre,result.unidades,money(result.ventaBruta),money(result.reembolso)]);for(const day of result.porDia){const current=daily.get(day.fecha)||{unidades:0,ventaBruta:0};current.unidades+=day.unidades;current.ventaBruta+=Math.round(day.ventaBruta*100);daily.set(day.fecha,current);}}$('sales-units').textContent=units;$('sales-gross').textContent=money(gross/100);$('sales-refund').textContent=money(refund/100);for(const [fecha,d] of [...daily].sort((a,b)=>a[0].localeCompare(b[0])))salesRow($('sales-days'),[fecha,d.unidades,money(d.ventaBruta/100)]);$('sales-errors').textContent=errors.length?'Consulta parcial. '+errors.join(' · '):'';$('sales-output').hidden=false;}
let salesRunning=false;
$('sales-form').addEventListener('submit',async event=>{
 event.preventDefault();if(salesRunning)return;
 const selected=$('sales-account').value,labCode=$('sales-lab').value,desde=$('sales-from').value,hasta=$('sales-to').value;
 if(desde>hasta||(Date.parse(hasta)-Date.parse(desde))/86400000>92){$('sales-status').textContent='Elegí un rango válido de hasta 93 días.';return;}
 const selectedAccounts=accounts.filter(a=>selected==='todos'||a.id===selected),results=[],errors=[];
 salesRunning=true;$('sales-submit').disabled=true;$('sales-output').hidden=true;$('consult').disabled=true;$('new-account').disabled=true;$('edit-account').disabled=true;
 try{
 for(const account of selectedAccounts){
  let labs;
  try{$('sales-status').textContent=`Buscando laboratorios de ${account.name}…`;labs=(await api('/api/laboratorios',{accountId:account.id})).laboratorios;updateSalesLabs(labs);}
  catch(error){errors.push(`${account.name}: ${error.message}`);if($('dashboard').hidden)break;continue;}
  const selectedLabs=labs.filter(l=>l.adherido&&(labCode==='todos'||l.codigo===labCode));
  if(!selectedLabs.length&&labCode!=='todos')errors.push(`${account.name}: sin adhesión al laboratorio elegido.`);
  for(const lab of selectedLabs){
   await new Promise(resolve=>setTimeout(resolve,3100));
   if($('dashboard').hidden)break;
   $('sales-status').textContent=`Consultando ${account.name} · ${lab.nombre}…`;
   try{const data=await api('/api/ventas',{accountId:account.id,laboratorio:lab.codigo,desde,hasta});results.push(...data.laboratorios.map(l=>({...l,farmacia:account.name})));errors.push(...data.errores.map(e=>`${account.name} · ${e.laboratorio}: ${e.error}`));}
   catch(error){errors.push(`${account.name} · ${lab.nombre}: ${error.message}`);}
  }
  if($('dashboard').hidden)break;
  await new Promise(resolve=>setTimeout(resolve,3100));
 }
 if(!$('dashboard').hidden){showSales(results,errors);$('sales-status').textContent=`${errors.length?'Consulta parcial':'Consulta completada'}: ${results.length} combinaciones farmacia/laboratorio. Período ${desde} al ${hasta}.`;}
 }finally{salesRunning=false;$('sales-submit').disabled=false;controls();}
});
const initialDate=new Date(),formatLocal=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
$('sales-from').value=formatLocal(new Date(initialDate.getFullYear(),initialDate.getMonth()-1,1));$('sales-to').value=formatLocal(new Date(initialDate.getFullYear(),initialDate.getMonth(),0));

