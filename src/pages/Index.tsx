import { useEffect, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { AppContext } from "@/context/AppContext";
import AppLayout from "@/layouts/AppLayout";
import { useDeviceType } from '@/hooks/useDeviceType'; // Import useDeviceType

const Index = () => {
  const { currentUser, loading } = useContext(AppContext);
  const navigate = useNavigate();
  const { isIOS } = useDeviceType(); // Use the hook

  useEffect(() => {
    if (!loading && !currentUser) {
      navigate("/login");
    }
  }, [loading, currentUser, navigate]);

  if (loading || !currentUser) {
    return (
      <div 
        className="flex items-center justify-center"
        style={isIOS ? { minHeight: 'calc(var(--vh, 1vh) * 100)' } : { minHeight: '100vh' }} // Apply custom vh for iOS
      >
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <AppLayout />
  );
};

export default Index;