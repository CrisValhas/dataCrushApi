// Script de Diagnóstico Detallado de Figma
// Este script te ayudará a entender exactamente qué está fallando

import { MongoClient, ObjectId } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/ga4fun';
const USER_ID = process.argv[2]; // Pasar el user ID como argumento
const FILE_KEY = process.argv[3]; // Opcional: pasar el file key para probar

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

async function diagnose() {
  console.log('='.repeat(60));
  console.log('🔍 DIAGNÓSTICO DETALLADO DE FIGMA');
  console.log('='.repeat(60));
  console.log('');

  if (!USER_ID) {
    console.error('❌ Error: Debes proporcionar el USER_ID');
    console.log('Uso: ts-node diagnose-figma-detailed.ts <USER_ID> [FILE_KEY]');
    console.log('');
    console.log('Para obtener tu USER_ID:');
    console.log('1. Abre DevTools en el navegador');
    console.log('2. Ve a Application > Local Storage');
    console.log('3. Busca el token JWT y decodifícalo en jwt.io');
    console.log('4. El campo "sub" es tu USER_ID');
    process.exit(1);
  }

  if (!ObjectId.isValid(USER_ID)) {
    console.error('Error: USER_ID debe ser un ObjectId valido de MongoDB');
    process.exit(1);
  }

  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    console.log('✅ Conectado a MongoDB');
    console.log('');

    const db = client.db();
    const usersCollection = db.collection('users');

    // 1. Verificar que el usuario existe
    console.log('1️⃣ Verificando usuario en base de datos...');
    const userObjectId = new ObjectId(USER_ID);
    const user = await usersCollection.findOne({ _id: userObjectId });

    if (!user) {
      console.error('❌ Usuario no encontrado en la base de datos');
      console.log(`   Buscando: ${USER_ID}`);
      process.exit(1);
    }

    console.log('✅ Usuario encontrado');
    console.log(`   Email: ${user.email}`);
    console.log('');

    // 2. Verificar token de Figma
    console.log('2️⃣ Verificando token de Figma...');
    const figmaProvider = user.providers?.figma;

    if (!figmaProvider) {
      console.error('❌ No hay provider de Figma configurado');
      console.log('   El usuario necesita conectar Figma desde /app/integrations');
      process.exit(1);
    }

    console.log('✅ Provider de Figma encontrado');
    console.log(`   Figma ID: ${figmaProvider.id || 'No configurado'}`);
    console.log('');

    const oauth = figmaProvider.oauth;
    if (!oauth) {
      console.error('❌ No hay configuración OAuth de Figma');
      console.log('   El usuario necesita conectar Figma desde /app/integrations');
      process.exit(1);
    }

    const hasAccessToken = !!oauth.accessToken;
    const hasRefreshToken = !!oauth.refreshToken;
    const expiresAt = oauth.expiresAt;

    console.log('3️⃣ Detalles del Token OAuth:');
    console.log(`   Access Token: ${hasAccessToken ? '✅ Existe' : '❌ No existe'}`);
    if (hasAccessToken) {
      console.log(`   Token Length: ${oauth.accessToken.length} caracteres`);
      console.log(`   Token Preview: ${oauth.accessToken.substring(0, 20)}...`);
    }
    console.log(`   Refresh Token: ${hasRefreshToken ? '✅ Existe' : '⚠️  No existe'}`);
    console.log(`   Expira en: ${expiresAt || 'No especificado'}`);

    if (expiresAt) {
      const expirationDate = new Date(expiresAt);
      const now = new Date();
      const isExpired = now >= expirationDate;
      const timeLeft = expirationDate.getTime() - now.getTime();
      const daysLeft = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
      const hoursLeft = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

      if (isExpired) {
        console.log(`   Estado: ❌ EXPIRADO (hace ${Math.abs(daysLeft)} días)`);
        console.log('   Acción: Reconectar Figma');
      } else if (daysLeft < 1) {
        console.log(`   Estado: ⚠️  Expira pronto (${hoursLeft} horas)`);
      } else {
        console.log(`   Estado: ✅ Válido (${daysLeft} días restantes)`);
      }
    }
    console.log('');

    if (!hasAccessToken) {
      console.error('❌ No se puede continuar sin access token');
      process.exit(1);
    }

    // 4. Probar el token con la API de Figma
    console.log('4️⃣ Probando token con API de Figma...');
    console.log('   Endpoint: https://api.figma.com/v1/me');

    try {
      const meResponse = await fetch('https://api.figma.com/v1/me', {
        headers: {
          'Authorization': `Bearer ${oauth.accessToken}`,
          'User-Agent': 'Analytics-Weaver/1.0',
        },
      });

      console.log(`   Status: ${meResponse.status} ${meResponse.statusText}`);

      if (meResponse.ok) {
        const meData = await meResponse.json();
        console.log('   ✅ Token válido');
        console.log(`   Usuario Figma: ${meData.email || meData.handle}`);
        console.log(`   ID: ${meData.id}`);
        console.log(`   Equipos: ${meData.teams?.length || 0}`);
      } else {
        const errorText = await meResponse.text();
        console.error('   ❌ Token inválido o expirado');
        console.error(`   Error: ${errorText}`);
        console.log('');
        console.log('   💡 Solución: Reconecta tu cuenta de Figma');
        console.log('      1. Ve a /app/integrations');
        console.log('      2. Desconecta Figma');
        console.log('      3. Conecta Figma de nuevo');
        process.exit(1);
      }
    } catch (error) {
      console.error('   ❌ Error al conectar con API de Figma:', getErrorMessage(error));
      process.exit(1);
    }
    console.log('');

    // 5. Si se proporcionó un FILE_KEY, probar acceso
    if (FILE_KEY) {
      console.log('5️⃣ Probando acceso al archivo de Figma...');
      console.log(`   File Key: ${FILE_KEY}`);
      console.log(`   URL: https://api.figma.com/v1/files/${FILE_KEY}`);
      console.log('');

      try {
        const fileResponse = await fetch(`https://api.figma.com/v1/files/${FILE_KEY}`, {
          headers: {
            'Authorization': `Bearer ${oauth.accessToken}`,
            'User-Agent': 'Analytics-Weaver/1.0',
          },
        });

        console.log(`   Status: ${fileResponse.status} ${fileResponse.statusText}`);

        if (fileResponse.ok) {
          const fileData = await fileResponse.json();
          console.log('   ✅ Acceso al archivo exitoso');
          console.log(`   Nombre: ${fileData.name}`);
          console.log(`   Última modificación: ${fileData.lastModified}`);
          console.log(`   Versión: ${fileData.version}`);
          
          // Contar frames
          let frameCount = 0;
          const countFrames = (node: any) => {
            if (node.type === 'FRAME') frameCount++;
            if (node.children) {
              node.children.forEach(countFrames);
            }
          };
          countFrames(fileData.document);
          console.log(`   Frames encontrados: ${frameCount}`);
        } else {
          const errorText = await fileResponse.text();
          console.error('   ❌ No se puede acceder al archivo');
          console.error(`   Error: ${errorText}`);
          console.log('');

          if (fileResponse.status === 403) {
            console.log('   💡 Causa: El archivo es privado o no tienes permisos');
            console.log('   📝 Soluciones posibles:');
            console.log('      1. HACER EL ARCHIVO PÚBLICO:');
            console.log('         a. Abre el archivo en Figma');
            console.log('         b. Click en "Share" (arriba derecha)');
            console.log('         c. Selecciona "Anyone with the link"');
            console.log('         d. Cambia a "can view"');
            console.log('         e. Intenta de nuevo');
            console.log('');
            console.log('      2. OBTENER ACCESO:');
            console.log('         a. Pide al dueño que te invite al archivo');
            console.log('         b. O únete al equipo que posee el archivo');
            console.log('');
            console.log('      3. VERIFICAR URL:');
            console.log('         a. Asegúrate de que la URL sea correcta');
            console.log('         b. El File Key debe ser el ID del archivo');
            console.log(`         c. Tu File Key: ${FILE_KEY}`);
          } else if (fileResponse.status === 404) {
            console.log('   💡 Causa: Archivo no encontrado');
            console.log('   📝 Verifica que el File Key sea correcto');
            console.log(`      File Key actual: ${FILE_KEY}`);
          } else if (fileResponse.status === 401) {
            console.log('   💡 Causa: Token inválido (aunque pasó la prueba /me)');
            console.log('   📝 Esto es raro, intenta reconectar Figma');
          }
        }
      } catch (error) {
        console.error('   ❌ Error al acceder al archivo:', getErrorMessage(error));
      }
      console.log('');
    }

    // 6. Verificar scopes
    console.log('6️⃣ Verificando configuración de scopes...');
    console.log(`   FIGMA_SCOPES configurados: ${process.env.FIGMA_SCOPES || 'file_read (default)'}`);
    console.log('');

    // 7. Resumen final
    console.log('='.repeat(60));
    console.log('📊 RESUMEN DEL DIAGNÓSTICO');
    console.log('='.repeat(60));
    console.log(`Usuario: ✅ ${user.email}`);
    console.log(`Token: ${hasAccessToken ? '✅ Existe' : '❌ No existe'}`);
    console.log(`Token válido: ${hasAccessToken ? '✅ Sí' : '❌ No'}`);
    
    if (FILE_KEY) {
      console.log(`Acceso al archivo: ${FILE_KEY ? '(ver arriba)' : 'No probado'}`);
    } else {
      console.log('Acceso al archivo: ⚠️  No se probó (no se proporcionó FILE_KEY)');
      console.log('');
      console.log('Para probar un archivo específico, ejecuta:');
      console.log(`node dist/scripts/diagnose-figma-detailed.js ${USER_ID} TU_FILE_KEY`);
    }
    console.log('='.repeat(60));

  } catch (error) {
    console.error('❌ Error durante el diagnóstico:', getErrorMessage(error));
    if (error instanceof Error && error.stack) {
      console.error(error.stack);
    }
  } finally {
    await client.close();
  }
}

diagnose().catch(console.error);
