// Development uses Vite's same-origin proxy. Production reads the container
// config, allowing the API host to change without rebuilding the image.
const configured = import.meta.env.DEV
  ? ""
  : window.__APP_CONFIG__?.VITE_API_BASE_URL?.trim() ?? "";

export const apiBaseUrl = configured.replace(/\/+$/, "");
