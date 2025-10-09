import { useEffect, useState, lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import { auth } from "@/lib/firebase";
// import InventoryManagementApp from "@/components/InventoryManagement"; // Original import

// Lazy load the InventoryManagementApp component
const InventoryManagementApp = lazy(() => import("@/components/InventoryManagement"));

const Index = () => {
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (!user) {
        navigate("/login");
      } else {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading application...</div>
      </div>
    }>
      <InventoryManagementApp />
    </Suspense>
  );
};

export default Index;