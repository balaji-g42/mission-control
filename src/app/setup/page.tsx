'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Terminal, Lock, Mail, AlertTriangle, CheckCircle, Copy, CheckCheck } from 'lucide-react';

export default function SetupPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [generatedPassword, setGeneratedPassword] = useState('');
  const [copied, setCopied] = useState(false);
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
    setLoading(true);

    try {
      const res = await fetch('/api/auth/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Setup failed');
        return;
      }

      setSuccess(true);
      setGeneratedPassword(data.password);
      
      // Redirect to password change page after 5 seconds
      setTimeout(() => {
        router.push('/settings/security?forcePasswordChange=true');
      }, 5000);
    } catch (err) {
      setError('Setup failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const copyPassword = async () => {
    try {
      await navigator.clipboard.writeText(generatedPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
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
                  <p className="font-medium text-mc-accent mb-1">No admin account found</p>
                  <p>Create your admin account to get started. A random password will be generated for you.</p>
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

                {error && (
                  <div className="mb-4 p-3 bg-mc-accent-red/10 border border-mc-accent-red/30 rounded-lg">
                    <p className="text-sm text-mc-accent-red">{error}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || !email}
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
                  <p className="text-mc-text-secondary mt-1">Save your password now. You must change it after login.</p>
                </div>
              </div>

              {/* Password Display */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-mc-text-secondary mb-2">
                  Generated Password
                </label>
                <div className="flex gap-2">
                  <div className="flex-1 p-3 bg-mc-bg border border-mc-border rounded-lg font-mono text-sm text-mc-accent break-all">
                    {generatedPassword}
                  </div>
                  <button
                    onClick={copyPassword}
                    className="px-3 py-2 bg-mc-bg-tertiary border border-mc-border rounded-lg hover:bg-mc-border/50 transition-colors"
                    title="Copy password"
                  >
                    {copied ? (
                      <CheckCheck className="w-4 h-4 text-mc-accent-green" />
                    ) : (
                      <Copy className="w-4 h-4 text-mc-text-secondary" />
                    )}
                  </button>
                </div>
              </div>

              {/* Warning */}
              <div className="flex items-start gap-3 p-3 bg-mc-accent-yellow/10 border border-mc-accent-yellow/30 rounded-lg">
                <Lock className="w-5 h-5 text-mc-accent-yellow flex-shrink-0 mt-0.5" />
                <div className="text-sm text-mc-text-secondary">
                  <p className="font-medium text-mc-accent-yellow mb-1">Important</p>
                  <p>This password will not be shown again. You will be redirected to the dashboard shortly.</p>
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