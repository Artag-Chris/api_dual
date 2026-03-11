/**
 * Calcula la edad actual del cliente en años
 * A partir de su fecha de nacimiento hasta hoy
 * 
 * Maneja: strings ISO (YYYY-MM-DD), Date objects, null, undefined, fechas inválidas
 * Retorna: edad como string (ej: "25", "0" si inválida o no nacido)
 * 
 * Validaciones:
 * - Rechazar null, undefined, strings vacíos
 * - Rechazar fechas anteriores a 1900 (poco probable)
 * - Rechazar fechas futuras (aún no nace)
 * - Rechazar fechas inválidas (formato mal formado)
 */
export function calculateAge(fechaNacimiento: any): string {
  try {
    // 1. Si es null/undefined/empty, retornar "0"
    if (!fechaNacimiento) {
      return '0';
    }

    // 2. Convertir a string y validar
    const stringValue = String(fechaNacimiento).trim();

    // 3. Rechazar valores inválidos comunes
    if (!stringValue ||
        stringValue === '' ||
        stringValue === 'null' ||
        stringValue === 'undefined' ||
        stringValue === '0' ||
        stringValue === 'Invalid Date') {
      return '0';
    }

    // 4. Validación de regex: detectar fechas con zeros (0000-00-00, 2020-00-15, etc)
    if (/^0000-/.test(stringValue) || /-00-/.test(stringValue) || /-00$/.test(stringValue)) {
      return '0';
    }

    // 5. Intentar parsear como Date
    let fechaObj: Date;

    if (typeof fechaNacimiento === 'string') {
      fechaObj = new Date(stringValue);
    } else if (fechaNacimiento instanceof Date) {
      fechaObj = fechaNacimiento;
    } else {
      return '0';
    }

    // 6. Validar que es una fecha válida
    if (isNaN(fechaObj.getTime())) {
      return '0';
    }

    // 7. Extraer componentes
    const year = fechaObj.getFullYear();
    const month = fechaObj.getMonth() + 1;
    const day = fechaObj.getDate();

    // 8. Validar que mes y día no sean zero
    if (year === 0 || month === 0 || day === 0) {
      return '0';
    }

    // 9. Rechazar fechas muy antiguas (antes de 1900) o futuras (después de hoy)
    const hoy = new Date();
    const hoyYear = hoy.getFullYear();

    if (year < 1900 || year > hoyYear) {
      return '0';
    }

    // 10. Rechazar si la fecha es posterior a hoy (aún no nace)
    if (fechaObj > hoy) {
      return '0';
    }

    // 11. Calcular edad en años completos
    // Fórmula: (hoy - nacimiento) / 365.25 en años
    // Pero mejor: restar el año y ajustar si cumpleaños aún no ocurrió este año
    let edad = hoyYear - year;

    // Si aún no ha cumplido años este año, restar 1
    const mesActual = hoy.getMonth() + 1;
    const diaActual = hoy.getDate();

    if (mesActual < month || (mesActual === month && diaActual < day)) {
      edad--;
    }

    // 12. Validar que edad sea positiva y razonable (0-150 años)
    if (edad < 0 || edad > 150) {
      return '0';
    }

    return String(edad);

  } catch (error) {
    // Cualquier error no controlado, retornar "0"
    return '0';
  }
}
