# Avanter Cuentas

Página privada para guardar hasta 11 cuentas de Avanter y consultar sus laboratorios, con y sin adhesión. Hosting y consultas en Render; Firebase Authentication autentica al administrador; Firestore almacena un único documento con las cuentas cifradas AES-256-GCM. Las contraseñas no se incluyen en respuestas al navegador ni en logs. La sesión del panel dura 8 horas; las cuentas se conservan entre sesiones y reinicios de Render.

## Configuración

1. Firebase proyecto `avanter-cuentas`: habilitar acceso email/contraseña y crear el usuario del panel. UID autorizado: `2nPAIyRIdtWHjc5FUdmgGjbi7NP2`.
2. Registrar una app web para obtener su apiKey pública. No usar credenciales de servicio ni el proyecto avanterplus.
3. Crear Firestore Standard `(default)` en producción. Publicar el contenido de `firestore.rules` en el proyecto nuevo. Ningún otro documento tiene acceso permitido.
4. En Render > Environment, configurar:

| Variable | Valor |
| --- | --- |
| NODE_ENV | production |
| FIREBASE_PROJECT_ID | avanter-cuentas |
| FIREBASE_API_KEY | AIzaSyDswOSAp4y3BEc784dBL0kF-twHWjyUeqw |
| DASHBOARD_ADMIN_UID | 2nPAIyRIdtWHjc5FUdmgGjbi7NP2 |
| ENCRYPTION_KEY | secreto aleatorio de al menos 32 caracteres |
| SESSION_SECRET | otro secreto aleatorio de al menos 32 caracteres |

Generar secretos con un gestor de contraseñas o `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. Guardarlos como variables privadas de Render. Conservar ENCRYPTION_KEY en un gestor seguro: cambiarla impide descifrar las cuentas existentes. No subir .env ni secretos a GitHub. Cambiar SESSION_SECRET cierra las sesiones actuales.

5. Actualizar archivos del repositorio y hacer Manual Deploy > Deploy latest commit. Una configuración incompleta deja bloqueadas las API, con un aviso en la página.
6. Ingresar al panel con el usuario Firebase. Agregar farmacia, email y clave de Avanter. El servidor verifica la conexión antes de guardar. Para consultar después, seleccionar la cuenta y presionar Consultar laboratorios. Actualizar clave permite reemplazarla para el mismo email.

## Verificación local

`npm ci`, `npm test`, `npm run check`. Las pruebas utilizan credenciales ficticias, verifican cifrado y alteraciones, persistencia tras recrear el módulo, control de acceso, CSRF y consultas con credenciales guardadas. No constituyen una prueba de la configuración publicada de Firebase o Render.

Firebase usa su cuota gratuita de Authentication y Firestore; no hay Cloud Functions. Render Free puede suspender el proceso por inactividad. El archivo cifrado permanece en Firestore. Documentación: https://firebase.google.com/docs/firestore/use-rest-api y https://firebase.google.com/docs/firestore/quotas.

