/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Backend origin for API calls. Empty in dev (Vite proxy); set in production. */
  readonly VITE_API_BASE_URL?: string;
  /** Google Maps/Places API key, used for the Onboarding page's business-address autocomplete. */
  readonly VITE_GOOGLE_MAPS_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
