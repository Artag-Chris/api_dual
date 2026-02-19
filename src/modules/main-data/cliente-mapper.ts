/**
 * Mapper para transformación de Cliente Legacy → Main
 * Transforma datos de la base de datos legacy al esquema main
 */

import {
  UserClienteCreateDto,
  InfoPersonalCreateDto,
  InfoContactoCreateDto,
  InfoLaboralCreateDto,
  InfoReferenciasCreateDto,
  ConyugeCreateDto,
} from '../../domain/dtos/migrate-cliente.dto';
import { ReferenceParser, ReferenceValidated } from './reference-parser';

class ClienteMapperService {
  private static instance: ClienteMapperService;

  constructor() {}

  public static getInstance(): ClienteMapperService {
    if (!ClienteMapperService.instance) {
      ClienteMapperService.instance = new ClienteMapperService();
    }
    return ClienteMapperService.instance;
  }

  /**
   * Mapea un cliente legacy a UserClienteCreateDto
   * Determina el estado (completo/incompleto) basado en datos disponibles
   */
  mapToUserCliente(clienteLegacy: any): [string?, UserClienteCreateDto?] {
    const nombres = this.buildNombres(clienteLegacy);
    const apellidos = this.buildApellidos(clienteLegacy);

    const props = {
      documento: clienteLegacy.num_doc || '',
      nombre: clienteLegacy.primer_nombre || nombres.split(' ')[0] || '',
      apellido: clienteLegacy.primer_apellido || apellidos.split(' ')[0] || '',
      tipo: clienteLegacy.tipo_doc ? this.mapTipoDoc(clienteLegacy.tipo_doc) : 'CC',
      email: clienteLegacy.email || '',
      telefono: clienteLegacy.movil || '',
      nombre_completo: nombres + ' ' + apellidos,
      estado_registro: this.determineEstadoRegistro(clienteLegacy) as 'completo' | 'incompleto',
    };

    return UserClienteCreateDto.create(props);
  }

  /**
   * Mapea un cliente legacy a InfoPersonalCreateDto
   * Incluye información sobre si el cliente tiene cónyuge (SI/NO)
   * Usa valores por defecto válidos para campos de lookup
   */
  mapToInfoPersonal(clienteLegacy: any): [string?, InfoPersonalCreateDto?] {
    const hasConyuge = !!(clienteLegacy.conyuges && Object.keys(clienteLegacy.conyuges).length > 0);
    const conyugeValue = hasConyuge ? 'SI' : 'NO';
    
    const props = {
      documento: clienteLegacy.num_doc || '',
      nombre: clienteLegacy.primer_nombre || '',
      apellido: clienteLegacy.primer_apellido || '',
      tipoDocumento: clienteLegacy.tipo_doc ? this.mapTipoDoc(clienteLegacy.tipo_doc) : 'CC',
      conyuge: conyugeValue,
      fecha_nacimiento: clienteLegacy.fecha_nacimiento || null,
      fecha_expedicion: clienteLegacy.fecha_exp ? this.formatDate(clienteLegacy.fecha_exp) : null,
      lugar_expedicion: clienteLegacy.lugar_exp || null,
      // Usar 'N/A' como valores por defecto si no existen en legacy (evita constraint violations)
      estudios: clienteLegacy.nivel_estudios || 'N/A',
      estrato: clienteLegacy.estrato || 'N/A',
    };

    return InfoPersonalCreateDto.create(props);
  }

  /**
   * Mapea un cliente legacy a InfoContactoCreateDto
   * Incluye mapeos mejorados para fuzzy matching en SQL
   * Ahora recibe municipio_nombre y municipio_departamento del servicio
   */
  mapToInfoContacto(clienteLegacy: any, municipio?: { nombre?: string; departamento?: string }): [string?, InfoContactoCreateDto?] {
    // Mapear ciudad usando geo_city fuzzy match
    const ciudad = this.mapCiudadDesdeNombre(municipio?.nombre || '', municipio?.departamento || '');
    
    const props = {
      documento: clienteLegacy.num_doc || '',
      celular: clienteLegacy.movil || '',
      email: clienteLegacy.email || '',
      direccion: clienteLegacy.direccion || '',
      ciudad: ciudad,
      genero: clienteLegacy.genero ? this.mapGenero(clienteLegacy.genero) : null,
      // Mapear estado_civil para fuzzy matching - pasar el valor original también
      estado_civil: clienteLegacy.estado_civil ? this.mapEstadoCivil(clienteLegacy.estado_civil) : null,
      barrio: clienteLegacy.barrio || null,
      // Mapear tipo_vivienda con valores que faciliten fuzzy matching
      tipo_vivienda: clienteLegacy.tipo_vivienda ? this.mapTipoViviendaDirecto(clienteLegacy.tipo_vivienda) : null,
      telefono_residencial: clienteLegacy.fijo || '0',
      // Convertir años+meses a rango para fuzzy matching
      tiempo_vivienda: this.inferTimeViviendaDirecto(clienteLegacy.anos_residencia, clienteLegacy.meses_residencia) || null,
    };

    return InfoContactoCreateDto.create(props);
  }

  /**
   * Mapea ciudad desde municipio nombre y departamento
   * Usa fuzzy matching (80%) en geo_city de main database
   * Retorna: geo_city.id si encuentra match, sino el nombre simple como fallback
   */
  mapCiudadDesdeNombre(municipioNombre: string, municipioDepartamento: string): string {
    if (!municipioNombre) return 'N/A';
    
    // Retornar un string que será usado en SQL para fuzzy matching
    // El servicio hará la búsqueda en geo_city + geo_department con este valor
    // Formato: "CIUDAD|DEPARTAMENTO" para que SQL lo procese
    return `${(municipioNombre || '').toUpperCase()}|${(municipioDepartamento || '').toUpperCase()}`;
  }

  /**
   * Mapea tipo_vivienda legacy directamente sin traducción (para fuzzy matching)
   */
  private mapTipoViviendaDirecto(tipoLegacy: string): string {
    const mapping: { [key: string]: string } = {
      Propia: 'Propia',
      PROPIA: 'Propia',
      Familiar: 'Familiar',
      FAMILIAR: 'Familiar',
      Alquilada: 'Alquilada',
      ALQUILADA: 'Alquilada',
      Arrendada: 'Alquilada',
      ARRENDADA: 'Alquilada',
    };

    return mapping[tipoLegacy] || tipoLegacy;
  }

  /**
   * Infiere tiempo de vivienda sin fuzzy matching
   * Retorna un string descriptivo que será usado para fuzzy matching en SQL
   */
  private inferTimeViviendaDirecto(anos?: number, meses?: number): string | null {
    if (!anos && !meses) return null;

    const totalMeses = (anos || 0) * 12 + (meses || 0);

    if (totalMeses < 12) return '0-1 años';
    if (totalMeses < 24) return '1-2 años';
    if (totalMeses < 36) return '2-3 años';
    if (totalMeses < 60) return '3-5 años';
    if (totalMeses < 120) return '5-10 años';
    return 'Más de 10 años';
  }

  /**
   * Mapea un cliente legacy a InfoLaboralCreateDto
   */
  mapToInfoLaboral(clienteLegacy: any): [string?, InfoLaboralCreateDto?] {
    // Mapear tipo_actividad: usar DEPENDIENTE o INDEPENDIENTE, default INDEPENDIENTE
    const tipoActividadMap: { [key: string]: string } = {
      'Dependiente': 'DEPENDIENTE',
      'Independiente': 'INDEPENDIENTE',
    };
    
    // Usar tipo_actividad como actividadEconomica (DEPENDIENTE/INDEPENDIENTE)
    // Si no existe o es null, usar INDEPENDIENTE como default
    let actividadEconomica = 'INDEPENDIENTE';
    if (clienteLegacy.tipo_actividad) {
      actividadEconomica = tipoActividadMap[clienteLegacy.tipo_actividad] || 'INDEPENDIENTE';
    }

    const props = {
      documento: clienteLegacy.num_doc || '',
      ocupacion_oficio: (clienteLegacy.ocupacion || '').substring(0, 50),
      empresa: (clienteLegacy.empresa || 'N/A').substring(0, 100),
      direccion_empresa: (clienteLegacy.dir_empresa || '').substring(0, 100),
      nit: (clienteLegacy.doc_empresa || '').substring(0, 50),
      tipo_contrato: (clienteLegacy.tipo_contrato || 'N/A').substring(0, 50),
      cargo: (clienteLegacy.cargo || 'N/A').substring(0, 50),
      actividadEconomica: actividadEconomica.substring(0, 50),
      id_rango: 1, // Default rango, puede variar según lógica de negocio
      fecha_vinculacion: clienteLegacy.fecha_vinculacion ? this.formatDate(clienteLegacy.fecha_vinculacion) : null,
      telefono: (clienteLegacy.tel_empresa || '0').substring(0, 30),
      descripcion: (clienteLegacy.descripcion_actividad || '').substring(0, 65535), // Text field, permite más caracteres
    };

    return InfoLaboralCreateDto.create(props);
  }

  /**
   * Mapea referencias desde comentarios en estudios legacy a InfoReferenciasCreateDto
   * Procesa ref_1 a ref_4 usando ReferenceParser con fuzzy matching
   * - ref_1, ref_2 → campos Familiar
   * - ref_3, ref_4 → campos Personal
   */
  mapToInfoReferencias(
    clienteLegacy: any,
    estudios: any[],
    parser: ReferenceParser
  ): [string?, InfoReferenciasCreateDto?] {
    const props: any = {
      documento: clienteLegacy.num_doc || '',
      nombreFamiliar: '',
      parentescoFamiliar: '',
      telefonoFamiliar: '',
      direccion_familiar: '',
      nombreFamiliar2: '',
      parentescoFamiliar2: '',
      celularFamiliar2: '',
      direccion_familiar_2: '',
      nombrePersonal: '',
      parentescoPersonal: '',
      telefonoPersonal: '',
      direcion_personal: '',
      nombrePersonal2: '',
      parentescoPersonal2: '',
      celularPersonal2: '',
      direccion_personal_2: '',
    };

    // Si no hay estudios, retornar con valores vacíos
    if (!estudios || estudios.length === 0) {
      return InfoReferenciasCreateDto.create(props);
    }

    const referencias: ReferenceValidated[] = [];

    // Procesar ref_1 a ref_4 desde todos los estudios
    for (const estudio of estudios) {
      for (let i = 1; i <= 4; i++) {
        const refField = `ref_${i}`;
        const comentario = estudio[refField];

        if (comentario && comentario.trim()) {
          const parsed = parser.parseComentario(comentario, clienteLegacy.id);
          if (parsed) {
            referencias.push(parsed);
          }
        }
      }
    }

    // Mapear referencias parseadas a campos del DTO
    // ref_1 y ref_2 → Familiar
    // ref_3 y ref_4 → Personal
    if (referencias.length > 0 && referencias[0]) {
      props.nombreFamiliar = referencias[0].nombre || '';
      props.parentescoFamiliar = referencias[0].parentesco || null;
      props.telefonoFamiliar = (referencias[0].celular && referencias[0].celular !== '0' && referencias[0].celular.length === 10) 
        ? referencias[0].celular 
        : '';
      props.direccion_familiar = (referencias[0].direccion && referencias[0].direccion !== 'N/A' && referencias[0].direccion.length > 2)
        ? referencias[0].direccion.substring(0, 150)
        : '';
    }

    if (referencias.length > 1 && referencias[1]) {
      props.nombreFamiliar2 = referencias[1].nombre || '';
      props.parentescoFamiliar2 = referencias[1].parentesco || null;
      props.celularFamiliar2 = (referencias[1].celular && referencias[1].celular !== '0' && referencias[1].celular.length === 10) 
        ? referencias[1].celular 
        : '';
      props.direccion_familiar_2 = (referencias[1].direccion && referencias[1].direccion !== 'N/A' && referencias[1].direccion.length > 2)
        ? referencias[1].direccion.substring(0, 150)
        : '';
    }

    if (referencias.length > 2 && referencias[2]) {
      props.nombrePersonal = referencias[2].nombre || '';
      props.parentescoPersonal = referencias[2].parentesco || null;
      props.telefonoPersonal = (referencias[2].celular && referencias[2].celular !== '0' && referencias[2].celular.length === 10) 
        ? referencias[2].celular 
        : '';
      props.direcion_personal = (referencias[2].direccion && referencias[2].direccion !== 'N/A' && referencias[2].direccion.length > 2)
        ? referencias[2].direccion.substring(0, 150)
        : '';
    }

    if (referencias.length > 3 && referencias[3]) {
      props.nombrePersonal2 = referencias[3].nombre || '';
      props.parentescoPersonal2 = referencias[3].parentesco || null;
      props.celularPersonal2 = (referencias[3].celular && referencias[3].celular !== '0' && referencias[3].celular.length === 10) 
        ? referencias[3].celular 
        : '';
      props.direccion_personal_2 = (referencias[3].direccion && referencias[3].direccion !== 'N/A' && referencias[3].direccion.length > 2)
        ? referencias[3].direccion.substring(0, 150)
        : '';
    }

    return InfoReferenciasCreateDto.create(props);
  }

  /**
   * Mapea un cónyuge legacy a ConyugeCreateDto
   */
  mapToConyuge(conyugeLegacy: any, documentoCliente: string): [string?, ConyugeCreateDto?] {
    const props = {
      nombres: conyugeLegacy.p_nombrey || '',
      apellidos: (conyugeLegacy.p_apellidoy || '') + ' ' + (conyugeLegacy.s_apellidoy || ''),
      tipo_documento: conyugeLegacy.tipo_docy ? this.mapTipoDoc(conyugeLegacy.tipo_docy) : 'CC',
      documento_conyuge: conyugeLegacy.num_docy || '',
      documento: documentoCliente,
      telefono: conyugeLegacy.movily || '',
    };

    return ConyugeCreateDto.create(props);
  }

  // ==================== UTILITY METHODS ====================

  /**
   * Construye el nombre completo desde primer y segundo nombre
   */
  /**
   * Construye nombres completo: primer_nombre + segundo_nombre
   * Normalizado a MAYÚSCULAS
   */
  private buildNombres(cliente: any): string {
    const primer = (cliente.primer_nombre || '').trim().toUpperCase();
    const segundo = (cliente.segundo_nombre || '').trim().toUpperCase();
    const combined = (primer + ' ' + segundo).trim();
    // Normalizar espacios múltiples
    return combined.replace(/\s+/g, ' ');
  }

  /**
   * Construye apellido completo: primer_apellido + segundo_apellido
   * Normalizado a MAYÚSCULAS
   */
  private buildApellidos(cliente: any): string {
    const primer = (cliente.primer_apellido || '').trim().toUpperCase();
    const segundo = (cliente.segundo_apellido || '').trim().toUpperCase();
    const combined = (primer + ' ' + segundo).trim();
    // Normalizar espacios múltiples
    return combined.replace(/\s+/g, ' ');
  }

  /**
   * Mapea tipo de documento legacy al main
   * Retorna 'CC' como defecto si el tipo no es reconocido (evita constraint violations)
   */
  private mapTipoDoc(tipoLegacy: string): string {
    const mapping: { [key: string]: string } = {
      Cedula_Ciudadan_a: 'CC',
      Cedula_Ciudadana: 'CC',
      Cedula_de_Extranjer_a: 'CE',
      Nit: 'NIT',
      Pasaporte: 'PP',
      Pase_Diplom_tico: 'PD',
    };

    // Siempre retorna 'CC' por defecto si no existe el mapping
    return mapping[tipoLegacy] || 'CC';
  }

  /**
   * Mapea género legacy al main
   * Retorna valores que existen en lista_genero de MAIN: MASCULINO, FEMENINO, NO DESEA DECIR
   */
  private mapGenero(generoLegacy: string): string {
    const mapping: { [key: string]: string } = {
      Masculino: 'MASCULINO',
      MASCULINO: 'MASCULINO',
      M: 'MASCULINO',
      Femenino: 'FEMENINO',
      FEMENINO: 'FEMENINO',
      F: 'FEMENINO',
      'No desea decir': 'NO DESEA DECIR',
      'NO DESEA DECIR': 'NO DESEA DECIR',
    };

    // Retorna 'NO DESEA DECIR' como fallback si no existe el mapping
    return mapping[generoLegacy] || 'NO DESEA DECIR';
  }

  /**
   * Mapea estado civil legacy al main con valores mejorados para fuzzy matching
   */
  private mapEstadoCivil(estadoLegacy: string): string {
    const mapping: { [key: string]: string } = {
      Soltero_a: 'Soltero/a',
      Soltero: 'Soltero/a',
      SOLTERO: 'Soltero/a',
      Casado_a: 'Casado/a',
      Casado: 'Casado/a',
      CASADO: 'Casado/a',
      Separado_a: 'Separado/a',
      Separado: 'Separado/a',
      SEPARADO: 'Separado/a',
      Viudo_a: 'Viudo/a',
      Viudo: 'Viudo/a',
      VIUDO: 'Viudo/a',
      Union_libre: 'Union libre',
      'Unión Libre': 'Union libre',
      'UNION LIBRE': 'Union libre',
      Otro: 'Otro',
      OTRO: 'Otro',
    };

    return mapping[estadoLegacy] || estadoLegacy;
  }

  /**
   * Infiere el tiempo de vivienda desde años y meses
   */
  private inferTimeVivienda(anos?: number, meses?: number): string | null {
    if (!anos && !meses) return null;

    const totalMeses = (anos || 0) * 12 + (meses || 0);

    if (totalMeses < 12) return '0-1 años';
    if (totalMeses < 24) return '1-2 años';
    if (totalMeses < 36) return '2-3 años';
    if (totalMeses < 60) return '3-5 años';
    if (totalMeses < 120) return '5-10 años';
    return 'Más de 10 años';
  }

  /**
   * Formatea fecha a formato YYYY-MM-DD
   */
  private formatDate(date: any): string | null {
    if (!date) return null;

    if (typeof date === 'string') {
      return date;
    }

    if (date instanceof Date) {
      return date.toISOString().split('T')[0];
    }

    return null;
  }

  /**
   * Determina el estado del registro basado en datos disponibles
   */
  private determineEstadoRegistro(cliente: any): 'completo' | 'incompleto' {
    const requiredFields = [
      cliente.num_doc,
      cliente.primer_nombre,
      cliente.primer_apellido,
      cliente.email,
      cliente.movil,
      cliente.direccion,
      cliente.genero,
    ];

    const allPresent = requiredFields.every(field => field && field !== '');

    return allPresent ? 'completo' : 'incompleto';
  }

  /**
   * Calcula similitud entre dos strings (0-1)
   * Usa algoritmo de Levenshtein normalizado
   */
  private fuzzyMatchString(str1: string, str2: string): number {
    const s1 = (str1 || '').toLowerCase().trim();
    const s2 = (str2 || '').toLowerCase().trim();

    if (s1 === s2) return 1.0;
    if (s1.length === 0 || s2.length === 0) return 0;

    // Levenshtein distance
    const matrix: number[][] = [];
    for (let i = 0; i <= s2.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= s1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= s2.length; i++) {
      for (let j = 1; j <= s1.length; j++) {
        if (s2.charAt(i - 1) === s1.charAt(j - 1)) {
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

    const distance = matrix[s2.length][s1.length];
    const maxLength = Math.max(s1.length, s2.length);
    return 1 - distance / maxLength;
  }

  /**
   * Mapea estado civil legacy al main con fuzzy matching (80%)
   */
  mapEstadoCivilFuzzy(estadoLegacy: string, posiblesCiviles: string[]): string | null {
    if (!estadoLegacy || posiblesCiviles.length === 0) return null;

    const threshold = 0.8;

    // Intento de match exacto primero
    const exactMatch = this.mapEstadoCivil(estadoLegacy);
    if (exactMatch) return exactMatch;

    // Fuzzy match
    let bestMatch = null;
    let bestScore = threshold;

    for (const civil of posiblesCiviles) {
      const score = this.fuzzyMatchString(estadoLegacy, civil);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = civil;
      }
    }

    return bestMatch;
  }

  /**
   * Mapea tipo de vivienda legacy al main con fuzzy matching (80%)
   */
  mapTipoViviendaFuzzy(tipoLegacy: string, posiblesViviendas: string[]): string | null {
    if (!tipoLegacy || posiblesViviendas.length === 0) return null;

    const threshold = 0.8;

    // Intentar valores conocidos primero
    const mapping: { [key: string]: string } = {
      Propia: 'Propia',
      PROPIA: 'Propia',
      Familiar: 'Familiar',
      FAMILIAR: 'Familiar',
      Alquilada: 'Alquilada',
      ALQUILADA: 'Alquilada',
      Arrendada: 'Alquilada',
      ARRENDADA: 'Alquilada',
    };

    if (mapping[tipoLegacy]) return mapping[tipoLegacy];

    // Fuzzy match
    let bestMatch = null;
    let bestScore = threshold;

    for (const vivienda of posiblesViviendas) {
      const score = this.fuzzyMatchString(tipoLegacy, vivienda);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = vivienda;
      }
    }

    return bestMatch;
  }

  /**
   * Infiere tiempo de vivienda desde años y meses con fuzzy matching
   * Retorna el matching value de la lista para luego hacer lookup en DB
   */
  inferTimeViviendaFuzzy(anos?: number, meses?: number, posiblesTiempos?: string[]): string | null {
    if (!anos && !meses) return null;
    if (!posiblesTiempos || posiblesTiempos.length === 0) return null;

    const totalMeses = (anos || 0) * 12 + (meses || 0);
    const threshold = 0.8;

    // Generar descripción del rango
    let rangeDescription = '';
    if (totalMeses < 12) rangeDescription = '0-1 años';
    else if (totalMeses < 24) rangeDescription = '1-2 años';
    else if (totalMeses < 36) rangeDescription = '2-3 años';
    else if (totalMeses < 60) rangeDescription = '3-5 años';
    else if (totalMeses < 120) rangeDescription = '5-10 años';
    else rangeDescription = 'Más de 10 años';

    // Fuzzy match contra los tiempos disponibles
    let bestMatch = posiblesTiempos[0] || null; // Fallback al primero
    let bestScore = 0;

    for (const tiempo of posiblesTiempos) {
      const score = this.fuzzyMatchString(rangeDescription, tiempo);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = tiempo;
      }
    }

    // Si score es muy bajo, usar el primero como fallback
    return bestScore >= threshold ? bestMatch : posiblesTiempos[0];
  }
}

export default ClienteMapperService;
