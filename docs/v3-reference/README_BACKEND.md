# Backend opcional con PostgreSQL

La web funciona inmediatamente sin servidor usando `localStorage`. Para conectar PostgreSQL:

1. En pgAdmin crea una base llamada `agervest_demo`.
2. Abre `database/agervest_postgresql.sql` y ejecútalo.
3. En `backend/`, copia `.env.example` a `.env` y coloca tu contraseña.
4. Ejecuta `npm install` y luego `npm start`.
5. En `config.js`, cambia `apiBase` a `http://localhost:3000/api`.
6. Abre `http://localhost:3000`.

Endpoints incluidos: `POST /api/register`, `POST /api/login`, `GET /api/health`.
