# Desplegar AgerVest para una presentación

GitHub Pages solo puede hospedar archivos estáticos. El backend Node/Express y PostgreSQL necesitan otro servicio. La receta recomendada es:

- **Frontend (carpeta `public/`)** → GitHub Pages (gratis, automático con Actions).
- **Backend + PostgreSQL** → Render.com (plan free). Alternativas equivalentes: Railway, Fly.io, Neon + Vercel.

El repositorio ya trae todo lo necesario:
- `.github/workflows/pages.yml` publica `public/` en Pages en cada push a `main`.
- `backend/render.yaml` es un blueprint de Render que crea el servicio web + la base de datos.
- `public/js/config.js` deja la URL del backend configurable.

---

## Paso 1. Subir a GitHub

```bash
cd agervest-mejorado
git init
git add .
git commit -m "AgerVest v1"
git branch -M main
git remote add origin https://github.com/<tu-usuario>/agervest.git
git push -u origin main
```

## Paso 2. Habilitar GitHub Pages

1. En el repo → **Settings → Pages**.
2. En **Source** elige **GitHub Actions**.
3. Al terminar el push, la action "Deploy frontend to GitHub Pages" corre sola. Mírala en la pestaña **Actions**.
4. Cuando termine, tu sitio quedará en: `https://<tu-usuario>.github.io/<nombre-repo>/`

El frontend sin backend abrirá pero todas las llamadas fallarán — eso se arregla en el paso 4.

## Paso 3. Desplegar el backend en Render

1. Entra a [render.com](https://render.com) y conéctate con GitHub.
2. **New → Blueprint** y selecciona el repo.
3. Render detecta `backend/render.yaml` y propone crear:
   - `agervest-db` (PostgreSQL 16, plan free)
   - `agervest-api` (Node web service, plan free)
4. Edita la variable **`CORS_ORIGINS`** y pon la URL de tu Pages:
   `https://<tu-usuario>.github.io`
5. Click **Apply**. La primera build tarda 3–5 min.
6. Al terminar, copia la URL pública del servicio (algo como `https://agervest-api.onrender.com`).
7. Abre el **Shell** del servicio en Render y corre:
   ```bash
   npm run db:migrate
   npm run db:seed
   ```
   (La primera vez; después no hace falta.)

**Nota sobre el plan free de Render**: el servicio se duerme tras 15 min de inactividad. La primera llamada después de dormir tarda ~30 s en responder. Para una demo, "despiértalo" cargando el sitio 1 min antes.

## Paso 4. Apuntar el frontend al backend

Edita `public/js/config.js`:

```js
window.AGV_CONFIG = {
  apiBase: 'https://agervest-api.onrender.com',  // la URL que te dio Render
};
```

Haz commit + push. La action de Pages se dispara y el sitio queda apuntando al backend en Render. Para probar:

- Abre `https://<tu-usuario>.github.io/<repo>/`
- Entra con `carlos.medina@mail.com` / `demo123`
- Haz una inversión → verás que el saldo baja, el del agricultor sube, y el retorno queda pendiente.

## Variables de entorno finales (Render)

| Variable            | Valor                                                       |
| ------------------- | ----------------------------------------------------------- |
| `NODE_ENV`          | `production`                                                |
| `DATABASE_URL`      | (auto, viene de `agervest-db`)                              |
| `JWT_SECRET`        | (auto-generado por Render)                                  |
| `JWT_EXPIRES_IN`    | `7d`                                                        |
| `COOKIE_NAME`       | `agv_session`                                               |
| `COOKIE_SAMESITE`   | `none` ← obligatorio cuando frontend y backend son dominios distintos |
| `BCRYPT_ROUNDS`     | `10`                                                        |
| `CORS_ORIGINS`      | `https://<tu-usuario>.github.io`                            |

## Problemas comunes

| Síntoma                                                      | Causa                            | Solución                                                    |
| ------------------------------------------------------------ | -------------------------------- | ----------------------------------------------------------- |
| "CORS blocked" en consola del navegador                      | `CORS_ORIGINS` no incluye Pages  | Añade `https://<usuario>.github.io` exacto, sin `/` final  |
| El login responde 200 pero `/api/auth/me` da 401             | Cookie no cruza el dominio       | `COOKIE_SAMESITE=none` + HTTPS (ambos obligatorios)        |
| Primera petición tarda 30 s                                  | Free tier de Render dormido      | Normal; mantener caliente con un ping periódico si molesta |
| GitHub Pages muestra 404 para `/foo.html`                    | Rutas relativas vs absolutas     | Usa rutas relativas: `href="login.html"`, no `/login.html` |
| `relation "projects" does not exist` al probar               | Falta correr migraciones         | En Render Shell: `npm run db:migrate && npm run db:seed`   |

## Alternativas al Pages + Render

- **Todo en un servicio**: despliega el backend en Render **sin** GitHub Pages. El servicio Node ya sirve `public/` como estático desde la misma URL, así que no necesitas Pages ni configurar CORS. Más simple pero sin dominio `github.io`.
- **Vercel + Supabase**: Vercel hospeda el frontend, Supabase expone Postgres. Necesitarías adaptar el backend o usar PostgREST.
- **Railway**: idéntico flujo a Render con un blueprint parecido.

Para una presentación académica, **Pages + Render** da mejor efecto: dominio limpio de Pages para el frontend y una API pública en vivo.
