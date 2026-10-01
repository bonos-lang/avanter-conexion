const form = document.querySelector('#login');
const status = document.querySelector('#status');
const search = document.querySelector('#search');
const rows = document.querySelector('#rows');
let laboratories = [];
function render() {
  const query = search.value.trim().toLocaleLowerCase('es');
  const filtered = laboratories.filter(l => `${l.nombre} ${l.codigo}`.toLocaleLowerCase('es').includes(query));
  rows.replaceChildren();
  for (const lab of filtered) {
    const row = document.createElement('tr');
    for (const value of [lab.nombre, lab.codigo]) { const cell = document.createElement('td'); cell.textContent = value; row.append(cell); }
    const cell = document.createElement('td'); const badge = document.createElement('span');
    badge.className = 'badge' + (lab.adherido ? ' yes' : ''); badge.textContent = lab.adherido ? 'Adherido' : 'Sin adherir';
    cell.append(badge); row.append(cell); rows.append(row);
  }
  document.querySelector('#count').textContent = `${filtered.length} de ${laboratories.length}`;
  if (!filtered.length && laboratories.length) { const row = document.createElement('tr'); const cell = document.createElement('td'); cell.colSpan = 3; cell.textContent = 'No hay coincidencias.'; row.append(cell); rows.append(row); }
}
search.addEventListener('input', render);
form.addEventListener('submit', async event => {
  event.preventDefault();
  const button = document.querySelector('#submit'); const password = document.querySelector('#password');
  const body = JSON.stringify({email: document.querySelector('#email').value.trim(), password: password.value});
  password.value = '';
  laboratories = []; rows.replaceChildren(); search.value = ''; search.disabled = true;
  document.querySelector('#table').hidden = true; document.querySelector('#count').textContent = 'Consultando'; document.querySelector('#updated').textContent = '';
  button.disabled = true; document.querySelector('#results').setAttribute('aria-busy', 'true');
  status.className = ''; status.textContent = 'Iniciando sesión y consultando Avanter…';
  try {
    const response = await fetch('/api/laboratorios', {method: 'POST', headers: {'Content-Type': 'application/json'}, body, cache: 'no-store', signal: AbortSignal.timeout(85000)});
    if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('El servidor no está disponible. Esperá un momento y volvé a probar.');
    const data = await response.json(); if (!response.ok) throw new Error(data.error || 'No se pudo consultar Avanter.');
    if (!Array.isArray(data.laboratorios)) throw new Error('La respuesta no contiene un listado válido.');
    laboratories = data.laboratorios; search.disabled = false; document.querySelector('#table').hidden = false; render();
    status.textContent = `Consulta completada: ${laboratories.length} laboratorios. Se incluyen todos los estados de adhesión.`;
    document.querySelector('#updated').textContent = `Consultado el ${new Date(data.consultadoEn).toLocaleString('es-AR')}`;
  } catch (error) {
    status.className = 'error'; status.textContent = error.name === 'TimeoutError' ? 'Avanter demoró demasiado. Intentá nuevamente.' : error.message;
    document.querySelector('#count').textContent = 'Sin datos';
  } finally { button.disabled = false; document.querySelector('#results').setAttribute('aria-busy', 'false'); }
});
