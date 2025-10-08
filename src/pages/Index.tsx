import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth } from "@/lib/firebase";
import InventoryManagementApp from "@/components/InventoryManagement";

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

  return <InventoryManagementApp />;
};

export default Index;
