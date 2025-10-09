import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth } from "@/lib/firebase";
import InventoryManagementApp from "@/components/InventoryManagement";
import OnboardingWizard from "@/components/OnboardingWizard"; // Import the new OnboardingWizard

const Index = () => {
  const [loading, setLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false); // State to control onboarding visibility
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (!user) {
        navigate("/login");
      } else {
        // Check if onboarding has been completed (e.g., using localStorage)
        const onboardingCompleted = localStorage.getItem('onboardingCompleted');
        if (!onboardingCompleted) {
          setShowOnboarding(true);
        }
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [navigate]);

  const handleOnboardingComplete = () => {
    localStorage.setItem('onboardingCompleted', 'true'); // Mark onboarding as complete
    setShowOnboarding(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <>
      {showOnboarding && <OnboardingWizard onComplete={handleOnboardingComplete} />}
      <InventoryManagementApp />
    </>
  );
};

export default Index;