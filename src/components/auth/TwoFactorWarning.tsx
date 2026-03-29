'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, AlertTriangle, X, ChevronRight } from 'lucide-react';

interface TwoFactorWarningProps {
  className?: string;
}

export default function TwoFactorWarning({ className = '' }: TwoFactorWarningProps) {
  const router = useRouter();
  const [dismissed, setDismissed] = useState(false);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState<boolean | null>(null);

  // Check if 2FA is enabled
  useEffect(() => {
    async function checkTwoFactor() {
      try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
          const data = await res.json();
          setTwoFactorEnabled(data.user?.twoFactorEnabled ?? false);
        }
      } catch (err) {
        console.error('Failed to check 2FA status:', err);
      }
    }
    checkTwoFactor();

    // Listen for 2FA status changes
    const handleTwoFactorChange = () => checkTwoFactor();
    window.addEventListener('twoFactorStatusChanged', handleTwoFactorChange);

    return () => {
      window.removeEventListener('twoFactorStatusChanged', handleTwoFactorChange);
    };
  }, []);

  // Don't show if 2FA is enabled or dismissed
  if (twoFactorEnabled === null || twoFactorEnabled === true || dismissed) {
    return null;
  }

  const handleSetupClick = () => {
    router.push('/settings/security');
  };

  const handleDismiss = () => {
    setDismissed(true);
  };

  return (
    <div className={`bg-mc-accent-yellow/10 border-b border-mc-accent-yellow/30 ${className}`}>
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0">
              <AlertTriangle className="w-5 h-5 text-mc-accent-yellow" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-mc-accent-yellow font-medium">
                <strong>Security Warning:</strong> Two-factor authentication is not enabled.
              </p>
              <p className="text-xs text-mc-text-secondary mt-1">
                Enable 2FA to secure your account and allow password recovery.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSetupClick}
              className="flex items-center gap-1 px-3 py-1.5 bg-mc-accent-yellow text-mc-bg text-xs font-medium rounded hover:bg-mc-accent-yellow/90 transition-colors"
            >
              <Shield className="w-3.5 h-3.5" />
              Setup 2FA
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleDismiss}
              className="p-1.5 text-mc-text-secondary hover:text-mc-text hover:bg-mc-bg-tertiary rounded transition-colors"
              title="Dismiss warning"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}