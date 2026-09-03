# Auctions Online API

API REST para una plataforma de subastas en línea, construida con Express y TypeScript. El proyecto incluye un dataset de subastas en memoria y una estructura inicial para autenticación, usuarios, órdenes, pagos, pujas y gestión del ciclo de vida de las subastas.

> **Estado actual:** la única operación funcional es `GET /api/v1/auctions`. El resto de rutas están registradas, pero sus controladores todavía no tienen implementación y no deben considerarse disponibles para producción.

## Contenido

- [Requisitos](#requisitos)
- [Instalación y ejecución](#instalación-y-ejecución)
- [Variables de entorno](#variables-de-entorno)
- [Arquitectura](#arquitectura)
- [API](#api)
- [Modelo de datos](#modelo-de-datos)
- [Manejo de errores](#manejo-de-errores)
- [Limitaciones actuales](#limitaciones-actuales)
- [Próximos pasos](#próximos-pasos)

## Requisitos

- Node.js y npm.
- TypeScript y Nodemon se instalan automáticamente con `npm install`.

## Instalación y ejecución

Clona el repositorio, entra en la carpeta del proyecto e instala las dependencias:

```bash
npm install
```

### Desarrollo

```bash
npm run dev
```

Este comando ejecuta Nodemon. Cada cambio en archivos TypeScript vuelve a compilar el proyecto y reinicia el servidor. La configuración se encuentra en `nodemon.json`; la carpeta `dist/` se ignora para evitar ciclos de reinicio.

### Compilación

```bash
npm run build
```

TypeScript genera los archivos JavaScript compilados dentro de `dist/`.

### Producción

```bash
npm run build
npm start
```

El comando `start` ejecuta `node dist/server.js`.

### Pruebas

```bash
npm test
```

Actualmente no existe una suite de pruebas automatizadas. El script incluido es el placeholder creado por npm y termina con error intencionalmente.

## Variables de entorno

Crea un archivo `.env` en la raíz del proyecto:

```env
PORT=****
```

| Variable | Descripción | Valor por defecto |
| --- | --- | --- |
| `PORT` | Puerto HTTP en el que escucha Express. | `3000` |

El servidor carga estas variables con `dotenv`. Si `PORT` no existe o no representa un número válido, se utiliza el puerto `3000`. El archivo `.env` está incluido en `.gitignore` y no debe subirse al repositorio.

## Arquitectura

```text
.
├── controllers/       # Controladores HTTP
├── data/              # Dataset mock de subastas
├── routes/            # Definición de endpoints
├── middlewares/       # Middleware preparado para errores
├── server.ts          # Inicialización de Express y registro de routers
├── tsconfig.json      # Configuración de TypeScript
├── nodemon.json       # Configuración de desarrollo
└── package.json       # Scripts y dependencias
```

El servidor:

1. Carga las variables de entorno.
2. Crea una aplicación Express.
3. Habilita el parser JSON con `express.json()`.
4. Monta todos los routers bajo el prefijo `/api/v1`.
5. Escucha en el puerto configurado.

No hay base de datos: las subastas se importan desde `data/auctions_mockdata.ts` y se mantienen únicamente en memoria.

## API

### URL base

En local:

```text
http://localhost:3000/api/v1
```

La aplicación no incluye actualmente una ruta `/health` ni una especificación OpenAPI/Swagger.

### Listar subastas

```http
GET /auctions
```

Devuelve todas las subastas del dataset mock.

#### Parámetros de consulta

| Parámetro | Tipo | Obligatorio | Descripción |
| --- | --- | --- | --- |
| `category` | `string` | No | Filtra por una categoría exacta. La comparación distingue mayúsculas, minúsculas y acentos. |

#### Ejemplos

```bash
curl http://localhost:3000/api/v1/auctions
curl "http://localhost:3000/api/v1/auctions?category=Arte"
```

#### Respuesta `200 OK`

La respuesta es un array JSON. Sin filtro contiene actualmente 30 subastas; con una categoría inexistente devuelve un array vacío.

```json
[
	{
		"id": "auc_0001",
		"item_name": "Pieza de colección",
		"description": "Descripción de la subasta",
		"category": "Arte",
		"seller_id": "usr_0001",
		"base_price": 100,
		"min_increment": 10,
		"current_highest_bid": 150,
		"published_at": "2025-01-15T10:00:00.000Z",
		"closing_date": "2025-01-30T10:00:00.000Z",
		"status": "ABIERTA",
		"winner_id": null,
		"bids": []
	}
]
```

### Rutas registradas todavía no implementadas

Estas rutas forman parte de la estructura prevista de la API, pero sus controladores están vacíos. Actualmente no crean, consultan ni modifican datos y una solicitud puede quedar pendiente sin respuesta.

| Método | Ruta | Propósito previsto |
| --- | --- | --- |
| `GET` | `/auctions/:auction_id` | Consultar una subasta por ID. |
| `POST` | `/auctions` | Crear una subasta. |
| `PATCH` | `/auctions/:auction_id/cancel` | Cancelar una subasta. |
| `POST` | `/auctions/:auction_id/bids` | Registrar una puja. |
| `POST` | `/auth/register` | Registrar un usuario. |
| `POST` | `/auth/login` | Autenticar un usuario. |
| `GET` | `/users/me` | Obtener el perfil del usuario autenticado. |
| `GET` | `/orders/:order_id` | Consultar una orden. |
| `POST` | `/webhooks/payments` | Procesar un webhook de pagos. |

No están definidos todavía los cuerpos JSON, respuestas exitosas, códigos de error ni requisitos de autenticación de estas operaciones.

## Modelo de datos

Cada subasta del dataset tiene esta estructura:

```json
{
	"id": "string",
	"item_name": "string",
	"description": "string",
	"category": "string",
	"seller_id": "string",
	"base_price": "number",
	"min_increment": "number",
	"current_highest_bid": "number | null",
	"published_at": "string",
	"closing_date": "string",
	"status": "ABIERTA | CANCELADA | CERRADA | DESIERTA",
	"winner_id": "string | null",
	"bids": "Bid[]"
}
```

Cada puja tiene esta estructura:

```json
{
	"id": "string",
	"bidder_id": "string",
	"amount": "number",
	"created_at": "string"
}
```

El dataset actual contiene 30 subastas, 182 pujas y las categorías `Coleccionables`, `Arte`, `Hogar`, `Electrónica`, `Vehículos`, `Moda`, `Joyería` y `Deportes`.

Los importes son números sin moneda ni reglas de precisión definidas. Las fechas son strings con formato de fecha y hora, pero el contrato no especifica formalmente una zona horaria.

## Manejo de errores

Existe un `errorHandler` preparado con esta estructura:

```json
{
	"ok": false,
	"error": {
		"code": "INTERNAL_SERVER_ERROR",
		"messages": "Ocurrió un error inesperado en el servidor."
	}
}
```

Sin embargo, el middleware todavía no está conectado en `server.ts`, por lo que no debe asumirse este formato para todos los errores. Tampoco existen errores de dominio implementados para subastas, usuarios, pujas, órdenes o pagos.

Las rutas inexistentes y algunos errores del parser JSON utilizan actualmente la respuesta predeterminada de Express.

## Limitaciones actuales

- No hay persistencia ni base de datos.
- No hay autenticación, JWT, sesiones, roles ni permisos.
- No hay validación de bodies, parámetros, importes, fechas o categorías.
- No se actualizan automáticamente los estados según `closing_date`.
- No se calcula `current_highest_bid` ni `winner_id`.
- `min_increment` todavía no se utiliza.
- No hay paginación, ordenamiento ni filtros por estado o fecha.
- No hay CORS, rate limiting ni documentación OpenAPI.
- No hay respuestas JSON uniformes para todos los errores.
- No hay pruebas automatizadas.

## Próximos pasos

Para convertir este prototipo en una API operativa, el orden recomendado es:

1. Definir interfaces o esquemas para usuarios, subastas, pujas, órdenes y pagos.
2. Añadir validación de entrada y respuestas de error consistentes.
3. Conectar una base de datos y separar repositorios de controladores.
4. Implementar registro, login y middleware de autenticación.
5. Implementar creación, consulta, cancelación y cierre de subastas.
6. Implementar pujas con validación de incremento mínimo y control de concurrencia.
7. Implementar órdenes, pagos y verificación de firmas de webhooks.
8. Conectar el middleware de errores y añadir pruebas unitarias e integración.
9. Publicar una especificación OpenAPI y un endpoint de health check.