 export function parseFecha(fecha: any, fallbackDate: Date = new Date()): string {
    try {
      if (fecha === null || fecha === undefined || fecha === '') {
        return fallbackDate.toISOString().split('T')[0];
      }

      // Si es Date object
      if (fecha instanceof Date) {
        if (!isNaN(fecha.getTime())) {
          return fecha.toISOString().split('T')[0];
        }
      }

      // Si es string, intenta parsear
      if (typeof fecha === 'string') {
        // Si es string vacío
        if (fecha.trim() === '') {
          return fallbackDate.toISOString().split('T')[0];
        }

        const parsed = new Date(fecha);
        if (!isNaN(parsed.getTime())) {
          return parsed.toISOString().split('T')[0];
        }
      }

      // Si es número, interpretarlo como día del mes
      if (typeof fecha === 'number') {
        const dia = Math.floor(fecha);
        // Validar que sea un día válido (1-31)
        if (dia >= 1 && dia <= 31) {
          const hoy = new Date(fallbackDate);
          hoy.setDate(dia);
          if (!isNaN(hoy.getTime())) {
            return hoy.toISOString().split('T')[0];
          }
        }
      }

      // Fallback final
      return fallbackDate.toISOString().split('T')[0];
    } catch (error) {

      return fallbackDate.toISOString().split('T')[0];
    }
  }
