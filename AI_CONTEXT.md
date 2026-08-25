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
- React Bits Side Rays sobre OGL para el fondo WebGL de la portada.
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
- `/api/admin/catalog-audit`: ejecuta manualmente el siguiente registro pendiente de la auditoría integral; requiere sesión administradora.

Sin `DATABASE_URL`, la portada usa eventos de demostración. El agente requiere PostgreSQL y `OPENAI_API_KEY`.

### Interfaz pública y carga visual

- `src/components/Dashboard.tsx` monta `SideRays` como una capa fija detrás de la interfaz y conserva el contenido interactivo en una capa superior.
- `src/components/SideRays.jsx` y `SideRays.css` provienen del registro `@react-bits/SideRays-JS-CSS`; `components.json` conserva el registro `@react-bits` y `ogl` es una dependencia de producción.
- La configuración visual usa origen inferior izquierdo, velocidad `2.5`, intensidad `2`, expansión `2`, mezcla `0.75`, caída `1.6`, saturación `1.5` y colores `#EAB308`/`#96C8FF`.
- Navegación, hero, aviso de demostración y filtros tienen una entrada escalonada mediante `transform` y `opacity`.
- `src/components/EventTile.tsx` usa `IntersectionObserver` para revelar cada tarjeta y no monta su `Image` hasta que se acerca al viewport.
- Las solicitudes de imágenes se separan 130 ms dentro de cada fila. Mientras cargan se muestra un lavado tonal estable; la imagen aparece después de `onLoad` con decodificación asíncrona.
- `prefers-reduced-motion` elimina Side Rays, evita las transiciones automáticas y quita la espera artificial antes de solicitar imágenes.

No convertir todas las imágenes de eventos en `eager` ni volver a montar las 25 imágenes de una página al mismo tiempo. El escalonamiento es una decisión deliberada de rendimiento percibido y debe conservarse al modificar `EventTile`.

### Worker

`src/worker.ts` se ejecuta inmediatamente al iniciar y después cada `AGENT_INTERVAL_MINUTES`:

1. Garantiza la taxonomía canónica.
2. Mantiene las consultas programadas de cobertura.
3. Recupera consultas que quedaron bloqueadas en `running`.
4. Consolida hasta 20 grupos de eventos duplicados.
5. Audita uno por uno los eventos existentes que no hayan pasado la versión actual de reglas.
6. Verifica el siguiente evento vencido.
7. Completa imágenes de hasta 4 eventos sin imagen.
8. Ejecuta hasta 4 consultas de descubrimiento vencidas.

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

Antes de publicar, `src/lib/event-source-validation.ts` descarga la página viva con protección SSRF y exige que su contenido contenga los términos distintivos del título. Una URL encontrada o citada por el buscador no basta: si la página cambió, fue reutilizada o sirve contenido distinto al índice, el evento no se publica. El worker rota por las fuentes guardadas; pone en pendiente cualquier evento cuya página ya no corresponda y solo lo republica tras encontrar y validar otra fuente.

## Deduplicación

La deduplicación está en `src/lib/events.ts` y cubre datos nuevos e históricos.

Reglas actuales:

- El título se normaliza sin acentos, mayúsculas ni puntuación.
- Los subtítulos posteriores a `—`, `–`, ` - `, `:` o `|` no cambian el título base.
- Si los títulos normalizados son exactamente iguales, se exige el mismo minuto para no fusionar funciones, tours o sesiones diferentes.
- Si una fuente agrega un subtítulo promocional y otra no, se permite una diferencia de hora dentro del mismo día.
- Las ciudades deben coincidir cuando ambas existen.
- Los recintos deben coincidir, contenerse textualmente o faltar en una fuente.
- Los rangos se consideran completos: una ficha que comienza dentro del rango de otra se fusiona cuando comparte la misma URL específica, o cuando título y recinto coinciden exactamente.
- Dos funciones recurrentes con rangos que no se superponen permanecen separadas aunque reutilicen título o URL.
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
7. Si las candidatas extraíbles no corresponden inequívocamente, o no existe una fuente específica todavía, OpenAI busca en la web una URL directa de afiche, banner o fotografía específica. Nunca se usa una imagen solo porque tenga un formato válido.

El worker ejecuta el backfill después de la verificación para no retrasar comprobaciones temporales. Aprobar un evento desde `/admin` también llama `ensureEventImage()`; un fallo de imagen se registra pero no revierte una aprobación ya guardada.

Al iniciar cada ciclo, el worker marca como `expired` y `completed` los eventos publicados o pendientes cuya última fecha terminó antes de hoy en `America/Santiago`. La consulta pública y el detalle aplican además el mismo límite directamente en PostgreSQL: un evento de hoy permanece visible todo el día, un evento de varios días permanece hasta su fecha final y ninguno depende de que el worker ya haya alcanzado a limpiarlo.

## Auditoría completa del catálogo

`src/lib/catalog-audit.ts` recorre uno por uno todos los eventos publicados, actuales o futuros. También rescata registros marcados como vencidos durante los últimos tres años cuando no tenían `endsAt`, porque pueden ser exposiciones o actividades de larga duración cuyo término se omitió. Cada registro pasa por validación de la página viva, verificación temporal, selección visual y ubicación. `events.catalog_audit_version` y `catalog_audited_at` forman un cursor persistente: los reinicios continúan donde quedó el worker y los fallos se reintentan sin bloquear el resto del catálogo. Una fuente incorrecta pone el evento en pendiente inmediatamente; una imagen dudosa se elimina; las coordenadas solo sobreviven si son exactas y están en Chile.

Cuando una nueva corrección deba aplicarse retroactivamente, incrementar `CATALOG_AUDIT_VERSION`. La variable `AGENT_CATALOG_AUDITS_PER_RUN` controla cuántos registros se revisan por ciclo (1 por defecto para limitar costo y carga). Las actualizaciones relevantes y aprobaciones manuales reinician la versión del registro a 0.

## Verificación

`src/lib/verification.ts` revisa fuentes por proximidad del evento:

- Hasta 30 días: cada 1 día.
- Hasta 90 días: cada 3 días.
- Más adelante: cada 7 días.

Una página primaria específica, consultada y con confianza alta puede completar o corregir `startsAt` y `endsAt`; la fuente debe aportar siempre el rango total y distinguirlo del horario diario. Solo una fuente oficial/confiable puede cambiar recinto o confirmar estados sensibles. Una cancelación necesita fuente oficial o evidencia independiente concordante. Las observaciones quedan en `event_source_observations`.

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
- El panel muestra los eventos restantes de `CATALOG_AUDIT_VERSION` y permite auditar manualmente el siguiente registro sin esperar al worker.

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
- `AGENT_SEARCHES_PER_RUN`, `AGENT_SEARCHES_PER_QUERY`, `AGENT_SEARCHES_PER_COVERAGE_QUERY`, `AGENT_QUERIES_PER_RUN`, `AGENT_IMAGES_PER_RUN`, `AGENT_IMAGE_SEARCHES_PER_EVENT` y `AGENT_CATALOG_AUDITS_PER_RUN` controlan la intensidad de cada ciclo.
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
