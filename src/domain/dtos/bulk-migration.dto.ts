import ExcelJS from 'exceljs';
import { parse } from 'csv-parse/sync';

export interface BulkMigrationRow {
  documento: string;
}

export class BulkMigrationParser {
  async parseFile(buffer: Buffer, filename: string): Promise<BulkMigrationRow[]> {
    if (filename.endsWith('.csv')) {
      return this.parseCSV(buffer);
    } else if (filename.endsWith('.xlsx')) {
      return this.parseExcelFile(buffer);
    } else {
      throw new Error('File must be .xlsx or .csv format');
    }
  }

  private parseCSV(buffer: Buffer): BulkMigrationRow[] {
    const csvText = buffer.toString('utf-8');
    const records: any[] = parse(csvText, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });

    if (!records || records.length === 0) {
      throw new Error('CSV file is empty');
    }

    const firstRecord = records[0];
    const documentoKey = Object.keys(firstRecord).find(
      (key) => key.toLowerCase() === 'documento'
    );

    if (!documentoKey) {
      throw new Error('CSV file must contain a "documento" column');
    }

    const results: BulkMigrationRow[] = [];
    for (const record of records) {
      const documento = String(record[documentoKey]).trim();
      if (documento) {
        results.push({ documento });
      }
    }

    if (results.length === 0) {
      throw new Error('No valid documents found in CSV file');
    }

    return results;
  }

  async parseExcelFile(buffer: Buffer): Promise<BulkMigrationRow[]> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);

    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      throw new Error('No worksheet found in Excel file');
    }

    // Get header row
    const headerRow = worksheet.getRow(1);
    const headers: { [key: string]: number } = {};

    headerRow.eachCell((cell, colNumber) => {
      const header = cell.value?.toString().toLowerCase().trim();
      if (header) {
        headers[header] = colNumber;
      }
    });

    if (!headers['documento']) {
      throw new Error('Excel file must contain a "documento" column');
    }

    const results: BulkMigrationRow[] = [];
    const documentoIndex = headers['documento'];

    // Parse data rows (starting from row 2, skipping header)
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // Skip header

      const documentoCell = row.getCell(documentoIndex);
      const documento = documentoCell.value?.toString().trim();

      if (documento) {
        results.push({ documento });
      }
    });

    if (results.length === 0) {
      throw new Error('No valid documents found in Excel file');
    }

    return results;
  }
}

export interface BulkMigrationResult {
  documento: string;
  prestamo_ID?: number;
  usuario?: string;
  cuotas?: number;
  estado: 'EXITOSO' | 'ERROR';
  error?: string;
}

export interface BulkMigrationResponse {
  exitosos: number;
  errores: number;
  totalProcesados: number;
  detalles: BulkMigrationResult[];
}
