/**
 * Reference Parser - Extrae información de comentarios de referencias
 * 
 * Parsea strings variados para extraer: nombre, celular, parentesco, dirección
 * Soporta múltiples formatos con heurísticos y agrupación por bloques
 */

/**
 * Resultado del parseo de un comentario de referencia
 */
export interface ReferenceParseResult {
  nombre: string;
  celular: string | null;
  parentesco: string | null;
  direccion: string;
  fecha?: string;
  raw: string;
}

/**
 * Referencia validada lista para insertar en BD
 */
export interface ReferenceValidated {
  nombre: string;
  celular: string | null;
  parentesco: string | null;
  direccion: string;
}

/**
 * Parser de referencias desde comentarios
 * Soporta múltiples formatos:
 * - Multi-línea estructurado (NOMBRE\nPARENTESCO\nCELULAR)
 * - Formato compacto (NOMBRE CELULAR PARENTESCO)
 * - Patrones puntuados (NOMBRE.. PARENTESCO.. UBICACION)
 * - Texto libre con notas
 */
export class ReferenceParser {
  private parentescosList: string[];
  private fuzzyThreshold = 0.80; // 80%
  private fuzzyThresholdGeneric = 0.75; // 75% para búsqueda genérica multi-línea

  constructor(parentescos: string[]) {
    this.parentescosList = parentescos
      .map((p) => (typeof p === 'string' ? p.toUpperCase().trim() : ''))
      .filter((p) => p.length > 0);
  }

  /**
   * Parsea un comentario de referencia
   * Intenta patrones en cascada: patron → generico → null
   * @param comentario Texto del comentario (puede ser null/undefined)
   * @param idCliente ID del cliente (para auditoria)
   * @returns ReferenceValidated si es válido, null si no
   */
  parseComentario(comentario: string | null | undefined, idCliente: number): ReferenceValidated | null {
    if (!comentario || typeof comentario !== 'string' || comentario.trim().length === 0) {
      return null;
    }

    try {
      // 1. Dividir en líneas
      const lineas = this.dividirEnLineas(comentario);
      if (lineas.length === 0) return null;

      // 2. Agrupar en bloques (cada bloque ≈ 1 referencia)
      const bloques = this.agruparEnBloques(lineas);
      if (bloques.length === 0) return null;

      // 3. Usar el primer bloque (la primera referencia del comentario)
      const primerBloque = bloques[0];

      // 4. Intentar extractores en cascada
      let resultado = this.extraerPorPatron(primerBloque);
      
      if (!resultado) {
        resultado = this.extraerGenerico(primerBloque);
      }

      // 5. Validar resultado
      if (resultado && resultado.nombre && resultado.nombre.length >= 2) {
        return resultado;
      }

      return null;
    } catch (error) {
      console.error(`Error parseando comentario para cliente ${idCliente}:`, error, comentario);
      return null;
    }
  }

  /**
   * Divide el comentario en líneas, filtrando vacías
   */
  private dividirEnLineas(texto: string): string[] {
    return texto
      .split(/[\n\r]+/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
  }

  /**
   * Agrupa líneas en bloques relacionados
   * Un bloque = grupo de líneas que conforman 1 referencia
   * 
   * Heurísticas:
   * - Línea con NOMBRE + CELULAR = inicia nuevo bloque
   * - Línea solo con CELULAR = agrupa con anterior
   * - Línea solo con PARENTESCO = agrupa con anterior
   */
  private agruparEnBloques(lineas: string[]): string[][] {
    const bloques: string[][] = [];
    let bloqueActual: string[] = [];

    for (const linea of lineas) {
      const tipoLinea = this.clasificarLinea(linea);

      if (tipoLinea === 'vacia') {
        continue;
      } else if (tipoLinea === 'principal') {
        // Iniciar nuevo bloque si hay uno anterior
        if (bloqueActual.length > 0) {
          bloques.push(bloqueActual);
        }
        bloqueActual = [linea];
      } else if (tipoLinea === 'complementaria') {
        // Agregar a bloque actual
        if (bloqueActual.length === 0) {
          bloqueActual = [linea];
        } else {
          bloqueActual.push(linea);
        }
      }
    }

    if (bloqueActual.length > 0) {
      bloques.push(bloqueActual);
    }

    return bloques;
  }

  /**
   * Clasifica una línea: principal (nombre), complementaria (celular/parentesco), o vacía
   */
  private clasificarLinea(linea: string): 'principal' | 'complementaria' | 'vacia' {
    const upper = linea.toUpperCase();

    // Línea vacía
    if (linea.trim().length === 0) {
      return 'vacia';
    }

    // Solo celular (10 dígitos, con o sin espacios/guiones)
    // "3XXXXXXXXX" o "3 XXX XXX XX" o "3-XXX-XXX-XX"
    if (/^(CEL)?\s*(\d{10})(\s|$)/.test(upper) || /^\d{10}(\s|$)/.test(linea)) {
      return 'complementaria';
    }
    
    // Celular con espacios/guiones: "310 247 7979" o "310-247-7979"
    const soloDigitosYSeparadores = linea.replace(/[\s\-]/g, '');
    if (/^3\d{9}$/.test(soloDigitosYSeparadores)) {
      // Si al remover espacios/guiones queda un celular válido, es complementaria
      return 'complementaria';
    }

    // Solo parentesco (palabra clave)
    const soloParentesco = this.parentescosList.some((p) => {
      const similarity = this.levenshteinSimilarity(linea, p);
      return similarity >= this.fuzzyThresholdGeneric;
    });
    if (soloParentesco && linea.split(/\s+/).length <= 2) {
      return 'complementaria';
    }

    // Línea con estructura "TL 3213245678"
    if (/TL\s+\d{10}/.test(upper)) {
      return 'complementaria';
    }

    // Principal: contiene nombre (palabras alphabéticas)
    return 'principal';
  }

  /**
   * Intenta extraer usando múltiples patrones regex
   */
  private extraerPorPatron(bloque: string[]): ReferenceValidated | null {
    const textoCompleto = bloque.join(' | ');
    const upper = textoCompleto.toUpperCase();

    // Patrón 1: "NOMBRE.. PARENTESCO.. UBICACION + CELULAR"
    // Ej: "WILMER LÓPEZ.. HIJO.. BOYACÁ 310 247 7979"
    // También acepta 3+ puntos: "YANCARLO LÓPEZ... HIJO.. BOYACÁ"
    // Captura: nombre, parentesco, y TODO lo demás (ubicación + celular)
    const patron1 = /^([A-ZÁÉÍÓÚÑ\s]+?)\.{2,}(?:\s+)?([A-ZÁÉÍÓÚÑ\s]+?)\.{2,}(?:\s+)?(.+)$/i;
    const match1 = textoCompleto.match(patron1);
    if (match1) {
      const nombre = match1[1]?.trim().toUpperCase();
      const parentesco = match1[2]?.trim().toUpperCase();
      const restoLinea = match1[3]?.trim() || '';

      // Buscar celular PRIMERO en el resto de la línea
      const celular = this.extraerCelularDe(restoLinea);
      
      // Ubicación: todo lo que NO es celular (remover números y caracteres especiales incluyendo |)
      const ubicacion = restoLinea
        .replace(/[\d\s\-().;\\\|/]/g, ' ') // Remover dígitos, caracteres especiales y |
        .replace(/\s+/g, ' ') // Limpiar espacios múltiples
        .trim()
        .toUpperCase();

      const parentescoMatch = this.fuzzyMatchParentesco(parentesco);

      if (nombre && nombre.length >= 2) {
        return {
          nombre,
          celular,
          parentesco: parentescoMatch,
          direccion: ubicacion || 'N/A',
        };
      }
    }

    // Patrón 2: "NOMBRE CELULAR PARENTESCO"
    // Ej: "Oscar fernando Ramirez 3136227430 hermano"
    const patron2 = /^([A-ZÁÉÍÓÚÑ\s]+?)\s+(\d{10})\s+([A-ZÁÉÍÓÚÑ\s(),]+?)(?:\s*$)/i;
    const match2 = textoCompleto.match(patron2);
    if (match2) {
      const nombre = match2[1]?.trim().toUpperCase();
      const celular = match2[2];
      const parentesco = match2[3]?.trim().toUpperCase();

      const parentescoMatch = this.fuzzyMatchParentesco(parentesco);
      if (nombre && nombre.length >= 2) {
        return {
          nombre,
          celular,
          parentesco: parentescoMatch,
          direccion: 'N/A',
        };
      }
    }

    // Patrón 3: "NOMBRE (PARENTESCO) CELULAR"
    // Ej: "patricia Diaz(madre) 3218529454"
    const patron3 = /^([A-ZÁÉÍÓÚÑ\s]+?)\s*\(([^)]+)\)\s+(\d{10})(?:\s*$)?/i;
    const match3 = textoCompleto.match(patron3);
    if (match3) {
      const nombre = match3[1]?.trim().toUpperCase();
      const parentesco = match3[2]?.trim().toUpperCase();
      const celular = match3[3];

      const parentescoMatch = this.fuzzyMatchParentesco(parentesco);
      if (nombre && nombre.length >= 2) {
        return {
          nombre,
          celular,
          parentesco: parentescoMatch,
          direccion: 'N/A',
        };
      }
    }

    // Patrón 4: "NOMBRE, PARENTESCO, CELULAR, UBICACION"
    // Ej: "Yisela marina, amiga, 3229777752, N/A"
    const patron4 = /^([A-ZÁÉÍÓÚÑ\s]+?)\s*,\s*([A-ZÁÉÍÓÚÑ\s]+?)\s*,\s*(\d{10})\s*(?:,\s*(.+))?$/i;
    const match4 = textoCompleto.match(patron4);
    if (match4) {
      const nombre = match4[1]?.trim().toUpperCase();
      const parentesco = match4[2]?.trim().toUpperCase();
      const celular = match4[3];
      const ubicacion = match4[4]?.trim().toUpperCase();

      const parentescoMatch = this.fuzzyMatchParentesco(parentesco);
      if (nombre && nombre.length >= 2) {
        return {
          nombre,
          celular,
          parentesco: parentescoMatch,
          direccion: ubicacion || 'N/A',
        };
      }
    }

    // Patrón 5: Multi-línea estructurado
    // Línea 1: NOMBRE, Línea 2: PARENTESCO, Línea 3: CELULAR
    if (bloque.length >= 2) {
      const nombreLine = bloque[0]?.toUpperCase() || '';
      const secondLine = bloque[1]?.toUpperCase() || '';

      // Verificar si segunda línea es parentesco
      const parentescoMatch = this.fuzzyMatchParentesco(secondLine);
      if (parentescoMatch && /^[A-ZÁÉÍÓÚÑ\s]+$/.test(nombreLine)) {
        const celular = this.extraerCelularDe(bloque.slice(2).join(' '));

        return {
          nombre: nombreLine.trim(),
          celular,
          parentesco: parentescoMatch,
          direccion: 'N/A',
        };
      }
    }

    return null;
  }

  /**
   * Extracción genérica línea por línea
   * Busca componentes (nombre, parentesco, celular) en cada línea
   */
  private extraerGenerico(bloque: string[]): ReferenceValidated | null {
    const componentes = {
      nombre: null as string | null,
      parentesco: null as string | null,
      celular: null as string | null,
      ubicacion: null as string | null,
    };

    // Pasar 1: Buscar componentes obvios
    for (let i = 0; i < bloque.length; i++) {
      const linea = bloque[i];
      const lineaUpper = linea.toUpperCase();

      // Buscar celular
      if (!componentes.celular) {
        const celMatch = linea.match(/\b(3\d{9})\b/);
        if (celMatch) {
          componentes.celular = celMatch[1];
        }
      }

      // Buscar parentesco
      if (!componentes.parentesco) {
        const parentescoMatch = this.fuzzyMatchParentesco(lineaUpper);
        if (parentescoMatch) {
          componentes.parentesco = parentescoMatch;
        }
      }

      // Buscar nombre (primeras palabras alphabéticas)
      if (!componentes.nombre) {
        const palabras = lineaUpper
          .split(/[\s,.()\-]+/)
          .filter((p) => /^[A-ZÁÉÍÓÚÑ]+$/.test(p) && p.length > 1)
          .slice(0, 3); // Max 3 palabras

        if (palabras.length >= 1) {
          componentes.nombre = palabras.join(' ');
        }
      }
    }

    // Pasar 2: Si no encontramos ubicación, usar línea con mayor longitud que no sea celular
    if (!componentes.ubicacion) {
      const lineasLargas = bloque.filter(
        (l) => l.length > 5 && !l.match(/^\d{10}$/) && !this.fuzzyMatchParentesco(l.toUpperCase())
      );

      if (lineasLargas.length > 0) {
        componentes.ubicacion = lineasLargas[0].toUpperCase().substring(0, 100);
      }
    }

    // Validar mínimos
    if (!componentes.nombre || componentes.nombre.trim().length < 2) {
      return null;
    }

    return {
      nombre: componentes.nombre.trim(),
      celular: componentes.celular,
      parentesco: componentes.parentesco,
      direccion: componentes.ubicacion || 'N/A',
    };
  }

  /**
   * Extrae celular de un texto (busca 10 dígitos comenzando con 3)
   * Maneja espacios, guiones, acentos: "310 247 7979" → "3102477979"
   */
  private extraerCelularDe(texto: string): string | null {
    if (!texto || texto.trim().length === 0) return null;

    // Paso 1: Remover TODOS los caracteres excepto dígitos y espacios/guiones
    // "BOYACÁ 310 247 7979" → "  310  247 7979"
    let soloDigitosYSeparadores = texto.replace(/[^0-9\s\-]/g, '');
    
    // Paso 2: Remover espacios y guiones para obtener secuencia limpia
    // "  310  247 7979" → "3102477979"
    const secuenciaLimpia = soloDigitosYSeparadores.replace(/[\s\-]/g, '');
    
    // Paso 3: Buscar cualquier secuencia de "3" seguido de 9 dígitos
    const matches = secuenciaLimpia.match(/3\d{9}/g);
    
    if (matches && matches.length > 0) {
      // Retornar el primer celular encontrado
      return matches[0];
    }

    return null;
  }

  /**
   * Fuzzy match contra lista de parentescos 
   * Intenta:
   * 1. Exacto (case-insensitive)
   * 2. Substring match (la palabra está contenida)
   * 3. Levenshtein similarity
   * Retorna el mejor match encontrado o null
   */
  private fuzzyMatchParentesco(texto: string): string | null {
    if (!texto || texto.trim().length === 0) return null;

    const textoClean = texto.trim().toUpperCase();
    
    // INTENTO 1: Búsqueda exacta (después de limpiar caracteres especiales)
    const textoSinSimbolos = textoClean.replace(/[^A-ZÁÉÍÓÚÑ\s]/g, '').trim();
    for (const parentesco of this.parentescosList) {
      if (parentesco === textoSinSimbolos) {
        return parentesco;
      }
    }

    // INTENTO 2: Substring match (contiene)
    for (const parentesco of this.parentescosList) {
      // Si el parentesco está dentro del texto o viceversa
      if (
        textoSinSimbolos.includes(parentesco) ||
        parentesco.includes(textoSinSimbolos)
      ) {
        return parentesco;
      }
    }

    // INTENTO 3: Matching de palabras individuales
    const palabrasTexto = textoSinSimbolos.split(/\s+/);
    for (const palabra of palabrasTexto) {
      if (palabra.length >= 3) { // mínimo 3 caracteres
        for (const parentesco of this.parentescosList) {
          if (parentesco.includes(palabra) || palabra.includes(parentesco.substring(0, palabra.length))) {
            return parentesco;
          }
        }
      }
    }

    // INTENTO 4: Levenshtein similarity con umbral bajo
    let bestMatch = null;
    let bestScore = 0;

    for (const parentesco of this.parentescosList) {
      const similarity = this.levenshteinSimilarity(textoSinSimbolos, parentesco);
      if (similarity > bestScore) {
        bestScore = similarity;
        bestMatch = parentesco;
      }
    }

    // Retornar si tiene al menos 50% de similitud
    if (bestMatch && bestScore >= 0.50) {
      return bestMatch;
    }

    return null;
  }

  /**
   * Calcula similitud entre dos strings usando Levenshtein distance (0-1)
   * @param s1 Primer string
   * @param s2 Segundo string
   * @returns Similitud entre 0 (completamente diferente) y 1 (idénticos)
   */
  private levenshteinSimilarity(s1: string, s2: string): number {
    const str1 = (s1 || '').toLowerCase().trim();
    const str2 = (s2 || '').toLowerCase().trim();

    if (str1 === str2) return 1.0;
    if (str1.length === 0 || str2.length === 0) return 0;

    // Matriz para calcular distancia de Levenshtein
    const matrix: number[][] = [];
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    const distance = matrix[str2.length][str1.length];
    const maxLength = Math.max(str1.length, str2.length);
    return 1 - distance / maxLength;
  }
}
