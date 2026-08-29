/** Stroke icons from the "Admin Portal Web" canvas (24-unit viewBox, round caps). */
export const ICON_PATHS = {
  dashboard: 'M3 3h7v8H3z M14 3h7v5h-7z M14 12h7v9h-7z M3 15h7v6H3z',
  onboarding: 'M8.5 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z M2.5 20.5c0-3.3 2.7-6 6-6s6 2.7 6 6 M18 8v6 M15 11h6',
  packages: 'M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5z M3.5 7.5 12 12l8.5-4.5 M12 12v9',
  addons: 'M4 4h7v7H4z M13 4h7v7h-7z M4 13h7v7H4z M16.5 13v7 M13 16.5h7',
  mileage: 'M5 17.5h14 M6.5 17.5V13l1.8-4.6A2 2 0 0 1 10.2 7h3.6a2 2 0 0 1 1.9 1.4L17.5 13v4.5 M7 13h10 M8 20v-2.5 M16 20v-2.5',
  contractors: 'M14.5 3.5a4.5 4.5 0 0 0-5.6 5.6L3.5 14.5v6h6l5.4-5.4a4.5 4.5 0 0 0 5.6-5.6l-2.9 2.9-2.2-2.2z',
  house: 'M4 20.5V9l8-5.5 8 5.5v11.5 M4 20.5h16 M9.5 20.5v-6h5v6 M9.5 11h5',
  bell: 'M18 8.5a6 6 0 1 0-12 0c0 6-2.5 7.5-2.5 7.5h17S18 14.5 18 8.5 M10 19.5a2.4 2.4 0 0 0 4 0',
  logout: 'M15 4h3.5A1.5 1.5 0 0 1 20 5.5v13A1.5 1.5 0 0 1 18.5 20H15 M10 12h9 M15.5 8.5 19 12l-3.5 3.5',
  menu: 'M4 7h16 M4 12h16 M4 17h16',
  close: 'M6 6l12 12 M18 6L6 18',
} as const;

export type IconName = keyof typeof ICON_PATHS;

export function Icon({ name, size = 17, strokeWidth = 1.6 }: { name: IconName; size?: number; strokeWidth?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ flex: 'none' }}
    >
      <path d={ICON_PATHS[name]} />
    </svg>
  );
}
