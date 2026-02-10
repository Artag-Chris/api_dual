import { PrismaClient } from '@prisma/client';

const testConnection = async () => {
  const prismaLegacy = new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL_LEGACY || ''
      }
    }
  });

  try {
    console.log('🔄 Intentando conectar a la base de datos LEGACY...');
    console.log('URL:', process.env.DATABASE_URL_LEGACY?.replace(/:[^:]*@/, ':***@'));
    
    await prismaLegacy.$connect();
    console.log('✅ Conexión exitosa a la base de datos LEGACY');
    
    const result = await prismaLegacy.$queryRaw`SELECT 1 as test`;
    console.log('✅ Query de prueba ejecutada:', result);
    
  } catch (error: any) {
    console.error('❌ Error al conectar:', error.message);
    console.error('Código de error:', error.code);
  } finally {
    await prismaLegacy.$disconnect();
  }

  const prismaMain = new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL_MAIN || ''
      }
    }
  });

  try {
    console.log('\n🔄 Intentando conectar a la base de datos MAIN...');
    console.log('URL:', process.env.DATABASE_URL_MAIN?.replace(/:[^:]*@/, ':***@'));
    
    await prismaMain.$connect();
    console.log('✅ Conexión exitosa a la base de datos MAIN');
    
    const result = await prismaMain.$queryRaw`SELECT 1 as test`;
    console.log('✅ Query de prueba ejecutada:', result);
    
  } catch (error: any) {
    console.error('❌ Error al conectar:', error.message);
    console.error('Código de error:', error.code);
  } finally {
    await prismaMain.$disconnect();
  }
};

testConnection();
