import ExcelJS from 'exceljs';

/**
 * UserAdminExcelRow
 * Interfaz que mapea las columnas del Excel de actualizacion de usuarios admin
 */
export interface UserAdminExcelRow {
  labora: string;       // Columna LABORA (check mark)
  name: string;         // Nombre completo
  estado: string;       // Estado (Activo, Inactivo, etc)
  rol_: string;         // Rol (Asesor, Coordinador, Administrador, etc)
  email: string;        // Email
  telefono: string;     // Teléfono
  num_cuenta?: string;  // Número de cuenta (opcional)
  banco_id?: string;    // Banco ID (opcional)
  punto: string;        // Punto (ubicación: "CHAPARRAL - FACILCREDITOS SAS")
  aliado: string;       // Aliado (FACILCREDITOS SAS, etc)
}

/**
 * UpdateUserAdminExcelParser
 * Parsea archivos Excel para actualización de usuarios admin
 * Detecta automáticamente las columnas y valida datos
 */
export class UpdateUserAdminExcelParser {
  /**
   * Parsea archivo Excel y retorna array de filas validadas
   */
  async parseFile(buffer: Buffer, filename: string): Promise<UserAdminExcelRow[]> {
    if (!filename.endsWith('.xlsx')) {
      throw new Error('File must be .xlsx format');
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);

    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      throw new Error('No worksheet found in Excel file');
    }

    // Mapeo de columnas case-insensitive
    const headers: { [key: string]: number } = {};
    const headerRow = worksheet.getRow(1);

    headerRow.eachCell((cell, colNumber) => {
      const header = cell.value?.toString().toLowerCase().trim();
      if (header) {
        headers[header] = colNumber;
      }
    });

    // Validar que existan las columnas requeridas
    const requiredColumns = ['name', 'email', 'rol_', 'punto'];
    for (const col of requiredColumns) {
      if (!headers[col] && !headers[col.replace('_', '')]) {
        throw new Error(`Excel file must contain a "${col}" column (case-insensitive)`);
      }
    }

    // Parsear los datos
    const results: UserAdminExcelRow[] = [];
    const rowErrors: string[] = [];

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // Skip header

      try {
        const rowData = this.extractRowData(row, headers);
        
        // Validar que tenga email o nombre
        if (!rowData.email && !rowData.name) {
          rowErrors.push(`Row ${rowNumber}: Must have at least email or name`);
          return;
        }

        results.push(rowData);
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        rowErrors.push(`Row ${rowNumber}: ${msg}`);
      }
    });

    if (results.length === 0) {
      throw new Error(
        `No valid records found in Excel file. Errors: ${rowErrors.join('; ')}`
      );
    }

    return results;
  }

  /**
   * Extrae y normaliza datos de una fila
   */
  private extractRowData(row: any, headers: { [key: string]: number }): UserAdminExcelRow {
    const getCellValue = (columnName: string): string => {
      const colNum = headers[columnName] || headers[columnName.replace('_', '')];
      if (!colNum) return '';
      
      const cell = row.getCell(colNum);
      return cell.value?.toString().trim() || '';
    };

    const name = getCellValue('name');
    const email = getCellValue('email');
    const telefono = getCellValue('telefono');
    const rol = getCellValue('rol_');
    const punto = getCellValue('punto');
    const estado = getCellValue('estado');
    const labora = getCellValue('labora');
    const aliado = getCellValue('aliado');
    const numCuenta = getCellValue('num_cuenta');
    const bancoId = getCellValue('banco_id');

    // Validar email format si existe
    if (email && !this.isValidEmail(email)) {
      throw new Error(`Invalid email format: ${email}`);
    }

    return {
      labora,
      name,
      estado,
      rol_: rol,
      email,
      telefono,
      num_cuenta: numCuenta,
      banco_id: bancoId,
      punto,
      aliado,
    };
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}

/**
 * UpdateUserAdminFromExcelDto
 * DTO con validación para cada fila de usuario a actualizar
 */
export class UpdateUserAdminFromExcelDto {
  name: string;
  email: string;
  telefono: string;
  rol_: string;
  punto: string;

  constructor(data: UserAdminExcelRow) {
    this.name = data.name?.trim() || '';
    this.email = data.email?.trim() || '';
    this.telefono = data.telefono?.trim() || '';
    this.rol_ = data.rol_?.trim() || '';
    this.punto = data.punto?.trim() || '';
  }

  /**
   * Factory method con validación (patrón existente)
   */
  static create(row: UserAdminExcelRow): [string?, UpdateUserAdminFromExcelDto?] {
    if (!row.email || row.email.trim() === '') {
      return ['Email is required', undefined];
    }

    if (!row.name || row.name.trim() === '') {
      return ['Name is required', undefined];
    }

    if (!row.rol_ || row.rol_.trim() === '') {
      return ['Rol (rol_) is required', undefined];
    }

    if (!row.punto || row.punto.trim() === '') {
      return ['Punto is required', undefined];
    }

    try {
      const dto = new UpdateUserAdminFromExcelDto(row);
      return [undefined, dto];
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown validation error';
      return [msg, undefined];
    }
  }
}
