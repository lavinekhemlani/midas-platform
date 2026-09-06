# CSS Architecture Review

**Date:** 2026-01-06
**Scope:** All CSS files excluding `print.css` and landing page styles
**Total Lines Reviewed:** ~4,233 lines across 11 files
**Best Practices Version:** CSS 2024/2025 Standards

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [File Structure](#file-structure)
3. [Theme System](#theme-system)
4. [Issues Identified](#issues-identified)
5. [Best Practices Gaps](#best-practices-gaps)
6. [Recommended Fixes](#recommended-fixes)
7. [Implementation Checklist](#implementation-checklist)
8. [Browser Compatibility](#browser-compatibility)

---

## Architecture Overview

### Methodology

- **Primary:** Tailwind CSS utility classes (~70% of styling)
- **Secondary:** CSS class selectors with CSS variables (~20%)
- **Tertiary:** Inline styles for dynamic values (~10%)

### Entry Point

- `/src/app/globals.css` imports all CSS files via `@import`
- Included in root layout (`src/app/layout.tsx`)

### Key Technologies

```json
{
  "@tailwindcss/container-queries": "^0.1.1",
  "@tailwindcss/postcss": "^4.1.18",
  "tailwind-merge": "^3.3.1",
  "tailwindcss": "^4.1.7",
  "tw-animate-css": "^1.4.0"
}
```

---

## File Structure

```
src/styles/
├── _base.css           (227 lines)  Base resets, scrollbar, HTML setup
├── _theme.css          (336 lines)  Theme system with 135 CSS variables
├── _animations.css     (313 lines)  28 keyframe animations
├── _components.css     (492 lines)  Reusable component classes
├── _forms.css          (175 lines)  Form element styling (.zenith-*)
├── _dashboard.css      (980 lines)  Dashboard layouts & components [LARGEST]
├── _chat.css           (829 lines)  Chat panel and messaging UI
├── _onboarding.css     (310 lines)  Onboarding flow specific styles
├── _health-score.css   (71 lines)   Financial health score component
├── _learn.css          (35 lines)   Learning module styles
└── _nprogress.css      (73 lines)   Progress bar customization
```

### File Responsibilities

| File                | Responsibility                                                                                      |
| ------------------- | --------------------------------------------------------------------------------------------------- |
| `_base.css`         | Tailwind imports, scrollbar styling, box-sizing resets, cursor definitions, theme flash prevention  |
| `_theme.css`        | 4 theme variants (default, light, minimal, darkmatter), CSS custom properties, View Transitions API |
| `_animations.css`   | Accordion, shimmer, fade-in, slide, pulse, shake, marquee animations                                |
| `_forms.css`        | Input, select, textarea styling with focus states, error messages                                   |
| `_components.css`   | `.shell-base`, `.glass-*`, `.btn-*`, sidebar animations, Clerk Auth overrides                       |
| `_dashboard.css`    | KPI cards, grid system, skeleton loading, bottom nav, tab navigation, mobile responsive             |
| `_chat.css`         | Message bubbles, markdown formatting, chat input, fullscreen mode                                   |
| `_onboarding.css`   | Connect buttons, proficiency selector, timeline animations                                          |
| `_health-score.css` | Financial health component overrides                                                                |
| `_learn.css`        | Badge styling, sheet components                                                                     |
| `_nprogress.css`    | Progress bar color and spinner                                                                      |

---

## Theme System

### Available Themes

1. **Default** (`:root`) - Dark theme (#121212)
2. **Light** (`html.theme-light`) - Warm cream (#e4e2df)
3. **Minimal** (`html.theme-minimal`) - Softer dark (#121212)
4. **Darkmatter** (`html.theme-darkmatter`) - Cosmic black (#0d0d0f)

### CSS Variable Categories

- Transition timings
- Shimmer animation RGB values
- Background, text, border colors
- Card, input, button, badge styling
- Premium and footer variants
- Glass effects
- Gradient overlays

---

## Issues Identified

### Critical Issues

#### 1. Hardcoded Color Values

**Location:** Multiple files
**Problem:** `#f59e0b` (amber accent) appears in 50+ places instead of using CSS variables.

```css
/* Current - scattered across files */
color: #f59e0b;
border-color: #f59e0b;
background-color: #f59e0b;
```

**Impact:** Theme changes require manual updates across all files.

---

#### 2. Z-Index Chaos

**Location:** Multiple files
**Problem:** No documented z-index scale. Values found: 10, 40, 50, 51, 52, 60, 9999, 1031

| Value | Usage                         |
| ----- | ----------------------------- |
| 10    | Various components            |
| 40    | Overlays                      |
| 50-52 | Modals, dropdowns             |
| 60    | Chat panel                    |
| 1031  | Bootstrap modal compatibility |
| 9999  | NProgress bar                 |

**Impact:** Risk of stacking context conflicts.

---

#### 3. Oversized Dashboard File

**Location:** `_dashboard.css` (980 lines)
**Problem:** Single file handles too many concerns:

- Layout structure
- KPI card styles
- Grid system
- Skeleton loading
- Bottom navigation
- Tab navigation
- Mobile responsive

**Impact:** Difficult to maintain and navigate.

---

### Moderate Issues

#### 4. Inconsistent Naming Conventions

**Problem:** Mix of naming patterns without clear standard.

| Pattern    | Example                           |
| ---------- | --------------------------------- |
| BEM-like   | `.dashboard-sidebar-item`         |
| Utility    | `.flex`, `.gap-4`                 |
| Custom     | `.shell-base`, `.glass-component` |
| Namespaced | `.zenith-input`, `.zenith-select` |

---

#### 5. Duplicate Transition Definitions

**Location:** 48 transition rules across files
**Problem:** Not centralized via CSS variables.

```css
/* Scattered definitions */
transition: all 0.2s ease;
transition: all 0.3s ease;
transition: background-color 0.15s ease;
transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
```

---

#### 6. Theme Variable Duplication

**Location:** `_theme.css`
**Problem:** Minimal theme duplicates all root values exactly (~100 lines of duplication).

---

#### 7. Scattered Responsive Breakpoints

**Problem:** No centralized mobile-first approach.

```css
/* Found in _dashboard.css */
@media (max-width: 768px) { ... }
@media (min-width: 1200px) { ... }

/* Container queries also used */
@container (min-width: 1200px) { ... }
```

---

### Minor Issues

#### 8. Potentially Unused Classes

- `.theme-transitioning` (lines 144-159 in \_theme.css)
- `.animated-shell-container`
- `.content-shadow`

---

#### 9. Incomplete Reduced Motion Support

**Problem:** Some animations missing `prefers-reduced-motion` rules.

```css
/* Good - has reduced motion */
@media (prefers-reduced-motion: reduce) {
  .animate-shimmer {
    animation: none;
  }
}

/* Missing - needs reduced motion */
.luxury-fade-in {
  /* no fallback */
}
```

---

#### 10. No CSS Architecture Documentation

**Problem:** Custom classes like `.shell-base`, `.glass-component`, `.glass-luxury` lack documentation.

---

## Best Practices Gaps

### Critical Gaps

#### 1. No CSS Layers (`@layer`)

**Best Practice:** Use CSS Cascade Layers to control specificity and override order.
**Current State:** All styles compete at the same cascade level.

```css
/* Recommended layer structure */
@layer reset, base, tokens, components, utilities, overrides;

@layer reset {
  /* Normalize/reset styles */
}

@layer base {
  /* Element defaults */
}

@layer tokens {
  /* Design tokens / CSS variables */
}

@layer components {
  /* Component styles */
}

@layer utilities {
  /* Utility classes (Tailwind) */
}

@layer overrides {
  /* Third-party overrides (Clerk, etc.) */
}
```

**Impact:** Without layers, specificity wars occur and `!important` becomes necessary.

---

#### 2. No Specificity Management Strategy

**Best Practice:** Keep specificity flat and predictable.
**Current State:** Mixed specificity levels found:

```css
/* Low specificity (good) */
.btn-primary {
}

/* High specificity (problematic) */
.dashboard-sidebar .dashboard-sidebar-item.active {
}
html.theme-light .glass-component .premium-badge {
}
```

**Recommendation:** Use `:where()` to zero-out specificity where needed:

```css
/* Before - high specificity */
.dashboard-sidebar .dashboard-sidebar-item.active {
}

/* After - zero specificity wrapper */
:where(.dashboard-sidebar .dashboard-sidebar-item).active {
}
```

---

#### 3. Missing Design Token Hierarchy

**Best Practice:** Three-tier token system (primitive → semantic → component).
**Current State:** Flat variable structure without semantic meaning.

```css
/* Current - flat tokens */
--color-amber-accent: #f59e0b;
--bg-primary: #121212;

/* Best practice - tiered tokens */
/* Tier 1: Primitives (raw values) */
--amber-500: #f59e0b;
--amber-600: #d97706;
--gray-900: #121212;

/* Tier 2: Semantic (purpose-based) */
--color-accent: var(--amber-500);
--color-accent-hover: var(--amber-600);
--color-background: var(--gray-900);

/* Tier 3: Component (scoped usage) */
--button-bg: var(--color-accent);
--button-bg-hover: var(--color-accent-hover);
--card-bg: var(--color-background);
```

---

### Performance Gaps

#### 4. No Critical CSS Strategy

**Best Practice:** Inline above-the-fold CSS, defer the rest.
**Current State:** All 4,233 lines loaded synchronously.

**Recommendation:**

- Extract critical path CSS (~15KB) for initial render
- Lazy-load non-critical styles (chat, onboarding, learn)
- Use `media="print" onload` pattern for deferred CSS

```html
<!-- Critical CSS inlined -->
<style>
  /* above-the-fold styles */
</style>

<!-- Non-critical deferred -->
<link rel="stylesheet" href="chat.css" media="print" onload="this.media='all'" />
```

---

#### 5. No CSS Containment

**Best Practice:** Use `contain` property to isolate component rendering.
**Current State:** No containment boundaries defined.

```css
/* Recommended for heavy components */
.kpi-card {
  contain: layout style paint;
}

.chat-message {
  contain: content;
}

.dashboard-sidebar {
  contain: strict;
}
```

**Impact:** Browser can optimize rendering by knowing component boundaries.

---

#### 6. No `will-change` Optimization

**Best Practice:** Hint browser about animated properties.
**Current State:** Animations don't declare `will-change`.

```css
/* Add to frequently animated elements */
.animate-shimmer {
  will-change: background-position;
}

.dashboard-sidebar {
  will-change: transform, width;
}

/* Remove after animation */
.animation-complete {
  will-change: auto;
}
```

---

### Modern CSS Gaps

#### 7. No Logical Properties

**Best Practice:** Use logical properties for internationalization support.
**Current State:** Physical properties only (`margin-left`, `padding-right`).

```css
/* Before - physical (LTR only) */
margin-left: 1rem;
padding-right: 0.5rem;
text-align: left;

/* After - logical (RTL-ready) */
margin-inline-start: 1rem;
padding-inline-end: 0.5rem;
text-align: start;
```

---

#### 8. No Native CSS Nesting

**Best Practice:** Tailwind 4 supports native CSS nesting.
**Current State:** Flat selectors with repetition.

```css
/* Before - repetitive */
.chat-input {
}
.chat-input:focus {
}
.chat-input::placeholder {
}
.chat-input:disabled {
}

/* After - native nesting */
.chat-input {
  /* base styles */

  &:focus {
    /* focus styles */
  }

  &::placeholder {
    /* placeholder styles */
  }

  &:disabled {
    /* disabled styles */
  }
}
```

---

#### 9. Stacking Context Not Isolated

**Best Practice:** Use `isolation: isolate` to create stacking contexts.
**Current State:** Z-index values compete globally.

```css
/* Create isolated stacking contexts */
.modal-container {
  isolation: isolate;
}

.chat-panel {
  isolation: isolate;
}

.sidebar {
  isolation: isolate;
}
```

---

### Accessibility Gaps

#### 10. No Focus-Visible Strategy

**Best Practice:** Use `:focus-visible` for keyboard-only focus styles.
**Current State:** Mixed `:focus` usage.

```css
/* Before - shows focus ring on click */
.btn-primary:focus {
  outline: 2px solid var(--color-accent);
}

/* After - keyboard only */
.btn-primary:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}

.btn-primary:focus:not(:focus-visible) {
  outline: none;
}
```

---

#### 11. No Forced Colors Mode Support

**Best Practice:** Support Windows High Contrast Mode.
**Current State:** No `@media (forced-colors: active)` rules.

```css
@media (forced-colors: active) {
  .btn-primary {
    border: 2px solid currentColor;
  }

  .glass-component {
    background: Canvas;
    border: 1px solid CanvasText;
  }
}
```

---

## Recommended Fixes

### Fix 1: Implement Tiered Design Tokens

Add to `_theme.css` using three-tier token system:

```css
:root {
  /* ========================================
     TIER 1: PRIMITIVE TOKENS (Raw Values)
     ======================================== */
  --amber-50: #fffbeb;
  --amber-100: #fef3c7;
  --amber-200: #fde68a;
  --amber-300: #fcd34d;
  --amber-400: #fbbf24;
  --amber-500: #f59e0b;
  --amber-600: #d97706;
  --amber-700: #b45309;

  --gray-50: #fafafa;
  --gray-100: #f4f4f5;
  --gray-800: #27272a;
  --gray-900: #18181b;
  --gray-950: #121212;

  --emerald-500: #10b981;
  --red-500: #ef4444;
  --blue-500: #3b82f6;

  /* ========================================
     TIER 2: SEMANTIC TOKENS (Purpose-Based)
     ======================================== */
  /* Accent */
  --color-accent: var(--amber-500);
  --color-accent-hover: var(--amber-600);
  --color-accent-light: var(--amber-400);
  --color-accent-subtle: var(--amber-200);

  /* Feedback */
  --color-success: var(--emerald-500);
  --color-error: var(--red-500);
  --color-warning: var(--amber-500);
  --color-info: var(--blue-500);

  /* Surfaces */
  --color-surface-primary: var(--gray-950);
  --color-surface-secondary: var(--gray-900);
  --color-surface-elevated: var(--gray-800);

  /* Text */
  --color-text-primary: rgba(255, 255, 255, 0.95);
  --color-text-secondary: rgba(255, 255, 255, 0.7);
  --color-text-muted: rgba(255, 255, 255, 0.5);

  /* ========================================
     TIER 3: COMPONENT TOKENS (Scoped Usage)
     ======================================== */
  --button-bg: var(--color-accent);
  --button-bg-hover: var(--color-accent-hover);
  --button-text: var(--gray-950);

  --card-bg: var(--color-surface-secondary);
  --card-border: rgba(255, 255, 255, 0.1);

  --input-bg: var(--color-surface-secondary);
  --input-border: rgba(255, 255, 255, 0.15);
  --input-border-focus: var(--color-accent);

  --link-color: var(--color-accent);
  --link-color-hover: var(--color-accent-hover);
}
```

Then replace all hardcoded values:

```css
/* Before */
color: #f59e0b;
background-color: #f59e0b;

/* After - use semantic token */
color: var(--color-accent);
background-color: var(--button-bg);
```

---

### Fix 2: Create Z-Index Scale with Stacking Contexts

Add to `_base.css`:

```css
:root {
  /* Z-Index Scale - Use with isolation: isolate */
  --z-base: 0;
  --z-dropdown: 100;
  --z-sticky: 200;
  --z-fixed: 300;
  --z-modal-backdrop: 400;
  --z-modal: 500;
  --z-popover: 600;
  --z-tooltip: 700;
  --z-toast: 800;
  --z-overlay: 900;
  --z-max: 9999;
}

/* Stacking context isolation - prevents z-index leaking */
.stacking-context {
  isolation: isolate;
}
```

Apply isolation to major layout sections:

```css
/* Isolate major sections */
.dashboard-layout {
  isolation: isolate;
}

.chat-panel {
  isolation: isolate;
  z-index: var(--z-fixed);
}

.modal-container {
  isolation: isolate;
  z-index: var(--z-modal);
}

.sidebar {
  isolation: isolate;
  z-index: var(--z-sticky);
}
```

Usage:

```css
/* Before - global z-index competition */
z-index: 50;

/* After - scoped within stacking context */
.modal-container {
  isolation: isolate;

  .modal-backdrop {
    z-index: var(--z-modal-backdrop);
  }

  .modal-content {
    z-index: var(--z-modal);
  }
}
```

---

### Fix 3: Split Dashboard CSS

Create new files:

```
src/styles/dashboard/
├── _layout.css         Dashboard structure, sidebar
├── _kpi-cards.css      KPI card styles, hover effects
├── _navigation.css     Bottom nav, tab navigation
└── _loading.css        Skeleton, shimmer states
```

Update `globals.css`:

```css
@import './styles/dashboard/_layout.css';
@import './styles/dashboard/_kpi-cards.css';
@import './styles/dashboard/_navigation.css';
@import './styles/dashboard/_loading.css';
```

---

### Fix 4: Create Transition Variables

Add to `_theme.css`:

```css
:root {
  /* Transition Timing */
  --transition-fast: 150ms ease;
  --transition-normal: 200ms ease;
  --transition-slow: 300ms ease;
  --transition-theme: 400ms ease;

  /* Transition Properties */
  --transition-colors:
    color var(--transition-fast), background-color var(--transition-fast),
    border-color var(--transition-fast);
  --transition-transform: transform var(--transition-normal);
  --transition-all: all var(--transition-normal);
}
```

---

### Fix 5: Add Reduced Motion Support (Targeted Approach)

Add to `_animations.css` - target specific animations instead of using `!important`:

```css
/* Define motion preference custom property */
:root {
  --motion-duration: 1;
  --motion-reduced: 0;
}

@media (prefers-reduced-motion: reduce) {
  :root {
    --motion-duration: 0;
    --motion-reduced: 1;
  }
}

/* Use calc() for duration scaling */
.animate-shimmer {
  animation-duration: calc(2s * var(--motion-duration));
}

.animate-slide-in {
  animation-duration: calc(0.3s * var(--motion-duration));
}

/* Targeted reduced motion overrides */
@media (prefers-reduced-motion: reduce) {
  /* Decorative animations - disable completely */
  .animate-shimmer,
  .animate-pulse-luxury,
  .luxury-fade-in,
  .animate-marquee {
    animation: none;
  }

  /* Functional animations - reduce but keep feedback */
  .animate-slide-in,
  .animate-fade-in {
    animation-duration: 0.01ms;
    animation-fill-mode: forwards;
  }

  /* Transitions - instant but preserve state changes */
  .btn-primary,
  .card,
  .sidebar,
  .chat-input {
    transition-duration: 0.01ms;
  }

  /* Ensure final states are visible */
  .luxury-fade-in,
  .animate-slide-in {
    opacity: 1;
    transform: none;
  }
}
```

**Why avoid global `!important`:**

- Breaks CSS specificity model
- Makes debugging difficult
- Can disable important UI feedback
- Targeted approach is more maintainable

---

### Fix 6: Remove Theme Duplication

Refactor minimal theme to only override differences:

```css
/* Before - full duplication */
html.theme-minimal {
  --bg-primary: #121212;
  --bg-secondary: #1a1a1a;
  /* 100+ more variables... */
}

/* After - only differences */
html.theme-minimal {
  /* Minimal inherits from :root, only override differences */
  --bg-secondary: #1e1e1e;
  --border-subtle: rgba(255, 255, 255, 0.08);
}
```

---

### Fix 7: Audit and Remove Unused Classes

Run PurgeCSS or manually verify usage of:

```css
/* Verify these are used */
.theme-transitioning {
}
.animated-shell-container {
}
.content-shadow {
}
```

---

### Fix 8: Implement CSS Layers

Update `globals.css` to use cascade layers:

```css
/* Define layer order - later layers have higher priority */
@layer reset, base, tokens, components, utilities, vendor, overrides;

/* Import files into appropriate layers */
@import './styles/_base.css' layer(reset);
@import './styles/_theme.css' layer(tokens);
@import './styles/_animations.css' layer(base);
@import './styles/_forms.css' layer(components);
@import './styles/_components.css' layer(components);
@import './styles/_dashboard.css' layer(components);
@import './styles/_chat.css' layer(components);
@import './styles/_onboarding.css' layer(components);
@import './styles/_health-score.css' layer(components);
@import './styles/_learn.css' layer(components);
@import './styles/_nprogress.css' layer(vendor);

/* Tailwind utilities go in utilities layer */
@layer utilities {
  @tailwind utilities;
}

/* Third-party overrides (Clerk, etc.) */
@layer overrides {
  /* Clerk auth overrides */
  .cl-internal-b3fm6y {
    display: none;
  }
}
```

**Benefits:**

- Predictable cascade regardless of source order
- Utilities always win over components
- Vendor styles isolated from application styles
- Overrides always have highest priority

---

### Fix 9: Add Focus-Visible and Forced Colors

Add to `_base.css`:

```css
/* Focus-visible for keyboard navigation */
:focus {
  outline: none;
}

:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}

/* Interactive elements */
button:focus-visible,
a:focus-visible,
input:focus-visible,
select:focus-visible,
textarea:focus-visible,
[tabindex]:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}

/* Forced colors mode (Windows High Contrast) */
@media (forced-colors: active) {
  /* Ensure borders are visible */
  .glass-component,
  .card,
  .btn-primary,
  .btn-secondary {
    border: 2px solid currentColor;
  }

  /* Use system colors */
  .btn-primary {
    background: ButtonFace;
    color: ButtonText;
  }

  /* Ensure focus is visible */
  :focus-visible {
    outline: 3px solid Highlight;
  }

  /* Links should be distinguishable */
  a {
    color: LinkText;
  }
}
```

---

### Fix 10: Add CSS Containment for Performance

Add to heavy/complex components:

```css
/* Layout containment - component doesn't affect outside layout */
.kpi-card,
.chat-message,
.sidebar-item {
  contain: layout;
}

/* Paint containment - component rendering is isolated */
.dashboard-grid,
.chat-container {
  contain: paint;
}

/* Style containment - counters/quotes scoped to element */
.markdown-content {
  contain: style;
}

/* Content containment - size independent of children */
.modal-content {
  contain: content;
}

/* Strict containment - all of the above */
.virtualized-list-item {
  contain: strict;
}
```

---

## Implementation Checklist

### Phase 1: Foundation (Critical)

- [ ] Implement CSS Layers in `globals.css` (Fix 8)
- [ ] Add tiered design tokens to `_theme.css` (Fix 1)
- [ ] Add z-index scale with stacking contexts to `_base.css` (Fix 2)
- [ ] Add transition variables to `_theme.css` (Fix 4)

### Phase 2: Token Migration (High Priority)

- [ ] Replace all hardcoded `#f59e0b` with `var(--color-accent)`
- [ ] Replace hardcoded z-index values with scale variables
- [ ] Add `isolation: isolate` to major layout components
- [ ] Migrate transitions to use variables

### Phase 3: Organization (Medium Priority)

- [ ] Split `_dashboard.css` into 4 sub-files (Fix 3)
- [ ] Update `globals.css` imports with layer assignments
- [ ] Remove duplicate minimal theme variables (Fix 6)
- [ ] Refactor to native CSS nesting where beneficial

### Phase 4: Accessibility (Medium Priority)

- [ ] Add `:focus-visible` styles (Fix 9)
- [ ] Add `@media (forced-colors: active)` support (Fix 9)
- [ ] Add comprehensive reduced motion support (Fix 5)
- [ ] Audit color contrast ratios

### Phase 5: Performance (Lower Priority)

- [ ] Add CSS containment to heavy components (Fix 10)
- [ ] Add `will-change` to animated elements
- [ ] Implement critical CSS extraction
- [ ] Audit and remove unused classes (Fix 7)

### Phase 6: Documentation (Ongoing)

- [ ] Document custom class purposes
- [ ] Establish naming convention standard
- [ ] Create CSS architecture diagram
- [ ] Document z-index scale usage

---

## Appendix: Tailwind Configuration

### Custom Extensions

**Fluid Typography:**

```javascript
fontSize: {
  'fluid-xs': 'clamp(0.625rem, 0.5rem + 0.5vw, 0.75rem)',
  'fluid-sm': 'clamp(0.75rem, 0.625rem + 0.5vw, 0.875rem)',
  'fluid-base': 'clamp(0.875rem, 0.75rem + 0.5vw, 1rem)',
  'fluid-lg': 'clamp(1rem, 0.875rem + 0.5vw, 1.125rem)',
  'fluid-xl': 'clamp(1.125rem, 1rem + 0.5vw, 1.25rem)',
  'fluid-2xl': 'clamp(1.25rem, 1rem + 1vw, 1.5rem)',
  'fluid-3xl': 'clamp(1.5rem, 1.25rem + 1vw, 1.875rem)',
  'fluid-4xl': 'clamp(1.875rem, 1.5rem + 1.5vw, 2.25rem)',
}
```

**Fluid Spacing:**

```javascript
spacing: {
  'fluid-1': 'clamp(0.25rem, 0.2rem + 0.25vw, 0.375rem)',
  'fluid-2': 'clamp(0.5rem, 0.4rem + 0.5vw, 0.75rem)',
  'fluid-4': 'clamp(1rem, 0.8rem + 1vw, 1.5rem)',
  'fluid-8': 'clamp(2rem, 1.5rem + 2vw, 3rem)',
}
```

**Safelisted Classes:** 58 dynamic classes protected from tree-shaking

---

## Browser Compatibility

### Features Currently in Use

| Feature               | Chrome | Firefox | Safari | Edge | Notes                            |
| --------------------- | ------ | ------- | ------ | ---- | -------------------------------- |
| CSS Custom Properties | 49+    | 31+     | 9.1+   | 15+  | Full support                     |
| CSS Grid              | 57+    | 52+     | 10.1+  | 16+  | Full support                     |
| Container Queries     | 105+   | 110+    | 16+    | 105+ | Used in dashboard                |
| `clamp()`             | 79+    | 75+     | 13.1+  | 79+  | Fluid typography                 |
| View Transitions API  | 111+   | No      | No     | 111+ | Theme switching - needs fallback |
| `:focus-visible`      | 86+    | 85+     | 15.4+  | 86+  | Good support                     |

### Features Recommended to Add

| Feature               | Chrome | Firefox | Safari | Edge | Notes             |
| --------------------- | ------ | ------- | ------ | ---- | ----------------- |
| CSS Layers (`@layer`) | 99+    | 97+     | 15.4+  | 99+  | Cascade control   |
| `isolation: isolate`  | 52+    | 36+     | 10.1+  | 79+  | Stacking contexts |
| CSS Nesting           | 112+   | 117+    | 16.5+  | 112+ | Native support    |
| `contain` property    | 52+    | 69+     | 15.4+  | 79+  | Performance       |
| `forced-colors` media | 89+    | 89+     | No     | 79+  | Accessibility     |
| Logical Properties    | 87+    | 66+     | 15+    | 87+  | RTL support       |

### Fallback Requirements

**View Transitions API:**

```css
/* Feature detection fallback */
@supports not (view-transition-name: none) {
  html.theme-transitioning {
    transition: background-color 0.4s ease;
  }
}
```

**Container Queries:**

```css
/* Fallback for older browsers */
@supports not (container-type: inline-size) {
  .kpi-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  }
}
```

**CSS Layers:**

```css
/* Layers degrade gracefully - styles still apply, just without layer cascade control */
/* No explicit fallback needed, but test in Safari 15.3 and below */
```

### Minimum Browser Targets (Recommended)

Based on feature usage:

| Browser | Minimum Version | Release Date |
| ------- | --------------- | ------------ |
| Chrome  | 105+            | Aug 2022     |
| Firefox | 110+            | Feb 2023     |
| Safari  | 16+             | Sep 2022     |
| Edge    | 105+            | Aug 2022     |

**Coverage:** ~95% of global users (as of 2025)

---

## References

- [CSS Cascade Layers (MDN)](https://developer.mozilla.org/en-US/docs/Web/CSS/@layer)
- [Design Tokens Format](https://design-tokens.github.io/community-group/format/)
- [CSS Containment (web.dev)](https://web.dev/css-containment/)
- [Logical Properties (MDN)](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_logical_properties_and_values)
- [WCAG 2.1 Focus Visible](https://www.w3.org/WAI/WCAG21/Understanding/focus-visible.html)
- [Tailwind CSS v4 Documentation](https://tailwindcss.com/docs)

---

_Review completed by CSS Architecture Analysis_
_Last updated: 2026-01-06_
