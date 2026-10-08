# Design System Specification

## Overview

This document specifies the UI/UX design rules, tokens, color system, component guidelines, and accessibility standards for the **AI-Based Food Redistribution System**.

The target aesthetic is a modern, high-end SaaS platform utilizing glassmorphism elements, clean card layouts, crisp typography, and responsive grid structures.

---

## 1. Color Palette & Tokens

### Primary Brand Palette
- **Primary / Emerald Green**: `#10B981` (`emerald-500`)
  - Usage: Primary CTAs, active status, environmental impact badges, success indicators.
  - Hover: `#059669` (`emerald-600`)
  - Muted: `rgba(16, 185, 129, 0.15)`
- **Secondary / Urgent Orange**: `#F97316` (`orange-500`)
  - Usage: Food expiry alerts, urgent surplus donations, high priority tags.
  - Hover: `#EA580C` (`orange-600`)
  - Muted: `rgba(249, 115, 22, 0.15)`
- **Accent / Dynamic Blue**: `#3B82F6` (`blue-500`)
  - Usage: Analytics charts, location/map pin highlights, NGO trust badges.
  - Hover: `#2563EB` (`blue-600`)
  - Muted: `rgba(59, 130, 246, 0.15)`

### Neutral Palette & Dark Mode Support
- **Light Theme**:
  - Background: `#F8FAFC` (`slate-50`)
  - Surface Card: `#FFFFFF` (`white`)
  - Text Primary: `#0F172A` (`slate-900`)
  - Text Muted: `#64748B` (`slate-500`)
  - Border: `#E2E8F0` (`slate-200`)
- **Dark Theme**:
  - Background: `#0F172A` (`slate-900`)
  - Surface Card: `#1E293B` (`slate-800`)
  - Text Primary: `#F8FAFC` (`slate-50`)
  - Text Muted: `#94A3B8` (`slate-400`)
  - Border: `#334155` (`slate-700`)

---

## 2. Glassmorphism Utilities

To maintain visual depth and dynamic modern feel, cards and floating headers employ glassmorphism styling:

- **Backdrop Blur**: `backdrop-blur-md` (12px blur)
- **Glass Card (Light)**: `bg-white/70 border border-white/40 shadow-xl backdrop-blur-md`
- **Glass Card (Dark)**: `bg-slate-900/70 border border-slate-700/50 shadow-2xl backdrop-blur-md`

---

## 3. Typography & Spacing

### Font Families
- Primary Body & UI: `Inter`, sans-serif
- Headings & KPI Cards: `Outfit`, sans-serif

### Hierarchy
- `H1`: 2.5rem (40px) / Bold / Leading tight
- `H2`: 2.0rem (32px) / SemiBold / Leading tight
- `H3`: 1.5rem (24px) / SemiBold / Leading normal
- `Subheading`: 1.125rem (18px) / Medium
- `Body`: 1.0rem (16px) / Regular / Leading relaxed
- `Caption`: 0.875rem (14px) / Regular / Text Muted

---

## 4. Components & Layout Conventions

### Border Radius
- Cards & Containers: `rounded-2xl` (16px)
- Buttons & Inputs: `rounded-xl` (12px)
- Badges & Pills: `rounded-full` (9999px)

### Shadows
- Standard Card: `shadow-md hover:shadow-xl transition-shadow duration-300`
- Glowing Accent Card: `shadow-[0_8px_30px_rgb(16,185,129,0.12)]`

### Animation Guidelines
- Micro-interactions powered by `framer-motion`:
  - Card Hover: `{ scale: 1.02, transition: { type: "spring", stiffness: 300 } }`
  - Page Transition: Fade in + slide up 10px.
  - Button Click: `{ scale: 0.98 }`

---

## 5. Accessibility & Responsiveness

- All interactive components must have visible focus rings (`focus:ring-2 focus:ring-emerald-500 focus:outline-none`).
- Minimum target size for mobile buttons: 44px height.
- Breakpoint standard:
  - Mobile: `< 640px` (sm)
  - Tablet: `640px - 1024px` (md/lg)
  - Desktop: `> 1024px` (xl/2xl)
