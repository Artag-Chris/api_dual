/**
 * Normaliza valores de fecha para evitar "Invalid time value" en Prisma
 * Maneja: null, undefined, strings inválidos, "0000-00-00", etc.
 * Retorna: ISO date string (YYYY-MM-DD) o null si es inválido
 */
export function normalizeDate(value: any, allowEmpty: boolean = true): string | null {
  // 1. Si es null/undefined/empty
  if (!value) {
    return allowEmpty ? null : '';
  }

  // 2. Convertir a string
  const stringValue = String(value).trim();

  // 3. Rechazar valores inválidos comunes
  if (!stringValue || 
      stringValue === '' || 
      stringValue === '0000-00-00' || 
      stringValue === '1900-01-01' ||
      stringValue === 'null' ||
      stringValue === 'undefined' ||
      stringValue === '0' ||
      stringValue === 'Invalid Date') {
    return null;
  }

  // 4. Intentar parsear como Date
  try {
    const fecha = new Date(stringValue);

    // Validar que es una fecha válida
    if (isNaN(fecha.getTime())) {
      return null;
    }

    // 5. Rechazar fechas muy antiguas (antes de 1900) o futuras (después de 2200)
    const year = fecha.getFullYear();
    if (year < 1900 || year > 2200) {
      return null;
    }

    // 6. Convertir a formato ISO YYYY-MM-DD
    const isoDate = fecha.toISOString().split('T')[0];
    return isoDate;

  } catch (error) {
    return null;
  }
}
