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

// ==================== DETALLE CREDITO DTO ====================
export class DetalleCreditoCreateDto {
  private constructor(
    public readonly documento: string,
    public readonly tipoCredito: string,
    public readonly valor_prestamo: string,
    public readonly inicial: number,
    public readonly plazo: string,
    public readonly numero_cuotas: string,
    public readonly valor_cuota: string,
    public readonly periocidad: string,
    public readonly tasa: string,
    public readonly diaPago: string,
    public readonly fechaPago: string,
    public readonly estado: string = 'EN ESTUDIO',
    public readonly origen: string = 'NUEVO',
    public readonly seguro: number = 0,
    public readonly iva_aval: string = '0',
    public readonly pablok: number = 0,
    public readonly seguro_add: string = '0'
  ) {}

  static create(props: { [key: string]: any }): [string?, DetalleCreditoCreateDto?] {
    const {
      documento,
      tipoCredito,
      valor_prestamo,
      inicial,
      plazo,
      numero_cuotas,
      valor_cuota,
      periocidad,
      tasa,
      diaPago,
      fechaPago,
      estado,
      origen,
      seguro,
      iva_aval,
      pablok,
      seguro_add,
    } = props;

    if (!documento) return ['Documento is required', undefined];
    if (valor_prestamo === undefined) return ['Valor prestamo is required', undefined];
    if (numero_cuotas === undefined) return ['Numero cuotas is required', undefined];
    if (!valor_cuota) return ['Valor cuota is required', undefined];
    if (!tasa) return ['Tasa is required', undefined];
    if (!diaPago) return ['Dia pago is required', undefined];
    if (!fechaPago) return ['Fecha pago is required', undefined];

    return [
      undefined,
      new DetalleCreditoCreateDto(
        documento,
        tipoCredito || 'CREDITO EXPRESS',
        String(valor_prestamo),
        inicial || 0,
        plazo || 'N/A',
        String(numero_cuotas),
        String(valor_cuota),
        periocidad || 'MENSUAL',
        String(tasa),
        String(diaPago),
        String(fechaPago),
        estado || 'EN ESTUDIO',
        origen || 'NUEVO',
        seguro || 0,
        String(iva_aval || 0),
        pablok || 0,
        String(seguro_add || 0)
      ),
    ];
  }
}

// ==================== AMORTIZACION DTO ====================
export class AmortizacionCreateDto {
  private constructor(
    public readonly prestamo_ID: number,
    public readonly numero_cuota: number,
    public readonly capital: number,
    public readonly interes: number,
    public readonly aval: number,
    public readonly IVA: number,
    public readonly total_cuota: number,
    public readonly saldo: number,
    public readonly fecha_pago: Date,
    public readonly estado: 'PENDIENTE' | 'PAGADO' | 'VENCIDO' = 'PENDIENTE'
  ) {}

  static create(props: { [key: string]: any }): [string?, AmortizacionCreateDto?] {
    const {
      prestamo_ID,
      numero_cuota,
      capital,
      interes,
      aval,
      IVA,
      total_cuota,
      saldo,
      fecha_pago,
      estado,
    } = props;

    if (!prestamo_ID) return ['Prestamo ID is required', undefined];
    if (numero_cuota === undefined) return ['Numero cuota is required', undefined];
    if (capital === undefined) return ['Capital is required', undefined];
    if (interes === undefined) return ['Interes is required', undefined];
    if (saldo === undefined) return ['Saldo is required', undefined];
    if (!fecha_pago) return ['Fecha pago is required', undefined];

    return [
      undefined,
      new AmortizacionCreateDto(
        prestamo_ID,
        numero_cuota,
        capital || 0,
        interes || 0,
        aval || 0,
        IVA || 0,
        total_cuota || 0,
        saldo,
        new Date(fecha_pago),
        estado || 'PENDIENTE'
      ),
    ];
  }
}

// ==================== ESTUDIOS REALIZADOS DTO ====================
export class EstudiosRealizadosCreateDto {
  private constructor(
    public readonly documento: string,
    public readonly cupo: string,
    public readonly cupoDisponible: string,
    public readonly tasa: number,
    public readonly plazo: number,
    public readonly creditos_activos?: number,
    public readonly creditos_maximos: number = 2,
    public readonly pagare?: string,
    public readonly desembolso?: string,
    public readonly observacion?: string
  ) {}

  static create(props: { [key: string]: any }): [string?, EstudiosRealizadosCreateDto?] {
    const {
      documento,
      cupo,
      cupoDisponible,
      tasa,
      plazo,
      creditos_activos,
      creditos_maximos,
      pagare,
      desembolso,
      observacion,
    } = props;

    if (!documento) return ['Documento is required', undefined];
    if (cupo === undefined) return ['Cupo is required', undefined];
    if (tasa === undefined) return ['Tasa is required', undefined];
    if (plazo === undefined) return ['Plazo is required', undefined];

    return [
      undefined,
      new EstudiosRealizadosCreateDto(
        documento,
        String(cupo),
        String(cupoDisponible || cupo),
        tasa,
        plazo,
        creditos_activos || 0,
        creditos_maximos || 2,
        pagare,
        desembolso,
        observacion
      ),
    ];
  }
}

// ==================== SALDO INICIAL DTO ====================
export class SaldoInicialCreateDto {
  private constructor(
    public readonly prestamoID: number,
    public readonly documento: string,
    public readonly saldo_Inicial: number,
    public readonly saldo_actual: number
  ) {}

  static create(props: { [key: string]: any }): [string?, SaldoInicialCreateDto?] {
    const { prestamoID, documento, saldo_Inicial, saldo_actual } = props;

    if (!prestamoID) return ['PrestamoID is required', undefined];
    if (!documento) return ['Documento is required', undefined];
    if (saldo_Inicial === undefined) return ['Saldo inicial is required', undefined];
    if (saldo_actual === undefined) return ['Saldo actual is required', undefined];

    return [
      undefined,
      new SaldoInicialCreateDto(prestamoID, documento, saldo_Inicial, saldo_actual),
    ];
  }
}

// ==================== PEDIDO DTO ====================
export class PedidoCreateDto {
  private constructor(
    public readonly user_cliente_id: number,
    public readonly prestamo_ID: number,
    public readonly cuota_inicial: number,
    public readonly valor_total: number,
    public readonly estado: string = 'CREADO',
    public readonly id_asesor?: number
  ) {}

  static create(props: { [key: string]: any }): [string?, PedidoCreateDto?] {
    const { user_cliente_id, prestamo_ID, cuota_inicial, valor_total, estado, id_asesor } = props;

    if (!user_cliente_id) return ['User cliente ID is required', undefined];
    if (!prestamo_ID) return ['Prestamo ID is required', undefined];
    if (cuota_inicial === undefined) return ['Cuota inicial is required', undefined];
    if (valor_total === undefined) return ['Valor total is required', undefined];

    return [
      undefined,
      new PedidoCreateDto(
        user_cliente_id,
        prestamo_ID,
        cuota_inicial,
        valor_total,
        estado || 'CREADO',
        id_asesor
      ),
    ];
  }
}

// ==================== PEDIDO PRODUCTO DTO ====================
export class PedidoProductoCreateDto {
  private constructor(
    public readonly pedido_id: number,
    public readonly product_id: number,
    public readonly cantidad_selec: number,
    public readonly costo_final: number,
    public readonly almacen: number
  ) {}

  static create(props: { [key: string]: any }): [string?, PedidoProductoCreateDto?] {
    const { pedido_id, product_id, cantidad_selec, costo_final, almacen } = props;

    if (!pedido_id) return ['Pedido ID is required', undefined];
    if (!product_id) return ['Product ID is required', undefined];
    if (!cantidad_selec) return ['Cantidad is required', undefined];
    if (costo_final === undefined) return ['Costo final is required', undefined];
    if (!almacen) return ['Almacen is required', undefined];

    return [
      undefined,
      new PedidoProductoCreateDto(pedido_id, product_id, cantidad_selec, costo_final, almacen),
    ];
  }
}

// ==================== PAGO HISTORICO DTO ====================
export class PagoHistoricoCreateDto {
  private constructor(
    public readonly prestamo_id: number,
    public readonly valor_pago: number,
    public readonly fecha_pago: Date,
    public readonly hora_pago: string,
    public readonly canal_pago: 'MANUAL' | 'API_PAGOS',
    public readonly medio_pago: 'EFECTIVO' | 'EFECTY' | 'TRANSFERENCIA' | 'CARD',
    public readonly tipo_pago: 'CUOTA' | 'PAGO_TOTAL' | 'CUOTA_INICIAL',
    public readonly numero_cuota: number | null,
    public readonly origen: string,
    public readonly estado_pago: 'PENDIENTE' | 'APLICADO' | 'REVERSADO',
    public readonly usuario_aplicacion: string,
    public readonly fecha_aplicacion?: Date,
    public readonly observacion?: string,
    public readonly referencia_id_transaccion?: string
  ) {}

  static create(props: { [key: string]: any }): [string?, PagoHistoricoCreateDto?] {
    const {
      prestamo_id,
      valor_pago,
      fecha_pago,
      hora_pago,
      canal_pago,
      medio_pago,
      tipo_pago,
      numero_cuota,
      origen,
      estado_pago,
      usuario_aplicacion,
      fecha_aplicacion,
      observacion,
      referencia_id_transaccion,
    } = props;

    if (!prestamo_id) return ['Prestamo ID is required', undefined];
    if (valor_pago === undefined) return ['Valor pago is required', undefined];
    if (!fecha_pago) return ['Fecha pago is required', undefined];
    if (!estado_pago) return ['Estado pago is required', undefined];
    if (!usuario_aplicacion) return ['Usuario aplicacion is required', undefined];

    return [
      undefined,
      new PagoHistoricoCreateDto(
        prestamo_id,
        valor_pago,
        new Date(fecha_pago),
        hora_pago || '00:00:00',
        canal_pago || 'MANUAL',
        medio_pago || 'EFECTIVO',
        tipo_pago || 'CUOTA',
        numero_cuota || null,
        origen || 'MIGRADO',
        estado_pago,
        usuario_aplicacion,
        fecha_aplicacion ? new Date(fecha_aplicacion) : undefined,
        observacion,
        referencia_id_transaccion
      ),
    ];
  }
}

/**
 * DTO para migrar historial de pagos (tabla historial_pagos)
 * Registra pagos aplicados con desglose de conceptos
 */
export class HistorialPagosCreateDto {
  private constructor(
    public readonly documento: string,
    public readonly prestamoID: number,
    public readonly Numero_cuota: number,
    public readonly capital: number,
    public readonly interes: number,
    public readonly aval: number,
    public readonly IVA: number,
    public readonly pablok: number,
    public readonly sanciones: number,
    public readonly prejuridico: number,
    public readonly juridico: number,
    public readonly seguro: number,
    public readonly total_pagado: number,
    public readonly recibo: string,
    public readonly agente_creador: string,
    public readonly bolsa: string | null,
    public readonly canal: string,
    public readonly tipo_pago: string,
    public readonly creador: string,
    public readonly fecha_registro: Date
  ) {}

  static create(props: { [key: string]: any }): [string?, HistorialPagosCreateDto?] {
    const {
      documento,
      prestamoID,
      Numero_cuota,
      capital,
      interes,
      aval,
      IVA,
      pablok,
      sanciones,
      prejuridico,
      juridico,
      seguro,
      total_pagado,
      recibo,
      agente_creador,
      bolsa,
      canal,
      tipo_pago,
      creador,
      fecha_registro,
    } = props;

    if (!documento) return ['Documento is required', undefined];
    if (!prestamoID) return ['Prestamo ID is required', undefined];
    if (Numero_cuota === undefined) return ['Numero cuota is required', undefined];
    if (total_pagado === undefined) return ['Total pagado is required', undefined];
    if (!recibo) return ['Recibo is required', undefined];
    if (!agente_creador) return ['Agente creador is required', undefined];

    return [
      undefined,
      new HistorialPagosCreateDto(
        documento,
        prestamoID,
        Numero_cuota,
        capital || 0,
        interes || 0,
        aval || 0,
        IVA || 0,
        pablok || 0,
        sanciones || 0,
        prejuridico || 0,
        juridico || 0,
        seguro || 0,
        total_pagado,
        recibo,
        agente_creador,
        bolsa || null,
        canal || 'MANUAL',
        tipo_pago || 'Cuota',
        creador || 'MIGRACION',
        fecha_registro ? new Date(fecha_registro) : new Date()
      ),
    ];
  }
}

/**
 * DTO para migrar historial de pagos detallado (tabla historial_pagos_detallado)
 * Vincula pagos de la tabla pagos con desglose detallado
 */
export class HistorialPagosDetalladoCreateDto {
  private constructor(
    public readonly id_pago: number,
    public readonly prestamo_id: number,
    public readonly id_cliente: number,
    public readonly documento: string,
    public readonly numero_cuota: number | null,
    public readonly capital_pagado: number,
    public readonly interes_pagado: number,
    public readonly aval_pagado: number,
    public readonly iva_pagado: number,
    public readonly pablok: number,
    public readonly sancion_pagada: number,
    public readonly descuento_capital: number,
    public readonly descuento_interes: number,
    public readonly descuento_aval: number,
    public readonly descuento_iva: number,
    public readonly descuento_sancion: number,
    public readonly total_pagado: number,
    public readonly total_descuento: number,
    public readonly tipo_pago: 'Cuota' | 'Cuota_Inicial' | 'Pago_Total' | 'Mora' | 'Parcial',
    public readonly id_bolsa_asignada: number | null,
    public readonly usuario_aplicacion: string,
    public readonly fecha_aplicacion: Date,
    public readonly observaciones: string | null
  ) {}

  static create(props: { [key: string]: any }): [string?, HistorialPagosDetalladoCreateDto?] {
    const {
      id_pago,
      prestamo_id,
      id_cliente,
      documento,
      numero_cuota,
      capital_pagado,
      interes_pagado,
      aval_pagado,
      iva_pagado,
      pablok,
      sancion_pagada,
      descuento_capital,
      descuento_interes,
      descuento_aval,
      descuento_iva,
      descuento_sancion,
      total_pagado,
      total_descuento,
      tipo_pago,
      id_bolsa_asignada,
      usuario_aplicacion,
      fecha_aplicacion,
      observaciones,
    } = props;

    if (!id_pago) return ['ID pago is required', undefined];
    if (!prestamo_id) return ['Prestamo ID is required', undefined];
    if (!id_cliente) return ['ID cliente is required', undefined];
    if (!documento) return ['Documento is required', undefined];
    if (total_pagado === undefined) return ['Total pagado is required', undefined];
    if (!usuario_aplicacion) return ['Usuario aplicacion is required', undefined];

    return [
      undefined,
      new HistorialPagosDetalladoCreateDto(
        id_pago,
        prestamo_id,
        id_cliente,
        documento,
        numero_cuota || null,
        capital_pagado || 0,
        interes_pagado || 0,
        aval_pagado || 0,
        iva_pagado || 0,
        pablok || 0,
        sancion_pagada || 0,
        descuento_capital || 0,
        descuento_interes || 0,
        descuento_aval || 0,
        descuento_iva || 0,
        descuento_sancion || 0,
        total_pagado,
        total_descuento || 0,
        tipo_pago || 'Cuota',
        id_bolsa_asignada || null,
        usuario_aplicacion,
        fecha_aplicacion ? new Date(fecha_aplicacion) : new Date(),
        observaciones || null
      ),
    ];
  }
}
