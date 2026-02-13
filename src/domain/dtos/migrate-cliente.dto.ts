/**
 * DTOs para la migración de cliente de Legacy a Main
 * Estos DTOs validan y transforman datos del cliente legacy al esquema main
 */

// ==================== USER CLIENTE DTO ====================
export class UserClienteCreateDto {
  private constructor(
    public readonly documento: string,
    public readonly nombre: string,
    public readonly apellido: string,
    public readonly tipo: string,
    public readonly email: string,
    public readonly telefono: string,
    public readonly nombre_completo: string,
    public readonly password: string = 'changeme',
    public readonly estado_registro: 'completo' | 'incompleto' = 'incompleto'
  ) {}

  static create(props: { [key: string]: any }): [string?, UserClienteCreateDto?] {
    const { documento, nombre, apellido, tipo, email, telefono, nombre_completo, password, estado_registro } = props;

    if (!documento) return ['Documento is required', undefined];
    if (!nombre) return ['Nombre is required', undefined];
    if (!apellido) return ['Apellido is required', undefined];
    if (!tipo) return ['Tipo is required', undefined];
    if (!email) return ['Email is required', undefined];
    if (!telefono) return ['Teléfono is required', undefined];
    if (!nombre_completo) return ['Nombre completo is required', undefined];

    return [
      undefined,
      new UserClienteCreateDto(
        documento,
        nombre,
        apellido,
        tipo,
        email,
        telefono,
        nombre_completo,
        password || 'changeme',
        estado_registro || 'incompleto'
      ),
    ];
  }
}

// ==================== INFO PERSONAL DTO ====================
export class InfoPersonalCreateDto {
  private constructor(
    public readonly documento: string,
    public readonly nombre: string,
    public readonly apellido: string,
    public readonly tipoDocumento: string,
    public readonly conyuge: string = 'NO',
    public readonly fecha_nacimiento?: string,
    public readonly fecha_expedicion?: string,
    public readonly lugar_expedicion?: string,
    public readonly estudios: string = 'N/A',
    public readonly estrato: string = 'N/A'
  ) {}

  static create(props: { [key: string]: any }): [string?, InfoPersonalCreateDto?] {
    const {
      documento,
      nombre,
      apellido,
      tipoDocumento,
      conyuge,
      fecha_nacimiento,
      fecha_expedicion,
      lugar_expedicion,
      estudios,
      estrato,
    } = props;

    if (!documento) return ['Documento is required', undefined];
    if (!nombre) return ['Nombre is required', undefined];
    if (!apellido) return ['Apellido is required', undefined];
    if (!tipoDocumento) return ['TipoDocumento is required', undefined];

    return [
      undefined,
      new InfoPersonalCreateDto(
        documento,
        nombre,
        apellido,
        tipoDocumento,
        conyuge || 'NO',
        fecha_nacimiento,
        fecha_expedicion,
        lugar_expedicion,
        estudios || 'N/A',
        estrato || 'N/A'
      ),
    ];
  }
}

// ==================== INFO CONTACTO DTO ====================
export class InfoContactoCreateDto {
  private constructor(
    public readonly documento: string,
    public readonly celular: string,
    public readonly email: string,
    public readonly direccion: string,
    public readonly ciudad: string,
    public readonly genero?: string,
    public readonly estado_civil?: string,
    public readonly barrio?: string,
    public readonly tipo_vivienda?: string,
    public readonly telefono_residencial?: string,
    public readonly tiempo_vivienda?: string
  ) {}

  static create(props: { [key: string]: any }): [string?, InfoContactoCreateDto?] {
    const {
      documento,
      celular,
      email,
      direccion,
      ciudad,
      genero,
      estado_civil,
      barrio,
      tipo_vivienda,
      telefono_residencial,
      tiempo_vivienda,
    } = props;

    if (!documento) return ['Documento is required', undefined];
    if (!celular) return ['Celular is required', undefined];
    if (!email) return ['Email is required', undefined];
    if (!direccion) return ['Dirección is required', undefined];
    if (!ciudad) return ['Ciudad is required', undefined];

    return [
      undefined,
      new InfoContactoCreateDto(
        documento,
        celular,
        email,
        direccion,
        ciudad,
        genero,
        estado_civil,
        barrio,
        tipo_vivienda,
        telefono_residencial,
        tiempo_vivienda
      ),
    ];
  }
}

// ==================== INFO LABORAL DTO ====================
export class InfoLaboralCreateDto {
  private constructor(
    public readonly documento: string,
    public readonly ocupacion_oficio: string,
    public readonly empresa: string,
    public readonly direccion_empresa: string,
    public readonly nit: string,
    public readonly tipo_contrato: string,
    public readonly cargo: string,
    public readonly actividadEconomica: string,
    public readonly id_rango: number,
    public readonly fecha_vinculacion?: string | Date,
    public readonly telefono?: string,
    public readonly descripcion?: string
  ) {}

  static create(props: { [key: string]: any }): [string?, InfoLaboralCreateDto?] {
    const {
      documento,
      ocupacion_oficio,
      empresa,
      direccion_empresa,
      nit,
      tipo_contrato,
      cargo,
      actividadEconomica,
      id_rango,
      fecha_vinculacion,
      telefono,
      descripcion,
    } = props;

    if (!documento) return ['Documento is required', undefined];
    if (!ocupacion_oficio) return ['Ocupación/Oficio is required', undefined];
    if (!empresa) return ['Empresa is required', undefined];
    if (!tipo_contrato) return ['Tipo Contrato is required', undefined];
    if (!cargo) return ['Cargo is required', undefined];
    if (!actividadEconomica) return ['Actividad Económica is required', undefined];
    if (!id_rango) return ['ID Rango Salarial is required', undefined];

    return [
      undefined,
      new InfoLaboralCreateDto(
        documento,
        ocupacion_oficio,
        empresa,
        direccion_empresa || 'N/A',
        nit || 'N/A',
        tipo_contrato,
        cargo,
        actividadEconomica,
        id_rango,
        fecha_vinculacion,
        telefono,
        descripcion
      ),
    ];
  }
}

// ==================== INFO REFERENCIAS DTO ====================
export class InfoReferenciasCreateDto {
  private constructor(
    public readonly documento: string,
    public readonly nombreFamiliar?: string,
    public readonly parentescoFamiliar?: string,
    public readonly telefonoFamiliar?: string,
    public readonly direccion_familiar?: string,
    public readonly nombreFamiliar2?: string,
    public readonly parentescoFamiliar2?: string,
    public readonly celularFamiliar2?: string,
    public readonly direccion_familiar_2?: string,
    public readonly nombrePersonal?: string,
    public readonly parentescoPersonal?: string,
    public readonly telefonoPersonal?: string,
    public readonly direcion_personal?: string,
    public readonly nombrePersonal2?: string,
    public readonly parentescoPersonal2?: string,
    public readonly celularPersonal2?: string,
    public readonly direccion_personal_2?: string
  ) {}

  static create(props: { [key: string]: any }): [string?, InfoReferenciasCreateDto?] {
    const { documento } = props;

    if (!documento) return ['Documento is required', undefined];

    return [
      undefined,
      new InfoReferenciasCreateDto(
        documento,
        props.nombreFamiliar || '',
        props.parentescoFamiliar || '',
        props.telefonoFamiliar || '',
        props.direccion_familiar || '',
        props.nombreFamiliar2 || '',
        props.parentescoFamiliar2 || '',
        props.celularFamiliar2 || '',
        props.direccion_familiar_2 || '',
        props.nombrePersonal || '',
        props.parentescoPersonal || '',
        props.telefonoPersonal || '',
        props.direcion_personal || '',
        props.nombrePersonal2 || '',
        props.parentescoPersonal2 || '',
        props.celularPersonal2 || '',
        props.direccion_personal_2 || ''
      ),
    ];
  }
}

// ==================== CONYUGE DTO ====================
export class ConyugeCreateDto {
  private constructor(
    public readonly nombres: string,
    public readonly apellidos: string,
    public readonly tipo_documento: string,
    public readonly documento_conyuge: string,
    public readonly documento: string,
    public readonly telefono: string
  ) {}

  static create(props: { [key: string]: any }): [string?, ConyugeCreateDto?] {
    const { nombres, apellidos, tipo_documento, documento_conyuge, documento, telefono } = props;

    if (!nombres) return ['Nombres is required', undefined];
    if (!apellidos) return ['Apellidos is required', undefined];
    if (!tipo_documento) return ['Tipo Documento is required', undefined];
    if (!documento_conyuge) return ['Documento Cónyuge is required', undefined];
    if (!documento) return ['Documento (Cliente) is required', undefined];
    if (!telefono) return ['Teléfono is required', undefined];

    return [
      undefined,
      new ConyugeCreateDto(nombres, apellidos, tipo_documento, documento_conyuge, documento, telefono),
    ];
  }
}
