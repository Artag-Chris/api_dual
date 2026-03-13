import { Request, Response } from 'express';
import CodeudoresClienteMapperService from '../../domain/class/codeudores-cliente-mapper.service';
import WinstonAdapter from '../../config/adapters/winstonAdapter';

export class CodeudoresClienteController {
  constructor(
    private codeudoresMapper: CodeudoresClienteMapperService,
    private logger: typeof WinstonAdapter,
  ) {}

  async migrateCodeudoresClientes(req: Request, res: Response) {
    try {
      this.logger.info('[CodeudoresClienteController] Iniciando migración de codeudores...');

      const result = await this.codeudoresMapper.migrateAllCodeudoresAsUserCliente();

      this.logger.info('[CodeudoresClienteController] Migración completada', {
        status: result.status,
        migrados: result.migrados,
      });

      return res.json({
        success: result.status === 'CODEUDORES_MIGRADOS',
        status: result.status,
        data: {
          totalEncontrados: result.totalEncontrados,
          migrados: result.migrados,
          omitidosSinDocumento: result.omitidosSinDocumento,
          incompletos: result.incompletos,
          emailDummy: result.emailDummy,
        },
        errores: result.errores && result.errores.length > 0 ? result.errores : [],
      });
    } catch (error) {
      this.logger.error('[CodeudoresClienteController] Error en migración', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });

      return res.status(500).json({
        success: false,
        status: 'ERROR',
        message: 'Error al migrar codeudores',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
