# Cómo continuar Nido en otro PC

## Dónde quedamos (9 nov 2026)

| Hecho | Archivo |
|---|---|
| Contexto de producto | [PRODUCT.md](../PRODUCT.md) |
| Arquitectura, navegación, UX y plan por fases | [docs/ARQUITECTURA.md](ARQUITECTURA.md) |
| Migración SQL del MVP con RLS, probada con 34 casos en Postgres embebido | [supabase/migrations/20261109000000_mvp.sql](../supabase/migrations/20261109000000_mvp.sql) |
| Dirección visual elegida: **Línea de metro** (contrato de diseño) | [.impeccable/surfaces/app-app-tabs-index-tsx.md](../.impeccable/surfaces/app-app-tabs-index-tsx.md) |
| Bocetos de la ronda de diseño (abrir en el navegador) | [.impeccable/mocks/decision/](../.impeccable/mocks/decision/) |
| Proyecto Expo SDK 58 con dependencias declaradas | [package.json](../package.json) |

**Fase 0 lista y probada (10 nov 2026):** los dos crearon cuenta en Expo Go, uno creó el hogar, el otro se unió con código y ambos ven sus líneas en Hoy.

**Migraciones aplicadas en Supabase** (se aplican a mano en *SQL Editor*; el proyecto no tiene la CLI vinculada):
- `20261109000000_mvp.sql`
- `20261110000000_ensure_profile.sql`: crea perfiles faltantes y hace que `create_household`/`join_household` garanticen el perfil.

**Configuración de Supabase:** *Confirm email* desactivado mientras desarrollan.

Lo que contiene la fase 0:
- `src/lib/`: cliente de Supabase (AsyncStorage + refresco con AppState) y QueryClient.
- `src/ui/`: tokens "Línea de metro" claro/oscuro, primitivas (Text, Button, TextField, Screen, Avatar), metro (Station, Line, LinePlate, MetroDiagram, NidoMark), barra de navegación M3 y estados vacíos.
- `src/features/session` y `src/features/household`: sesión, auth, hogar, integrantes, invitaciones y color de línea.
- `src/app/`: `Stack.Protected` en el layout raíz → `(auth)` · `(onboarding)` · `(app)` con 5 pestañas y `hogar`.
- Nota SDK 58: las pestañas JS se importan desde `expo-router/js-tabs`, y la barra personalizada usa `emitter` + `navigateToTab`.

**Fase 1 (Tareas) lista y probada (10 nov 2026)** en los dos celulares, con sincronización en tiempo real:
- `src/lib/recurrence.ts`: subconjunto propio de RRULE (diaria, semanal por días, mensual, con intervalo), sin la librería `rrule`. `src/lib/dates.ts` y `useToday`.
- `src/features/tasks/`: `derive.ts` calcula el estado del día (atrasadas · hoy · próximas · sin fecha · hechas) a partir de la tarea y sus cumplimientos; API, hooks con completar/deshacer optimista y Realtime (`tasks` y `task_completions`).
- Pantallas: pestaña Tareas (filtro Mías/Compartidas/Todas, grupos, botón +), `tareas/nueva`, `tareas/[id]` (detalle e historial, archivar, borrar) y `tareas/[id]/editar`.
- Hoy: estaciones reales en la línea de cada integrante y en el tronco; tocar una estación la completa o la deshace.
- No requirió migración: el esquema, la RLS y Realtime ya estaban en la migración MVP.
- Criterio de listo: una tarea que completa uno aparece hecha en el celular del otro en segundos.

**Fase 2 (Hábitos) lista y probada (10 nov 2026):**
- `src/features/habits/stats.ts`: progreso del período (día, semana o mes), racha actual, récord, porcentaje y estado de cada día; todo calculado de `habit_logs`, nada guardado.
- Registro: un toque suma 1 (upsert de la fila del día); −1 resta y en 0 borra la fila. Solo el dueño registra (RLS).
- Línea circular de la semana (`HabitRing`): el anillo se llena con el progreso y sus 7 estaciones son lunes a domingo.
- Pantallas: pestaña Hábitos (mis hábitos, los que hoy no tocan y los compartidos de la pareja), `habitos/nuevo`, `habitos/[id]` (anillo, −1/+1, racha, récord, porcentajes, calendario mensual, registrar un día pasado) y `habitos/[id]/editar`.
- Hoy: la tarjeta Hábitos muestra los cumplidos del día y suma con un toque.
- Realtime sobre `habit_logs` (sin filtro: la tabla no tiene `household_id`; la RLS decide qué llega).
- No requirió migración.
- Criterio de listo: una semana de uso real muestra racha y porcentaje correctos.

**Fase 3 (Finanzas) lista y probada (10 nov 2026)**; el criterio de "un mes que cuadra" se confirma con el uso:
- `src/lib/money.ts`: formato COP propio (`$ 180.000`, `$ 1,3 M`, `$ 850 mil`) y lectura de lo que se escribe.
- `src/features/finance/summary.ts`: balance (libre = ingresos − gastos − ahorro), agrupación por día, por categoría y por mes, y progreso de metas (suma de aportes; nada guardado).
- Registro rápido `dinero/nuevo`: teclado numérico abierto, Gasto/Ingreso/Ahorro, categorías con ícono (sin elegir = "Otros"), fecha, Del hogar/Solo mío. Editar y borrar en `dinero/[id]` (borrar solo el autor).
- Pestaña Dinero: selector Hogar/Personal (`visibility`), mes navegable, balance y vistas Movimientos (por día, firmados con el color de quien registró) · Metas · Reportes (barras por categoría y columnas de 12 meses, una serie en azul del tronco; tocar una columna elige el mes).
- Metas: `dinero/metas/nueva`, detalle con aportar/retirar e historial, editar, archivar y borrar.
- Hoy: la tarjeta El mes muestra lo gastado frente al mismo tramo del mes pasado y la meta principal.
- Realtime sobre `transactions`. No requirió migración.
- Pendiente para después: categorías propias del hogar (la tabla ya lo permite).
- Criterio de listo: un mes registrado cuadra con lo que gastaron de verdad.

**Fase 4 (Vehículos) lista y probada (10 nov 2026):**
- Sin fotos de vehículos (decisión del 10 nov 2026: no gastar almacenamiento). Las tablas `attachments` y el bucket `media` siguen en la base, sin uso.
- `src/features/vehicles/`: vehículos, historial con su movimiento vinculado (`transaction:transactions(...)`; si es personal de otra persona la RLS lo oculta y se muestra "Valor privado"), totales por vehículo y por tipo, y línea de kilometraje.
- Registrar usa la RPC `create_vehicle_expense`: el gasto queda una sola vez, en el vehículo y en Dinero (categoría Vehículos). Editar crea, actualiza o quita el gasto según el valor; borrar el registro borra también el gasto si es tuyo.
- Línea de kilometraje: últimos registros con km, la posición actual y el próximo aceite estimado (último aceite + 3.000 km moto / 5.000 km carro). La fase 8 lo vuelve configurable.
- Pantallas: pestaña Garaje (tarjetas con ícono, km, gasto del año y aceite estimado), `garaje/nuevo`, `garaje/[id]` (perfil, actualizar km, gasto por tipo, historial filtrable), `garaje/[id]/editar`, `garaje/registro/nuevo` y `garaje/registro/[id]`.
- Realtime sobre `vehicle_records` y cambios de `transactions`. No requirió migración.
- Criterio de listo: el cambio de aceite aparece en la moto y en Dinero una sola vez.

**Teclado (10 nov 2026):** con el modo de borde a borde de Android (SDK 58) la ventana no se encoge con el teclado. `Screen` usa `KeyboardAvoidingView` con `padding` en ambas plataformas (descontando la barra superior) y desplaza el campo enfocado a la vista; `TextField` lo pide al enfocarse. Campos de texto propios: llamar `useRevealFocused()` en `onFocus`.

**Recordatorios locales (adelanto de la fase 7, 10 nov 2026), probados (llega el aviso de prueba):**
- Expo Go falla al crear el canal de Android (`NullPointerException` nativo en `setNotificationChannelAsync`). `ensureChannel` lo crea con lo mínimo y, si falla, usa el canal por defecto de Expo. Revisar con la APK que el canal "Recordatorios" sí se cree.
- Dependencia `expo-notifications` (~58.1.8). Los recordatorios locales funcionan en Expo Go; los push no (Android, desde SDK 53).
- `src/features/notifications/`: `plan.ts` (puro) decide qué avisar; `scheduler.ts` agenda/cancela solo lo de Nido (identificadores `nido-…`, con huella para no reagendar lo que no cambió); `useReminders.ts` reagenda al cambiar datos o volver a la app, y abre la tarea o el hábito al tocar el aviso.
- Tareas con hora (mías y compartidas, próximos 7 días, con anticipación de 0/10/30/60 min) y hábitos propios con `reminder_at` (diario o semanal según sus días). Máximo 60 agendados.
- Preferencias en el celular (AsyncStorage), pantalla `recordatorios` desde Hogar, con aviso de prueba. Al cerrar sesión se cancelan.
- Pendiente (con la APK): push "tu pareja completó…" = tokens + webhook de `task_completions` → Edge Function → Expo Push.

**Fase 5 (Hoy completo + pulido) lista y probada en Expo Go (10 nov 2026); falta generar la APK:**
- Hoy: "Se viene" (tareas de los próximos 3 días, aceite a ≤300 km o vencido, metas con fecha en ≤30 días) y "La casa" (completados, movimientos y registros de vehículo de los últimos 2 días, firmados con el color de quien lo hizo). Lógica pura en `src/features/today/feed.ts`.
- Botón + de Hoy con menú: tarea, gasto, ingreso, hábito y gasto de vehículo (si hay vehículos). Atrás cierra el menú.
- Movimiento: pestañas con desplazamiento corto (`shift`, ninguno con "quitar animaciones"), esqueletos de carga (`Skeleton`, `SkeletonRows`) y conteo animado de totales (`useCountUp`).
- APK: `eas.json` con perfil `preview` (APK de distribución interna). Plugin de `expo-notifications` en `app.json` (ícono monocromo, color del tronco, canal `recordatorios`).

**Generar la APK en el PC (Android Studio, sin EAS) — forma principal:**
- Requisitos instalados: Android Studio (su Java `jbr`, JDK 25, funciona con Gradle 9.4.1), SDK, y **CMake 3.31.6** desde SDK Manager → SDK Tools → Show Package Details. No usar CMake 4.x.
- Windows: con el CMake 3.22.1 por defecto falla con `Filename longer than 260 characters` (ninja 1.10 no soporta rutas largas). CMake 3.31.6 trae ninja 1.12.1, que sí. `LongPathsEnabled` ya está en 1.
- `android/` se genera con `npx expo prebuild -p android` (está en `.gitignore`) y **se regenera desde cero**: no editarlo a mano. El plugin `plugins/withLocalAndroidBuild.js` (en `app.json`) aplica en cada prebuild:
  - `reactNativeArchitectures=arm64-v8a` (más rápido; los celulares actuales son arm64).
  - En Windows, `android/local.properties` con `sdk.dir` y `cmake.dir` (CMake 3.31.6), si existen.
- Después de cambiar íconos, `app.json` o dependencias nativas: `npx expo prebuild -p android` y volver a compilar.
- `expo-system-ui` instalado: sin él, la APK no sigue el modo oscuro del celular.
- Compilar (PowerShell): `$env:JAVA_HOME="C:\Program Files\Android\Android Studio\jbr"; cd android; .\gradlew.bat assembleRelease` → `android/app/build/outputs/apk/release/app-release.apk` (~40 MB). El `.env` se lee solo.
- La APK se firma con la clave de depuración: sirve para instalar en los dos celulares, no para Play Store.

**Inicio animado (10 nov 2026):** el splash nativo muestra la marca como rieles tenues (30 %); `src/ui/AnimatedSplash.tsx` arranca idéntico (mismo tamaño 160 dp y centro), llena las líneas de color, cierra la estación y muestra "Nido"; se queda hasta que la app está lista y se desvanece. Respeta "quitar animaciones". La geometría compartida está en `src/ui/metro/markGeometry.ts`. En Expo Go primero se ve la pantalla de carga de Expo Go (no se puede cambiar).

**Selector de hora:** `@react-native-community/datetimepicker` (incluido en Expo Go). `TimeField` abre el reloj nativo de Android; se usa en la hora de las tareas y en el recordatorio de los hábitos.

**Ícono y splash:** marca "Línea de metro" (dos líneas, naranja y verde azulado, que se unen en el tronco azul y terminan en una estación). Se generan con `node scripts/generate-icons.mjs` (sin dependencias) en `assets/`: ícono, adaptativo de Android (frente, fondo, monocromo), splash y favicon. La misma marca está en la app (`src/ui/metro/NidoMark.tsx`).

**Generar la APK con EAS (nube; alternativa, necesita la cuenta de Expo):** ojo, el `.env` no se sube; si faltan las variables en EAS la app abre con "Faltan EXPO_PUBLIC_SUPABASE_URL…".
1. `npx eas-cli@latest login`
2. `npx eas-cli@latest init` (vincula el proyecto; agrega `extra.eas.projectId` a `app.json`).
3. Variables de entorno en EAS (el `.env` no se sube): `npx eas-cli@latest env:create --environment preview --name EXPO_PUBLIC_SUPABASE_URL --value <url> --visibility plaintext` y lo mismo para `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
4. `npx eas-cli@latest build -p android --profile preview` → enlace para descargar e instalar la APK en ambos celulares.

**Siguiente:** con la APK y el `projectId`, los push de la pareja (tokens + webhook de `task_completions` → Edge Function → Expo Push).

> Si Metro dice `Unable to resolve` con un archivo que sí existe (pasa en Windows al crear varios archivos seguidos), reinicia con `npx expo start -c`.

**No verificado:** si la migración ya se aplicó en Supabase. Revisa en *Table Editor* si existen las tablas `households`, `tasks`, etc.

---

## Paso a paso en el PC nuevo

1. **Instala** Node.js 22 LTS, Git y Claude Code.
2. **Clona e instala:**

   ```bash
   git clone https://github.com/adraw-dev/nido.git
   ```

   ```bash
   cd nido && npm install
   ```

3. **Variables de entorno:** copia `.env.example` como `.env` y pega la *anon key*. Está en Supabase → *Project Settings → API*. La key no se sube al repo.
4. **Base de datos** (si no lo hiciste antes): en Supabase → *SQL Editor → New query*, pega el contenido de `supabase/migrations/20261109000000_mvp.sql` y dale *Run*.
5. **Correos de confirmación** (recomendado mientras desarrollan): en Supabase → *Authentication → Sign In / Providers → Email*, desactiva *Confirm email*. Si lo dejas activo, el enlace del correo apunta a localhost y no abre la app.
6. **Abre Claude Code** en la carpeta `nido` y pega el prompt de abajo.
7. Cuando Claude termine la fase 0, arranca el servidor tú mismo y escanea el QR con **Expo Go**. Celular y PC deben estar en la misma red Wi-Fi; en redes corporativas usa `--tunnel`.

   ```bash
   npx expo start
   ```

> **Si `npx expo install` falla con `self-signed certificate in certificate chain`:** es el proxy de la red. Pide a TI el certificado raíz y define `NODE_EXTRA_CA_CERTS=<ruta-al-certificado>`, o usa `EXPO_OFFLINE=1 npx expo install <paquetes>`.

---

## Prompt para pegar en Claude Code

```text
Vamos a continuar la app "Nido" (gestión del hogar en pareja: tareas, hábitos, finanzas y vehículos). Ya existe una propuesta aprobada; no la rediseñes, impleméntala.

Lee primero, en este orden:
1. PRODUCT.md: contexto del producto.
2. docs/ARQUITECTURA.md: estructura, modelo de datos, RLS, navegación y plan por fases.
3. supabase/migrations/20261109000000_mvp.sql: esquema real (tablas, RLS, RPCs create_household, join_household, create_vehicle_expense).
4. .impeccable/surfaces/app-app-tabs-index-tsx.md: contrato de diseño "Línea de metro" (colores, tipografía, estados de estación, movimiento firma). Toda la UI debe seguirlo.
5. AGENTS.md: reglas de Expo SDK 58. Consulta https://docs.expo.dev/llms.txt antes de usar APIs de Expo; no confíes en la memoria.

Hechos ya verificados:
- Expo SDK 58, React Native 0.88, Expo Router. Las rutas van en src/app/. El resto (features, ui, lib) va fuera de src/app.
- Auth en Expo Router SDK 58: Stack.Protected con guard={...} en el layout raíz (no Redirect).
- Fuentes: useFonts de @expo-google-fonts/schibsted-grotesk y @expo-google-fonts/roboto + expo-splash-screen (funciona en Expo Go).
- Tabs JS: import { Tabs } from 'expo-router' (vienen incluidas desde SDK 56).
- Supabase: URL y anon key en .env como EXPO_PUBLIC_SUPABASE_URL y EXPO_PUBLIC_SUPABASE_ANON_KEY. Sesión en AsyncStorage + react-native-url-polyfill.
- app.json está mínimo: complétalo (name "Nido", slug "nido", scheme "nido", userInterfaceStyle "automatic", experiments.typedRoutes, android.predictiveBackGestureEnabled true, íconos de ./assets).

Tarea: implementar la FASE 0 completa.
1. Configuración: tsconfig con alias @/* -> src/*, app.json completo, src/lib/supabase.ts (AsyncStorage, autoRefresh con AppState), src/lib/query.ts (TanStack Query).
2. Sistema de diseño en src/ui/:
   - tokens.ts: colores del contrato, claro y oscuro, colores de línea por persona y tronco compartido azul #3B5BDB.
   - Primitivas: Text, Button, TextField, Screen.
   - Componentes metro con react-native-svg + Reanimated: Line, Station (estados pendiente/hecha/atrasada/saltada), LinePlate.
   - Movimiento que respete "reducir animaciones" (useReducedMotion).
3. Sesión: provider con supabase.auth.onAuthStateChange. Layout raíz con Stack.Protected:
   - sin sesión -> (auth)
   - con sesión sin hogar -> (onboarding)
   - con hogar -> (app)
4. Pantallas:
   - (auth)/entrar y (auth)/crear-cuenta: email, contraseña y nombre (display_name en metadata).
   - (onboarding): crear hogar (rpc create_household) o unirse con código (rpc join_household).
   - (app)/(tabs): Hoy, Tareas, Hábitos, Dinero, Garaje. Hoy muestra el diagrama de líneas con los integrantes reales y un estado vacío bonito; las demás pestañas quedan como estado vacío.
   - (app)/hogar: integrantes, elegir mi color de línea (profiles.accent), generar código de invitación (insert en household_invites), copiarlo (expo-clipboard) y cerrar sesión.
5. Verifica con npm run typecheck y npx expo lint antes de decir que terminaste.

Criterio de listo: mi esposa y yo creamos cuenta desde nuestros celulares con Expo Go, uno crea el hogar, el otro se une con el código y ambos ven las dos líneas en Hoy.

Cómo trabajo:
- Si un comando falla por red, proxy, certificados o entorno, para y pregúntame antes de probar alternativas.
- El servidor de Expo lo arranco yo: dime cuándo está listo para probar.
- Responde en español.
- Usa la skill de diseño "impeccable" si está disponible.
```

---

## Fases siguientes (resumen; detalle en ARQUITECTURA.md §6)

| Fase | Qué |
|---|---|
| 1 | Tareas: CRUD, asignación, recurrencia RRULE, completar/deshacer, historial, realtime |
| 2 | Hábitos: registro diario, rachas, línea circular de la semana |
| 3 | Finanzas: movimientos, categorías, Hogar/Personal, metas, reportes |
| 4 | Vehículos: perfiles, historial, gasto vinculado (create_vehicle_expense), línea de kilometraje |
| 5 | Hoy completo + pulido de movimiento → **MVP en APK** |
| 6–9 | QR, notificaciones, mantenimientos programados, reportes y desktop |

Al empezar cada fase, pega en Claude Code: *"Lee docs/CONTINUAR.md y docs/ARQUITECTURA.md e implementa la fase N"*.
