# Product

<!-- impeccable:product-schema 1 -->

## Platform

android

## Stack

Expo + React Native (TypeScript, Expo Router). Backend: Supabase (Auth, Postgres, RLS, Realtime, Storage). Elegido por el usuario. Desktop a futuro vía Expo web empaquetado (Tauri/Electron), sin reescritura.

## Users

Una pareja (el usuario y su esposa) que comparte hogar. Usan la app a diario desde sus celulares Android: en la casa (al terminar una tarea, al llegar del mercado), en la calle (al pagar algo, al tanquear) y en momentos de revisión (fin de mes, antes de un mantenimiento). A futuro pueden sumarse más integrantes al hogar.

## Product Purpose

Nido centraliza la vida cotidiana del hogar en un solo lugar: tareas personales y compartidas, hábitos individuales, finanzas personales y familiares, y los vehículos de la familia con sus gastos y mantenimientos. El éxito es que ambos la usen todos los días sin fricción, sepan qué falta por hacer y quién lo hizo, y puedan responder "¿cuánto hemos gastado?" o "¿cuándo toca el aceite?" sin buscar en otro lado.

## Positioning

No es un gestor de tareas ni una app de finanzas genérica: es el registro compartido de un hogar concreto. Todo movimiento económico existe una sola vez (un cambio de aceite es a la vez historial del vehículo y gasto del hogar), cada acción queda firmada por quien la hizo, y la información personal de cada integrante permanece privada aunque compartan hogar.

## Operating Context

- Registro rápido en movimiento: una mano, segundos, a veces sin buena señal (la app muestra lo último cargado y sincroniza al volver).
- Tareas domésticas recurrentes (platos, ropa, basura) que a futuro se completan escaneando un código QR pegado en el lugar.
- Revisión periódica: balances mensuales y anuales, historial de mantenimientos, próximos vencimientos (SOAT, tecnomecánica).
- Contexto colombiano: moneda COP, documentos vehiculares SOAT y revisión técnico-mecánica, motos y carros.

## Capabilities and Constraints

- Inicio de sesión con email y contraseña (Supabase Auth).
- Hogar con N integrantes; hoy dos.
- Visibilidad por registro: personal (solo su dueño) o compartida (todo el hogar). Un integrante nunca puede leer lo personal de otro.
- Online con caché: no es offline-first.
- MVP: hogares, tareas, hábitos, finanzas, vehículos y sus gastos.
- Fase posterior: QR (escaneo y generación/impresión), notificaciones push y locales, mantenimientos programados con alertas, reportes avanzados.
- Idioma: español. Moneda por defecto: COP.

## Brand Commitments

- Nombre: **Nido**.
- El usuario pidió una identidad visual propia, que no parezca un gestor de tareas ni un dashboard financiero genérico, con microinteracciones sutiles, rápidas y respetuosas de "reducir movimiento".

## Evidence on Hand

Ninguna todavía: sin logo, sin datos reales. Los datos de ejemplo en desarrollo serán sintéticos.

## Product Principles

1. Un registro, un lugar: nada se duplica entre módulos.
2. Cada acción tiene autor: quién lo hizo y cuándo siempre es visible.
3. Lo privado es privado por defecto en la base de datos, no solo en la interfaz.
4. Registrar algo toma segundos; consultar a fondo es opcional.
5. Crecer sin rehacer: más integrantes, más módulos y desktop sin cambiar la estructura.

## Accessibility & Inclusion

Respetar el ajuste de reducir/quitar animaciones del sistema y el tamaño de fuente del sistema (sp). Objetivos táctiles de 48dp.
