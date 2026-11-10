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

**Falta:** todo el código de la app (fase 0 en adelante). Todavía no existe la carpeta `src/`.

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
