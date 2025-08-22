# Copiador de Playlists de Spotify

Esta herramienta te permite copiar canciones de una playlist de Spotify a otra, incluso entre diferentes cuentas. Es útil cuando quieres:
- Hacer una copia de seguridad de una playlist
- Transferir una playlist a otra cuenta
- Crear múltiples versiones de una playlist

## Requisitos Previos

- Node.js instalado en tu sistema
- Una cuenta de Spotify
- Credenciales de desarrollador de Spotify (Client ID y Client Secret)

## Configuración Inicial

### 1. Crear una Aplicación en Spotify Developer Dashboard

1. Ve a [Spotify Developer Dashboard](https://developer.spotify.com/dashboard/)
2. Inicia sesión con tu cuenta de Spotify
3. Crea una nueva aplicación
4. Configura una URL de redirección: `http://127.0.0.1:5173/callback`
5. Anota tu **Client ID** y **Client Secret**

### 2. Configurar el Archivo .env

Crea un archivo `.env` en la raíz del proyecto con el siguiente contenido:

```
SPOTIFY_CLIENT_ID=tu_client_id_aquí
SPOTIFY_CLIENT_SECRET=tu_client_secret_aquí
SPOTIFY_REDIRECT_URI=http://127.0.0.1:5173/callback
SPOTIFY_REFRESH_TOKEN=se_generará_en_el_siguiente_paso
```

### 3. Instalar Dependencias

Ejecuta el siguiente comando para instalar todas las dependencias necesarias:

```bash
npm install
```

Las dependencias principales que se utilizan son:
- `dotenv`: Para cargar variables de entorno desde el archivo .env
- `express`: Para el servidor web que maneja la autenticación OAuth
- `open`: Para abrir automáticamente el navegador durante la autenticación
- `spotify-web-api-node`: Para interactuar con la API de Spotify
- `ts-node`: Para ejecutar archivos TypeScript sin compilación previa

## Uso

### Paso 1: Obtener un Token de Acceso

Primero necesitas obtener un token de actualización (refresh token) que permita a la aplicación acceder a tu cuenta de Spotify:

```bash
node --loader ts-node/esm auth-local.ts
```

Este comando:
1. Abrirá tu navegador
2. Te pedirá iniciar sesión en Spotify (si aún no lo has hecho)
3. Te pedirá autorizar la aplicación
4. Generará un token de actualización que se mostrará en la terminal

Copia este token y actualiza el valor de `SPOTIFY_REFRESH_TOKEN` en tu archivo `.env`.

### Paso 2: Crear una Playlist de Destino (Opcional)

Si quieres copiar canciones a una playlist existente, crea una nueva playlist vacía en tu cuenta de Spotify. Anota su ID, que encontrarás en la URL cuando la abras:

```
https://open.spotify.com/playlist/TU_ID_DE_PLAYLIST
```

### Paso 3: Copiar una Playlist

#### Opción A: Crear una Nueva Playlist y Copiar Canciones

```bash
node simple-copy.mjs https://open.spotify.com/playlist/ID_PLAYLIST_ORIGEN
```

#### Opción B: Copiar a una Playlist Existente

```bash
node simple-copy.mjs https://open.spotify.com/playlist/ID_PLAYLIST_ORIGEN https://open.spotify.com/playlist/ID_PLAYLIST_DESTINO
```

Donde:
- `ID_PLAYLIST_ORIGEN` es el ID de la playlist que quieres copiar
- `ID_PLAYLIST_DESTINO` es el ID de la playlist donde quieres copiar las canciones

## Notas Importantes

- Este script solo copia las canciones, no copia la imagen de portada ni otros metadatos.
- Las canciones locales no se pueden copiar debido a limitaciones de la API de Spotify.
- Si la creación de la playlist falla, el script te pedirá que crees una manualmente y luego uses la Opción B.
- El token de actualización no caduca, pero si cambias las configuraciones de la aplicación, es posible que necesites generar uno nuevo.

## Resolución de Problemas

### Error al Crear una Playlist

Si ves un mensaje como:

```
Error creating playlist with promise API.
Por favor, crea manualmente una playlist en tu cuenta de Spotify
Y luego ejecuta este script con la URL/ID de la playlist de origen Y la URL/ID de tu playlist como segundo argumento
```

Sigue las instrucciones:
1. Crea una playlist manualmente en Spotify
2. Copia su ID desde la URL
3. Ejecuta el script con ambos IDs como se muestra en la Opción B

### Error al Refrescar Token

Si ves un error relacionado con la autenticación, es posible que necesites generar un nuevo token:

1. Asegúrate que tus credenciales en `.env` sean correctas
2. Ejecuta nuevamente `node --loader ts-node/esm auth-local.ts`
3. Actualiza el token en `.env`

## Cómo Funciona

1. **auth-local.ts**: Configura un servidor local para el flujo OAuth con Spotify y obtiene un token de actualización.
2. **simple-copy.mjs**: Utiliza ese token para autenticarse, obtener las canciones de la playlist de origen y copiarlas a la playlist de destino.

El proceso respeta los límites de la API de Spotify, procesando las canciones en lotes de 100 para evitar errores.

## Estructura del Proyecto

- **auth-local.ts**: Script de TypeScript para la autenticación con Spotify
- **simple-copy.mjs**: Script principal de JavaScript para copiar playlists
- **.env**: Archivo de configuración para almacenar credenciales y tokens
- **package.json** y **package-lock.json**: Archivos de configuración de npm para gestionar dependencias
- **tsconfig.json**: Configuración de TypeScript necesaria para ejecutar auth-local.ts

Estos archivos son necesarios para el correcto funcionamiento de la aplicación. Si quisieras recrear el proyecto desde cero, necesitarías configurar estos archivos con las dependencias mencionadas anteriormente.
