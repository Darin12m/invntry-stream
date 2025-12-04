# AI Rules for Invntry-Stream Application

This document outlines the core technologies used in the Invntry-Stream application and provides clear guidelines on which libraries to use for specific functionalities. Adhering to these rules ensures consistency, maintainability, and optimal performance across the codebase.

## Tech Stack Overview

*   **Frontend Framework**: React with TypeScript for building dynamic user interfaces.
*   **Build Tool**: Vite for a fast development experience and optimized builds.
*   **Styling**: Tailwind CSS for utility-first CSS, enabling rapid and consistent styling.
*   **UI Components**: shadcn/ui, built on Radix UI, for accessible and customizable UI components.
*   **Routing**: React Router DOM for declarative client-side routing.
*   **State Management**: React Context API for global state, complemented by custom React Hooks for feature-specific logic.
*   **Data Fetching**: React Query (`@tanstack/react-query`) for efficient server state management.
*   **Backend & Database**: Firebase (Firestore for database, Firebase Auth for authentication).
*   **Icons**: Lucide React for a comprehensive set of customizable SVG icons.
*   **Notifications**: Sonner for elegant and accessible toast notifications.
*   **PDF Generation**: `jspdf` and `html2canvas` for client-side PDF creation from HTML.
*   **Mobile Responsiveness**: Capacitor for native mobile app capabilities, with custom hooks (`useDeviceType`) and Tailwind CSS for responsive design.

## Library Usage Rules

To maintain a clean and efficient codebase, please follow these guidelines when implementing new features or modifying existing ones:

1.  **UI Components**:
    *   **Always** prioritize `shadcn/ui` components (e.g., `Button`, `Card`, `Input`, `Dialog`, `Select`, `Switch`).
    *   If a required component is not available in `shadcn/ui` or needs significant customization, create a **new component file** in `src/components/` and style it using Tailwind CSS.
    *   **Never** modify files within `src/components/ui/` directly.

2.  **Styling**:
    *   **Exclusively** use Tailwind CSS classes for all styling.
    *   Avoid inline styles unless absolutely necessary for dynamic, calculated values.
    *   Ensure designs are responsive, leveraging Tailwind's responsive prefixes and the `useDeviceType` hook for device-specific adjustments. Prioritize a mobile-first approach.

3.  **Icons**:
    *   Use icons from the `lucide-react` library.

4.  **Routing**:
    *   Use `react-router-dom` for all client-side navigation.
    *   Define all primary routes within `src/App.tsx`.

5.  **State Management**:
    *   For global application state (e.g., `currentUser`, `products`, `invoices`, `settings`), use the `AppContext` in `src/context/AppContext.tsx`.
    *   For feature-specific logic, data fetching, and state management, create custom React Hooks in `src/hooks/`.

6.  **Data Persistence**:
    *   Firebase Firestore is the designated database. All interactions with Firestore should go through the service files located in `src/services/firestore/`.
    *   **Do not** directly import `firebase/firestore` into components or hooks unless absolutely necessary for batch operations or specific queries not covered by existing services.

7.  **Authentication**:
    *   Firebase Authentication is used for user management. All authentication logic should be handled via the `useAuth` hook in `src/hooks/useAuth.ts`.

8.  **Notifications**:
    *   Use `sonner` for all toast notifications to provide user feedback. Import `toast` from `sonner` directly.

9.  **PDF Generation**:
    *   For generating PDFs from HTML content, use `jspdf` in conjunction with `html2canvas`.

10. **Date Handling**:
    *   For any date formatting, parsing, or manipulation, use the `date-fns` library.

11. **Utility Functions**:
    *   Create small, focused utility functions in `src/utils/` for common, reusable logic (e.g., `cn.ts` for Tailwind class merging, `helpers.ts` for general helpers, `invoiceCalculations.ts` for invoice-specific math).

12. **File Structure**:
    *   New components should be placed in `src/components/`.
    *   New pages should be placed in `src/pages/`.
    *   New hooks should be placed in `src/hooks/`.
    *   New services should be placed in `src/services/firestore/`.
    *   New utility functions should be placed in `src/utils/`.
    *   Directory names **must** be all lower-case. File names may use mixed-case.