import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { AppContext } from "@/context/AppContext";
import { useContext } from "react";
import { useDeviceType } from '@/hooks/useDeviceType';
import { Package } from 'lucide-react';

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { login, loadingAuth, authError } = useAuth();
  const { currentUser, loading: loadingApp } = useContext(AppContext);
  const navigate = useNavigate();
  const { isIOS } = useDeviceType();

  useEffect(() => {
    if (currentUser && !loadingApp) {
      navigate("/", { replace: true });
    }
  }, [loadingApp, currentUser, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
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
        className="flex items-center justify-center bg-background"
        style={isIOS ? { minHeight: 'calc(var(--vh, 1vh) * 100)' } : { minHeight: '100vh' }}
      >
        <div className="text-center">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Package className="h-6 w-6 text-primary animate-pulse" />
          </div>
          <p className="text-muted-foreground font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="flex items-center justify-center bg-background p-4"
      style={isIOS ? { minHeight: 'calc(var(--vh, 1vh) * 100)' } : { minHeight: '100vh' }}
    >
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="w-14 h-14 rounded-2xl bg-primary shadow-lg shadow-primary/25 flex items-center justify-center mx-auto mb-4">
            <Package className="h-7 w-7 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl font-black tracking-tighter">Welcome back</CardTitle>
          <CardDescription>
            Enter your credentials to access your inventory
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-[11px] uppercase tracking-widest text-muted-foreground font-medium">Email</Label>
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
              <Label htmlFor="password" className="text-[11px] uppercase tracking-widest text-muted-foreground font-medium">Password</Label>
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