# Apple Liquid Glass UI Design Specification

- **Date**: 2026-10-08
- **Topic**: Apple macOS Sequoia & visionOS Liquid Glass (Glassmorphism) UI Transformation
- **Status**: Approved by User
- **Constraint**: DO NOT COMMIT OR PUSH to git (as explicitly requested by user).

---

## 1. Objectives

Transform the NSA Training Platform web UI from flat opaque surfaces into an Apple-inspired Liquid Glass aesthetic (macOS Sequoia / visionOS style):
- Translucent frosted crystal surfaces with multi-layer depth and backdrop blur.
- Subtle specular highlights on edges (`inset 0 1px 1px rgba(255, 255, 255, 0.95)`).
- Organic ambient illumination mesh in the canvas background to refract light through moving glass panels.
- Preserve 100% existing functionality, keyboard accessibility, high contrast readability (WCAG AAA), responsive layout, and tactile button physics.

---

## 2. Visual Architecture & Tokens

### 2.1 Ambient Canvas & Background
- **Root Background**: Fluid gradient `bg-gradient-to-br from-[#F0F4FC] via-[#F8FAFD] to-[#F5F1EB]`.
- **Ambient Light Halos**: Fixed blurred luminous spheres positioned behind all app content:
  - Top-left: Blue halo (`#60A5FA/15`, blur 140px, w-[520px] h-[520px]).
  - Center-right: NSA Gold halo (`#FBBF24/12`, blur 150px, w-[480px] h-[480px]).
  - Bottom-left: Indigo halo (`#818CF8/10`, blur 130px, w-[420px] h-[420px]).
- **Micro-Texture**: Subtle dot matrix overlay (`radial-gradient(#0A25400d 1px, transparent 1px)` with 24px spacing) to ground the refraction.

### 2.2 Core Liquid Glass Components

#### `Card` (`apps/web/src/components/ui.tsx`)
- Container background: `bg-white/70 backdrop-blur-xl`.
- Border: `border border-white/85`.
- Shadows: `shadow-[0_4px_24px_rgba(7,20,38,0.04),inset_0_1px_1px_rgba(255,255,255,0.95)]`.
- Hover (where interactive): `hover:bg-white/85 hover:shadow-[0_8px_32px_rgba(7,20,38,0.07),inset_0_1px_1px_white]`.

#### `AppLayout` Shell (`apps/web/src/app/AppLayout.tsx`)
- **Desktop Sidebar**:
  - `bg-white/65 backdrop-blur-2xl border-r border-white/60 shadow-[4px_0_24px_rgba(7,20,38,0.02)]`.
  - Active group button: `bg-white/75 text-[#0078D4] shadow-xs border border-white/90`.
  - Inactive group button: `hover:bg-white/50 text-slate-700`.
  - Flyout popup: `bg-white/85 backdrop-blur-2xl border border-white/90 shadow-2xl`.
  - User profile & Logout bar: `border-t border-white/60 bg-white/40`.
- **Header**:
  - Notification icon button: `bg-white/60 backdrop-blur-md border border-white/80 hover:bg-white/80 shadow-2xs`.
  - Notification Popover: `bg-white/85 backdrop-blur-3xl border border-white/90 shadow-elevated rounded-2xl`.

#### Form Controls (`Input`, `Select`, `Textarea` in `apps/web/src/components/ui.tsx`)
- Field background: `bg-white/60 backdrop-blur-md`.
- Border: `border-white/80`.
- Shadow: `shadow-2xs`.
- Focus state: `focus:bg-white/95 focus:border-gold/80 focus:ring-2 focus:ring-gold/20`.
- Custom Select dropdown popup: `bg-white/90 backdrop-blur-2xl border border-white/90 shadow-2xl rounded-2xl`.

#### Dialogs & Overlays (`Modal`)
- Backdrop: `bg-navy/30 backdrop-blur-md`.
- Panel: `bg-white/85 backdrop-blur-3xl border border-white/95 rounded-3xl shadow-[0_24px_64px_rgba(7,20,38,0.18),inset_0_1px_2px_white]`.

#### Buttons (`Button`)
- All buttons receive an Apple specular top rim highlight: `shadow-[...,inset_0_1px_0_rgba(255,255,255,0.35)]`.
- Ghost button: `bg-white/60 backdrop-blur-md border-white/80 hover:bg-white/85 text-navy`.

#### Tables & Filter Caps
- Table header row: `bg-white/50 backdrop-blur-md border-b border-white/70 text-gtext`.
- Table body rows: `hover:bg-white/60 transition-colors`.
- Filter caps / pill buttons: `bg-white/60 backdrop-blur-md border border-white/80`.

---

## 3. Implementation Steps

1. **Tokens & CSS**:
   - Update `apps/web/src/index.css` to add Apple glass utility classes and canvas mesh styles.
   - Extend `apps/web/tailwind.config.js` if necessary for custom box shadows and blurs.
2. **AppLayout Transformation**:
   - Wrap the main application shell with the ambient lighting halo container.
   - Refactor sidebar and top notification container to liquid glass styles.
3. **Core UI Library Transformation**:
   - Enhance `Card`, `Input`, `Select`, `Textarea`, `Button`, `Modal`, `SearchCombobox` with glass styling in `apps/web/src/components/ui.tsx` and `apps/web/src/components/SearchCombobox.tsx`.
4. **Verification**:
   - Run `npm run lint`, `npm run typecheck`, `npm run format:check`, `npm test`, `npm run build`.
   - Verify visually that the web platform renders a stunning Apple liquid glass theme.
   - DO NOT COMMIT or PUSH.
