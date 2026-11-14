# AgerVest Proto v0.2

**Plataforma de financiamiento agrícola con tokenización** — backend API + frontend web con las 7 pantallas del mockup.

## Cómo levantarlo

```bash
npm install
npm run build
npm start
```

Luego abre: **http://localhost:3000**

### Modo desarrollo (sin compilar)
```bash
npm install
npm run dev
```

## Pantallas incluidas (public/)
- `index.html` — Inicio (proyectos destacados, stats de la plataforma)
- `register-farmer.html` — Registro de agricultor
- `register-project.html` — Registro de proyecto agrícola
- `catalog.html` — Catálogo/marketplace de oportunidades con filtros
- `project-detail.html` — Detalle del proyecto + inversión + trazabilidad
- `investor-dashboard.html` — Panel del inversionista (tokens, portafolio, historial)
- `farmer-dashboard.html` — Panel del agricultor (financiamiento, avances, reportes)

## Datos de ejemplo
El servidor incluye datos semilla (4 agricultores validados, 4 proyectos, 2 inversionistas con inversiones ya realizadas) para que todas las pantallas se vean pobladas desde el primer arranque. Los datos viven en memoria y se reinician al reiniciar el servidor.

## Stack
- Node.js + TypeScript + Express (API REST)
- Frontend estático (HTML/CSS/JS vanilla, sin build step) servido por Express
- UUID para IDs, almacenamiento en memoria (sin BD)

## API principal
- `POST/GET /api/farmers`, `GET /api/farmers/:id/dashboard`
- `POST/GET /api/projects`, `GET /api/projects/:id`, `POST /api/projects/:id/updates`
- `POST/GET /api/investors`, `GET /api/investors/:id/portfolio`
- `POST /api/investments`
- `GET /api/stats`


## V0.9 — Integración de AgerVest V3

Esta versión mantiene la autenticación y operaciones de V0.8 y agrega la capa de datos/analítica de la versión V3:

- analítica histórica por cultivo (precio y producción 2025–2026);
- métricas regionales de Arequipa y comparación de rendimiento;
- referencia de siniestralidad SAC;
- costos de jornal, tractor y yunta;
- contexto y transparencia de fuentes;
- score del productor, riesgo y confianza explicados de forma visual;
- rol adicional de aliado/asociación con dashboard propio;
- flujo demostrativo de verificación del inversionista antes de una operación;
- documentación de fuentes y métricas del dataset V3 incluida en `data/` y `docs/`.

El backend alternativo PostgreSQL de V3 no se mezcla con el backend TypeScript de V0.8 para evitar dos sistemas de autenticación incompatibles.
