'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Terminal, Lock, Mail, AlertTriangle, CheckCircle, Eye, EyeOff } from 'lucide-react';

export default function SetupPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(true);

  // Check if setup is needed
  useEffect(() => {
    async function checkStatus() {
      try {
        const res = await fetch('/api/auth/status');
        const data = await res.json();
        
        if (data.usersExist) {
          // Users already exist, redirect to login
          router.push('/login');
        }
      } catch (err) {
        console.error('Failed to check auth status:', err);
      } finally {
        setCheckingStatus(false);
      }
    }
    checkStatus();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Setup failed');
        return;
      }

      setSuccess(true);
      
      // Redirect to 2FA setup after 2 seconds
      setTimeout(() => {
        router.push('/settings/security');
      }, 2000);
    } catch (err) {
      setError('Setup failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const copyPassword = async () => {
    // Not needed anymore since password is user-provided
  };

  if (checkingStatus) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-mc-bg">
        <div className="text-mc-text-secondary">Checking system status...</div>
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
          <p className="text-mc-text-secondary mt-2">First Run Setup</p>
        </div>

        {/* Setup Card */}
        <div className="bg-mc-bg-secondary border border-mc-border rounded-lg p-6">
          {!success ? (
            <>
              {/* Info Banner */}
              <div className="flex items-start gap-3 p-3 bg-mc-accent/10 border border-mc-accent/30 rounded-lg mb-6">
                <AlertTriangle className="w-5 h-5 text-mc-accent flex-shrink-0 mt-0.5" />
                <div className="text-sm text-mc-text-secondary">
                  <p className="font-medium text-mc-accent mb-1">Create Admin Account</p>
                  <p>Enter your email and choose a secure password. Two-factor authentication will be required.</p>
                </div>
              </div>

              {/* Setup Form */}
              <form onSubmit={handleSubmit}>
                <div className="mb-4">
                  <label htmlFor="email" className="block text-sm font-medium text-mc-text-secondary mb-2">
                    Admin Email
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
                      className="w-full pl-10 pr-4 py-2.5 bg-mc-bg border border-mc-border rounded-lg text-mc-text placeholder-mc-text-secondary/50 focus:outline-none focus:border-mc-accent transition-colors"
                    />
                  </div>
                </div>

                <div className="mb-4">
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
                      placeholder="Enter a secure password"
                      required
                      minLength={8}
                      className="w-full pl-10 pr-12 py-2.5 bg-mc-bg border border-mc-border rounded-lg text-mc-text placeholder-mc-text-secondary/50 focus:outline-none focus:border-mc-accent transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-mc-text-secondary hover:text-mc-text transition-colors"
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="mb-4">
                  <label htmlFor="confirmPassword" className="block text-sm font-medium text-mc-text-secondary mb-2">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-mc-text-secondary" />
                    <input
                      id="confirmPassword"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm your password"
                      required
                      className="w-full pl-10 pr-4 py-2.5 bg-mc-bg border border-mc-border rounded-lg text-mc-text placeholder-mc-text-secondary/50 focus:outline-none focus:border-mc-accent transition-colors"
                    />
                  </div>
                </div>

                {error && (
                  <div className="mb-4 p-3 bg-mc-accent-red/10 border border-mc-accent-red/30 rounded-lg">
                    <p className="text-sm text-mc-accent-red">{error}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || !email || !password || !confirmPassword}
                  className="w-full py-2.5 bg-mc-accent text-white font-medium rounded-lg hover:bg-mc-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? 'Creating Account...' : 'Create Admin Account'}
                </button>
              </form>
            </>
          ) : (
            <>
              {/* Success State */}
              <div className="flex items-center gap-3 p-3 bg-mc-accent-green/10 border border-mc-accent-green/30 rounded-lg mb-6">
                <CheckCircle className="w-5 h-5 text-mc-accent-green flex-shrink-0" />
                <div className="text-sm">
                  <p className="font-medium text-mc-accent-green">Account created successfully!</p>
                  <p className="text-mc-text-secondary mt-1">You will be redirected to the dashboard shortly.</p>
                </div>
              </div>

              {/* Info */}
              <div className="flex items-start gap-3 p-3 bg-mc-accent-blue/10 border border-mc-accent-blue/30 rounded-lg">
                <Lock className="w-5 h-5 text-mc-accent-blue flex-shrink-0 mt-0.5" />
                <div className="text-sm text-mc-text-secondary">
                  <p className="font-medium text-mc-accent-blue mb-1">Next Steps</p>
                  <p>Enable two-factor authentication in Settings → Security for enhanced security.</p>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-mc-text-secondary mt-6">
          Mission Control v2.4.0 • User Authentication System
        </p>
      </div>
    </div>
  );
}