# Datito: contexto técnico para IA

Este documento es el punto de entrada para continuar el proyecto desde otra IA o chat. Describe el estado funcional y las decisiones que no deben inferirse de conocimiento genérico de Next.js.

## Estado del producto

Datito descubre, verifica y presenta eventos futuros o en curso en Chile según intereses. La interfaz pública ofrece agenda, mapa, búsqueda local/web, filtros por categoría y subcategoría, autenticación, preferencias y envío comunitario. Un worker separado mantiene el catálogo autónomo.

El producto antes se llamaba Gustos. El paquete y la marca visible son `datito`, pero se conservan por compatibilidad:

- Repositorio: `github.com/KalciferTolueno/gustos`.
- Base PostgreSQL y algunas URLs internas: `gustos`.
- Carpeta local histórica: `Gustos`.

No renombrar esos identificadores persistidos sin una migración y un cambio coordinado de infraestructura.

## Stack

- Next.js 16.3 App Router, React 19 y TypeScript 6.
- Tailwind CSS 4, Radix/Shadcn y Leaflet.
- PostgreSQL 17, Drizzle ORM y migraciones en `drizzle/`.
- Auth.js 5 con credenciales, Google y Discord opcionales.
- OpenAI Responses API con búsqueda web, salida estructurada y visión.
- Vitest y ESLint.
- Node.js 22+.

Antes de modificar APIs o convenciones de Next.js, leer la guía relevante en `node_modules/next/dist/docs/`; esta versión tiene cambios incompatibles con versiones anteriores.

## Procesos

### Web

`src/app/page.tsx` carga eventos, sesión e intereses y entrega la aplicación a `src/components/Dashboard.tsx`.

Rutas principales:

- `/`: catálogo, mapa, filtros, búsqueda y paneles.
- `/admin`: métricas de agente, cobertura, búsquedas y moderación.
- `/api/discover`: caché local y descubrimiento web solicitado por usuarios.
- `/api/events`: envío comunitario autenticado.
- `/api/events/[id]`: detalle, fuentes y aprobación/rechazo.
- `/api/interests`: preferencias del usuario.
- `/api/agent/run`: ejecución manual protegida por secreto.
- `/api/auth/[...nextauth]`: Auth.js.
- `/api/register`: alta por correo y contraseña.
- `/api/health`: health check.

Sin `DATABASE_URL`, la portada usa eventos de demostración. El agente requiere PostgreSQL y `OPENAI_API_KEY`.

### Worker

`src/worker.ts` se ejecuta inmediatamente al iniciar y después cada `AGENT_INTERVAL_MINUTES`:

1. Garantiza la taxonomía canónica.
2. Mantiene las consultas programadas de cobertura.
3. Recupera consultas que quedaron bloqueadas en `running`.
4. Consolida hasta 20 grupos de eventos duplicados.
5. Verifica el siguiente evento vencido.
6. Completa imágenes de hasta 4 eventos sin imagen.
7. Ejecuta hasta 4 consultas de descubrimiento vencidas.

Mantener una sola réplica del worker. `beginAgentRun()` también usa un bloqueo global en PostgreSQL para evitar carreras de presupuesto.

## Cobertura autónoma

`src/lib/discovery-queries.ts` crea una matriz persistente de 20 familias temáticas por 16 regiones de Chile y el trimestre actual más los cuatro siguientes. Cada consulta tiene un rango de fechas explícito; esto cubre al menos los próximos 12 meses incluso a mitad de trimestre y permite búsquedas más profundas que una única ventana anual amplia.

Categorías raíz:

- Gaming
- Anime
- Cine y películas
- Música
- Fotografía
- Astrofotografía
- Viajes y tours
- Arte y cultura
- Teatro y danza
- Comedia
- Literatura
- Gastronomía y ferias
- Deportes y bienestar
- Tecnología y ciencia
- Familia
- Comunidad

El refresco es adaptativo:

- 15 o más resultados: 7 días.
- 1 a 14 resultados: 21 días.
- 0 resultados: 45 días.
- Consultas de usuario: caché normal de 24 horas; resultados vacíos duran 2 minutos.

Las consultas de usuario repetidas al menos 3 veces y activas durante la última semana entran al refresco del worker.

## Descubrimiento y taxonomía

`src/lib/agent.ts` exige salida JSON estructurada. Cada candidato incluye:

- Categoría raíz cerrada (`categorySlug`).
- Temas libres como géneros, actividades, juegos o franquicias.
- Artistas, bandas, DJs, elencos o invitados.
- Destinos para viajes y tours.
- De 1 a 5 referencias web consultadas.
- Confianza y datos temporales/geográficos.

`src/lib/taxonomy.ts` crea categorías y subcategorías canónicas. Los artistas, destinos y temas siguen almacenados en `topics`; no crear tablas específicas salvo necesidad demostrada.

`saveCandidate()` en `src/lib/events.ts` es el punto común para guardar candidatos del agente. Los eventos con confianza `>= 85` se publican; los demás quedan pendientes.

## Deduplicación

La deduplicación está en `src/lib/events.ts` y cubre datos nuevos e históricos.

Reglas actuales:

- El título se normaliza sin acentos, mayúsculas ni puntuación.
- Los subtítulos posteriores a `—`, `–`, ` - `, `:` o `|` no cambian el título base.
- Si los títulos normalizados son exactamente iguales, se exige el mismo minuto para no fusionar funciones, tours o sesiones diferentes.
- Si una fuente agrega un subtítulo promocional y otra no, se permite una diferencia de hora dentro del mismo día.
- Las ciudades deben coincidir cuando ambas existen.
- Los recintos deben coincidir, contenerse textualmente o faltar en una fuente.
- Si faltan ciudad o recinto y existen varias coincidencias posibles, no se fusiona por adivinación.

Ejemplo cubierto por prueba:

- `RushCon 2026`
- `RushCon 2026 — El Multiverso Friki Más Grande de Chile`

Se consideran el mismo evento si ocurren el mismo día y la ubicación es compatible, aunque las fuentes publiquen horas distintas.

`consolidateDuplicateEvents()` conserva un registro y mueve antes de borrar duplicados:

- Temas (`event_topics`).
- Relaciones con consultas (`discovery_query_events`).
- Fuentes distintas (`event_sources`).
- Observaciones cuando dos fuentes tienen la misma URL normalizada.
- La mejor imagen, descripción, confianza, estado, ubicación y demás datos disponibles.

El detalle público muestra como máximo 4 páginas por evento, priorizando la primaria. La base puede conservar más fuentes para no borrar historial de verificación; no eliminar observaciones solo para cumplir el límite visual.

## Imágenes oficiales

No usar imágenes de stock, genéricas ni de otros eventos. `src/lib/event-images.ts` sigue este orden:

1. Consulta hasta 4 fuentes del evento en paralelo.
2. Extrae imágenes de JSON-LD, Open Graph, Twitter Cards, `img`, atributos lazy, `srcset` y fondos CSS.
3. Valida DNS y bloquea localhost, redes privadas y DNS rebinding; la conexión se fija al IP ya validado.
4. Reparte hasta 12 candidatas entre las cuatro páginas para que una fuente no monopolice la selección.
5. Con una candidata oficial, la usa directamente.
6. Con varias candidatas, OpenAI visión selecciona la que corresponda al título.
7. Sin candidatas extraíbles, OpenAI hace hasta 2 búsquedas web para encontrar una URL directa de afiche, banner o fotografía específica.

El worker ejecuta el backfill después de la verificación para no retrasar comprobaciones temporales. Aprobar un evento desde `/admin` también llama `ensureEventImage()`; un fallo de imagen se registra pero no revierte una aprobación ya guardada.

## Verificación

`src/lib/verification.ts` revisa fuentes por proximidad del evento:

- Hasta 30 días: cada 1 día.
- Hasta 90 días: cada 3 días.
- Más adelante: cada 7 días.

Solo una fuente oficial/confiable puede cambiar fecha o recinto. Una cancelación necesita fuente oficial o evidencia independiente concordante. Las observaciones quedan en `event_source_observations`.

## Modelo de datos

Tablas principales en `src/db/schema.ts`:

- `users`, `accounts`, `sessions`, `verification_tokens`: identidad y Auth.js.
- `topics`, `user_interests`: taxonomía jerárquica y preferencias.
- `events`: registro canónico del evento.
- `event_topics`: temas, artistas, destinos y franquicias por evento.
- `event_sources`: páginas que mencionan el evento.
- `event_source_observations`: evidencia histórica por fuente.
- `sources`: dominios conocidos y nivel de confianza.
- `discovery_queries`, `discovery_query_events`: caché y cobertura programada.
- `agent_runs`: búsquedas, tokens, costo estimado, resultados y errores.
- `search_requests`: telemetría de búsquedas de usuarios con IP en hash HMAC, nunca texto plano.

Después de cambiar el esquema:

```bash
npm run db:generate
npm run db:migrate
```

No editar snapshots de Drizzle manualmente salvo una razón concreta y revisada.

## Autenticación y administración

- Credenciales usan `scrypt` con sal aleatoria.
- OAuth Google y Discord son opcionales.
- El rate limit actual es local al proceso y supone una réplica web.
- No existe recuperación de contraseña porque no hay proveedor de correo.
- El seed crea/actualiza `admin@datito.local` cuando existe `ADMIN_PASSWORD` de al menos 12 caracteres.
- Nunca guardar la contraseña administrativa en Git.
- Panel administrativo: `/admin`.

## Variables de entorno

La lista completa está en `.env.example`.

Esenciales:

- `DATABASE_URL`, `POSTGRES_PASSWORD`.
- `AUTH_SECRET`, `AUTH_URL`.
- `OPENAI_API_KEY`, `OPENAI_MODEL`.
- `AGENT_RUN_SECRET`.
- `ADMIN_PASSWORD` para aprovisionar la cuenta local.

Control del agente:

- `AGENT_ENABLED=false` desactiva nuevas ejecuciones.
- `AGENT_INTERVAL_MINUTES` controla el ciclo del worker (15 minutos por defecto).
- `AGENT_SEARCHES_PER_DAY` y `AGENT_SEARCHES_PER_MONTH`: `0` significa sin límite.
- `AGENT_BOOTSTRAP_SEARCHES_PER_DAY`: `0` también significa sin límite durante la carga inicial.
- `AGENT_SEARCHES_PER_RUN`, `AGENT_SEARCHES_PER_QUERY`, `AGENT_SEARCHES_PER_COVERAGE_QUERY`, `AGENT_QUERIES_PER_RUN`, `AGENT_IMAGES_PER_RUN` y `AGENT_IMAGE_SEARCHES_PER_EVENT` controlan la intensidad de cada ciclo.
- Las tarifas `OPENAI_*_USD_*` alimentan el costo estimado del panel; deben reflejar el modelo/proveedor real.

Los límites de Datito no reemplazan el límite de gasto configurado en OpenAI.

## Desarrollo y validación

Comandos:

```bash
npm install
npm run db:migrate
npm run db:seed
npm run dev
npm test
npx tsc --noEmit
npm run lint
npm run build
npm run worker
```

Antes de cerrar cambios ejecutar como mínimo:

```bash
npx tsc --noEmit
npm test
npm run lint
npm run build
git diff --check
```

Las pruebas actuales viven en `src/lib/events.test.ts` y cubren identidad, variantes de RushCon, horarios separados, imágenes estructuradas/CSS, caché, costos, seguridad temporal, contraseñas y búsqueda local.

## Despliegue

El flujo recomendado está en `docker-compose.yml`:

- `db`: PostgreSQL con volumen persistente.
- `web`: migra, ejecuta seed y arranca Next.js.
- `worker`: espera el health check de web y ejecuta `npm run worker`.

EasyPanel despliega `main` desde `git@github.com:KalciferTolueno/gustos.git`. El volumen `postgres-data` requiere backups externos y pruebas periódicas de restauración.

## Decisiones e invariantes

- Nombre público: Datito.
- Mantener el nombre histórico de repo/base hasta planificar una migración.
- Cobertura nacional: trimestre actual más los cuatro siguientes, con fechas explícitas.
- Una salida fechada de un tour es un evento; itinerario/destinos son temas y descripción.
- La hora/minuto sigue siendo significativa para títulos exactamente iguales.
- Las variantes con subtítulo pueden unirse por día para tolerar discrepancias entre fuentes.
- Máximo 4 fuentes visibles por evento.
- No perder observaciones al consolidar.
- No publicar imágenes de stock.
- No almacenar IP en texto plano.
- No añadir una dependencia si la plataforma o una dependencia instalada resuelve el problema.
- `gustos-react-shadcn.zip` es un archivo local no versionado y debe seguir fuera de commits.

## Historial funcional reciente

- Catálogo autónomo, fuentes, observaciones, búsqueda y verificación.
- Tarjetas con imágenes oficiales y cinco columnas en escritorio.
- Taxonomía jerárquica, cobertura nacional trimestral y refresco adaptativo.
- Telemetría de búsquedas/tokens/costos y panel administrativo.
- Cambio de marca de Gustos a Datito.
- Consolidación de duplicados con hasta cuatro fuentes visibles.
- Selección visual y búsqueda web de imágenes oficiales.
- Caso RushCon 2026 documentado y cubierto por regresión.
