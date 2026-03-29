'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Terminal, Lock, Mail, AlertTriangle, Eye, EyeOff } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [checkingStatus, setCheckingStatus] = useState(true);

  // Check if user is already logged in or if setup is needed
  useEffect(() => {
    async function checkAuth() {
      try {
        // First check if setup is needed (no users exist)
        const statusRes = await fetch('/api/auth/status');
        if (statusRes.ok) {
          const statusData = await statusRes.json();
          if (statusData.setupRequired) {
            // No users exist, redirect to setup
            router.push('/setup');
            return;
          }
        }

        // Check if already logged in
        const res = await fetch('/api/auth/me');
        if (res.ok) {
          // Already logged in, redirect to dashboard
          router.push('/');
        }
      } catch (err) {
        // Not logged in, stay on login page
      } finally {
        setCheckingStatus(false);
      }
    }
    checkAuth();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Login failed');
        return;
      }

      // Check if user must change password
      if (data.user?.mustChangePassword) {
        router.push('/settings/security?forcePasswordChange=true');
      } else {
        router.push('/');
      }
    } catch (err) {
      setError('Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (checkingStatus) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-mc-bg">
        <div className="text-mc-text-secondary">Checking authentication...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-mc-bg p-4">
      <div className="w-full max-w-md">
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-mc-accent/20 rounded-lg mb-4">
            <Terminal className="w-8 h-8 text-mc-accent" />
          </div>
          <h1 className="text-2xl font-bold text-mc-text">Mission Control</h1>
          <p className="text-mc-text-secondary mt-2">Sign in to your account</p>
        </div>

        {/* Login Card */}
        <div className="bg-mc-bg-secondary border border-mc-border rounded-lg p-6">
          {/* Login Form */}
          <form onSubmit={handleSubmit}>
            {/* Email Field */}
            <div className="mb-4">
              <label htmlFor="email" className="block text-sm font-medium text-mc-text-secondary mb-2">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-mc-text-secondary" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@example.com"
                  required
                  autoComplete="email"
                  className="w-full pl-10 pr-4 py-2.5 bg-mc-bg border border-mc-border rounded-lg text-mc-text placeholder-mc-text-secondary/50 focus:outline-none focus:border-mc-accent transition-colors"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="mb-6">
              <label htmlFor="password" className="block text-sm font-medium text-mc-text-secondary mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-mc-text-secondary" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  autoComplete="current-password"
                  className="w-full pl-10 pr-12 py-2.5 bg-mc-bg border border-mc-border rounded-lg text-mc-text placeholder-mc-text-secondary/50 focus:outline-none focus:border-mc-accent transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-mc-text-secondary hover:text-mc-text transition-colors"
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-4 p-3 bg-mc-accent-red/10 border border-mc-accent-red/30 rounded-lg">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-mc-accent-red flex-shrink-0" />
                  <p className="text-sm text-mc-accent-red">{error}</p>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || !email || !password}
              className="w-full py-2.5 bg-mc-accent text-white font-medium rounded-lg hover:bg-mc-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          {/* Forgot Password Link */}
          <div className="mt-4 text-center">
            <a
              href="/forgot-password"
              className="text-sm text-mc-text-secondary hover:text-mc-accent transition-colors"
            >
              Forgot your password?
            </a>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-mc-text-secondary mt-6">
          Mission Control v2.4.0 • User Authentication System
        </p>
      </div>
    </div>
  );
}