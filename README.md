# Turnos de Vuelo - Aeroclub 9 de Julio

Esta es una aplicación Next.js para la gestión de turnos de vuelo, pilotos, aeronaves y más para el Aeroclub 9 de Julio.

## 🚀 Primeros Pasos

Sigue estos pasos para poner en marcha el proyecto en tu entorno local.

### 1. Requisitos Previos

- Node.js (versión 18 o superior)
- npm, pnpm, o yarn

### 2. Instalación

Clona el repositorio y luego instala las dependencias:

```bash
git clone <tu-repositorio-git>
cd <nombre-del-directorio>
npm install
```

### 3. Configuración de Variables de Entorno

Crea un archivo llamado `.env.local` en la raíz del proyecto. Este archivo contendrá las claves secretas de los servicios que utiliza la aplicación.

Copia y pega el siguiente contenido en tu archivo `.env.local` y reemplaza los valores de ejemplo con tus propias claves:

```env
# URL de tu proyecto en Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxxxxxxxxxx.supabase.co

# Clave anónima PÚBLICA de tu proyecto en Supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xxxxx.xxxxx

# Clave de SERVICIO (secreta) de tu proyecto en Supabase (para operaciones de admin)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xxxxx.xxxxx

# Clave de API de Google para Genkit (Gemini AI)
GOOGLE_API_KEY=AIzaSyxxxxxxxxxxxxxxxxxxxxxxx

# Token de tu bot de Telegram (obtenido de @BotFather)
NEXT_PUBLIC_TELEGRAM_BOT_TOKEN=1234567890:ABC-DEF1234567890abcdefg

# Un token secreto que inventes para proteger la ruta del cron job
CRON_SECRET=ESTO_ES_UN_SECRETO_MUY_SEGURO_12345
```

### 4. Ejecutar el Servidor de Desarrollo

Una vez configuradas las variables de entorno, puedes iniciar el servidor de desarrollo:

```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) en tu navegador para ver la aplicación.

---

## ☁️ Despliegue en Vercel

Vercel es la forma recomendada de desplegar esta aplicación Next.js.

### 1. Conectar tu Repositorio de GitHub

- Sube tu código a un repositorio de GitHub (si aún no lo has hecho).
- Ve a [Vercel](https://vercel.com/) y crea una cuenta o inicia sesión.
- Desde tu dashboard de Vercel, haz clic en "Add New..." -> "Project".
- Importa el repositorio de GitHub que acabas de crear/subir.

### 2. Configurar el Proyecto en Vercel

Vercel detectará automáticamente que es un proyecto Next.js y configurará los ajustes de build por ti. Lo más importante es añadir las variables de entorno.

- En la configuración de tu proyecto en Vercel, ve a la sección "Settings" -> "Environment Variables".
- Añade cada una de las variables que definiste en tu archivo `.env.local`.

**Variables a añadir en Vercel:**

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GOOGLE_API_KEY`
- `NEXT_PUBLIC_TELEGRAM_BOT_TOKEN`
- `CRON_SECRET`

**¡Importante!** Asegúrate de que los nombres de las variables en Vercel coincidan exactamente con los del archivo `.env.local`.

### 3. Desplegar

Una vez que hayas añadido las variables de entorno, haz clic en el botón "Deploy". Vercel construirá y desplegará tu aplicación.

### 4. Configurar el Webhook de Telegram

Después del primer despliegue, Vercel te dará la URL de tu aplicación (ej: `https://tu-proyecto.vercel.app`).

1.  Ve a la sección de **Administración -> Configuración de Telegram** en tu aplicación ya desplegada.
2.  La URL del webhook se generará automáticamente.
3.  Ingresa el token de tu bot de Telegram en el campo correspondiente.
4.  Copia el comando `curl` que se genera y ejecútalo en una terminal en tu computadora. Esto le dirá a Telegram que envíe las actualizaciones a tu aplicación en Vercel.

### 5. Configurar el Cron Job (Opcional)

Para enviar los informes semanales automáticamente, necesitas configurar un Cron Job en Vercel.

1.  En tu proyecto de Vercel, crea un archivo `vercel.json` en la raíz si no existe.
2.  Añade la siguiente configuración:

    ```json
    {
      "crons": [
        {
          "path": "/api/cron?token=ESTO_ES_UN_SECRETO_MUY_SEGURO_12345",
          "schedule": "0 11 * * 1"
        }
      ]
    }
    ```
    - **path**: Debe ser `/api/cron?token=` seguido del mismo valor que pusiste en la variable `CRON_SECRET`.
    - **schedule**: Este ejemplo se ejecuta todos los lunes a las 11:00 AM UTC. Puedes ajustarlo usando la sintaxis de `cron`.

3.  Vuelve a desplegar tu proyecto en Vercel para que los cambios surtan efecto.
