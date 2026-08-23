# Gustos

Descubrimiento de eventos en Chile según intereses personales. Next.js muestra la agenda y el mapa; un worker de OpenAI busca eventos verificables y PostgreSQL conserva candidatos, fuentes y moderación.

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

Despliega y después crea un dominio dirigido al servicio interno `web`, protocolo HTTP, puerto `3000`. El Compose espera PostgreSQL, ejecuta migraciones y carga los gustos iniciales antes de iniciar la web; el worker comienza únicamente cuando la web está saludable.

El volumen `postgres-data` conserva la base entre despliegues. Configura en EasyPanel un backup programado de ese volumen hacia almacenamiento externo. Para restauraciones selectivas también puedes ejecutar `pg_dump` desde el contenedor `db`.

### Opción alternativa: servicios separados

Crea un proyecto con estos servicios:

1. `gustos-db`: servicio PostgreSQL privado. Activa copias diarias hacia almacenamiento externo y prueba una restauración.
2. `gustos-web`: servicio App desde este repositorio y `Dockerfile`, dominio al puerto `3000`, health check `/api/health`.
3. `gustos-worker`: otro servicio App desde el mismo repositorio, sin dominio, con comando `npm run worker` y una sola réplica.

Usa la URL interna de PostgreSQL como `DATABASE_URL` en web y worker. Antes del primer despliegue ejecuta en la consola de `gustos-web`:

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

Para convertir una cuenta en administradora:

```sql
update users set role = 'admin' where email = 'tu-correo@ejemplo.cl';
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
