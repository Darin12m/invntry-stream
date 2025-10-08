import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { ThemeProvider } from "./components/theme-provider.tsx"; // Import ThemeProvider
import { Toaster } from "@/components/ui/toaster"; // Keep Toaster here
import { Toaster as Sonner } from "@/components/ui/sonner"; // Keep Sonner here

createRoot(document.getElementById("root")!).render(
  <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
    <App />
    <Toaster />
    <Sonner />
  </ThemeProvider>
);