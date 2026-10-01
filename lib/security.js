import {createHash, randomBytes, createCipheriv, createDecipheriv} from 'node:crypto';

export class AppError extends Error {
  constructor(message, status = 500) {super(message); this.status = status;}
}

function deriveKey(secret) {
  if (typeof secret !== 'string' || secret.length < 32) throw new AppError('El servidor todavía no tiene configurado el cifrado.',503);
  return createHash('sha256').update(secret).digest();
}
export function seal(value, secret, context) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm',deriveKey(secret),iv);
  cipher.setAAD(Buffer.from(context));
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value),'utf8'),cipher.final()]);
  return ['v1',iv.toString('base64url'),cipher.getAuthTag().toString('base64url'),encrypted.toString('base64url')].join('.');
}
export function unseal(value, secret, context) {
  const key = deriveKey(secret);
  try {
    const [version,iv,tag,data,...extra] = value.split('.');
    if (version !== 'v1' || extra.length || !iv || !tag || !data) throw new Error('format');
    const decipher = createDecipheriv('aes-256-gcm',key,Buffer.from(iv,'base64url'));
    decipher.setAAD(Buffer.from(context)); decipher.setAuthTag(Buffer.from(tag,'base64url'));
    return JSON.parse(Buffer.concat([decipher.update(Buffer.from(data,'base64url')),decipher.final()]).toString('utf8'));
  } catch {throw new AppError('No se pudo abrir la información cifrada. Verificá que las claves del servidor no hayan cambiado.',503);}
}
