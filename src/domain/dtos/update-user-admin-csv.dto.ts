import { parse } from 'csv-parse/sync';
import ExcelJS from 'exceljs';

/**
 * Interfaz que mapea las columnas del CSV de actualización de usuarios
 * Columnas esperadas: LABORA, CEDULA, name, estado, rol_, email, telefono, num_cuenta, banco_id, punto, aliado
 */
export interface UserAdminCsvRow {
  labora: string;
  cedula: string;
  name: string;
  estado: string;
  rol_: string;
  email: string;
  telefono: string;
  num_cuenta: string;
  banco_id: string;
  punto: string;
  aliado: string;
}

/**
 * UpdateUserAdminCsvParser
 * Parsea archivos CSV o XLSX para actualización masiva de usuarios admin por documento
 */
export class UpdateUserAdminCsvParser {
  /**
   * Parsea archivo CSV o XLSX y retorna array de filas
   */
  async parseFile(buffer: Buffer, filename: string): Promise<UserAdminCsvRow[]> {
    if (filename.endsWith('.csv')) {
      return this.parseCSV(buffer);
    } else if (filename.endsWith('.xlsx')) {
      return this.parseExcel(buffer);
    } else {
      throw new Error('File must be .csv or .xlsx format');
    }
  }

  private parseCSV(buffer: Buffer): UserAdminCsvRow[] {
    const rawText = buffer.toString('utf-8');

    // Saltar filas iniciales vacías (ej: fila en blanco antes de los headers reales)
    const lines = rawText.split(/\r?\n/);
    const firstContentIdx = lines.findIndex(
      (line) => line.replace(/,/g, '').trim() !== ''
    );
    const csvText = firstContentIdx > 0 ? lines.slice(firstContentIdx).join('\n') : rawText;

    const records: any[] = parse(csvText, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
    });

    if (!records || records.length === 0) {
      throw new Error('CSV file is empty');
    }

    // Mapeo case-insensitive de columnas
    const firstRecord = records[0];
    const keys = Object.keys(firstRecord);
    const findKey = (target: string) =>
      keys.find((k) => k.toLowerCase().trim() === target.toLowerCase()) || '';

    const results: UserAdminCsvRow[] = [];

    for (const record of records) {
      const row: UserAdminCsvRow = {
        labora: String(record[findKey('labora')] || '').trim(),
        cedula: String(record[findKey('cedula')] || '').trim(),
        name: String(record[findKey('name')] || '').trim(),
        estado: String(record[findKey('estado')] || '').trim(),
        rol_: String(record[findKey('rol_')] || '').trim(),
        email: String(record[findKey('email')] || '').trim(),
        telefono: String(record[findKey('telefono')] || '').trim(),
        num_cuenta: String(record[findKey('num_cuenta')] || '').trim(),
        banco_id: String(record[findKey('banco_id')] || '').trim(),
        punto: String(record[findKey('punto')] || '').trim(),
        aliado: String(record[findKey('aliado')] || '').trim(),
      };

      // Solo incluir filas que tengan al menos nombre o email
      if (row.name || row.email) {
        results.push(row);
      }
    }

    if (results.length === 0) {
      throw new Error('No valid records found in CSV file');
    }

    return results;
  }

  private async parseExcel(buffer: Buffer): Promise<UserAdminCsvRow[]> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);

    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      throw new Error('No worksheet found in Excel file');
    }

    // Encontrar la primera fila no vacía para usarla como headers
    let headerRowNumber = 1;
    worksheet.eachRow((row, rowNumber) => {
      if (headerRowNumber !== 1) return; // ya encontramos el header
      let hasContent = false;
      row.eachCell((cell) => {
        if (cell.value?.toString().trim()) hasContent = true;
      });
      if (hasContent) headerRowNumber = rowNumber;
    });

    const headers: { [key: string]: number } = {};
    const headerRow = worksheet.getRow(headerRowNumber);

    headerRow.eachCell((cell, colNumber) => {
      const header = cell.value?.toString().toLowerCase().trim();
      if (header) {
        headers[header] = colNumber;
      }
    });

    const getCellValue = (row: any, columnName: string): string => {
      const colNum = headers[columnName.toLowerCase()];
      if (!colNum) return '';
      const cell = row.getCell(colNum);
      return cell.value?.toString().trim() || '';
    };

    const results: UserAdminCsvRow[] = [];

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber <= headerRowNumber) return; // saltar filas vacías y la de headers

      const csvRow: UserAdminCsvRow = {
        labora: getCellValue(row, 'labora'),
        cedula: getCellValue(row, 'cedula'),
        name: getCellValue(row, 'name'),
        estado: getCellValue(row, 'estado'),
        rol_: getCellValue(row, 'rol_'),
        email: getCellValue(row, 'email'),
        telefono: getCellValue(row, 'telefono'),
        num_cuenta: getCellValue(row, 'num_cuenta'),
        banco_id: getCellValue(row, 'banco_id'),
        punto: getCellValue(row, 'punto'),
        aliado: getCellValue(row, 'aliado'),
      };

      if (csvRow.name || csvRow.email) {
        results.push(csvRow);
      }
    });

    if (results.length === 0) {
      throw new Error('No valid records found in Excel file');
    }

    return results;
  }
}

/**
 * DTO con validación para cada fila del CSV
 */
export class UpdateUserAdminCsvDto {
  cedula: string;
  name: string;
  estado: string;
  rol_: string;
  email: string;
  telefono: string;
  punto: string;

  constructor(row: UserAdminCsvRow) {
    this.cedula = row.cedula?.trim() || '';
    this.name = row.name?.trim() || '';
    this.estado = row.estado?.trim() || '';
    this.rol_ = row.rol_?.trim() || '';
    this.email = row.email?.trim() || '';
    this.telefono = row.telefono?.trim() || '';
    this.punto = row.punto?.trim() || '';
  }

  static create(row: UserAdminCsvRow): [string?, UpdateUserAdminCsvDto?] {
    if (!row.name || row.name.trim() === '') {
      return ['name is required', undefined];
    }

    if (!row.telefono || row.telefono.trim() === '') {
      return ['telefono is required for document lookup', undefined];
    }

    return [undefined, new UpdateUserAdminCsvDto(row)];
  }
}
