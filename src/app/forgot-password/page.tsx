'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Terminal, Mail, Key, Lock, AlertTriangle, CheckCircle, Eye, EyeOff } from 'lucide-react';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/auth/password/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email, 
          twoFactorCode,
          newPassword 
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Password reset failed');
        return;
      }

      setSuccess(true);
      
      // Redirect to login after 3 seconds
      setTimeout(() => {
        router.push('/login');
      }, 3000);
    } catch (err) {
      setError('Password reset failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-mc-bg p-4">
      <div className="w-full max-w-md">
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-mc-accent/20 rounded-lg mb-4">
            <Terminal className="w-8 h-8 text-mc-accent" />
          </div>
          <h1 className="text-2xl font-bold text-mc-text">Mission Control</h1>
          <p className="text-mc-text-secondary mt-2">Reset your password</p>
        </div>

        {/* Reset Card */}
        <div className="bg-mc-bg-secondary border border-mc-border rounded-lg p-6">
          {!success ? (
            <>
              {/* Info Banner */}
              <div className="flex items-start gap-3 p-3 bg-mc-accent-yellow/10 border border-mc-accent-yellow/30 rounded-lg mb-6">
                <AlertTriangle className="w-5 h-5 text-mc-accent-yellow flex-shrink-0 mt-0.5" />
                <div className="text-sm text-mc-text-secondary">
                  <p className="font-medium text-mc-accent-yellow mb-1">2FA Required</p>
                  <p>Password reset requires a valid 2FA code (TOTP or Recovery Code). If you don&apos;t have access to your 2FA device, use a recovery code.</p>
                </div>
              </div>

              {/* Reset Form */}
              <form onSubmit={handleSubmit}>
                {/* Email Field */}
                <div className="mb-4">
                  <label htmlFor="email" className="block text-sm font-medium text-mc-text-secondary mb-2">
                    Email Address
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

                {/* 2FA Code Field */}
                <div className="mb-4">
                  <label htmlFor="twoFactorCode" className="block text-sm font-medium text-mc-text-secondary mb-2">
                    2FA Code (TOTP or Recovery Code)
                  </label>
                  <div className="relative">
                    <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-mc-text-secondary" />
                    <input
                      id="twoFactorCode"
                      type="text"
                      value={twoFactorCode}
                      onChange={(e) => setTwoFactorCode(e.target.value)}
                      placeholder="Enter 6-digit code or recovery code"
                      required
                      className="w-full pl-10 pr-4 py-2.5 bg-mc-bg border border-mc-border rounded-lg text-mc-text placeholder-mc-text-secondary/50 focus:outline-none focus:border-mc-accent transition-colors"
                    />
                  </div>
                  <p className="text-xs text-mc-text-secondary mt-1">
                    Use your authenticator app code or one of your saved recovery codes
                  </p>
                </div>

                {/* New Password Field */}
                <div className="mb-4">
                  <label htmlFor="newPassword" className="block text-sm font-medium text-mc-text-secondary mb-2">
                    New Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-mc-text-secondary" />
                    <input
                      id="newPassword"
                      type={showPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter new password"
                      required
                      minLength={12}
                      className="w-full pl-10 pr-12 py-2.5 bg-mc-bg border border-mc-border rounded-lg text-mc-text placeholder-mc-text-secondary/50 focus:outline-none focus:border-mc-accent transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-mc-text-secondary hover:text-mc-text transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-mc-text-secondary mt-1">
                    Minimum 12 characters with uppercase, lowercase, number, and symbol
                  </p>
                </div>

                {/* Confirm Password Field */}
                <div className="mb-6">
                  <label htmlFor="confirmPassword" className="block text-sm font-medium text-mc-text-secondary mb-2">
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-mc-text-secondary" />
                    <input
                      id="confirmPassword"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm new password"
                      required
                      className="w-full pl-10 pr-4 py-2.5 bg-mc-bg border border-mc-border rounded-lg text-mc-text placeholder-mc-text-secondary/50 focus:outline-none focus:border-mc-accent transition-colors"
                    />
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
                  disabled={loading || !email || !twoFactorCode || !newPassword || !confirmPassword}
                  className="w-full py-2.5 bg-mc-accent text-white font-medium rounded-lg hover:bg-mc-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? 'Resetting Password...' : 'Reset Password'}
                </button>
              </form>

              {/* Back to Login Link */}
              <div className="mt-4 text-center">
                <a
                  href="/login"
                  className="text-sm text-mc-text-secondary hover:text-mc-accent transition-colors"
                >
                  Back to Login
                </a>
              </div>
            </>
          ) : (
            <>
              {/* Success State */}
              <div className="flex items-center gap-3 p-3 bg-mc-accent-green/10 border border-mc-accent-green/30 rounded-lg mb-6">
                <CheckCircle className="w-5 h-5 text-mc-accent-green flex-shrink-0" />
                <div className="text-sm">
                  <p className="font-medium text-mc-accent-green">Password reset successful!</p>
                  <p className="text-mc-text-secondary mt-1">Redirecting to login page...</p>
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