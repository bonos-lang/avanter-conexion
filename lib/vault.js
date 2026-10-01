import {randomUUID} from 'node:crypto';
import {AppError,seal,unseal} from './security.js';
export function createVault({firebase,encryptionKey}) {
 const context=uid=>`avanter-vault:${uid}`;
 const read=async session=>{
  const result=await firebase.readVault(session);
  const data=result.cipher?unseal(result.cipher,encryptionKey,context(session.uid)):{accounts:[]};
  if(!Array.isArray(data.accounts)||data.accounts.length>11)throw new AppError('El archivo de cuentas no tiene un formato válido.',503);
  return {...result,accounts:data.accounts};
 };
 const publicAccount=({id,name,email})=>({id,name,email});
 return {
  async list(session){return (await read(session)).accounts.map(publicAccount);},
  async add(session,{name,email,password}){
   const state=await read(session);const existing=state.accounts.find(a=>a.email.toLowerCase()===email.trim().toLowerCase());
   if(!existing&&state.accounts.length>=11)throw new AppError('Ya guardaste 11 cuentas.',400);
   const account={id:existing?.id||randomUUID(),name:name.trim(),email:email.trim(),password};
   if(existing)state.accounts[state.accounts.indexOf(existing)]=account;else state.accounts.push(account);
   await firebase.writeVault(session,seal({accounts:state.accounts},encryptionKey,context(session.uid)),state.version);
   return publicAccount(account);
  },
  async get(session,id){const account=(await read(session)).accounts.find(a=>a.id===id);if(!account)throw new AppError('La cuenta seleccionada no existe.',404);return account;}
 };
}
