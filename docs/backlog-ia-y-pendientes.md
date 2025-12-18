# Backlog: IA y pendientes

## IA “gratis” dentro de la app (ideas)

### A) IA “gratis real” (local en el dispositivo)

#### 1) LLM on-device en navegador (PWA)
- **Enfoque**: correr un modelo pequeño en el navegador.
- **Tecnologías posibles**:
  - `@mlc-ai/web-llm`
  - `transformers.js` (HuggingFace) con WebGPU
- **Ventajas**:
  - costo por request: **$0**
  - privacidad (no se envían datos a terceros)
- **Desventajas**:
  - descarga/modelo pesado, consumo de RAM/batería
  - compatibilidad iOS/Safari puede ser limitada
  - calidad menor vs modelos grandes

#### 2) IA local para tareas específicas (más liviano)
- **Enfoque**: en vez de chat general, usar modelos pequeños/técnicas locales para:
  - redacción asistida con plantillas
  - clasificación de consultas
  - búsqueda semántica local

### B) Free-tier (IA en la nube con plan gratuito)

- **Enfoque**: usar un proveedor con cuota gratis (limitada) y exponerlo vía un endpoint server-side (Next.js) para no filtrar keys.
- **Ventajas**:
  - mejor calidad/latencia (según proveedor)
  - implementación rápida
- **Desventajas**:
  - “gratis” es limitado
  - requiere rate-limit y manejo anti-abuso

### C) “IA” sin LLM (features inteligentes, 100% gratis)
- **Enfoque**: aportar valor con lógica/heurísticas/reportes sin IA generativa.
- **Ejemplos**:
  - detección de alumnos con caída de asistencia
  - ranking de deudas o pagos pendientes
  - alertas y resúmenes automáticos

## Ideas aplicadas a esta app (academia/pagos/agenda)

### 1) Asistente de soporte interno
- Objetivo: responder preguntas del admin (notificaciones, pagos, flujo de PWA).
- Alimentación: documentación interna (`docs/notificaciones-push.md`) y reglas del sistema.
- Opciones:
  - RAG simple (búsqueda en docs) + LLM (free-tier)
  - modo local opcional (on-device)

### 2) Redactor de mensajes
- Objetivo: generar textos para avisos a alumnos (pago pendiente, reprogramación, recordatorios).
- Puede implementarse con:
  - plantillas + variables (sin LLM)
  - LLM pequeño (local) o free-tier

### 3) Explicador de reportes
- Objetivo: transformar reportes en un resumen entendible para admins.
- Parte “inteligente”:
  - lógica determinística (gratis)
  - opcional: LLM para redactar un resumen

## Pendientes (para retomar)

### 1) Notificaciones in-app (v2) (pendiente)
- Definir alcance:
  - qué eventos generan notificación in-app
  - quiénes son destinatarios (admin/coach/student)
  - persistencia y estado (leído/no leído)
- Diseño sugerido:
  - tabla `in_app_notifications`
  - endpoints para listar/marcar leído
  - UI: campana + badge + centro de notificaciones

### 2) Prueba manual del recordatorio de clase (pendiente)
- Objetivo: validar cómo ejecutar manualmente el envío de recordatorio (modo debug/force/secret) y requisitos de datos (ventana de tiempo).
- Entregables:
  - pasos de ejecución
  - ejemplos de payload
  - cómo verificar logs y entrega (push_subscriptions, errores 404/410)
