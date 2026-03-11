# Arquitectura Amortización v2 - Análisis y Diseño Desacoplado

## 🎯 Propósito
Desacoplar la lógica de amortización en **3 fases independientes** para reducir margen de error y mejorar mantenibilidad:
1. **FASE 1**: Creación de amortización base (Factory)
2. **FASE 2**: Aplicación de pagos (Strategy Pagos)
3. **FASE 3**: Aplicación de sanciones y gastos cartera (Strategy Sanciones)

---

## 📊 FASE 1: CREACIÓN AMORTIZACIÓN BASE (Factory)

### Responsabilidad
El **Factory** identifica el TIPO de crédito y crea la amortización base **sin alterar datos**.

### ⚠️ CASOS CRÍTICOS A IDENTIFICAR (Validación Factory)

```
enum TipoAmortizacion {
  CANCELADO = 'CANCELADO',              // Estado = CANCELADO || CANCELADO_REFINANCIAMIENTO
  SIMPLE = 'SIMPLE',                    // capital_distribuido > 0 && capital_distribuido > cta_aval + cta_iva_aval
  DEFICIT_AVAL = 'DEFICIT_AVAL',        // capital_distribuido < (cta_aval + cta_iva_aval)
  CAPITAL_PURO = 'CAPITAL_PURO',        // capital_distribuido == valor_cuota
}
```

### Decisión Factory (En Cascada)

```typescript
PASO 1: ¿estado = CANCELADO o CANCELADO_REFINANCIAMIENTO?
  → SI: Usa STRATEGY → AmortizacionCanceladaStrategy
  → NO: Continúa PASO 2

PASO 2: Calcular capital_distribuido = valor_prestamo / cantidad_meses
PASO 3: Calcular excedente = valor_cuota - capital_distribuido

PASO 4: ¿capital_distribuido == valor_cuota? (sin decimales relevantes)
  → SI: Usa STRATEGY → AmortizacionCapitalPuroStrategy
  → NO: Continúa PASO 5

PASO 5: ¿excedente < (cta_aval + cta_iva_aval)?
  → SI: Usa STRATEGY → AmortizacionDeficitAvalStrategy
  → NO: Usa STRATEGY → AmortizacionSimpleStrategy
```

---

## 📋 DETALLES CASOS FASE 1

### CASO 1: CANCELADO
**Condición**: `estado IN ('CANCELADO', 'CANCELADO_REFINANCIAMIENTO')`

**Salida**: Todas las cuotas con valores = 0
```
numeroCuota  capital  interes  aval  iva  cuotaTotal  saldo
1            0        0        0     0    0           0
2            0        0        0     0    0           0
...
```

---

### CASO 2: CAPITAL PURO
**Condición**: `capital_distribuido ≈ valor_cuota` (iguales)

**Lógica**:
```
capital_distribuido = valor_prestamo / cantidad_meses
excedente = valor_cuota - capital_distribuido

SI excedente ≈ 0 (menor a 1000, margen de redondeo):
  Usa CAPITAL PURO
  
Cada cuota:
  capital = capital_distribuido
  interes = 0
  aval = 0
  iva = 0
  cuotaTotal = capital
  saldo = saldo_anterior - capital
```

**Por qué**: El crédito fue diseñado solo con capital, sin componentes adicionales.

---

### CASO 3: SIMPLE (La Mayoría)
**Condición**: `excedente > 0 && excedente >= (cta_aval + cta_iva_aval)`

**Lógica**:
```
capital_distribuido = valor_prestamo / cantidad_meses
excedente = valor_cuota - capital_distribuido

Cada cuota:
  1. capital = capital_distribuido
  2. aval = cta_aval (fijo por cuota)
  3. iva_aval = cta_iva_aval (fijo por cuota)
  4. interes = excedente - aval - iva_aval
  5. cuotaTotal = capital + aval + iva_aval + interes
  6. saldo = saldo_anterior - capital
```

**Ejemplo**:
```
valor_prestamo = 10,000,000
cantidad_meses = 12
valor_cuota = 900,000
cta_aval = 15,000
cta_iva_aval = 2,850

capital_distribuido = 10,000,000 / 12 = 833,333
excedente = 900,000 - 833,333 = 66,667

Cuota 1:
  capital = 833,333
  aval = 15,000
  iva = 2,850
  interes = 66,667 - 15,000 - 2,850 = 48,817
  cuotaTotal = 833,333 + 15,000 + 2,850 + 48,817 = 900,000 ✓
```

---

### CASO 4: DEFICIT DE AVAL
**Condición**: `excedente < (cta_aval + cta_iva_aval)`

**Lógica Especial**:
```
excedente < (cta_aval + cta_iva_aval)
  → No hay suficiente para aval FIJO

SOLUCIÓN: Distribuir excedente entre aval e iva proporcional
  
  aval = round(excedente / 1.19, redondear_a_10)
  iva = excedente - aval (también redondear_a_10)
  VALIDAR: aval + iva = excedente (sin pérdida)
  
  Cada cuota:
    1. capital = capital_distribuido
    2. aval = aval (recalculado)
    3. iva_aval = iva (recalculado)
    4. interes = 0 (NO hay espacio)
    5. cuotaTotal = capital + aval + iva
```

**Ejemplo**:
```
excedente = 10,000
cta_aval + cta_iva_aval = 12,000 → DEFICIT

aval = round(10,000 / 1.19, -1) = round(8,403.36, -1) = 8,400
iva = 10,000 - 8,400 = 1,600 ✓
Validar: 8,400 + 1,600 = 10,000 ✓

Cuota 1:
  capital = 833,333
  aval = 8,400
  iva = 1,600
  interes = 0
  cuotaTotal = 843,333
```

---

## 🔄 FASE 2: APLICACIÓN PAGOS (Strategy Pagos)

### Responsabilidad
Procesar tabla `pagos` y actualizar amortización según:
- **VALIDAR SINCRONÍA CON CUOTAS_FALTANTES** (campo critical de legacy)
- Validar sincronía de `num_cuota` con estructura
- Detectar cuotas completamente pagadas (estado = 'Ok')
- Detectar cuotas parcialmente pagadas (estado = 'Debe')
- Eliminar cuotas pagadas, ajustar cuota parcial

### ⚠️ REGLAS DE SINCRONIZACIÓN (CON VALIDACIÓN CRITICAL)

```
REGLA 0: VALIDAR CUOTAS_FALTANTES (LA VERDAD)
  cuota_maxima_pagada = MAX(pago.num_cuota WHERE estado = 'Ok')
  cuotas_pagadas_calculadas = cuota_maxima_pagada
  cuotas_faltantes_esperadas = cantidad_meses_total - cuotas_pagadas_calculadas
  
  SI cuotas_faltantes_esperadas ≠ cuotas_faltantes (legacy):
    ⚠️ ALERTA: Inconsistencia entre pagos y legacy
    → Usar cuotas_faltantes de legacy como VERDAD
    → Registrar divergencia para auditoría
  
  RESULTADO: amortizacion_final.length = cuotas_faltantes (legacy)

REGLA 1: SI pago.num_cuota EXISTS
  → Validar: SUM(pago.abono WHERE num_cuota = X) ≤ cuota[X].cuotaTotal
  → Si estado = 'Ok': Marcar cuota como completamente pagada
  → Si estado = 'Debe': Calcular faltante = cuotaTotal - abono

REGLA 2: SI pago.num_cuota IS NULL
  → Verificar pago.concepto IN ('Cuota', 'Cuota Parcial', 'Aval')
  → Agrupar pagos por acumulación hasta = valor_cuota
  → VALIDAR: SUM(pago.abono GROUP BY periodo) ≤ valor_cuota
  → Asignar automáticamente a cuota siguiente no pagada

REGLA 3: SI conceptos mezclados (Cuota + Aval en mismo período)
  → Sumar TODOS los abonos de ese período
  → VALIDAR: suma_conceptos ≤ valor_cuota (margen 1%)
  → SI suma_conceptos > valor_cuota: ALERTA, usar solo hasta valor_cuota
  → Asignar al num_cuota o calcular cuota destino
```

### Algoritmo (CON VALIDACIÓN CUOTAS_FALTANTES)

```
ENTRADA: 
  amortizacion[], 
  pagos[], 
  valor_cuota,
  cuotas_faltantes (LEGACY),      ← CRÍTICO
  cantidad_meses_total (LEGACY)

1. Identificar cuota_maxima_pagada = MAX(pago.num_cuota WHERE estado = 'Ok')

2. VALIDAR SINCRONÍA:
   cuotas_esperadas = cantidad_meses_total - cuota_maxima_pagada
   SI cuotas_esperadas ≠ cuotas_faltantes:
     ALERTA("Divergencia: esperadas=" + cuotas_esperadas + ", legacy=" + cuotas_faltantes)
   
   USAR: cuotas_faltantes como verdad absoluta
   
3. Eliminar cuotas 1 a cuota_maxima_pagada de amortizacion[]
   RESULTADO: amortizacion[] con cuotas_faltantes items EXACTAMENTE

4. Validar que amortizacion.length = cuotas_faltantes
   SI NO: AJUSTAR tomando solo las primeras cuotas_faltantes cuotas

5. Detectar cuota parcial:
   - Buscar pago cuyo cuota_número = (cuota_maxima_pagada + 1) con estado = 'Debe'
   - SI existe múltiples pagos en esa cuota:
     * SUM(pago.abono WHERE cuota = X) ≤ valor_cuota (validar)
     * Calcular faltante = valor_cuota - SUM(abono)
     * Ajustar proporcional: capital, interes, aval, iva
   - RESULTADO: Cuota 1 (nueva) es la parcial ajustada si es necesario

6. Retornar amortizacion_actualizada[] con:
   - length = cuotas_faltantes exactamente
   - sin cuotas pagadas
   - con parcial ajustada si aplica
```

---

## ⚡ FASE 3: APLICACIÓN SANCIONES (Strategy Sanciones)

### Responsabilidad
Distribuir sanciones y gastos cartera respetando:
- Límites por período (Mensual: 30k, Quincenal: 15k)
- Distribución por cuotas faltantes
- Última cuota acumula excedente

### ⚠️ ALGORITMO SANCIONES (SIN FECHA)

```
ENTRADA: 
  - amortizacion[] (ya con pagos aplicados)
  - sanciones[] con estado = 'Debe'
  - periocidad ('mensual' | 'quincenal')

PASO 1: Calcular máximo sanción por período
  mensual = 30,000 (1 día × 1,000 × 30 días)
  quincenal = 15,000 (1 día × 1,000 × 15 días)

PASO 2: Sumar total_sanciones = SUM(sanciones[].valor)

PASO 3: Distribuir proporcionalmente sin mirar fechas
  cantidad_cuotas = amortizacion.length
  sancion_por_cuota = floor(total_sanciones / cantidad_cuotas)
  
  PARA CADA cuota i (0 a cantidad_cuotas - 1):
    SI i < (cantidad_cuotas - 1):
      sancion_aplicada[i] = MIN(sancion_por_cuota, maximo_sancion)
      total_distribuido += sancion_aplicada[i]
    SINO (última cuota):
      sancion_aplicada[i] = total_sanciones - total_distribuido
      // La última acumula lo que falta, sin límite

PASO 4: Agregar campo sancion a cada cuota
  amortizacion[i].sancion = sancion_aplicada[i]
  amortizacion[i].cuotaTotal += sancion_aplicada[i]
```

**Ejemplo**:
```
total_sanciones = 150,000
cantidad_cuotas = 5
periocidad = mensual (máximo 30,000)

sancion_por_cuota = 150,000 / 5 = 30,000

Cuota 1: MIN(30,000, 30,000) = 30,000  → acumulado = 30,000
Cuota 2: MIN(30,000, 30,000) = 30,000  → acumulado = 60,000
Cuota 3: MIN(30,000, 30,000) = 30,000  → acumulado = 90,000
Cuota 4: MIN(30,000, 30,000) = 30,000  → acumulado = 120,000
Cuota 5: 150,000 - 120,000 = 30,000    → acumulado = 150,000 ✓

(Si hubiera sido 160,000: última sería 40,000, sin importar máximo)
```

---

### Sanciones Exoneradas y Pagadas

```
sanciones estado = 'Exonerada':
  - Restar del total antes de distribuir
  - Registrar en infoPagos.sanciones_condonadas

sanciones estado = 'Ok':
  - Ya están pagadas
  - Restar del total antes de distribuir
  - NO incluir en nuevas amortizaciones
```

---

## 💰 FASE 3b: GASTOS CARTERA (Prejuridico + Juridico)

### Lógica

```
ENTRADA: extras[] con concepto IN ('Prejuridico', 'Juridico'), estado = 'Debe'

PASO 1: Agrupar por concepto
  prejuridico_total = SUM(extras WHERE concepto = 'Prejuridico' AND estado = 'Debe')
  juridico_total = SUM(extras WHERE concepto = 'Juridico' AND estado = 'Debe')

PASO 2: Restar pagos ya realizados
  pagos_prejuridicos = SUM(pagos WHERE concepto = 'Prejuridico' AND estado = 'Ok')
  pagos_juridicos = SUM(pagos WHERE concepto = 'Juridico' AND estado = 'Ok')
  
  prejuridico_pendiente = prejuridico_total - pagos_prejuridicos
  juridico_pendiente = juridico_total - pagos_juridicos

PASO 3: Agregar a última cuota
  amortizacion[-1].gastos_cartera = {
    prejuridico: prejuridico_pendiente,
    juridico: juridico_pendiente
  }
  amortizacion[-1].cuotaTotal += prejuridico_pendiente + juridico_pendiente

PASO 4: Validar sincronía
  ✓ Cada pago 'Ok' debe coincidir con un extra registrado
  ✓ Suma de pagos <= suma de extras (por concepto)
  ✗ Si diverge > 1000: Alertar inconsistencia en datos legacy
```

---

## 🏗️ ARQUITECTURA DE CÓDIGO (3 Clases)

```
amortizacionPattern/
│
├── factory/
│   └── AmortizacionFactory.ts
│       ├── enum TipoAmortizacion
│       ├── class AmortizacionFactory
│       │   ├── identificarTipo(infoCredito): TipoAmortizacion
│       │   ├── validarPrecondiciones(infoCredito): boolean
│       │   └── crear(infoCredito): RefinanciamientoItem[]
│       │
│       └── Retorna: AMORTIZACIÓN BASE (sin pagos, sin sanciones)
│
├── strategies/
│   ├── IAmortizacionStrategy.ts (Interface)
│   │   └── execute(amortizacion, datos): RefinanciamientoItem[]
│   │
│   ├── AmortizacionCanceladaStrategy.ts
│   ├── AmortizacionCapitalPuroStrategy.ts
│   ├── AmortizacionSimpleStrategy.ts
│   └── AmortizacionDeficitAvalStrategy.ts
│
├── applications/
│   ├── AmortizacionPagosStrategy.ts
│   │   ├── procesar(amortizacion, pagos, valor_cuota)
│   │   ├── validarSincronía()
│   │   ├── identificarCuotasCompletadas()
│   │   ├── detectarCuotaParcial()
│   │   └── retorna: amortizacion[] actualizada
│   │
│   └── AmortizacionSancionesStrategy.ts
│       ├── distribuirSanciones(amortizacion, sanciones, periocidad)
│       ├── procesarExoneradas(sanciones_exoneradas)
│       ├── procesarGastosCartera(extras, pagos)
│       └── retorna: amortizacion[] final + estadísticas
│
└── AmortizacionOrchestrator.ts
    ├── FASE 1: Factory.crear()
    ├── FASE 2: PagosStrategy.procesar()
    ├── FASE 3: SancionesStrategy.distribuir()
    └── retorna: ResultadoFinal {
          amortizacion: RefinanciamientoItem[],
          estadisticas: {},
          validaciones: {}
        }
```

---

## 🔌 FLUJO DE DATOS: Legacy → Main → Amortización (POR FASES)

### ANTES (Actual - Acoplado)
```
Service.obtenerInfoCredito() [LEGACY]
    ↓
Service.obtenerPagos() [LEGACY]
    ↓
Service.obtenerSanciones() [LEGACY]
    ↓
AmortizacionRefinanciamiento.calcularRefinanciamientoConPagos()
    ↓ (mezcla todo: creación + pagos + sanciones)
    ↓
ResultadoFinal

⚠️ PROBLEMAS:
- Una lógica gigante (1000+ líneas)
- Difícil de testear (requiere mocks de todos los datos legacy)
- Actualizar un caso afecta todo lo demás
- Errores en sanciones afectan pagos y viceversa
```

### DESPUÉS (Propuesto - Desacoplado SIN PERSISTENCIA EN ESTAS CLASES)

#### ⚙️ PASO 0: OBTENER DATOS DE LEGACY (LECTURA SOLAMENTE)
```
Service.obtenerInfoCredito(creditoId) [LEGACY - LECTURA]
    → normalizar
    → InfoCreditoData (EN MEMORIA)

Service.obtenerPagos(creditoId) [LEGACY - LECTURA]
    → PagoRegistro[] (EN MEMORIA)

Service.obtenerSanciones(creditoId) [LEGACY - LECTURA]
    → SancionRegistro[] (EN MEMORIA)
    
Service.obtenerGastosCartera(creditoId) [LEGACY - LECTURA]
    → ExtraRegistro[] (EN MEMORIA)

RESULTADO: Todos los datos legacy cargados en memoria, usados en las 3 fases
⚠️ NO hay INSERT/UPDATE en esta capa - solo LECTURA
```

#### 📌 FASE 1: CREAR AMORTIZACIÓN BASE

```
INPUT:  InfoCreditoData (de LEGACY - LECTURA)

PROCESO:
  Factory.identificarTipo(infoCredito)
    ↓
  Strategy correspondiente.execute(infoCredito)
    ↓
  amortizacion_base[] (estructura completa)
  
  RETURN: amortizacion_base[] ← SOLO RETORNA (lógica pura, SIN INSERT)

OUTPUT: Object
  ├─ amortizacion_base[] (datos listos para siguiente fase)
  └─ ✓ PERSISTENCIA: será responsabilidad del QueueProcessor enviar a MAIN

⚠️ IMPORTANTE: 
  - Esta clase NO hace INSERT/UPDATE
  - Solo retorna datos con lógica aplicada
  - La persistencia en BD la hace la capa de colas (QueueProcessor)
```

#### 📌 FASE 2: APLICAR PAGOS

```
INPUT: 
  - amortizacion[] de FASE 1 (en contexto)
  - pagos[] DE LEGACY (LECTURA)
  - valor_cuota, cuotas_faltantes (DE LEGACY - LECTURA)

PROCESO:
  PagosStrategy.procesar(amortizacion, pagos, valor_cuota, cuotas_faltantes)
    ↓ Elimina cuotas pagadas
    ↓ Ajusta cuota parcial si existe
    ↓ Retorna NUEVA amortización
    ↓
  amortizacion_con_pagos[] ← SOLO RETORNA (lógica pura, SIN UPDATE)

OUTPUT: Object
  │
  └─ amortizacion_con_pagos[] (datos listos para Fase 3)

⚠️ IMPORTANTE:
  - Esta clase NO hace UPDATE/INSERT
  - Solo retorna datos con lógica aplicada
  - La persistencia en BD la hace la capa de colas (QueueProcessor)
  - El contexto en memoria pasa de Fase 1 a Fase 2 a Fase 3
```

#### 📌 FASE 3: APLICAR SANCIONES Y GASTOS CARTERA

```
INPUT:
  - amortizacion[] de FASE 2 (en contexto)
  - sanciones[] DE LEGACY (LECTURA)
  - sanciones_exoneradas[] DE LEGACY (LECTURA)
  - extras[] DE LEGACY (LECTURA - prejuridico + juridico)
  - periocidad

PROCESO:
  SancionesStrategy.distribuirSanciones(amortizacion, sanciones, periocidad)
    ↓ Distribuye sanciones en cuotas
    ↓
  SancionesStrategy.procesarGastosCartera(extras, pagos_juridicos)
    ↓ Agrega gastos a última cuota
    ↓
  amortizacion_final[] ← SOLO RETORNA (lógica pura, SIN UPDATE)

OUTPUT: Object
  │
  └─ amortizacion_final[] (datos FINALES listos para persistencia)

⚠️ IMPORTANTE:
  - Esta clase NO hace UPDATE/INSERT
  - Solo retorna datos con lógica aplicada
  - La persistencia en BD la hace la capa de colas (QueueProcessor)
```

#### 🎯 FLUJO COMPLETO CON ARQUITECTURA DE COLAS (SIN PERSISTENCIA EN ESTAS CLASES)

```
RefinanciamientoService.calcularRefinanciamientoConPagos(creditoId)
  │
  ├─ PASO 0: Cargar datos legacy (UNA SOLA VEZ - SOLO LECTURA)
  │   ├─ infoCredito = service.obtenerInfoCredito(creditoId) [LEGACY - LECTURA]
  │   ├─ pagos = service.obtenerPagos(creditoId) [LEGACY - LECTURA]
  │   ├─ sanciones = service.obtenerSancionesPendientes(creditoId) [LEGACY - LECTURA]
  │   └─ extras = service.obtenerGastosCartera(creditoId) [LEGACY - LECTURA]
  │
  ├─ FASE 1: Factory.crear(infoCredito)  ← LÓGICA PURA (SIN BD)
  │   ├─ Retorna: amortizacion_base[]
  │   └─ ✓ RETURN amortizacion_base[] (SIN INSERT)
  │
  ├─ FASE 2: 
  │   ├─ Cargar desde MAIN: amortizacion = obtenerDelContexto(amortizacion_base)
  │   ├─ PagosStrategy.procesar(amortizacion, pagos, valor_cuota, cuotas_faltantes)  ← LÓGICA PURA (SIN BD)
  │   ├─ Retorna: amortizacion_con_pagos[]
  │   └─ ✓ RETURN amortizacion_con_pagos[] (SIN UPDATE)
  │
  └─ FASE 3:
      ├─ Cargar desde contexto: amortizacion = obtenerDelContexto(amortizacion_con_pagos)
      ├─ SancionesStrategy.distribuir(amortizacion, sanciones, extras, periocidad)  ← LÓGICA PURA (SIN BD)
      ├─ Retorna: amortizacion_final[]
      └─ ✓ RETURN amortizacion_final[] (SIN UPDATE)

RESPUESTA DEL SERVICE: ResultadoFinal
  ├─ amortizacion_final[] (objeto simple, sin persistencia)
  ├─ estadisticas {}
  └─ validaciones {}

FLUJO DE PERSISTENCIA (FUERA DE ESTAS CLASES):
  │
  └─ Procesador de Colas (QueueProcessor / Consumer)
      ├─ RECIBE: ResultadoFinal del Service
      ├─ PROCESA: Itera sobre amortizacion_final[]
      └─ PERSISTE: INSERT/UPDATE en MAIN (tabla amortizaciones)
          await db.amortizaciones.create()
          await db.amortizaciones.update()

✓ VENTAJAS ARQUITECTURA SIN PERSISTENCIA:
  - Factory + Strategies: LÓGICA PURA (input → output, sin efectos secundarios)
  - Service: ORQUESTACIÓN (coordina Fases, retorna datos)
  - Persistencia: RESPONSABILIDAD DE LA CAPA DE COLAS
  
  → Fácil de testear: NO requiere mocks de BD
  → Fácil de paralelizar: Las fases pueden ser procesadas en diferentes workers de colas
  → Fácil de debuggear: Lógica 100% separada de persistencia
  → Tolerancia a fallos: Si falla persistencia, la lógica ya fue procesada
```

#### 🗄️ PERSISTENCIA EN MAIN (Responsabilidad de QueueProcessor)

```
QUIÉN PERSISTE: QueueProcessor / Consumer de colas (NO estas clases)

FLUJO:
1. RefinanciamientoService.calcularRefinanciamientoConPagos() 
   → retorna ResultadoFinal { amortizacion_final[] }
   
2. Cola (Queue System) / Job Queue
   → recibe ResultadoFinal
   → crea Job/Message para persistencia
   
3. QueueProcessor (Consumer / Worker)
   → ITERA sobre amortizacion_final[]
   → EJECUTA: INSERT/UPDATE en MAIN
   
TABLA: amortizaciones (MAIN)
  id: PK
  credito_id: FK
  numero_cuota: numero
  capital: number
  interes: number
  aval: number
  iva: number
  sancion: number (agregado en Fase 3)
  gastos_cartera_prejuridico: number (agregado en Fase 3)
  gastos_cartera_juridico: number (agregado en Fase 3)
  cuota_total: number
  saldo: number
  fecha_pago: date
  fase_actual: 'CREADA' | 'PAGOS_APLICADOS' | 'COMPLETA'  ← QueueProcessor actualiza
  created_at: timestamp
  updated_at: timestamp (QueueProcessor actualiza)

✓ VENTAJAS:
  - Estas clases: SIN responsabilidad de persistencia (solo lógica)
  - QueueProcessor: Responsable de INSERT/UPDATE
  - Separación clara: Lógica ≠ Persistencia
  - Tolerancia a fallos: Si falla persistencia, la lógica ya fue procesada
  - Escalable: Diferentes workers procesando colas en paralelo
```

---

## 🧪 MATRIZ DE CASOS A TESTEAR

|  # | Caso | Fase 1 | Fase 2 | Fase 3 | Subcasos |
|----|------|--------|--------|--------|----------|
| 1  | CANCELADO | ✓ | ✗ | ✗ | Estado CANCELADO, CANCELADO_REFINANCIAMIENTO |
| 2  | CAPITAL_PURO | ✓ | ✓ | ✓ | Sin pagos, Con pagos, Con sanciones |
| 3  | SIMPLE | ✓ | ✓ | ✓ | Sin pagos, Pagos parciales, Múltiples cuotas |
| 4  | DEFICIT_AVAL | ✓ | ✓ | ✓ | Recalculo 1.19, Con pagos, Con sanciones |
|    | | | | | |
| 5  | Pagos | ✗ | ✓ | ✗ | num_cuota presente, num_cuota NULL, concepto mix |
| 6  | Pagos Parciales | ✗ | ✓ | ✗ | 1 cuota parcial, múltiples parciales |
| 7  | Sanciones | ✗ | ✗ | ✓ | Distribución, exoneradas, mesual vs quincenal |
| 8  | Gastos Cartera | ✗ | ✗ | ✓ | Prejuridico, Juridico, Sincronía pagos |

**Total**: ~28-35 escenarios, pero cada uno AISLADO (no combos explosivos)

---

## 🎯 BENEFICIOS FINALES

| Aspecto | Antes | Después |
|---------|--------|---------|
| **Tamaño código** | 1 clase 2000 líneas | 3 clases, 300-400 líneas c/u |
| **Testabilidad** | 1 test gigante | 28+ test pequeños + independientes |
| **Mantenibilidad** | Cambiar 1 cosa afecta todo | Cambio encapsulado por fase |
| **Margen de error** | Alto (lógica entrelazada) | Bajo (fases desacopladas) |
| **Debugging** | "¿Dónde falló?" | "¿En qué fase?" → Fase exacta |
| **Reutilización** | No | Cada Strategy usable en otros contextos |
| **Datos Legacy** | Acoplado en lógica | Normalizado una sola vez |

---

## 📝 NEXT STEPS

1. ✅ Crear `AmortizacionFactory.ts` + 4 Strategies base
2. ✅ Crear `AmortizacionPagosStrategy.ts`
3. ✅ Crear `AmortizacionSancionesStrategy.ts`
4. ✅ Crear `AmortizacionOrchestrator.ts` (orquestador)
5. ✅ Actualizar `RefinanciamientoService.ts` para usar Orchestrator
6. ✅ Tests por cada estrategia
7. ✅ Tests de integración (Orchestrator)
8. ✅ Migración gradual (Flag para legacy vs new)

