interface CarteraResult {
  carteraId: number;
  carteraNombre: string;
  franjadias: string;
  estadoNormalizado: string;
  estrategiaId: number;
}

interface CarteraMap {
  id: number;
  nombre: string;
  franjadias: string;
  patrones: RegExp[];
}

interface EstadoMapeo {
  [key: string]: string;
}

export function getCarteraIdbyFuzzy(cartera: string, estadoLegacy?: string): CarteraResult {
  // 1. Normalizar el estado
  const estadoNormalizado = String(estadoLegacy || '').trim().toUpperCase();
  
  // 2. Mapeo directo EXACTO desde enum legacy creditos_estado a estados main
  const mapaExacto: EstadoMapeo = {
    'AL DIA': 'ACTIVO',           // Legacy: "Al dia" → Main: "ACTIVO"
    'MORA': 'ACTIVO',             // Legacy: "Mora" → Main: "ACTIVO" (crédito activo pero en mora)
    'PREJURIDICO': 'PREJURIDICO', // Legacy: "Prejuridico" → Main: "PREJURIDICO"
    'JURIDICO': 'JURIDICO',       // Legacy: "Juridico" → Main: "JURIDICO"
    'CANCELADO': 'FINALIZADO',    // Legacy: "Cancelado" → Main: "FINALIZADO"
    'CANCELADO POR REFINANCIACION': 'REFINANCIADO', // Legacy con espacios
    'ACTIVO': 'ACTIVO',           // Si ya viene normalizado
    'INACTIVO': 'INACTIVO'        // Estados adicionales de carteras
  };
  
  // Obtener el estado mapeado o usar el normalizado como fallback
  let estadoMapeado = mapaExacto[estadoNormalizado] || estadoNormalizado || 'ACTIVO';
  // Mapeo de carteras con sus IDs, rango de días y patrones de búsqueda
  const carterasMap: CarteraMap[] = [
    { id: 1, nombre: "AL DIA", franjadias: "0", patrones: [/al dia/i, /al\s*dia/i] },
    { id: 2, nombre: "IDEAL", franjadias: "1 - 30", patrones: [/ideal/i] },
    { id: 3, nombre: "ALERTA", franjadias: "31 - 74", patrones: [/alerta/i] },
    { id: 4, nombre: "CRITICO", franjadias: "75 - 89", patrones: [/critico/i, /cr[ií]tico/i] },
    { id: 5, nombre: "PREJURIDICO", franjadias: "90 - 149", patrones: [/prejuridico/i, /pre\s*juridico/i, /pre\s*jurídico/i] },
    { id: 6, nombre: "IRRECUPERABLE", franjadias: "150", patrones: [/irrecuperable/i, /irrecuperables/i] },
    { id: 7, nombre: "FALLECIDO", franjadias: "150", patrones: [/fallecido/i, /fallecidos/i] },
    { id: 8, nombre: "FONDO GARANTIAS", franjadias: "150", patrones: [/fondo\s*garantias/i, /fondo\s*garant[ií]as/i] },
    { id: 9, nombre: "ABOGADO DRA. MIRIAM YORLADIS (JURIDICO)", franjadias: "150", patrones: [/miriam\s*yorladis/i, /dra\.?\s*miriam/i, /miriam/i] },
    { id: 10, nombre: "GESTIÓN LEGAL (JURIDICO)", franjadias: "150", patrones: [/gesti[oó]n\s*legal/i, /legal/i] },
    { id: 11, nombre: "ABOGADO DR JUAN DIEGO RESTREPO (JURIDICO)", franjadias: "150", patrones: [/juan\s*diego\s*restrepo/i, /restrepo/i, /dr\s*juan\s*diego/i] },
    { id: 12, nombre: "ABOGADO DR. JUAN MANUEL ARIAS (JURIDICO)", franjadias: "150", patrones: [/juan\s*manuel\s*arias/i, /arias/i, /dr\.\s*juan\s*manuel/i] },
    { id: 13, nombre: "GRUPO ASECOB SAS", franjadias: "150", patrones: [/asecob/i, /grupo\s*asecob/i] },
    { id: 14, nombre: "GRUPO AFIANZAMOS", franjadias: "150", patrones: [/afianzamos/i, /grupo\s*afianzamos/i] },
    { id: 15, nombre: "ABOGADO DRA ANA MILENA (JURIDICO)", franjadias: "150", patrones: [/ana\s*milena/i, /dra\s*ana/i, /milena/i] }
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
  let carteraResult = carterasMap.find(c => c.id === 6); // IRRECUPERABLE
  let estrategiaId = 4; // Por defecto TRADICIONAL

  // Primero verificamos si es PADLOK (tiene prioridad)
  const esPadlok = estrategiasMap[4].patrones.some(pattern => pattern.test(cartera));
  if (esPadlok) {
    estrategiaId = 5; // PADLOK
  }

  // Buscar coincidencias para cartera
  let mejorMatchCartera = carterasMap[5]; // IRRECUPERABLE como default
  let scoreCartera = 0;

  // Si el estado es JURIDICO, dar prioridad a carteras jurídicas
  const esJuridico = estadoMapeado === 'JURIDICO' || /juridico/i.test(cartera);
  const esPrejuridico = estadoMapeado === 'PREJURIDICO' || /prejuridico/i.test(cartera);
  
  carterasMap.forEach(carteraItem => {
    carteraItem.patrones.forEach(pattern => {
      if (pattern.test(cartera)) {
        // Boost score si el estado coincide con el tipo de cartera
        let score = 100;
        if (esJuridico && /juridico|abogado|dr|dra/i.test(carteraItem.nombre)) {
          score = 110; // Boost para carteras jurídicas
        } else if (esPrejuridico && /prejuridico/i.test(carteraItem.nombre)) {
          score = 110; // Boost para prejurídicos
        }
        
        if (score > scoreCartera) {
          mejorMatchCartera = carteraItem;
          scoreCartera = score;
        }
      }
    });
  });

  // Si no encontramos match con patrones, usar fuzzy matching básico
  if (scoreCartera === 0) {
    const palabras = cartera.toLowerCase().split(/[\s-]+/);
    
    carterasMap.forEach(carteraItem => {
      const palabrasCartera = carteraItem.nombre.toLowerCase().split(/[\s-]+/);
      
      palabrasCartera.forEach(palabraCartera => {
        palabras.forEach(palabra => {
          // Calcular similitud básica (contiene o es muy similar)
          if (palabra.includes(palabraCartera) || palabraCartera.includes(palabra)) {
            let score = Math.min(palabra.length, palabraCartera.length) / Math.max(palabra.length, palabraCartera.length);
            
            // Boost score si el estado coincide
            if (esJuridico && /juridico|abogado|dr|dra/i.test(carteraItem.nombre)) {
              score += 0.2;
            } else if (esPrejuridico && /prejuridico/i.test(carteraItem.nombre)) {
              score += 0.2;
            }
            
            if (score > scoreCartera) {
              mejorMatchCartera = carteraItem;
              scoreCartera = score;
            }
          }
        });
      });
    });
  }

  // Si encontramos un match decente, actualizar carteraResult
  if (scoreCartera > 0.3) {
    carteraResult = mejorMatchCartera;
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
    carteraId: carteraResult!.id,
    carteraNombre: carteraResult!.nombre,
    franjadias: carteraResult!.franjadias,
    estadoNormalizado: estadoMapeado,
    estrategiaId
  };
}