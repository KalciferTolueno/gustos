# Datito

Descubrimiento de eventos en Chile según intereses personales. Next.js muestra la agenda y el mapa; un worker de OpenAI busca eventos verificables y PostgreSQL conserva candidatos, fuentes y moderación.

Para arquitectura, flujos, modelo de datos, invariantes y traspaso a otra IA, consulta [`AI_CONTEXT.md`](AI_CONTEXT.md).

## Desarrollo

Requiere Node.js 22+ y PostgreSQL.

```bash
npm install
cp .env.example .env.local
npm run db:migrate
npm run db:seed
npm run dev
```

Sin `DATABASE_URL`, la interfaz funciona con eventos ficticios claramente identificados. El agente nunca funciona sin PostgreSQL y `OPENAI_API_KEY`.

La búsqueda de portada consulta primero PostgreSQL. Los resultados se guardan durante 24 horas; una búsqueda vacía se reintenta después de 2 minutos. Los términos solicitados al menos tres veces y activos durante la última semana se actualizan diariamente. Las consultas invitadas sin caché están limitadas por IP para controlar abuso.

El worker mantiene una matriz de 20 familias temáticas en las 16 regiones y el trimestre actual más los cuatro siguientes. Separar el año en trimestres da al buscador fechas concretas y evita que una única consulta amplia deje eventos fuera, sin dejar fuera los últimos meses cuando el ciclo comienza a mitad de trimestre. El refresco se adapta a la cantidad de resultados (7, 21 o 45 días). También consolida duplicados, conserva sus fuentes, verifica eventos próximos y completa imágenes oficiales mediante datos estructurados, HTML y selección de IA. Una auditoría versionada recorre todos los eventos existentes y vuelve a comprobar fuente viva, vigencia, imagen y ubicación; al incrementar la versión de reglas, el catálogo completo se revisa nuevamente sin perder el avance entre reinicios. La configuración incluida no aplica topes internos diarios ni mensuales (`0`); si se requiere controlar gasto, define límites positivos en `AGENT_*_SEARCHES_PER_*` o un límite de gasto en el proveedor.

## EasyPanel

### Opción recomendada: Compose

Crea un solo servicio `Compose` con fuente Git y estos valores:

```text
Repositorio: git@github.com:KalciferTolueno/gustos.git
Rama: main
Ruta de compilación: /
Archivo Compose: docker-compose.yml
```

Copia las variables de `.env.example` al editor `Environment` de EasyPanel. Como mínimo configura `POSTGRES_PASSWORD`, `AUTH_SECRET`, `AUTH_URL`, `AGENT_RUN_SECRET` y `OPENAI_API_KEY`. Usa una contraseña alfanumérica para PostgreSQL porque se incluye en la URL interna.

Despliega y después crea un dominio dirigido al servicio interno `web`, protocolo HTTP, puerto `3000`. El Compose espera PostgreSQL, ejecuta migraciones y carga la taxonomía inicial antes de iniciar la web; el worker comienza únicamente cuando la web está saludable.

El volumen `postgres-data` conserva la base entre despliegues. Configura en EasyPanel un backup programado de ese volumen hacia almacenamiento externo. Para restauraciones selectivas también puedes ejecutar `pg_dump` desde el contenedor `db`.

### Opción alternativa: servicios separados

Crea un proyecto con estos servicios:

1. `datito-db`: servicio PostgreSQL privado. Activa copias diarias hacia almacenamiento externo y prueba una restauración.
2. `datito-web`: servicio App desde este repositorio y `Dockerfile`, dominio al puerto `3000`, health check `/api/health`.
3. `datito-worker`: otro servicio App desde el mismo repositorio, sin dominio, con comando `npm run worker` y una sola réplica.

Usa la URL interna de PostgreSQL como `DATABASE_URL` en web y worker. Antes del primer despliegue ejecuta en la consola de `datito-web`:

```bash
npm run db:migrate
npm run db:seed
```

Variables requeridas están en `.env.example`. Configura en OpenAI un límite de gasto del proyecto; los límites de búsquedas de la aplicación son una segunda barrera, no sustituyen el límite del proveedor.

Callbacks OAuth:

```text
https://tu-dominio.cl/api/auth/callback/google
https://tu-dominio.cl/api/auth/callback/discord
```

El acceso por correo y contraseña funciona sin variables adicionales desde el panel `Ingresar` de la portada. Auth.js inicia una sesión JWT. Las contraseñas se almacenan con `scrypt` y sal aleatoria, nunca en texto plano. El correo de credenciales se trata como identificador no verificado y se mantiene separado del correo confirmado por Google o Discord. La recuperación de contraseña no está incluida porque requiere configurar un proveedor de correo.

Si `ADMIN_PASSWORD` está configurada con al menos 12 caracteres, el seed aprovisiona `admin@datito.local`. El panel se encuentra en `/admin`.

Para convertir una cuenta en administradora:

```sql
update users set role = 'admin' where email = 'tu-correo@ejemplo.cl' or credential_email = 'tu-correo@ejemplo.cl';
```

## Comandos

```bash
npm test
npm run lint
npm run build
npm run db:generate
npm run db:migrate
npm run db:seed
npm run worker
```
