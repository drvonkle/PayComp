# PayComp Website Rebuild Sandbox

This branch is an isolated, editable rebuild of the public-facing PayComp website. It remains separate from the existing Resource Hub on `main`.

## Branch
`website-rebuild`

## Local pages
- `index.html` — rebuilt homepage
- `why-paycomp.html` — Why PayComp
- `atlas.html` — ATLAS
- `technology.html` — Technology / WOPR
- `mga.html` — Wholesaler / MGA
- `payroll-integration.html` — 5 Levels of Payroll Provider Integration
- `privacy-security.html` — Privacy & Security

## Shared assets
- `styles.css` — shared layout, components, responsive behavior and animations
- `script.js` — mobile navigation, copyright year and scroll-reveal behavior
- `paycomp-logo-top.png` — PayComp logo asset already stored in the repository

## Navigation
The main navigation and footer now use local relative links so the rebuild can be browsed as a standalone multi-page site. External links are limited to actions that intentionally leave the sandbox, such as signup, ATLAS login and email contact actions.

## Editing
The rebuild uses plain HTML, CSS and JavaScript. Copy, structure, links, colors, spacing and components can be changed directly in GitHub without a build pipeline.

## Local preview
Open `index.html` with a static web server and navigate normally between pages.

## Handoff
The production site is not modified by this branch. When the sandbox is approved, the development team can port or merge the approved markup, styles and content into the production framework through its normal review/deployment process.
