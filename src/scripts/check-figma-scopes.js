// Script para verificar los scopes del token de Figma
const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/analytics_weaver';

async function checkScopes() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('✅ Conectado a MongoDB\n');
    
    const db = client.db();
    const users = await db.collection('users').find({
      'providers.figma.oauth.accessToken': { $exists: true }
    }).toArray();
    
    console.log(`📊 Usuarios con token de Figma: ${users.length}\n`);
    
    for (const user of users) {
      console.log('━'.repeat(60));
      console.log(`Usuario: ${user.email}`);
      console.log(`ID: ${user._id}`);
      console.log(`Figma ID: ${user.providers?.figma?.id || 'N/A'}`);
      
      const token = user.providers?.figma?.oauth?.accessToken;
      if (token) {
        console.log(`Token length: ${token.length} caracteres`);
        console.log(`Token preview: ${token.substring(0, 30)}...`);
        
        // Intentar decodificar si es JWT (no lo es, pero por si acaso)
        if (token.startsWith('eyJ')) {
          console.log('⚠️  Token parece ser JWT (inesperado para Figma)');
        } else {
          console.log('✅ Token es opaco (esperado para Figma)');
        }
        
        // Probar el token con la API de Figma
        console.log('\n🔍 Probando token con API de Figma...');
        
        try {
          const response = await fetch('https://api.figma.com/v1/me', {
            headers: {
              'Authorization': `Bearer ${token}`,
              'User-Agent': 'Analytics-Weaver/1.0',
            },
          });
          
          console.log(`   Status: ${response.status} ${response.statusText}`);
          
          if (response.ok) {
            const data = await response.json();
            console.log('   ✅ Token válido');
            console.log(`   Email: ${data.email || data.handle}`);
            console.log(`   Scopes del token: No disponible directamente en respuesta`);
            
            // Intentar acceder a un archivo de prueba
            console.log('\n🔍 Probando acceso al archivo 2x3buJPznNfEV6zev2dGHH...');
            const fileResponse = await fetch('https://api.figma.com/v1/files/2x3buJPznNfEV6zev2dGHH', {
              headers: {
                'Authorization': `Bearer ${token}`,
                'User-Agent': 'Analytics-Weaver/1.0',
              },
            });
            
            console.log(`   Status: ${fileResponse.status} ${fileResponse.statusText}`);
            
            if (fileResponse.ok) {
              console.log('   ✅ ACCESO AL ARCHIVO EXITOSO!');
            } else {
              const errorText = await fileResponse.text();
              console.log('   ❌ NO SE PUEDE ACCEDER AL ARCHIVO');
              console.log(`   Error: ${errorText}`);
              
              if (fileResponse.status === 403) {
                console.log('\n💡 POSIBLE CAUSA: Scopes insuficientes del token');
                console.log('   El token fue generado con scopes que no incluyen acceso a archivos');
              }
            }
          } else {
            console.log('   ❌ Token inválido');
            const errorText = await response.text();
            console.log(`   Error: ${errorText}`);
          }
        } catch (error) {
          console.log(`   ❌ Error: ${error.message}`);
        }
        
        console.log(`\nExpira en: ${user.providers?.figma?.oauth?.expiresAt || 'No especificado'}`);
      } else {
        console.log('❌ No hay token OAuth');
      }
      console.log('━'.repeat(60));
      console.log('');
    }
    
    // Mostrar scopes configurados en .env
    console.log('\n📋 SCOPES CONFIGURADOS EN .ENV:');
    console.log(`   FIGMA_SCOPES: ${process.env.FIGMA_SCOPES || 'No configurado'}`);
    console.log('\n💡 RECOMENDACIÓN:');
    console.log('   Si el token actual no tiene acceso al archivo, necesitas:');
    console.log('   1. Cambiar FIGMA_SCOPES en .env a: file_read');
    console.log('   2. Desconectar Figma en la app');
    console.log('   3. Volver a conectar Figma (esto generará un nuevo token con los scopes correctos)');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.close();
  }
}

checkScopes().catch(console.error);
