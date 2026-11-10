<div align="center">

<img src="assets/icon.png" alt="Logo de Nido" width="128" />

# Nido

**La casa de los dos, en una sola línea.**

Tareas, hábitos, finanzas y vehículos del hogar, compartidos en pareja y sincronizados en tiempo real.

<br />

![Android](https://img.shields.io/badge/Android-3DDC84?style=for-the-badge&logo=android&logoColor=white)
![Expo](https://img.shields.io/badge/Expo_SDK_58-000020?style=for-the-badge&logo=expo&logoColor=white)
![React Native](https://img.shields.io/badge/React_Native-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-3FCF8E?style=for-the-badge&logo=supabase&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)

![TanStack Query](https://img.shields.io/badge/TanStack_Query-FF4154?style=flat-square&logo=reactquery&logoColor=white)
![Reanimated](https://img.shields.io/badge/Reanimated_4-6E40C9?style=flat-square&logo=react&logoColor=white)
![Zod](https://img.shields.io/badge/Zod-3E67B1?style=flat-square&logo=zod&logoColor=white)
![date-fns](https://img.shields.io/badge/date--fns-770C56?style=flat-square&logo=datefns&logoColor=white)
![Android Studio](https://img.shields.io/badge/Android_Studio-3DDC84?style=flat-square&logo=androidstudio&logoColor=white)

</div>

---

## Qué es

Nido es una app Android para que una pareja organice su casa sin mandarse mensajes sueltos. Cada integrante tiene su propia **línea de color**, como en un mapa de metro, y la pantalla **Hoy** junta las líneas de los dos en un solo recorrido: lo que toca hoy, lo que viene y lo que el otro acaba de hacer.

## Módulos

| | Módulo | Qué hace |
|:-:|---|---|
| 🏠 | **Hoy** | Diagrama de metro del día, hábitos pendientes, resumen del mes, lo que viene y la actividad de la casa. Atajo rápido para agregar cualquier cosa. |
| ✅ | **Tareas** | Tareas compartidas o personales, con responsable, hora y repetición. |
| 🔁 | **Hábitos** | Línea circular de la semana, rachas, calendario del mes y recordatorio a la hora que elijas. |
| 💰 | **Dinero** | Ingresos y gastos del hogar y personales, categorías, gráficas del mes y metas de ahorro. |
| 🚗 | **Garaje** | Vehículos, kilometraje e historial de mantenimientos, con su gasto enlazado a finanzas. |

Además: hogar compartido por invitación, sincronización en tiempo real entre los dos celulares, recordatorios locales, modo oscuro, inicio animado con la marca y respeto por "quitar animaciones".

## Stack

| Capa | Herramientas |
|---|---|
| App | Expo SDK 58 · React Native 0.88 · React 19 · Expo Router · TypeScript |
| Datos | Supabase: Auth, Postgres con RLS, Realtime · TanStack Query |
| Interfaz | Reanimated 4 · react-native-svg · expo-haptics · Schibsted Grotesk y Roboto |
| Utilidades | zod · date-fns · expo-notifications · datetimepicker |

Todo lo calculado (rachas, saldos, próximas fechas de las repeticiones) se deriva en el cliente; la base guarda solo los hechos.

## Correr en desarrollo

Requisitos: Node.js 22 LTS, un proyecto de Supabase y Expo Go en el celular.

```bash
npm install
```

```bash
cp .env.example .env
```

Pega en `.env` la anon key de Supabase (*Project Settings → API*) y aplica las migraciones de [`supabase/migrations/`](supabase/migrations) en el *SQL Editor*, en orden.

```bash
npx expo start
```

Escanea el código QR con Expo Go. Si Metro no encuentra un archivo que sí existe, reinicia con `npx expo start -c`.

## Compilar la APK

En el PC, con Android Studio (JDK incluido), el SDK de Android y CMake 3.31.6:

```bash
npx expo prebuild -p android
```

```powershell
$env:JAVA_HOME="C:\Program Files\Android\Android Studio\jbr"; cd android; .\gradlew.bat assembleRelease
```

La APK queda en `android/app/build/outputs/apk/release/app-release.apk` y lee las variables del `.env`. Los detalles (rutas largas en Windows, firma, alternativa con EAS) están en [docs/CONTINUAR.md](docs/CONTINUAR.md).

## Estructura

```
src/
├── app/          Rutas (Expo Router): entrar, hogar y las pestañas
├── features/     Un módulo por dominio: tasks, habits, finance, vehicles, today…
├── lib/          Supabase, fechas, repeticiones, dinero
└── ui/           Sistema de diseño "Línea de metro": tokens, primitivas, estaciones
supabase/
├── migrations/   Esquema y políticas RLS
└── scripts/      Utilidades para correr a mano (limpiar datos de prueba)
```

## Documentación

- [docs/CONTINUAR.md](docs/CONTINUAR.md): estado actual y siguiente paso.
- [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md): arquitectura y fases.
- [PRODUCT.md](PRODUCT.md): producto.

## Lo que viene

- Avisos push cuando la pareja completa una tarea.
- Invitación por código QR.
- Mantenimientos programados por kilómetros o fecha.
- Reportes del mes.
- Versión de escritorio.
