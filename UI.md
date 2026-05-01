# Universal Industrial Management System UI/UX Standards

This document defines high-fidelity standards for building modern, premium management systems (ERP, HRMS, CRM, Inventory). Follow these patterns to ensure a professional, industrial-standard SaaS experience.

---

## 🎨 Core Design System

### 1. Minimalist Color Palette
- **Primary Action**: `#58cc02` (Lime/Safety Green) or `Indigo-600` (Professional Blue).
- **Backgrounds**: Use `Slate` or `Gray` 50/100 for depth.
- **Borders**: Subtle `gray-200` or `white/20`.
- **States**:
  - `Success`: Green (Soft bg, sharp text).
  - `Warning`: Amber/Orange.
  - `Danger`: Rose/Red.
- **Glassmorphism**: Use `backdrop-blur-md` on modals and navigation bars for a premium feel.

### 2. Interaction & Motion
- **Global Transitions**: `* { transition: all 0.2s ease-in-out; }`.
- **Focus States**: High visibility rings (e.g., `ring-2 ring-primary ring-offset-2`).
- **Micro-animations**: Subtle hover lifts (`hover:-translate-y-0.5`) and shimmer loaders.

---

## 🧱 Architectural Patterns

### 1. Dashboard & Layout
- **Sidebar**: Collapsible, minimalist icons, active state high-contrast.
- **Top Bar**: Search-focused, breadcrumbs for navigation, profile/notifications.
- **Stats Cards**: 3-4 column grid, large font for numbers, trend indicators (up/down arrows).

### 2. The "Smart" Data Table
- **Responsive Hybrid**: 
  - **Desktop**: Multi-column table with horizontal scroll (`scrollbar-thin`).
  - **Mobile**: Transforms into a vertical Stacked Card view.
- **Features**:
  - Sticky Headers (`sticky top-0`).
  - Inline editing capability.
  - Multi-select (Checkbox) with batch action toolbar.
  - Sorting via `SortIcon` sub-components.

### 3. Management System Forms
- **Centered Modals**: For record creation/editing to avoid page-context loss.
- **Input Design**: Consistent spacing, clear labels, and inline validation.
- **Searchable Dropdowns**: Essential for long lists (Clients, Items, Employees).

### 4. Professional Skeleton Loaders
- **Anti-Flicker Logic**: Always implement a minimum loading state (~1.2s-1.5s).
- **Match Identity**: Skeleton should mirror the final component's structure (Table rows, Card shapes).
- **Shimmer**: Fast, horizontal gradient animation.

---

## 🏗️ Technical Implementation Standards

### Data Fetching & State
- **Abortable Requests**: Use `AbortController` in all `useEffect` hooks.
- **Optimistic UI**: Update UI immediately on action, then sync with the backend.
- **Empty States**: Never show a blank screen. If no data, show an icon + "No Records Found" message.

### Performance & Scaling
- **List Virtualization**: Use for 1000+ records.
- **Memoization**: `useMemo` for filtered datasets; `useCallback` for row actions.
- **SVG over Images**: Use `lucide-react` for scalable, theme-aware icons.

---

## 🛡️ Industrial Best Practices

- **Role-Based Visibility (RBAC)**: Elements should be conditionally rendered based on user permissions.
- **Audit Tracking**: All management screens should ideally display/track "Created By" and "Modified Time".
- **Print/PDF Utility**: Include `.no-print` classes for reports and `.print-only` for specialized layouts.
- **Success Feedback**: Use non-intrusive Toast notifications for background tasks and centered overlays for critical confirmations.
