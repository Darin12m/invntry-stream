# AI Rules for invntry-stream Application

This document outlines the core technologies used in the `invntry-stream` application and provides clear guidelines for using specific libraries and frameworks. Adhering to these rules ensures consistency, maintainability, and optimal performance.

## Tech Stack Overview

*   **React**: A JavaScript library for building user interfaces.
*   **TypeScript**: A superset of JavaScript that adds static typing, enhancing code quality and developer experience.
*   **Vite**: A fast build tool that provides an instant development server and bundles your code for production.
*   **Tailwind CSS**: A utility-first CSS framework for rapidly building custom designs.
*   **shadcn/ui**: A collection of reusable components built with Radix UI and styled with Tailwind CSS.
*   **React Router**: A standard library for routing in React applications.
*   **Firebase**: Used for backend services, including Firestore (NoSQL database) and Authentication.
*   **TanStack Query (React Query)**: A powerful library for managing server state, data fetching, caching, and synchronization.
*   **Sonner**: A modern toast notification library for displaying messages to the user.
*   **Lucide React**: A library providing a set of beautiful, pixel-perfect icons.
*   **HTML2Canvas, jsPDF, XLSX**: Libraries for client-side PDF generation and Excel file import/export.
*   **Capacitor**: An open-source native runtime that allows web apps to run on iOS, Android, and desktop as native apps.

## Library Usage Rules

To maintain a consistent and efficient codebase, please follow these guidelines when implementing new features or modifying existing ones:

*   **UI Components**:
    *   **Always** use components from `shadcn/ui` (e.g., `Button`, `Card`, `Input`, `Label`, `Checkbox`, `Badge`, `Popover`, `Avatar`, `Textarea`).
    *   If a required component is not available in `shadcn/ui` or needs significant customization, create a **new, separate component** in `src/components/` and style it using Tailwind CSS. **Do not modify files within `src/components/ui/`**.
*   **Styling**:
    *   **Exclusively** use **Tailwind CSS** for all styling. Avoid writing custom CSS classes or inline styles unless absolutely necessary for dynamic, calculated styles.
    *   Ensure designs are **responsive** using Tailwind's utility classes.
*   **Routing**:
    *   Use **`react-router-dom`** for all client-side navigation.
    *   All main application routes should be defined in `src/App.tsx`.
*   **State Management (Server Data)**:
    *   For fetching, caching, and updating server data (e.g., products, invoices from Firebase), use **`TanStack Query`**.
*   **Authentication & Database**:
    *   **Firebase Auth** (`firebase/auth`) must be used for all user authentication flows (login, logout).
    *   **Firebase Firestore** (`firebase/firestore`) must be used for all database interactions (adding, getting, updating, deleting products and invoices).
*   **Notifications**:
    *   Use **`sonner`** for all toast notifications to provide user feedback (e.g., success messages, error alerts).
*   **Icons**:
    *   Use **`lucide-react`** for all icons throughout the application.
*   **File Operations**:
    *   For importing data from Excel files, use **`xlsx`**.
    *   For generating and downloading PDF invoices, use **`html2canvas`** (to capture content) and **`jspdf`** (to create the PDF).
*   **Mobile Detection**:
    *   If you need to check if the user is on a mobile device, use the `useIsMobile` hook from `src/hooks/use-mobile.tsx`.
*   **Code Structure**:
    *   New components should be created in `src/components/`.
    *   New pages should be created in `src/pages/`.
    *   Utility functions should be placed in `src/lib/` or `src/utils/`.
    *   Hooks should be placed in `src/hooks/`.
*   **Error Handling**:
    *   Do not use `try/catch` blocks for API calls unless specifically requested. Let errors bubble up to be caught by global error boundaries or `TanStack Query` error handling mechanisms.