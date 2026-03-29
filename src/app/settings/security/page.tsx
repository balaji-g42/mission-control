'use client';

import { useRouter } from 'next/navigation';
import { ChevronLeft, Settings, Shield } from 'lucide-react';
import Link from 'next/link';
import SecuritySettings from '@/components/settings/SecuritySettings';
import TwoFactorWarning from '@/components/auth/TwoFactorWarning';

export default function SecurityPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-mc-bg">
      {/* Header */}
      <header className="border-b border-mc-border bg-mc-bg-secondary">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center gap-3">
            <Link href="/settings" className="flex items-center gap-2 text-mc-text-secondary hover:text-mc-accent transition-colors">
              <ChevronLeft className="w-4 h-4" />
              <Settings className="w-4 h-4" />
              Settings
            </Link>
            <span className="text-mc-text-secondary">/</span>
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-mc-accent-cyan" />
              <h1 className="text-lg font-semibold">Security</h1>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <div className="border-b border-mc-border bg-mc-bg-secondary">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3">
          <nav className="flex items-center gap-6">
            <Link
              href="/settings"
              className="text-mc-text-secondary hover:text-mc-text pb-1 border-b-2 border-transparent hover:border-mc-text-secondary transition-colors"
            >
              General
            </Link>
            <Link
              href="/settings/security"
              className="text-mc-accent font-medium border-b-2 border-mc-accent pb-1"
            >
              Security
            </Link>
          </nav>
        </div>
      </div>

      {/* 2FA Warning Banner */}
      <TwoFactorWarning />
      
      {/* Security Settings */}
      <SecuritySettings />
    </div>
  );
}