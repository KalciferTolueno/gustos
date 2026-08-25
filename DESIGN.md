# Design System: Datito

## 1. Visual Theme & Atmosphere

Datito is a dark editorial discovery interface for finding events in Chile. It should feel selective, fast and culturally aware. Density is balanced at 5/10, layout variance is controlled at 6/10, and motion intensity is fluid at 6/10. Photography from real events carries the atmosphere. Interface chrome uses a restrained dark liquid-glass material.

The canvas uses React Bits Side Rays as an ambient WebGL layer behind the complete discovery surface. It combines yellow (`#EAB308`) and pale blue (`#96C8FF`) rays from the lower-left corner at 86% layer opacity, while a dark veil preserves text contrast. It never intercepts input and is removed when reduced motion is requested.

The product is an application, not a marketing landing page. Prioritize search, filters, event scanning and trustworthy source details over decorative storytelling.

## 2. Color Palette & Roles

- **Night Canvas** (`#0B0C0E`): page background and browser theme color.
- **Raised Night** (`#15171A`): dialogs and elevated controls.
- **Liquid Surface** (`rgba(22,25,27,.70)`): translucent navigation, event cards and grouped controls.
- **Primary Ink** (`#F4F4F5`): headings and primary content.
- **Muted Ink** (`#A1A1AA`): secondary content and metadata.
- **Refracted Border** (`rgba(255,255,255,.14)`): structural edges with a subtle top highlight.
- **Radar Lime** (`#D9FF81`): the only interface accent, used for focus, active state and high-priority feedback.

The coral dot inside the existing Datito logo is part of the preserved brand mark, not a reusable interface accent.

## 3. Typography Rules

- **Display and UI:** Geist Variable, loaded through `next/font`.
- **Headlines:** weight 600, tight tracking, balanced wrapping and no more than 2 lines in the hero.
- **Body:** 1rem minimum where space permits, relaxed leading and a maximum readable width near 65 characters.
- **Numbers:** tabular figures for result counts, dates and pagination.
- **Copy:** direct Chilean Spanish, active voice and specific labels. Avoid marketing clichés and decorative technical jargon.

## 4. Component Stylings

- **Buttons:** 16 px radius, 44 px minimum target, clear focus ring, slight lift on hover and tactile press feedback.
- **Cards:** 28 px outer radius, refracted border and low, tinted depth. No nested card stacks.
- **Glass surfaces:** combine translucency, 18–26 px backdrop blur, mild saturation, a 1 px inner highlight and one consistent overhead light direction. Keep content-bearing photography opaque.
- **Badges:** reserved for category, status or verification. They never decorate photography without adding information.
- **Forms:** visible or assistive label, correct input type, inline status and error feedback.
- **Loading:** shape-matched skeleton lines or compact progress motion. Event imagery uses a tinted wash that matches the card hue until the image has loaded and decoded. No generic circular spinners.
- **Empty states:** state the reason and provide one direct recovery action.

## 5. Layout Principles

- Maximum content width: 1440 px.
- Desktop navigation stays on one line and remains below 80 px tall.
- The discovery hero stays compact and contains only the title, supporting copy and search controls.
- Desktop navigation floats above the page and remains visible throughout scrolling.
- Once the page is scrolled, desktop navigation softens to 78% opacity and returns to full clarity on hover or keyboard focus.
- Category filters show a compact primary set and reveal overflow choices through a `+N` control.
- Event results use five equal columns on wide screens, three on medium screens, two on tablets and one on mobile.
- Event cards open from the entire surface, place their category over the image and fade photography into the glass body at the lower edge.
- Multi-column areas collapse explicitly to one column below 768 px.
- The mobile navigation respects the bottom safe area and every action keeps a 44 px target.
- Full-height behavior uses `100dvh`, never `100vh`.

## 6. Motion & Interaction

- Motion communicates entry, feedback or state change only.
- Animate `transform` and `opacity`; avoid layout-triggering animation.
- Use `cubic-bezier(.16, 1, .3, 1)` for interaction easing.
- Initial entry is staged in this order: ambient rays, navigation, hero, demonstration status, filters and event cards.
- The WebGL background fades in over 1.65 seconds instead of appearing at full intensity on the first frame.
- Event cards become visible through `IntersectionObserver` with a 120 px look-ahead and stagger by column.
- Event image requests begin only after their card approaches the viewport. Requests within a row are separated by 130 ms and images fade in after decoding.
- The first visible image may load eagerly; every following image remains lazy and all image decoding is asynchronous.
- All automatic motion stops under `prefers-reduced-motion`.
- Reduced-motion mode removes the WebGL layer, reveals cards immediately and skips artificial image-request delays.
- Images may scale slightly on hover when their container clips overflow.

## 7. Anti-Patterns

- No additional accent colors, neon glows or purple-blue AI gradients.
- No centered promotional hero, decorative scroll cue or version badge.
- No rows of identical feature cards or fake dashboard screenshots.
- No decorative status dots, section numbering or repeated eyebrow labels.
- No generic filler names, fake metrics or unverified precision.
- No labels placed over event photography unless required for a real status.
- No mixed light and dark sections. Datito uses one locked dark theme.
- No motion that ignores reduced-motion preferences.
- No icon-only button without an accessible name.
