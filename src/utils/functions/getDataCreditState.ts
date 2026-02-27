import { prismaMainService } from "../../database/main/prisma-main.service";

let estadosValidosCache: Map<string, string> | null = null;

export async function getEstadoValidoFromList(estadoLegacy: string): Promise<string> {
  try {
    const estadoNormalizado = String(estadoLegacy || '').trim().toUpperCase();

    // 1. MAPEO EXACTO: Estados con conversión conocida
    const mapaEstadosExactos: { [key: string]: string } = {
      'CANCELADO': 'FINALIZADO',
      'CANCELADO POR REFINANCIACION': 'REFINANCIADO',
      'AL DIA': 'ACTIVO',
      'MORA': 'ACTIVO',
      'PREJURIDICO': 'PREJURIDICO',
      'JURIDICO': 'JURIDICO'
    };

    // Intentar match exacto primero (sin query a BD)
    if (mapaEstadosExactos[estadoNormalizado]) {
     
      return mapaEstadosExactos[estadoNormalizado];
    }

    // 2. CACHE: Reutilizar estados válidos de la BD si ya los consultamos
    let estadosValidos: { tipo: string }[];
    if (estadosValidosCache && estadosValidosCache.has(estadoNormalizado)) {
      return estadosValidosCache.get(estadoNormalizado)!;
    }

    // 3. QUERY BD: Obtener estados válidos (primera vez o no en cache)
    estadosValidos = await prismaMainService.lista_estado_credito.findMany({
      select: { tipo: true }
    });

    if (!estadosValidos || estadosValidos.length === 0) {

      return 'EN ESTUDIO';
    }

    // Inicializar cache si es primera vez
    if (!estadosValidosCache) {
      estadosValidosCache = new Map();
    }

    // 4. FUZZY MATCH: Buscar similar en BD
    let mejorMatch = estadosValidos[0].tipo;
    let mejorSimilitud = 0;

    for (const estado of estadosValidos) {
      const similitud = calcularSimilitud(estadoNormalizado, estado.tipo.toUpperCase());
      if (similitud > mejorSimilitud) {
        mejorSimilitud = similitud;
        mejorMatch = estado.tipo;
      }
    }

    // 5. RETORNAR: Si similitud >= 70%, usar fuzzy match; sino fallback
    if (mejorSimilitud >= 0.7) {
     
      // Cachear resultado
      estadosValidosCache.set(estadoNormalizado, mejorMatch);
      return mejorMatch;
    }

   
    estadosValidosCache.set(estadoNormalizado, 'EN ESTUDIO');
    return 'EN ESTUDIO';

  } catch (error) {
   
    return 'EN ESTUDIO';
  }
}

const calcularSimilitud = (a: string, b: string): number => {
    const max = Math.max(a.length, b.length);
    if (max === 0) return 1;
    let diferencias = 0;
    for (let i = 0; i < max; i++) {
      if (a[i] !== b[i]) diferencias++;
    }
    return 1 - (diferencias / max);
  };