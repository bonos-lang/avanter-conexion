import {AppError} from './security.js';

export function createFirebase({projectId,apiKey,adminUid,fetcher=fetch}) {
  const configured = () => !!(projectId && apiKey && adminUid);
  const google = async (url,options) => {
    let response;
    try {response = await fetcher(url,{...options,signal:AbortSignal.timeout(15000)});} catch {throw new AppError('No se pudo conectar con el servicio de acceso privado.',502);}
    let data; try {data = await response.json();} catch {throw new AppError('El servicio de acceso devolvió una respuesta inválida.',502);}
    if (!response.ok) {
      if (response.status === 400 || response.status === 401) throw new AppError('No se pudo iniciar sesión. Revisá las credenciales del dashboard.',401);
      throw new AppError('El servicio de acceso privado no está configurado o disponible.',503);
    }
    return data;
  };
  const guard = uid => {if (uid !== adminUid) throw new AppError('Esta cuenta no tiene acceso al dashboard.',403);};
  return {
    configured,
    async login(email,password) {
      if (!configured()) throw new AppError('Falta configurar el acceso privado al dashboard.',503);
      const data = await google(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(apiKey)}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password,returnSecureToken:true})});
      guard(data.localId);
      if (!data.idToken || !data.refreshToken) throw new AppError('La respuesta de acceso está incompleta.',502);
      return {uid:data.localId,idToken:data.idToken,refreshToken:data.refreshToken,tokenExpires:Date.now()+Number(data.expiresIn || 3600)*1000,sessionExpires:Date.now()+8*60*60*1000};
    },
    async refresh(session) {
      guard(session.uid);
      const data = await google(`https://securetoken.googleapis.com/v1/token?key=${encodeURIComponent(apiKey)}`,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'refresh_token',refresh_token:session.refreshToken})});
      guard(data.user_id);
      if (!data.id_token || !data.refresh_token) throw new AppError('No se pudo renovar el acceso privado.',401);
      return {...session,idToken:data.id_token,refreshToken:data.refresh_token,tokenExpires:Date.now()+Number(data.expires_in || 3600)*1000};
    },
    async readVault(session) {
      guard(session.uid);
      const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents/avanterVaults/${encodeURIComponent(session.uid)}`;
      let response;
      try {response=await fetcher(url,{headers:{Authorization:`Bearer ${session.idToken}`},signal:AbortSignal.timeout(15000)});} catch {throw new AppError('No se pudo conectar con el almacenamiento de cuentas.',502);}
      if (response.status===404) return {cipher:null,version:null};
      if (!response.ok) throw new AppError('No se pudo acceder a las cuentas guardadas. Revisá la base de datos y sus reglas.',503);
      const doc=await response.json();
      if (typeof doc.fields?.cipher?.stringValue !== 'string' || !doc.updateTime) throw new AppError('La información guardada no tiene un formato válido.',503);
      return {cipher:doc.fields.cipher.stringValue,version:doc.updateTime};
    },
    async writeVault(session,cipher,version) {
      guard(session.uid);
      const precondition = version ? `currentDocument.updateTime=${encodeURIComponent(version)}` : 'currentDocument.exists=false';
      const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents/avanterVaults/${encodeURIComponent(session.uid)}?${precondition}`;
      let response;
      try {response=await fetcher(url,{method:'PATCH',headers:{Authorization:`Bearer ${session.idToken}`,'Content-Type':'application/json'},body:JSON.stringify({fields:{cipher:{stringValue:cipher}}}),signal:AbortSignal.timeout(15000)});} catch {throw new AppError('No se pudo guardar la cuenta. Intentá nuevamente.',502);}
      if (response.status===409 || response.status===412) throw new AppError('Las cuentas cambiaron en otra ventana. Recargá e intentá nuevamente.',409);
      if (!response.ok) throw new AppError('No se pudo guardar la cuenta. Revisá las reglas de almacenamiento.',503);
    }
  };
}
