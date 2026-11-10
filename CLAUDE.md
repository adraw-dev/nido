# Nido

App Android (Expo SDK 58 + Supabase) para organizar el hogar en pareja: tareas, hábitos, finanzas y vehículos.

- Estado actual y siguiente paso: `docs/CONTINUAR.md`
- Producto: `PRODUCT.md` · Arquitectura y fases: `docs/ARQUITECTURA.md`
- Esquema y RLS: `supabase/migrations/`
- Contrato de diseño "Línea de metro": `.impeccable/surfaces/app-app-tabs-index-tsx.md`
- Reglas de Expo: `AGENTS.md`

Reglas de trabajo:
- Responder en español.
- Si un comando falla por red, proxy o certificados, parar y preguntar antes de probar alternativas.
- El usuario arranca el servidor de Expo; avisarle cuándo probar.
- Antes de terminar una tarea: `npm run typecheck` y `npx expo lint`.
