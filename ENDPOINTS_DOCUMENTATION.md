# 📚 Documentación de Endpoints API Dual

**Versión:** 1.0  
**Fecha:** 11 de Febrero de 2026  
**Base URL:** `https://demo-api-migracion.facilcreditos.co/api`

---

## 📋 Tabla de Contenidos

1. [Legacy Data Endpoints](#-legacy-data-endpoints)
2. [Main Data Endpoints](#-main-data-endpoints)
3. [Migration Endpoints](#-migration-endpoints)
4. [Response Format](#-response-format)
5. [Error Handling](#-error-handling)

---

## 🏛️ LEGACY DATA ENDPOINTS

Base Path: `/api/legacy`

### Clientes

#### 1. Obtener todos los clientes
```
GET /legacy/clientes
```

**Query Parameters:**
- `skip` (optional): Número de registros a saltar (default: 0)
- `take` (optional): Cantidad de registros a retornar (default: 100)

**Ejemplo de Solicitud:**
```bash
curl -X GET "https://demo-api-migracion.facilcreditos.co/api/legacy/clientes?skip=0&take=50"
```

**Respuesta Exitosa (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "nombre": "Juan Pérez",
      "primer_nombre": "Juan",
      "segundo_nombre": "Carlos",
      "primer_apellido": "Pérez",
      "segundo_apellido": "López",
      "tipo_doc": "Cedula_Ciudadan_a",
      "num_doc": "1234567890",
      "email": "juan@example.com",
      "movil": "3125555555",
      "created_at": "2024-01-15T10:30:00Z"
    }
  ]
}
```

---

#### 2. Obtener cliente por ID
```
GET /legacy/clientes/:id
```

**Parámetros de Ruta:**
- `id` (required): ID del cliente

**Ejemplo de Solicitud:**
```bash
curl -X GET "https://demo-api-migracion.facilcreditos.co/api/legacy/clientes/1"
```

**Respuesta Exitosa (200):**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "nombre": "Juan Pérez",
    "primer_nombre": "Juan",
    "num_doc": "1234567890",
    "email": "juan@example.com"
  }
}
```

**Respuesta No Encontrado (404):**
```json
{
  "success": false,
  "error": "Cliente no encontrado"
}
```

---

#### 3. Obtener cliente por Documento
```
GET /legacy/clientes/documento/:num_doc
```

**Parámetros de Ruta:**
- `num_doc` (required): Número de documento del cliente

**Ejemplo de Solicitud:**
```bash
curl -X GET "https://demo-api-migracion.facilcreditos.co/api/legacy/clientes/documento/1234567890"
```

**Respuesta Exitosa (200):**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "nombre": "Juan Pérez",
    "num_doc": "1234567890",
    "movil": "3125555555"
  }
}
```

---

### Créditos

#### 4. Obtener todos los créditos
```
GET /legacy/creditos
```

**Query Parameters:**
- `skip` (optional): Número de registros a saltar (default: 0)
- `take` (optional): Cantidad de registros a retornar (default: 100)

**Ejemplo de Solicitud:**
```bash
curl -X GET "https://demo-api-migracion.facilcreditos.co/api/legacy/creditos?skip=0&take=50"
```

**Respuesta Exitosa (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "precredito_id": 5,
      "estado": "Vigente",
      "valor_credito": 5000000,
      "saldo": 2500000,
      "cuotas_faltantes": 6,
      "created_at": "2024-02-01T14:20:00Z",
      "precreditos": {
        "id": 5,
        "num_fact": "FAC-001",
        "cliente_id": 1
      }
    }
  ]
}
```

---

#### 5. Obtener crédito por ID
```
GET /legacy/creditos/:id
```

**Parámetros de Ruta:**
- `id` (required): ID del crédito

**Ejemplo de Solicitud:**
```bash
curl -X GET "https://demo-api-migracion.facilcreditos.co/api/legacy/creditos/1"
```

**Respuesta Exitosa (200):**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "precredito_id": 5,
    "estado": "Vigente",
    "valor_credito": 5000000,
    "saldo": 2500000
  }
}
```

---

#### 6. Obtener créditos por Cliente
```
GET /legacy/creditos/cliente/:cliente_id
```

**Parámetros de Ruta:**
- `cliente_id` (required): ID del cliente

**Ejemplo de Solicitud:**
```bash
curl -X GET "https://demo-api-migracion.facilcreditos.co/api/legacy/creditos/cliente/1"
```

**Respuesta Exitosa (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "precredito_id": 5,
      "estado": "Vigente",
      "valor_credito": 5000000
    },
    {
      "id": 2,
      "precredito_id": 6,
      "estado": "Pagado",
      "valor_credito": 3000000
    }
  ]
}
```

---

### Codeudores

#### 7. Obtener todos los codeudores
```
GET /legacy/codeudores
```

**Query Parameters:**
- `skip` (optional): Número de registros a saltar (default: 0)
- `take` (optional): Cantidad de registros a retornar (default: 100)

**Ejemplo de Solicitud:**
```bash
curl -X GET "https://demo-api-migracion.facilcreditos.co/api/legacy/codeudores?skip=0&take=50"
```

---

### Facturas

#### 8. Obtener todas las facturas
```
GET /legacy/facturas
```

**Query Parameters:**
- `skip` (optional): Número de registros a saltar (default: 0)
- `take` (optional): Cantidad de registros a retornar (default: 100)

**Ejemplo de Solicitud:**
```bash
curl -X GET "https://demo-api-migracion.facilcreditos.co/api/legacy/facturas?skip=0&take=50"
```

**Respuesta Exitosa (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "numero_factura": "FAC-2024-001",
      "fecha": "2024-02-01",
      "total": 5000000,
      "estado": "Pagada"
    }
  ]
}
```

---

#### 9. Obtener factura por ID
```
GET /legacy/facturas/:id
```

**Parámetros de Ruta:**
- `id` (required): ID de la factura

**Ejemplo de Solicitud:**
```bash
curl -X GET "https://demo-api-migracion.facilcreditos.co/api/legacy/facturas/1"
```

---

### Pagos

#### 10. Obtener todos los pagos
```
GET /legacy/pagos
```

**Query Parameters:**
- `skip` (optional): Número de registros a saltar (default: 0)
- `take` (optional): Cantidad de registros a retornar (default: 100)

**Ejemplo de Solicitud:**
```bash
curl -X GET "https://demo-api-migracion.facilcreditos.co/api/legacy/pagos?skip=0&take=50"
```

**Respuesta Exitosa (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "factura_id": 1,
      "credito_id": 1,
      "abono": 1000000,
      "debe": 4000000,
      "estado": "Pagado",
      "pago_desde": "2024-02-01",
      "pago_hasta": "2024-02-28"
    }
  ]
}
```

---

#### 11. Obtener pago por ID
```
GET /legacy/pagos/:id
```

**Parámetros de Ruta:**
- `id` (required): ID del pago

**Ejemplo de Solicitud:**
```bash
curl -X GET "https://demo-api-migracion.facilcreditos.co/api/legacy/pagos/1"
```

---

### Precreditos

#### 12. Obtener todos los precreditos
```
GET /legacy/precreditos
```

**Query Parameters:**
- `skip` (optional): Número de registros a saltar (default: 0)
- `take` (optional): Cantidad de registros a retornar (default: 100)

**Ejemplo de Solicitud:**
```bash
curl -X GET "https://demo-api-migracion.facilcreditos.co/api/legacy/precreditos?skip=0&take=50"
```

**Respuesta Exitosa (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "num_fact": "FAC-2024-001",
      "cliente_id": 1,
      "vlr_fin": 5000000,
      "cuotas": 12,
      "vlr_cuota": 416666.67,
      "estudio": "Aprobado",
      "aprobado": "Si"
    }
  ]
}
```

---

#### 13. Obtener precredito por ID
```
GET /legacy/precreditos/:id
```

**Parámetros de Ruta:**
- `id` (required): ID del precredito

**Ejemplo de Solicitud:**
```bash
curl -X GET "https://demo-api-migracion.facilcreditos.co/api/legacy/precreditos/1"
```

---

### Estadísticas Legacy

#### 14. Obtener estadísticas generales
```
GET /legacy/stats
```

**Ejemplo de Solicitud:**
```bash
curl -X GET "https://demo-api-migracion.facilcreditos.co/api/legacy/stats"
```

**Respuesta Exitosa (200):**
```json
{
  "success": true,
  "data": {
    "clientes": 1250,
    "creditos": 3450,
    "pagos": 12300,
    "precreditos": 890
  }
}
```

---

## 🏢 MAIN DATA ENDPOINTS

Base Path: `/api/main`

### Usuarios Clientes

#### 1. Obtener todos los usuarios clientes
```
GET /main/usuarios
```

**Query Parameters:**
- `skip` (optional): Número de registros a saltar (default: 0)
- `take` (optional): Cantidad de registros a retornar (default: 100)

**Ejemplo de Solicitud:**
```bash
curl -X GET "https://demo-api-migracion.facilcreditos.co/api/main/usuarios?skip=0&take=50"
```

**Respuesta Exitosa (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "documento": "1234567890",
      "nombre": "Juan Pérez",
      "estado": "Activo",
      "created_at": "2024-01-15T10:30:00Z"
    }
  ]
}
```

---

#### 2. Obtener usuario por ID
```
GET /main/usuarios/:id
```

**Parámetros de Ruta:**
- `id` (required): ID del usuario

**Ejemplo de Solicitud:**
```bash
curl -X GET "https://demo-api-migracion.facilcreditos.co/api/main/usuarios/1"
```

---

### Información Personal

#### 3. Obtener toda la información personal
```
GET /main/info-personal
```

**Query Parameters:**
- `skip` (optional): Número de registros a saltar (default: 0)
- `take` (optional): Cantidad de registros a retornar (default: 100)

**Ejemplo de Solicitud:**
```bash
curl -X GET "https://demo-api-migracion.facilcreditos.co/api/main/info-personal?skip=0&take=50"
```

**Respuesta Exitosa (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "nombre": "Juan",
      "apellido": "Pérez",
      "tipoDocumento": "CC",
      "documento": "1234567890",
      "fecha_nacimiento": "1990-05-15",
      "estudio": "Universitario",
      "estrato": "3"
    }
  ]
}
```

---

### Información de Contacto

#### 4. Obtener toda la información de contacto
```
GET /main/info-contacto
```

**Query Parameters:**
- `skip` (optional): Número de registros a saltar (default: 0)
- `take` (optional): Cantidad de registros a retornar (default: 100)

**Ejemplo de Solicitud:**
```bash
curl -X GET "https://demo-api-migracion.facilcreditos.co/api/main/info-contacto?skip=0&take=50"
```

**Respuesta Exitosa (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "documento": "1234567890",
      "telefono": "3125555555",
      "celular": "3125555555",
      "email": "juan@example.com",
      "direccion": "Cra 10 #20-50"
    }
  ]
}
```

---

### Información Laboral

#### 5. Obtener toda la información laboral
```
GET /main/info-laboral
```

**Query Parameters:**
- `skip` (optional): Número de registros a saltar (default: 0)
- `take` (optional): Cantidad de registros a retornar (default: 100)

**Ejemplo de Solicitud:**
```bash
curl -X GET "https://demo-api-migracion.facilcreditos.co/api/main/info-laboral?skip=0&take=50"
```

**Respuesta Exitosa (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "documento": "1234567890",
      "empresa": "Empresa XYZ",
      "ocupacion": "Ingeniero",
      "cargo": "Senior Developer",
      "antiguedad": "5 años"
    }
  ]
}
```

---

### Información de Referencias

#### 6. Obtener toda la información de referencias
```
GET /main/info-referencias
```

**Query Parameters:**
- `skip` (optional): Número de registros a saltar (default: 0)
- `take` (optional): Cantidad de registros a retornar (default: 100)

**Ejemplo de Solicitud:**
```bash
curl -X GET "https://demo-api-migracion.facilcreditos.co/api/main/info-referencias?skip=0&take=50"
```

---

### Pagos

#### 7. Obtener todos los pagos
```
GET /main/pagos
```

**Query Parameters:**
- `skip` (optional): Número de registros a saltar (default: 0)
- `take` (optional): Cantidad de registros a retornar (default: 100)

**Ejemplo de Solicitud:**
```bash
curl -X GET "https://demo-api-migracion.facilcreditos.co/api/main/pagos?skip=0&take=50"
```

**Respuesta Exitosa (200):**
```json
{
  "success": true,
  "data": [
    {
      "id_pago": 1,
      "prestamo_id": 5,
      "valor_pago": 1000000,
      "fecha_pago": "2024-02-10",
      "canal_pago": "Transferencia",
      "estado_pago": "Completado"
    }
  ]
}
```

---

### Productos

#### 8. Obtener todos los productos
```
GET /main/productos
```

**Query Parameters:**
- `skip` (optional): Número de registros a saltar (default: 0)
- `take` (optional): Cantidad de registros a retornar (default: 100)

**Ejemplo de Solicitud:**
```bash
curl -X GET "https://demo-api-migracion.facilcreditos.co/api/main/productos?skip=0&take=50"
```

**Respuesta Exitosa (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "nombre": "Laptop Dell",
      "descripcion": "Laptop para profesionales",
      "precio": 3000000,
      "categoria_id": 2
    }
  ]
}
```

---

#### 9. Obtener producto por ID
```
GET /main/productos/:id
```

**Parámetros de Ruta:**
- `id` (required): ID del producto

**Ejemplo de Solicitud:**
```bash
curl -X GET "https://demo-api-migracion.facilcreditos.co/api/main/productos/1"
```

---

### Inventario

#### 10. Obtener todo el inventario
```
GET /main/inventario
```

**Query Parameters:**
- `skip` (optional): Número de registros a saltar (default: 0)
- `take` (optional): Cantidad de registros a retornar (default: 100)

**Ejemplo de Solicitud:**
```bash
curl -X GET "https://demo-api-migracion.facilcreditos.co/api/main/inventario?skip=0&take=50"
```

**Respuesta Exitosa (200):**
```json
{
  "success": true,
  "data": [
    {
      "product_id": 1,
      "almacen": 1,
      "saldo": 50,
      "saldo_reservado": 5,
      "fecha_actualizacion": "2024-02-10T15:30:00Z"
    }
  ]
}
```

---

### Pedidos

#### 11. Obtener todos los pedidos
```
GET /main/pedidos
```

**Query Parameters:**
- `skip` (optional): Número de registros a saltar (default: 0)
- `take` (optional): Cantidad de registros a retornar (default: 100)

**Ejemplo de Solicitud:**
```bash
curl -X GET "https://demo-api-migracion.facilcreditos.co/api/main/pedidos?skip=0&take=50"
```

**Respuesta Exitosa (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "user_cliente_id": 1,
      "fecha": "2024-02-08",
      "estado": "Enviado",
      "total": 3000000
    }
  ]
}
```

---

#### 12. Obtener pedido por ID
```
GET /main/pedidos/:id
```

**Parámetros de Ruta:**
- `id` (required): ID del pedido

**Ejemplo de Solicitud:**
```bash
curl -X GET "https://demo-api-migracion.facilcreditos.co/api/main/pedidos/1"
```

---

### Estudios de Crédito

#### 13. Obtener todos los estudios de crédito
```
GET /main/estudios
```

**Query Parameters:**
- `skip` (optional): Número de registros a saltar (default: 0)
- `take` (optional): Cantidad de registros a retornar (default: 100)

**Ejemplo de Solicitud:**
```bash
curl -X GET "https://demo-api-migracion.facilcreditos.co/api/main/estudios?skip=0&take=50"
```

---

### Historial de Pagos

#### 14. Obtener historial de pagos
```
GET /main/historial-pagos
```

**Query Parameters:**
- `skip` (optional): Número de registros a saltar (default: 0)
- `take` (optional): Cantidad de registros a retornar (default: 100)

**Ejemplo de Solicitud:**
```bash
curl -X GET "https://demo-api-migracion.facilcreditos.co/api/main/historial-pagos?skip=0&take=50"
```

---

### Estadísticas Main

#### 15. Obtener estadísticas generales
```
GET /main/stats
```

**Ejemplo de Solicitud:**
```bash
curl -X GET "https://demo-api-migracion.facilcreditos.co/api/main/stats"
```

**Respuesta Exitosa (200):**
```json
{
  "success": true,
  "data": {
    "usuarios": 890,
    "pagos": 4560,
    "productos": 235,
    "pedidos": 1200
  }
}
```

---

## 🔄 MIGRATION ENDPOINTS

Base Path: `/api/migration`

### 1. Obtener estadísticas de migración
```
GET /migration/statistics
```

**Ejemplo de Solicitud:**
```bash
curl -X GET "https://demo-api-migracion.facilcreditos.co/api/migration/statistics"
```

**Respuesta Exitosa (200):**
```json
{
  "success": true,
  "legacy": {
    "clientes": 1250,
    "creditos": 3450,
    "pagos": 12300,
    "precreditos": 890
  },
  "main": {
    "usuarios": 890,
    "pagos": 4560,
    "productos": 235,
    "pedidos": 1200
  },
  "comparison": {
    "clientesVsUsuarios": {
      "legacy": 1250,
      "main": 890
    },
    "creditosVsEstudios": {
      "legacy": 3450,
      "main": 235
    },
    "pagos": {
      "legacy": 12300,
      "main": 4560
    }
  }
}
```

---

### 2. Validar consistencia de datos
```
GET /migration/validate
```

**Ejemplo de Solicitud:**
```bash
curl -X GET "https://demo-api-migracion.facilcreditos.co/api/migration/validate"
```

**Respuesta Exitosa (200):**
```json
{
  "success": true,
  "dataValidation": {
    "legacyClientsCount": 5,
    "legacyCreditosCount": 5,
    "mainUsuariosCount": 5,
    "mainPagosCount": 5,
    "status": "Data retrieved successfully"
  }
}
```

---

### 3. Previsualizar migración
```
GET /migration/preview
```

**Query Parameters:**
- `skip` (optional): Número de registros a saltar (default: 0)
- `take` (optional): Cantidad de registros a retornar (default: 10)

**Ejemplo de Solicitud:**
```bash
curl -X GET "https://demo-api-migracion.facilcreditos.co/api/migration/preview?skip=0&take=5"
```

**Respuesta Exitosa (200):**
```json
{
  "success": true,
  "preview": {
    "legacyClientes": [
      {
        "id": 1,
        "nombre": "Cliente 1",
        "num_doc": "1111111111"
      }
    ],
    "legacyCreditos": [
      {
        "id": 1,
        "estado": "Vigente",
        "valor_credito": 5000000
      }
    ],
    "mainUsuarios": [
      {
        "id": 1,
        "documento": "1234567890",
        "nombre": "Usuario 1"
      }
    ]
  }
}
```

---

## 📨 RESPONSE FORMAT

### Respuesta Exitosa
```json
{
  "success": true,
  "data": {}
}
```

### Lista con Paginación
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "nombre": "Item 1"
    },
    {
      "id": 2,
      "nombre": "Item 2"
    }
  ]
}
```

---

## ⚠️ ERROR HANDLING

### Error 400 - Bad Request
```json
{
  "success": false,
  "error": "Invalid parameters"
}
```

### Error 404 - Not Found
```json
{
  "success": false,
  "error": "Registro no encontrado"
}
```

### Error 500 - Internal Server Error
```json
{
  "success": false,
  "error": "Internal server error message"
}
```

---

## 🔍 EJEMPLOS DE CONSULTAS

### Obtener clientes con paginación
```bash
curl -X GET "https://demo-api-migracion.facilcreditos.co/api/legacy/clientes?skip=0&take=100"
```

### Obtener créditos de un cliente específico
```bash
curl -X GET "https://demo-api-migracion.facilcreditos.co/api/legacy/creditos/cliente/1"
```

### Obtener estadísticas comparativas
```bash
curl -X GET "https://demo-api-migracion.facilcreditos.co/api/migration/statistics"
```

### Previsualizar datos para migración
```bash
curl -X GET "https://demo-api-migracion.facilcreditos.co/api/migration/preview?skip=0&take=10"
```

---

## 🚀 NOTAS IMPORTANTES

1. **Paginación**: Todos los endpoints que retornan listas soportan parámetros `skip` y `take`
2. **Límite de registros**: El máximo por defecto es 100 registros
3. **Códigos de estado HTTPs**: Todos los endpoints devuelven códigos HTTPs apropiados
4. **Autenticación**: Algunos endpoints pueden requerir autenticación (ver configuración del proyecto)
5. **Rate Limiting**: No hay límite de rate en desarrollo, revisar en producción
6. **CORS**: Origen permitido en desarrollo: `*` (configurar en producción)

---

## 📝 CONVENCIONES DE ESTRUCTURA

- **Respuestas**: Siempre incluyen campo `success` (boolean)
- **Errores**: Incluyen campo `error` con descripción
- **Datos**: Localizados en el campo `data`
- **Timestamps**: Formato ISO 8601 (UTC)
- **IDs**: Enteros positivos

---

**Última actualización:** 11 de Febrero de 2026  
**Versión API:** 1.0  
**Estado:** ✅ Operacional
