'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { 
  Shield, 
  ShieldCheck, 
  ShieldOff, 
  Key, 
  Lock, 
  Eye, 
  EyeOff, 
  Copy, 
  CheckCheck, 
  AlertTriangle,
  RefreshCw,
  QrCode,
  Smartphone
} from 'lucide-react';

interface User {
  id: string;
  email: string;
  role: string;
  twoFactorEnabled: boolean;
  mustChangePassword: boolean;
}

interface TwoFactorSetupData {
  secret: string;
  manualEntryKey: string;
  qrCode: string;
  recoveryCodes: string[];
}

export default function SecuritySettings() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Password change state
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);

  // 2FA state
  const [show2FASetup, setShow2FASetup] = useState(false);
  const [twoFactorData, setTwoFactorData] = useState<TwoFactorSetupData | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [twoFactorLoading, setTwoFactorLoading] = useState(false);
  const [copiedCodes, setCopiedCodes] = useState(false);
  const [showRecoveryCodes, setShowRecoveryCodes] = useState(false);

  // 2FA disable state
  const [showDisable2FA, setShowDisable2FA] = useState(false);
  const [disablePassword, setDisablePassword] = useState('');
  const [disableLoading, setDisableLoading] = useState(false);

  // Load user data
  useEffect(() => {
    async function loadUser() {
      try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
        } else {
          router.push('/login');
        }
      } catch (err) {
        console.error('Failed to load user:', err);
        setError('Failed to load user data');
      } finally {
        setLoading(false);
      }
    }
    loadUser();
  }, [router]);

  // Check for force password change
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('forcePasswordChange') === 'true') {
      setShowPasswordForm(true);
    }
  }, []);

  // Handle password change
  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setPasswordLoading(true);

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      setPasswordLoading(false);
      return;
    }

    try {
      const payload: any = { newPassword };
      if (!user?.mustChangePassword) {
        payload.currentPassword = currentPassword;
      }
      
      const res = await fetch('/api/auth/password/change', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to change password');
        return;
      }

      setSuccess('Password changed successfully');
      setUser(prev => prev ? { ...prev, mustChangePassword: false } : null);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowPasswordForm(false);
      
      // If this was a forced password change, redirect to dashboard
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('forcePasswordChange') === 'true') {
        window.location.href = '/';
      }
    } catch (err) {
      setError('Failed to change password');
    } finally {
      setPasswordLoading(false);
    }
  };

  // Handle 2FA setup
  const handle2FASetup = async () => {
    setError('');
    setTwoFactorLoading(true);

    try {
      const res = await fetch('/api/auth/2fa/setup', {
        method: 'POST',
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to setup 2FA');
        return;
      }

      setTwoFactorData(data);
      setShow2FASetup(true);
    } catch (err) {
      setError('Failed to setup 2FA');
    } finally {
      setTwoFactorLoading(false);
    }
  };

  // Handle 2FA verification
  const handle2FAVerify = async () => {
    setError('');
    setTwoFactorLoading(true);

    try {
      const res = await fetch('/api/auth/2fa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: verificationCode }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to verify 2FA code');
        return;
      }

      setSuccess('Two-factor authentication enabled successfully!');
      setUser(prev => prev ? { ...prev, twoFactorEnabled: true } : null);
      window.dispatchEvent(new CustomEvent('twoFactorStatusChanged'));
      setShow2FASetup(false);
      setTwoFactorData(null);
      setVerificationCode('');
    } catch (err) {
      setError('Failed to verify 2FA code');
    } finally {
      setTwoFactorLoading(false);
    }
  };

  // Handle 2FA disable
  const handle2FADisable = async () => {
    setError('');
    setDisableLoading(true);

    try {
      const res = await fetch('/api/auth/2fa/disable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: disablePassword }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to disable 2FA');
        return;
      }

      setSuccess('Two-factor authentication disabled');
      setUser(prev => prev ? { ...prev, twoFactorEnabled: false } : null);
      window.dispatchEvent(new CustomEvent('twoFactorStatusChanged'));
      setShowDisable2FA(false);
      setDisablePassword('');
    } catch (err) {
      setError('Failed to disable 2FA');
    } finally {
      setDisableLoading(false);
    }
  };

  // Copy recovery codes
  const copyRecoveryCodes = async () => {
    if (twoFactorData?.recoveryCodes) {
      try {
        await navigator.clipboard.writeText(twoFactorData.recoveryCodes.join('\n'));
        setCopiedCodes(true);
        setTimeout(() => setCopiedCodes(false), 2000);
      } catch (err) {
        console.error('Failed to copy:', err);
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-mc-bg">
        <div className="text-mc-text-secondary">Loading security settings...</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-mc-text">Security Settings</h1>
        <p className="text-mc-text-secondary mt-1">Manage your account security and authentication</p>
      </div>

      {/* Error/Success Messages */}
      {error && (
        <div className="mb-6 p-3 bg-mc-accent-red/10 border border-mc-accent-red/30 rounded-lg">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-mc-accent-red flex-shrink-0" />
            <p className="text-sm text-mc-accent-red">{error}</p>
          </div>
        </div>
      )}

      {success && (
        <div className="mb-6 p-3 bg-mc-accent-green/10 border border-mc-accent-green/30 rounded-lg">
          <div className="flex items-center gap-2">
            <CheckCheck className="w-4 h-4 text-mc-accent-green flex-shrink-0" />
            <p className="text-sm text-mc-accent-green">{success}</p>
          </div>
        </div>
      )}

      {/* Password Section */}
      <div className="bg-mc-bg-secondary border border-mc-border rounded-lg p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Lock className="w-5 h-5 text-mc-accent" />
            <div>
              <h2 className="text-lg font-semibold text-mc-text">Password</h2>
              <p className="text-sm text-mc-text-secondary">Change your account password</p>
            </div>
          </div>
          <button
            onClick={() => setShowPasswordForm(!showPasswordForm)}
            className="px-4 py-2 bg-mc-accent text-white rounded-lg hover:bg-mc-accent/90 transition-colors text-sm"
          >
            {showPasswordForm ? 'Cancel' : 'Change Password'}
          </button>
        </div>

        {showPasswordForm && (
          <form onSubmit={handlePasswordChange} className="space-y-4">
            {!user?.mustChangePassword && (
              <div>
                <label className="block text-sm font-medium text-mc-text-secondary mb-2">
                  Current Password
                </label>
                <div className="relative">
                  <input
                    type={showCurrentPassword ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required={!user?.mustChangePassword}
                    className="w-full px-3 py-2 bg-mc-bg border border-mc-border rounded-lg text-mc-text focus:outline-none focus:border-mc-accent pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-mc-text-secondary hover:text-mc-text"
                  >
                    {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-mc-text-secondary mb-2">
                New Password
              </label>
              <div className="relative">
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-mc-bg border border-mc-border rounded-lg text-mc-text focus:outline-none focus:border-mc-accent pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-mc-text-secondary hover:text-mc-text"
                >
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-xs text-mc-text-secondary mt-1">
                Minimum 12 characters with uppercase, lowercase, number, and symbol
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-mc-text-secondary mb-2">
                Confirm New Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="w-full px-3 py-2 bg-mc-bg border border-mc-border rounded-lg text-mc-text focus:outline-none focus:border-mc-accent"
              />
            </div>

            <button
              type="submit"
              disabled={passwordLoading}
              className="px-4 py-2 bg-mc-accent text-white rounded-lg hover:bg-mc-accent/90 disabled:opacity-50 transition-colors text-sm"
            >
              {passwordLoading ? 'Changing...' : 'Change Password'}
            </button>
          </form>
        )}
      </div>

      {/* Two-Factor Authentication Section */}
      <div className="bg-mc-bg-secondary border border-mc-border rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            {user?.twoFactorEnabled ? (
              <ShieldCheck className="w-5 h-5 text-mc-accent-green" />
            ) : (
              <ShieldOff className="w-5 h-5 text-mc-accent-red" />
            )}
            <div>
              <h2 className="text-lg font-semibold text-mc-text">Two-Factor Authentication</h2>
              <p className="text-sm text-mc-text-secondary">
                {user?.twoFactorEnabled 
                  ? 'Your account is protected with 2FA' 
                  : 'Add an extra layer of security to your account'}
              </p>
            </div>
          </div>
          {user?.twoFactorEnabled ? (
            <button
              onClick={() => setShowDisable2FA(true)}
              className="px-4 py-2 bg-mc-accent-red/10 text-mc-accent-red border border-mc-accent-red/30 rounded-lg hover:bg-mc-accent-red/20 transition-colors text-sm"
            >
              Disable 2FA
            </button>
          ) : (
            <button
              onClick={handle2FASetup}
              disabled={twoFactorLoading}
              className="px-4 py-2 bg-mc-accent text-white rounded-lg hover:bg-mc-accent/90 disabled:opacity-50 transition-colors text-sm"
            >
              {twoFactorLoading ? 'Setting up...' : 'Enable 2FA'}
            </button>
          )}
        </div>

        {/* 2FA Setup Flow */}
        {show2FASetup && twoFactorData && (
          <div className="mt-6 p-4 bg-mc-bg border border-mc-border rounded-lg">
            <h3 className="text-md font-semibold text-mc-text mb-4">Setup Two-Factor Authentication</h3>
            
            {/* QR Code */}
            <div className="mb-6">
              <p className="text-sm text-mc-text-secondary mb-3">
                Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.):
              </p>
              <div className="flex justify-center p-4 bg-white rounded-lg">
                <Image 
                  src={twoFactorData.qrCode} 
                  alt="2FA QR Code" 
                  width={192} 
                  height={192}
                  className="w-48 h-48"
                />
              </div>
            </div>

            {/* Manual Entry */}
            <div className="mb-6">
              <p className="text-sm text-mc-text-secondary mb-2">
                Or enter this code manually:
              </p>
              <div className="p-3 bg-mc-bg-tertiary border border-mc-border rounded-lg font-mono text-sm text-mc-accent break-all">
                {twoFactorData.manualEntryKey}
              </div>
            </div>

            {/* Recovery Codes */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-mc-text">Recovery Codes</p>
                <button
                  onClick={() => setShowRecoveryCodes(!showRecoveryCodes)}
                  className="text-xs text-mc-accent hover:underline"
                >
                  {showRecoveryCodes ? 'Hide' : 'Show'} codes
                </button>
              </div>
              <p className="text-xs text-mc-accent-yellow mb-3">
                ⚠️ Save these codes securely! Each code can only be used once.
              </p>
              {showRecoveryCodes && (
                <div className="p-3 bg-mc-bg-tertiary border border-mc-border rounded-lg">
                  <div className="grid grid-cols-2 gap-2 font-mono text-sm text-mc-text">
                    {twoFactorData.recoveryCodes.map((code, index) => (
                      <div key={index} className="p-1">{code}</div>
                    ))}
                  </div>
                  <button
                    onClick={copyRecoveryCodes}
                    className="mt-3 flex items-center gap-1 text-xs text-mc-accent hover:underline"
                  >
                    {copiedCodes ? (
                      <>
                        <CheckCheck className="w-3 h-3" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        Copy all codes
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* Verification */}
            <div>
              <label className="block text-sm font-medium text-mc-text-secondary mb-2">
                Enter verification code from your authenticator app:
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  maxLength={6}
                  className="flex-1 px-3 py-2 bg-mc-bg border border-mc-border rounded-lg text-mc-text focus:outline-none focus:border-mc-accent font-mono text-center text-lg"
                />
                <button
                  onClick={handle2FAVerify}
                  disabled={verificationCode.length !== 6 || twoFactorLoading}
                  className="px-4 py-2 bg-mc-accent text-white rounded-lg hover:bg-mc-accent/90 disabled:opacity-50 transition-colors"
                >
                  {twoFactorLoading ? 'Verifying...' : 'Verify & Enable'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 2FA Disable Modal */}
        {showDisable2FA && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-mc-bg-secondary border border-mc-border rounded-lg p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-semibold text-mc-text mb-4">Disable Two-Factor Authentication</h3>
              <p className="text-sm text-mc-text-secondary mb-4">
                Disabling 2FA will make your account less secure. Enter your password to confirm.
              </p>
              <input
                type="password"
                value={disablePassword}
                onChange={(e) => setDisablePassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full px-3 py-2 bg-mc-bg border border-mc-border rounded-lg text-mc-text focus:outline-none focus:border-mc-accent mb-4"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setShowDisable2FA(false);
                    setDisablePassword('');
                  }}
                  className="flex-1 px-4 py-2 bg-mc-bg-tertiary text-mc-text rounded-lg hover:bg-mc-border transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handle2FADisable}
                  disabled={!disablePassword || disableLoading}
                  className="flex-1 px-4 py-2 bg-mc-accent-red text-white rounded-lg hover:bg-mc-accent-red/90 disabled:opacity-50 transition-colors"
                >
                  {disableLoading ? 'Disabling...' : 'Disable 2FA'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}