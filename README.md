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
