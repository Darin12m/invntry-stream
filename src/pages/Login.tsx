import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { AppContext } from "@/context/AppContext";
import { useContext } from "react";
import { useDeviceType } from '@/hooks/useDeviceType'; // Import useDeviceType

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { login, loadingAuth, authError } = useAuth();
  const { currentUser, loading: loadingApp } = useContext(AppContext);
  const navigate = useNavigate();
  const { isIOS } = useDeviceType(); // Use the hook

  useEffect(() => {
    // Only navigate when user is authenticated AND data loading is complete
    if (currentUser && !loadingApp) {
      navigate("/", { replace: true });
    }
  }, [loadingApp, currentUser, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      // useAuth hook will handle toast.error
      return;
    }
    try {
      await login(email, password);
    } catch (err) {
      // Error already handled by useAuth and global context
    }
  };

  if (loadingApp) {
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
    <div 
      className="flex items-center justify-center bg-gradient-to-br from-background to-muted p-4"
      style={isIOS ? { minHeight: 'calc(var(--vh, 1vh) * 100)' } : { minHeight: '100vh' }} // Apply custom vh for iOS
    >
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">Login</CardTitle>
          <CardDescription className="text-center">
            Enter your credentials to access your inventory
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loadingAuth}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loadingAuth}
                required
              />
            </div>
            {authError && (
              <p className="text-sm text-destructive text-center">{authError}</p>
            )}
            <Button type="submit" className="w-full" disabled={loadingAuth}>
              {loadingAuth ? "Logging in..." : "Login"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;