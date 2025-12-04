import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useDeviceType } from '@/hooks/useDeviceType'; // Import useDeviceType

const NotFound = () => {
  const location = useLocation();
  const { isIOS } = useDeviceType(); // Use the hook

  useEffect(() => {
    // This console.error is kept as it's useful for debugging unexpected routes in production.
    // console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div 
      className="flex min-h-screen items-center justify-center bg-gray-100"
      style={isIOS ? { minHeight: 'calc(var(--vh, 1vh) * 100)' } : { minHeight: '100vh' }} // Apply custom vh for iOS
    >
      <div className="text-center">
        <h1 className="mb-4 text-4xl font-bold">404</h1>
        <p className="mb-4 text-xl text-gray-600">Oops! Page not found</p>
        <a href="/" className="text-blue-500 underline hover:text-blue-700">
          Return to Home
        </a>
      </div>
    </div>
  );
};

export default NotFound;