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
    *   Tener a mano las claves de los servicios que usarás (Supabase, Google).

### 2. Sube tu Código a un Repositorio de GitHub

Una vez que tengas `git` instalado y tu proyecto esté listo, es momento de subirlo a un nuevo repositorio en tu cuenta de GitHub.

```bash
# Inicializa git si no lo has hecho
git init
git add .
git commit -m "Versión inicial del proyecto"

# Crea un nuevo repositorio en GitHub.com y luego ejecuta los siguientes dos comandos:
# Reemplaza la URL con la de tu repositorio.
git remote add origin https://github.com/tu-usuario/nombre-del-repositorio.git

# Sube tu rama actual a GitHub. HEAD se refiere a la rama en la que te encuentras.
git push -u origin HEAD
```

### 3. Despliegue en Vercel

Vercel es la plataforma recomendada para desplegar esta aplicación.

#### Paso 3.1: Conectar tu Repositorio

1.  Ve a tu [Dashboard de Vercel](https://vercel.com/dashboard).
2.  Haz clic en **"Add New..."** -> **"Project"**.
3.  Importa el repositorio de GitHub que acabas de crear/subir.
4.  Vercel detectará automáticamente que es un proyecto Next.js y pre-configurará los ajustes de build por ti. No necesitas cambiarlos.

#### Paso 3.2: Configurar las Variables de Entorno

Este es el paso más **crítico**. Todas las siguientes claves se encuentran en el dashboard de tu proyecto de Supabase, en la sección **Settings -> API**.

1.  En la configuración del proyecto en Vercel, antes de desplegar, ve a la sección **"Environment Variables"**.
2.  Añade cada una de las siguientes variables con sus respectivos valores. Asegúrate de que los nombres coincidan exactamente.

| Variable                      | Descripción                                                                      |
| ----------------------------- | -------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`    | La URL de tu proyecto de Supabase (sección "Project URL").                         |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | La clave pública de tu proyecto (sección "Project API Keys", la que dice `anon`). |
| `SUPABASE_SERVICE_ROLE_KEY`   | **(SECRETA)** La clave de servicio (sección "Project API Keys", la que dice `service_role`). |
| `GOOGLE_API_KEY`              | Tu clave de API de Google para Genkit (Gemini AI).                                |
| `NEXT_PUBLIC_TELEGRAM_BOT_TOKEN` | El token de tu bot de Telegram, obtenido de @BotFather.                              |
| `CRON_SECRET`                 | Un texto secreto que inventes para proteger el cron job.                         |

#### Paso 3.3: Desplegar

1.  Una vez que todas las variables de entorno han sido añadidas, haz clic en el botón **"Deploy"**.
2.  Vercel construirá y desplegará tu aplicación. Cuando termine, te proporcionará la URL pública de tu proyecto (ej: `https://tu-proyecto.vercel.app`).

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

---

### 🚨 Resolución de Problemas Comunes

#### Error: `error: '...' does not have a commit checked out`

Este error ocurre cuando intentas ejecutar `git add .` y una de las subcarpetas de tu proyecto (por ejemplo, `turnosvuelo/`) es, a su vez, otro repositorio de Git (contiene su propia carpeta `.git`).

**Solución:**

Debes eliminar el repositorio de Git anidado. Abre tu terminal, navega hasta la raíz de tu proyecto y ejecuta el siguiente comando, **reemplazando `nombre-carpeta` por el nombre de la carpeta que te indica el error**:

```bash
# Para Windows (usando Command Prompt)
rmdir /s /q nombre-carpeta\\.git

# Para Windows (usando PowerShell)
Remove-Item -Recurse -Force nombre-carpeta\\.git

# Para macOS o Linux
rm -rf nombre-carpeta/.git
```

Una vez ejecutado, puedes volver a intentar el comando `git add .` desde la raíz de tu proyecto principal:

```bash
git add .
# Ahora debería funcionar sin errores.
git commit -m "Eliminar repositorio anidado y continuar con el commit"
git push
```

#### Error: `src refspec main does not match any`

Este error significa que Git no puede encontrar la rama `main` para subirla. Esto puede ocurrir si tu rama local tiene otro nombre (como `master`) o si el repositorio local está en un estado inconsistente. Si los comandos estándar no funcionan, la solución más segura es reiniciar la configuración de Git local.

**Solución Definitiva (Plan de Reseteo Nuclear):**

Este método **NO BORRARÁ TU CÓDIGO**. Solo reiniciará la configuración de Git.

1.  **Elimina la configuración actual de Git**. Abre una terminal en la carpeta raíz de tu proyecto y ejecuta el siguiente comando. Esto eliminará la carpeta `.git` oculta.
    ```bash
    # Para Windows (usando Command Prompt)
    rmdir /s /q .git

    # Para Windows (usando PowerShell)
    Remove-Item -Recurse -Force .git

    # Para macOS o Linux
    rm -rf .git
    ```

2.  **Ahora, inicializa un repositorio limpio desde cero** y sigue los pasos para subirlo como si fuera la primera vez.
    ```bash
    # 1. Iniciar un nuevo repositorio de Git
    git init

    # 2. (Opcional, pero recomendado) Crear y cambiarse a la rama 'main'
    git checkout -b main
    
    # 3. Añadir todos tus archivos
    git add .

    # 4. Crear el primer commit (el guardado inicial)
    git commit -m "Versión inicial del proyecto (reseteo)"

    # 5. Conectar con tu repositorio en GitHub (reemplaza la URL)
    git remote add origin https://github.com/tu-usuario/nombre-del-repositorio.git

    # 6. Subir tus archivos a GitHub
    git push -u origin HEAD
    ```

Este proceso de "borrón y cuenta nueva" para la configuración de Git debería resolver cualquier estado inconsistente y permitirte subir tu proyecto exitosamente.
