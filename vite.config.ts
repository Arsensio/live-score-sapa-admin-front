import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const target = env.VITE_API_BASE_URL?.trim().replace(/\/+$/, "");

  return {
    server: {
      proxy: target
        ? {
            "/api": {
              target,
              changeOrigin: true,
            },
            "/image": {
              target,
              changeOrigin: true,
            },
          }
        : undefined,
    },
  };
});
