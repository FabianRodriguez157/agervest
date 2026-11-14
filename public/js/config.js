/**
 * Configuración runtime del frontend.
 *
 * - En desarrollo local y cuando el backend sirve la misma carpeta `public/`,
 *   deja `apiBase` como cadena vacía. Las llamadas serán `/api/...` (misma origin).
 *
 * - Cuando subas el frontend a GitHub Pages y el backend esté en otro host
 *   (Render, Railway, Fly, etc.), pon aquí la URL completa del backend, por ejemplo:
 *
 *     window.AGV_CONFIG = { apiBase: 'https://agervest-api.onrender.com' };
 *
 *   Asegúrate de que la variable CORS_ORIGINS del backend incluya el dominio
 *   https://<usuario>.github.io para que las cookies de sesión viajen.
 */
window.AGV_CONFIG = window.AGV_CONFIG || {
  apiBase: '',
};
