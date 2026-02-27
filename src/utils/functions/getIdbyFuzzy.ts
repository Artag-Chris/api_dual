interface CarteraResult {
  carteraId: number;
  estrategiaId: number;
}

export function getIdbyFuzzy(cartera: string): CarteraResult {
  // Mapeo de carteras con sus IDs y patrones de búsqueda
  const carterasMap = [
    { id: 1, nombre: "AL DIA", patrones: [/al dia/i, /al\s*dia/i] },
    { id: 2, nombre: "IDEAL", patrones: [/ideal/i] },
    { id: 3, nombre: "ALERTA", patrones: [/alerta/i] },
    { id: 4, nombre: "CRITICO", patrones: [/critico/i, /cr[ií]tico/i] },
    { id: 5, nombre: "PREJURIDICO", patrones: [/prejuridico/i, /pre\s*juridico/i, /pre\s*jurídico/i] },
    { id: 6, nombre: "IRRECUPERABLE", patrones: [/irrecuperable/i, /irrecuperables/i] },
    { id: 7, nombre: "FALLECIDO", patrones: [/fallecido/i, /fallecidos/i] },
    { id: 8, nombre: "FONDO GARANTIAS", patrones: [/fondo\s*garantias/i, /fondo\s*garant[ií]as/i] },
    { id: 9, nombre: "ABOGADO DRA. MIRIAM YORLADIS (JURIDICO)", patrones: [/miriam\s*yorladis/i, /dra\.?\s*miriam/i, /miriam/i] }
  ];

  // Mapeo de estrategias con sus IDs y patrones de búsqueda
  const estrategiasMap = [
    { id: 1, nombre: "ESTRATEGIA REPORT", patrones: [/estrategia\s*report/i, /report/i] },
    { id: 2, nombre: "LIBRANZA INFORMAL", patrones: [/libranza\s*informal/i, /libranza/i] },
    { id: 3, nombre: "EMPLEADOS", patrones: [/empleados/i, /empleado/i] },
    { id: 4, nombre: "TRADICIONAL", patrones: [/tradicional/i] },
    { id: 5, nombre: "PADLOK", patrones: [/padlock/i, /padlok/i, /padlok/i] }
  ];

  // Valores por defecto (los más comunes)
  let carteraId = 6; // Por defecto IRRECUPERABLE
  let estrategiaId = 4; // Por defecto TRADICIONAL

  // Primero verificamos si es PADLOK (tiene prioridad)
  const esPadlok = estrategiasMap[4].patrones.some(pattern => pattern.test(cartera));
  if (esPadlok) {
    estrategiaId = 5; // PADLOK
  }

  // Buscar coincidencias para cartera
  let mejorMatchCartera = {
    id: 6,
    score: 0
  };

  carterasMap.forEach(carteraItem => {
    carteraItem.patrones.forEach(pattern => {
      if (pattern.test(cartera)) {
        // Si hay match directo con patrón, darle prioridad máxima
        mejorMatchCartera = {
          id: carteraItem.id,
          score: 100
        };
      }
    });
  });

  // Si no encontramos match con patrones, usar fuzzy matching básico
  if (mejorMatchCartera.score === 0) {
    const palabras = cartera.toLowerCase().split(/[\s-]+/);
    
    carterasMap.forEach(carteraItem => {
      const palabrasCartera = carteraItem.nombre.toLowerCase().split(/[\s-]+/);
      
      palabrasCartera.forEach(palabraCartera => {
        palabras.forEach(palabra => {
          // Calcular similitud básica (contiene o es muy similar)
          if (palabra.includes(palabraCartera) || palabraCartera.includes(palabra)) {
            const score = Math.min(palabra.length, palabraCartera.length) / Math.max(palabra.length, palabraCartera.length);
            if (score > mejorMatchCartera.score) {
              mejorMatchCartera = {
                id: carteraItem.id,
                score: score
              };
            }
          }
        });
      });
    });
  }

  // Si encontramos un match decente, actualizar carteraId
  if (mejorMatchCartera.score > 0.3) {
    carteraId = mejorMatchCartera.id;
  }

  // Buscar coincidencias para estrategia (solo si no es PADLOK ya que eso tiene prioridad)
  if (!esPadlok) {
    let mejorMatchEstrategia = {
      id: 4,
      score: 0
    };

    estrategiasMap.forEach((estrategiaItem, index) => {
      // Saltamos PADLOK porque ya lo verificamos
      if (index === 4) return;
      
      estrategiaItem.patrones.forEach(pattern => {
        if (pattern.test(cartera)) {
          mejorMatchEstrategia = {
            id: estrategiaItem.id,
            score: 100
          };
        }
      });
    });

    // Si no encontramos match con patrones, usar fuzzy matching
    if (mejorMatchEstrategia.score === 0) {
      const palabras = cartera.toLowerCase().split(/[\s-]+/);
      
      estrategiasMap.forEach((estrategiaItem, index) => {
        if (index === 4) return; // Saltamos PADLOK
        
        const palabrasEstrategia = estrategiaItem.nombre.toLowerCase().split(/[\s-]+/);
        
        palabrasEstrategia.forEach(palabraEstrategia => {
          palabras.forEach(palabra => {
            if (palabra.includes(palabraEstrategia) || palabraEstrategia.includes(palabra)) {
              const score = Math.min(palabra.length, palabraEstrategia.length) / Math.max(palabra.length, palabraEstrategia.length);
              if (score > mejorMatchEstrategia.score) {
                mejorMatchEstrategia = {
                  id: estrategiaItem.id,
                  score: score
                };
              }
            }
          });
        });
      });
    }

    if (mejorMatchEstrategia.score > 0.3) {
      estrategiaId = mejorMatchEstrategia.id;
    }
  }

  return {
    carteraId,
    estrategiaId
  };
}