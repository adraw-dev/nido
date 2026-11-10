---
version: 1
slug: "app-app-tabs-index-tsx"
primary_target: "app/(app)/(tabs)/index.tsx"
related_targets: []
---

# Surface: Hoy (y sistema de la app)

Modo: Operate. Plataforma: Android (Material 3 como estructura). Build: code-led.

Audiencia y tarea: la pareja abre Hoy varias veces al día para ver qué falta, qué hizo el otro y completar algo en un toque. Ambos se describen como "muy visuales": el estado del día debe leerse de un vistazo, sin leer texto.

Elegida por el usuario: "Línea de metro" (tarjeta de la ronda de dirección; el usuario la eligió en el chat).

## Direction contract

THESIS: El día del hogar es un diagrama de líneas: cada integrante es una línea de color, lo compartido es el tronco donde se unen, y cada tarea es una estación que se llena al cumplirse. Rechaza el tablero de tarjetas y checkboxes en gris con un acento.

OWN-WORLD: Fondo blanco de señalética #F6F7F7, tinta #15171A (nunca negro puro), una línea fina #DCE0E3. Cada persona elige un color de línea (naranja #D9480F, verde azulado #0A7F6F, magenta #C2255C, ámbar #E8A400, verde #2F9E44); el tronco compartido es azul #3B5BDB. Estaciones: anillo = pendiente, llena = hecha, anillo con marca roja #C92A2A = atrasada, tachada = saltada. Rótulos de línea en Schibsted Grotesk mayúsculas sobre placa de color; cifras tabulares; cuerpo en Roboto. Oscuro: fondo #111315 con las mismas líneas un tono más claras.

STORY: De un vistazo entienden quién ha avanzado y qué falta; creen que la casa es de los dos porque el tronco compartido los une visualmente; tocan una estación para cumplirla y el color avanza.

FIRST VIEWPORT: Barra superior con fecha pequeña y título del estado ("4 de 7 hechas") a la izquierda, avatar a la derecha. Debajo, el diagrama ocupa ~40% de la pantalla: dos líneas verticales paralelas con placas de nombre arriba que convergen en el tronco azul "LOS DOS"; las estaciones llevan nombre y firma a la derecha. Debajo, hábitos y el mes como tarjetas compactas. FAB "+" abajo a la derecha sobre la navegación inferior de 5 destinos (Hoy, Tareas, Hábitos, Dinero, Garaje).

FORM: Línea de metro, posición 1 de 7 en la lista propia (IMPECCABLE'S PICK). seed:d03f8cc84d74bb94. Movimiento firma: al completar, la estación se llena desde el centro (≤200 ms), el tramo hacia la siguiente estación se colorea hacia adelante (≤250 ms) y vibra suave; con "quitar animaciones", cambio instantáneo. Alcance: hábitos como línea circular de la semana; vehículos como línea de kilometraje con la próxima estación de mantenimiento (aceite a los 20.000 km); finanzas usan los colores de línea para firmar quién registró cada movimiento.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
