const configured = import.meta.env.VITE_BACKEND_URL?.trim();
// Development requests use Vite's same-origin /api proxy. Its target comes
// from the same VITE_BACKEND_URL variable in vite.config.ts.
// Production uses the configured address, or the frontend origin if empty.
export const backendUrl = import.meta.env.DEV
  ? ""
  : configured
    ? configured.replace(/\/+$/, "")
    : "";
