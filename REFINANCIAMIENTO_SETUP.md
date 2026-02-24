# Configuración del Endpoint de Refinanciamiento con Pagos

## Resumen de Cambios

Se ha integrado correctamente el **RefinanciamientoService** con la base de datos principal usando el patrón Singleton `prismaMainService`.

### Archivos Modificados

1. **`src/amortizacion/amortizacion-refinanciamiento.service.ts`**
   - ✅ Agregado import: `import { prismaMainService } from '../database/main/prisma-main.service'`
   - ✅ Método `obtenerInfoCredito(creditoId)` - sin parámetro prismaClient
   - ✅ Método `obtenerPagos(creditoId)` - sin parámetro prismaClient
   - ✅ Método `calcularRefinanciamientoConPagos(creditoId)` - sin parámetro prismaClient
   - ✅ Usa `prismaMainService.$queryRaw` internamente para ejecutar queries

2. **`src/amortizacion/amortizacion.controller.ts`**
   - ✅ Método `calcularRefinanciamientoConPagos` simplificado
   - ✅ Llamada directa: `this.refinanciamientoService.calcularRefinanciamientoConPagos(creditoId)`
   - ✅ Ya no requiere pasar parámetro de Prisma client

---

## Cómo Usar el Endpoint

### Request
```bash
POST /api/amortizacion/refinanciamiento/calcular-con-pagos
Content-Type: application/json

{
  "creditoId": 26122
}
```

### Response (Exitoso)
```json
{
  "exitoso": true,
  "mensaje": "Refinanciamiento calculado exitosamente. Cuotas pendientes: 5",
  "infoCredito": {
    "documento": "1023456789",
    "valor_prestamo": 500000,
    "periodicidad": "mensual",
    "cantidad_meses": 18,
    "cuotas_faltantes": 5
  },
  "infoPagos": {
    "cuotaMaximaPagada": 13,
    "tieneCuotaParcial": true,
    "montoDebe": 45000,
    "desglosePagos": { ... }
  },
  "amortizacionOriginal": [...],
  "amortizacionActualizada": [...],
  "estadisticas": {
    "totalCuotas": 5,
    "cuotaTotal": 95000,
    "totalCapital": 450000,
    "totalInteres": 5000,
    "totalAval": 25000,
    "totalIVA": 4750
  }
}
```

### Response (Error)
```json
{
  "exitoso": false,
  "mensaje": "No se encontró información para el crédito 26122",
  "errores": ["Crédito no encontrado"]
}
```

---

## Flujo de Procesamiento

El endpoint ejecuta automáticamente el siguiente flujo de 5 pasos:

```
┌─────────────────────────────────────────────────────────────┐
│ PASO 1: OBTENER INFORMACIÓN DEL CRÉDITO                    │
│ (documento, valor_prestamo, periodicidad, cantidad_meses)  │
└──────────────────┬──────────────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────────────┐
│ PASO 2: OBTENER PAGOS REGISTRADOS                          │
│ (pagos con estado: Ok, Debe, Finalizado)                   │
└──────────────────┬──────────────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────────────┐
│ PASO 3: CALCULAR REFINANCIAMIENTO INICIAL                  │
│ (18 cuotas con capital distribuido equitativamente)        │
└──────────────────┬──────────────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────────────┐
│ PASO 4: PROCESAR Y VALIDAR PAGOS                           │
│ → Identifica cuota máxima pagada (estado = Ok)             │
│ → ELIMINA esas cuotas de la amortización                   │
│ → Si cuota parcial (estado = Debe):                        │
│    • Calcula % de pago vs cuota total                      │
│    • Ajusta capital, interés, aval, IVA proporcionalmente  │
└──────────────────┬──────────────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────────────┐
│ PASO 5: RETORNA AMORTIZACIÓN ACTUALIZADA                   │
│ (Solo cuotas faltantes por pagar)                          │
└─────────────────────────────────────────────────────────────┘
```

---

## Verificación

Para verificar que todo está funcionando correctamente:

```bash
# 1. Compilar TypeScript
npm run build

# 2. Probar el endpoint
curl -X POST http://localhost:3000/api/amortizacion/refinanciamiento/calcular-con-pagos \
  -H "Content-Type: application/json" \
  -d '{"creditoId": 26122}'

# 3. Revisar los logs
# Buscar: [REFINANCIAMIENTO-SVC] en los logs de la aplicación
```

---

## Detalles Técnicos

### Patrón Singleton
El `prismaMainService` es un singleton que se importa directamente:
```typescript
import { prismaMainService } from '../database/main/prisma-main.service';
```

### Tipo de Queries
Se usan queries crudas con Prisma:
```typescript
const resultado = (await prismaMainService.$queryRaw`...`) as InfoCreditoData[] | PagoRegistro[];
```

### Manejo de Errores
- Cada paso tiene logging detallado
- Si no se encuentra información, retorna `exitoso: false`
- Los errores de BD son capturados y reportados en la respuesta

---

## Próximos Pasos

1. ✅ Instalar Prisma y generar clientes (`client-main`, `client-legacy`)
2. ✅ Configurar variables de entorno (`DATABASE_URL_MAIN`, `DATABASE_URL_LEGACY`)
3. ✅ Inicializar conexión a BD en `src/app.ts` o `src/server.ts`
4. **LISTO** - Probar el endpoint con credoId real

