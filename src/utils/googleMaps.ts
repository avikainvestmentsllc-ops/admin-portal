// Loads the Google Maps JavaScript API (with the Places library) exactly once, no matter how many
// components request it — subsequent calls reuse the same in-flight/resolved promise instead of
// injecting duplicate <script> tags. Mirrors rental/src/utils/googleMaps.js (this app has no
// shared package with the other UIs, so the loader is duplicated rather than imported).

/** Minimal surface of the google.maps namespace this app actually uses. */
export interface GoogleMapsNamespace {
  places: {
    Autocomplete: new (
      input: HTMLInputElement,
      options?: {
        types?: string[];
        componentRestrictions?: { country: string };
        fields?: string[];
      },
    ) => GoogleAutocomplete;
  };
}

export interface GoogleAddressComponent {
  long_name: string;
  short_name: string;
  types: string[];
}

export interface GooglePlace {
  address_components?: GoogleAddressComponent[];
  formatted_address?: string;
}

export interface GoogleAutocomplete {
  addListener: (event: 'place_changed', handler: () => void) => { remove: () => void };
  getPlace: () => GooglePlace;
}

declare global {
  interface Window {
    google?: { maps?: GoogleMapsNamespace };
    [key: string]: unknown;
  }
}

let loadPromise: Promise<GoogleMapsNamespace> | null = null;

export function loadGoogleMaps(): Promise<GoogleMapsNamespace> {
  if (loadPromise) return loadPromise;

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return Promise.reject(new Error('Google Maps API key is not configured (VITE_GOOGLE_MAPS_API_KEY).'));
  }

  if (window.google?.maps?.places) {
    loadPromise = Promise.resolve(window.google.maps);
    return loadPromise;
  }

  loadPromise = new Promise<GoogleMapsNamespace>((resolve, reject) => {
    const callbackName = '__googleMapsLoaded';
    window[callbackName] = () => {
      delete window[callbackName];
      resolve(window.google!.maps!);
    };

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places&callback=${callbackName}&loading=async`;
    script.async = true;
    script.onerror = () => reject(new Error('Failed to load Google Maps.'));
    document.head.appendChild(script);
  });

  return loadPromise;
}

/** Find one address component by its Google Places type. */
export function getComponent(
  components: GoogleAddressComponent[] | undefined,
  type: string,
): GoogleAddressComponent | undefined {
  return components?.find((c) => c.types.includes(type));
}
