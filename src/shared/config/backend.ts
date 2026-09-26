// Development uses Vite's same-origin /api proxy. Production reads the
// container-generated config, so the backend can change without rebuilding.
const configured = import.meta.env.DEV
  ? ""
  : window.__APP_CONFIG__?.VITE_BACKEND_URL?.trim() ?? "";

export const backendUrl = configured.replace(/\/+$/, "");
