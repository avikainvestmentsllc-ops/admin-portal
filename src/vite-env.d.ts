/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Backend origin for API calls. Empty in dev (Vite proxy); set in production. */
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
