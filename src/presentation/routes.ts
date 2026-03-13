import { Router } from 'express';
import { ModuloRoutes } from '../modulo/modulo.routes';
import { LegacyDataRoutes } from '../modules/legacy-data/legacy-data.routes';
import { MainDataRoutes } from '../modules/main-data/main-data.routes';
import migrationRoutes from '../modules/migration/migration.routes';
import amortizacionRoutes from '../amortizacion/amortizacion.routes';
import amortizacionPatternRoutes from '../amortizacionPattern/amortizacionPattern.routes';
import { UsuariosRoutes } from '../modules/usuarios/usuarios.routes';

//import { PrismaRoutes } from '../prisma/prisma.routes';

export class AppRoutes {
  static get routes(): Router {
    const router = Router();
    /*  
    Rutas de los módulos:
    - /api/modulo: Módulo de ejemplo existente
    - /api/legacy: Operaciones CRUD en base de datos legacy
    - /api/main: Operaciones CRUD en base de datos principal
    - /api/migration: Herramientas de migración entre bases de datos
    - /api/amortizacion: Cálculo de amortizaciones
    - /api/amortizacion-pattern: Patrón de amortización (3 fases: Factory + Pagos + Sanciones)
    */
  
    router.use(`/api/modulo`, ModuloRoutes.routes);
    router.use(`/api/legacy`, LegacyDataRoutes.routes);
    router.use(`/api/main`, MainDataRoutes.routes);
    router.use(`/api/migration`, migrationRoutes);
    router.use(`/api/amortizacion`, amortizacionRoutes);
    router.use(`/api/amortizacion-pattern`, amortizacionPatternRoutes);
    router.use(`/api/admin`, UsuariosRoutes.routes);
    
    // Ruta comentada - antigua implementación con una sola base de datos
    // router.use(`/api/prisma`, PrismaRoutes.routes);

    return router;
  }
}





