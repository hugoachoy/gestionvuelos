# Turnos de Vuelo - Aeroclub 9 de Julio

Esta es una aplicación Next.js para la gestión de turnos de vuelo, pilotos, aeronaves y más para el Aeroclub 9 de Julio.

## 🚀 Despliegue y Puesta en Marcha

Estas instrucciones se centran en cómo subir tu proyecto a internet usando GitHub y Vercel.

### 1. Prerrequisitos

Antes de empezar, asegúrate de tener lo siguiente:

*   **Git Instalado**: `git` es la herramienta que te permite comunicarte con GitHub. Si al escribir `git` en tu terminal recibes un error como "comando no encontrado", necesitas instalarlo.
    *   Puedes descargarlo desde su [página oficial](https://git-scm.com/downloads).
*   **Cuentas Creadas**:
    *   Una cuenta en [GitHub](https://github.com/).
    *   Una cuenta en [Vercel](https://vercel.com/) (puedes registrarte con tu cuenta de GitHub).
*   **Claves de Servicios**:
    *   Tener a mano las claves de los servicios que usarás (Supabase, Google, Telegram).

### 2. Sube tu Código a un Repositorio de GitHub

Una vez que tengas `git` instalado y tu proyecto esté listo, es momento de subirlo a un nuevo repositorio en tu cuenta de GitHub.

```bash
# Inicializa git si no lo has hecho
git init
git add .
git commit -m "Versión inicial del proyecto"

# Crea un nuevo repositorio en GitHub.com y luego ejecuta:
git remote add origin https://github.com/tu-usuario/nombre-del-repositorio.git
git branch -M main
git push -u origin main
```

### 3. Despliegue en Vercel

Vercel es la plataforma recomendada para desplegar esta aplicación.

#### Paso 3.1: Conectar tu Repositorio

1.  Ve a tu [Dashboard de Vercel](https://vercel.com/dashboard).
2.  Haz clic en **"Add New..."** -> **"Project"**.
3.  Importa el repositorio de GitHub que acabas de crear/subir.
4.  Vercel detectará automáticamente que es un proyecto Next.js y pre-configurará los ajustes de build por ti. No necesitas cambiarlos.

#### Paso 3.2: Configurar las Variables de Entorno

Este es el paso más **crítico**.

1.  En la configuración del proyecto en Vercel, antes de desplegar, ve a la sección **"Environment Variables"**.
2.  Añade cada una de las siguientes variables con sus respectivos valores. Asegúrate de que los nombres coincidan exactamente.

| Variable                      | Descripción                                           |
| ----------------------------- | ----------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`    | La URL de tu proyecto de Supabase.                    |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | La clave pública (anon key) de tu proyecto Supabase.  |
| `SUPABASE_SERVICE_ROLE_KEY`   | La clave de servicio (secreta) de tu proyecto Supabase. |
| `GOOGLE_API_KEY`              | Tu clave de API de Google para Genkit (Gemini AI).      |
| `NEXT_PUBLIC_TELEGRAM_BOT_TOKEN` | El token de tu bot de Telegram, obtenido de @BotFather. |
| `CRON_SECRET`                 | Un texto secreto que inventes para proteger el cron job. |


#### Paso 3.3: Desplegar

1.  Una vez añadidas todas las variables de entorno, haz clic en el botón **"Deploy"**.
2.  Vercel construirá y desplegará tu aplicación. Al finalizar, te proporcionará la URL pública de tu proyecto (ej: `https://tu-proyecto.vercel.app`).

### 4. Configuración Post-Despliegue

Con tu aplicación ya online, necesitas realizar dos configuraciones finales desde la propia aplicación.

#### Paso 4.1: Configurar el Webhook de Telegram

Para que el bot de Telegram reciba mensajes y comandos, debes decirle a Telegram a qué URL enviar las actualizaciones.

1.  Navega a tu aplicación desplegada en Vercel.
2.  Ve a la sección **Administración -> Configuración de Telegram**.
3.  La "URL del Webhook" se mostrará automáticamente, basada en la URL de tu proyecto en Vercel.
4.  Pega el `token` de tu bot de Telegram en el campo correspondiente.
5.  Se generará un comando `curl`. **Cópialo**.
6.  Abre una terminal en tu computadora (no importa la ubicación) y **pega y ejecuta** ese comando.
7.  Si todo va bien, verás una respuesta como `{"ok":true,"result":true,"description":"Webhook was set"}`. ¡Listo! Tu bot ya está conectado.

#### Paso 4.2: Configurar el Cron Job para Informes Semanales (Opcional)

Para que los informes de actividad se envíen automáticamente a los pilotos cada semana, necesitas configurar una tarea programada (Cron Job) en Vercel.

1.  En la raíz de tu proyecto (en tu computadora), crea un archivo llamado `vercel.json` si no existe.
2.  Añade la siguiente configuración. **Recuerda reemplazar el token secreto** con el mismo que pusiste en las variables de entorno.

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
    - **path**: `/api/cron?token=` seguido de tu `CRON_SECRET`.
    - **schedule**: `0 11 * * 1` ejecuta la tarea todos los lunes a las 11:00 AM UTC. Puedes ajustar este valor usando la sintaxis de `cron`.

3.  Sube los cambios de este archivo `vercel.json` a tu repositorio de GitHub.

    ```bash
    git add vercel.json
    git commit -m "Añadir configuración de cron job"
    git push
    ```
4.  Vercel detectará el cambio y realizará un nuevo despliegue automáticamente, activando el cron job.

¡Y eso es todo! Tu aplicación estará completamente configurada y funcionando en producción.
