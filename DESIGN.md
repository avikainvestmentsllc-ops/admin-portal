---
name: Obsidian Administrative Protocol
colors:
  surface: '#0b1326'
  surface-dim: '#0b1326'
  surface-bright: '#31394d'
  surface-container-lowest: '#060e20'
  surface-container-low: '#131b2e'
  surface-container: '#171f33'
  surface-container-high: '#222a3d'
  surface-container-highest: '#2d3449'
  on-surface: '#dae2fd'
  on-surface-variant: '#c7c4d7'
  inverse-surface: '#dae2fd'
  inverse-on-surface: '#283044'
  outline: '#908fa0'
  outline-variant: '#464554'
  surface-tint: '#c0c1ff'
  primary: '#c0c1ff'
  on-primary: '#1000a9'
  primary-container: '#8083ff'
  on-primary-container: '#0d0096'
  inverse-primary: '#494bd6'
  secondary: '#4edea3'
  on-secondary: '#003824'
  secondary-container: '#00a572'
  on-secondary-container: '#00311f'
  tertiary: '#ffb95f'
  on-tertiary: '#472a00'
  tertiary-container: '#ca8100'
  on-tertiary-container: '#3e2400'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#e1e0ff'
  primary-fixed-dim: '#c0c1ff'
  on-primary-fixed: '#07006c'
  on-primary-fixed-variant: '#2f2ebe'
  secondary-fixed: '#6ffbbe'
  secondary-fixed-dim: '#4edea3'
  on-secondary-fixed: '#002113'
  on-secondary-fixed-variant: '#005236'
  tertiary-fixed: '#ffddb8'
  tertiary-fixed-dim: '#ffb95f'
  on-tertiary-fixed: '#2a1700'
  on-tertiary-fixed-variant: '#653e00'
  background: '#0b1326'
  on-background: '#dae2fd'
  surface-variant: '#2d3449'
typography:
  display-lg:
    fontFamily: Hanken Grotesk
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Hanken Grotesk
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
  headline-lg-mobile:
    fontFamily: Hanken Grotesk
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  title-md:
    fontFamily: Hanken Grotesk
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.05em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  container-max: 1440px
  gutter: 1.5rem
  margin-x: 2rem
  margin-x-mobile: 1rem
  stack-sm: 0.5rem
  stack-md: 1rem
  stack-lg: 2rem
---

## Brand & Style

This design system establishes a high-performance, dark-themed environment tailored for administrative efficiency and data clarity. The brand personality is **Professional, Technical, and Precision-Oriented**, evolving the existing aesthetic into a refined "Modern Corporate" style with subtle "SaaS" influences.

The emotional goal is to provide users with a sense of control and reliability. We move away from high-saturation backgrounds toward a deep, layered monochromatic foundation punctuated by vibrant, high-contrast action colors. This ensures that while the environment is dark, the utility is never compromised. The visual language utilizes clean lines, generous negative space, and a systematic approach to depth to guide the user's focus toward critical data and primary calls-to-action.

## Colors

The palette is built on a "Deep Navy" foundation to reduce eye strain during long sessions while maintaining a modern professional edge.

*   **Primary (#6366F1):** An indigo-violet used for active states, primary buttons, and critical focus indicators. It provides a contemporary tech feel that is more legible against dark backgrounds than the original purple.
*   **Secondary (#10B981):** An emerald green dedicated to success states and "Active" status indicators, ensuring high-visibility semantic meaning.
*   **Surface Hierarchy:**
    *   **Base:** #0F172A (Deepest layer)
    *   **Surface:** #1E293B (Cards and Containers)
    *   **Elevated:** #334155 (Hover states and Tooltips)
*   **Typography:** We use #F8FAFC for primary headings to ensure maximum contrast, and #94A3B8 for secondary/meta information.

## Typography

The typography system prioritizes legibility and information density. 

We use **Hanken Grotesk** for headlines to provide a sharp, contemporary character that feels more "designed" than standard system fonts. **Inter** handles the heavy lifting for data tables and body text due to its exceptional readability at small sizes on screens. For technical data—like Customer IDs or status badges—**JetBrains Mono** is introduced to provide a clear, monospaced distinction, aiding in rapid data scanning.

Scale is strictly managed: desktop headings are bold and expressive, while mobile variants scale down to ensure content remains the hero on smaller viewports.

## Layout & Spacing

This design system employs a **Fluid Grid** model. The layout utilizes a 12-column grid system for desktop, transitioning to 8 columns for tablet, and a single-column stack for mobile. 

The rhythm is governed by a 4px baseline, with most increments following an 8px (0.5rem) scale. 

**Key Layout Rules:**
*   **Safe Areas:** Desktop views maintain a 32px (2rem) outer margin to let the data breathe.
*   **Responsiveness:** On mobile, side navigation collapses into a bottom bar or a hamburger menu, and table rows may transform into "cards" to prevent horizontal scrolling of critical data.
*   **Density:** Data tables use a "Compact" vertical rhythm (12px padding) to maximize information visibility without feeling cluttered.

## Elevation & Depth

To avoid the "flatness" often found in dark UIs, we use **Tonal Layering** combined with subtle **Ambient Shadows**.

1.  **The Canvas:** The lowest layer (#0F172A) represents the void.
2.  **The Containers:** Cards and data tables sit on the Surface layer (#1E293B). They do not use heavy shadows but instead utilize a 1px solid border (#334155) to define their boundaries.
3.  **The Interaction:** Elements that are interactive (buttons, clickable table rows) use a secondary "Glow" shadow only on hover. This shadow uses the primary indigo color at 20% opacity with a large (12px) blur to signify "lift."
4.  **The Overlay:** Modals and dropdowns use a "Glassmorphism lite" approach—a backdrop blur of 8px with a semi-transparent background (#1E293B at 80% opacity) to maintain context of the underlying data.

## Shapes

The design system adopts a **Rounded** corner strategy (Level 2). This softens the technical nature of the admin portal, making it feel more "customer-friendly" and modern.

*   **Standard Elements:** Inputs, buttons, and small cards use 0.5rem (8px) corners.
*   **Large Containers:** Main dashboard sections use `rounded-lg` (1rem / 16px).
*   **Status Badges:** Use `rounded-xl` (1.5rem) or full pill-shapes to differentiate them from interactive buttons.

## Components

### Buttons
*   **Primary:** Solid background (#6366F1), white text, 8px border radius. High-contrast and clear.
*   **Secondary/Ghost:** 1px border (#334155) with transparent background. Subtle hover state that fills the background slightly.

### Data Tables
*   **Header:** Uses `label-md` (JetBrains Mono) in uppercase with a muted color (#64748B) to separate metadata from the content.
*   **Rows:** 1px bottom border for separation. Alternating "zebra" stripes are avoided in favor of a clear hover-highlight state.

### Chips & Status Badges
*   **Active:** Light green background (10% opacity of #10B981) with a solid #10B981 text color.
*   **Generic:** Neutral slate backgrounds with high-contrast text.

### Input Fields
*   **Style:** Dark fill (#0F172A) with a subtle border. On focus, the border transitions to the primary indigo with a 2px outer glow.
*   **Labels:** Always positioned above the field in `label-md` for clarity and accessibility.

### Cards
*   Defined by a 1px border (#334155). They should be used to group related metrics or "Onboarding" steps to provide a clean visual container for complex tasks.