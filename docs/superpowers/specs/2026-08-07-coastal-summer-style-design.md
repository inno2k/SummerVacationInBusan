# Coastal Summer Style Design

## Goal

Refresh the Busan family-trip planner with a cool summer-coast atmosphere while preserving its information-dense planning workflow and responsive behavior.

## Approved Direction

- Style direction: CSS-only coastal layers rather than a photographic or illustrative hero.
- Palette: seafoam mint, warm ivory, and restrained peach coral, anchored by deep teal text.
- Typography: postcard-like serif for the main and section headings; readable Korean sans-serif for schedules, maps, budgets, inputs, and controls.
- Scope: visual treatment only. Travel data, orchestration behavior, tabs, map interactions, and budget behavior remain unchanged.

## Visual System

### Background and hierarchy

- Use a warm ivory page base with subtle sky-mint and sand-toned background bands.
- Add quiet CSS-only wave/coastline cues that do not reduce contrast or compete with content.
- Keep cards bright and lightly elevated. Avoid strong gradients, decorative blobs, and nested cards.

### Color roles

- Deep teal: headings, navigation, and high-priority text.
- Seafoam/mint: chips, secondary panels, and quiet interactive surfaces.
- Peach coral: primary action, selected state, and small emphasis only.
- Sand: low-emphasis section accents and secondary dividers.

### Typography

- Add a Korean-capable serif display face for `h1` and section headings.
- Retain Noto Sans KR for operational content, controls, and small text.
- Preserve current font sizes and responsive constraints unless a small adjustment is required for visual balance.

### Components

- Hero: airy sky-to-ivory backdrop, improved type contrast, and a seafoam statistic panel.
- Sticky tabs: translucent, light coastal surface with a distinct teal active state.
- Cards, day blocks, inputs, map filters, and budget selector: brighter surfaces, softer borders, and clearer focus/hover states.
- Primary action: peach coral with an accessible hover state.

### Responsive behavior

- Preserve the current desktop, tablet, and mobile layout structure.
- Reduce decorative background treatment on narrow screens.
- Maintain minimum touch target sizes and ensure text stays within controls.

## Verification

- Run existing syntax, JSON, and QA checks.
- Inspect the page at desktop and mobile widths.
- Confirm tabs, date-flow recalculation, map filtering, and budget selection still operate unchanged.
- Verify color contrast and that content remains legible over every background layer.

## Non-goals

- No change to trip content, budget logic, routing logic, map data, or GitHub Pages setup.
- No external photo asset or new runtime dependency.
