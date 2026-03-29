'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Zap, Settings, ChevronLeft, LayoutGrid, Rocket, Terminal } from 'lucide-react';
import { useMissionControl } from '@/lib/store';
import { format } from 'date-fns';
import TwoFactorWarning from '@/components/auth/TwoFactorWarning';
import type { Workspace } from '@/lib/types';

interface HeaderProps {
  workspace?: Workspace;
  isPortrait?: boolean;
}

export function Header({ workspace, isPortrait = true }: HeaderProps) {
  const router = useRouter();
  const { agents, tasks, isOnline } = useMissionControl();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [activeSubAgents, setActiveSubAgents] = useState(0);
  const [user, setUser] = useState<{ email: string; role: string } | null>(null);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [isTerminalEnabled, setIsTerminalEnabled] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const loadSubAgentCount = async () => {
      try {
        const res = await fetch('/api/openclaw/sessions?session_type=subagent&status=active');
        if (res.ok) {
          const sessions = await res.json();
          setActiveSubAgents(sessions.length);
        }
      } catch (error) {
        console.error('Failed to load sub-agent count:', error);
      }
    };

    loadSubAgentCount();
    const interval = setInterval(loadSubAgentCount, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
        }
      } catch (error) {
        console.error('Failed to load user:', error);
      }
    };

    loadUser();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showUserMenu && !(event.target as Element).closest('.user-menu')) {
        setShowUserMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showUserMenu]);

  // Load terminal configuration at runtime
  useEffect(() => {
    const loadTerminalConfig = async () => {
      try {
        const res = await fetch('/api/config/terminal');
        if (res.ok) {
          const config = await res.json();
          setIsTerminalEnabled(config.enabled);
        }
      } catch (error) {
        console.error('Failed to load terminal config:', error);
        setIsTerminalEnabled(false);
      }
    };

    loadTerminalConfig();
  }, []);

  const workingAgents = agents.filter((a) => a.status === 'working').length;
  const activeAgents = workingAgents + activeSubAgents;
  const tasksInQueue = tasks.filter((t) => t.status !== 'done' && t.status !== 'review').length;

  const portraitWorkspaceHeader = !!workspace && isPortrait;

  return (
    <>
      <TwoFactorWarning />
      <header
        className={`bg-mc-bg-secondary border-b border-mc-border px-3 md:px-4 ${
          portraitWorkspaceHeader ? 'py-2.5 space-y-2.5' : 'h-14 flex items-center justify-between gap-2'
        }`}
      >
      {portraitWorkspaceHeader ? (
        <>
          <div className="flex items-center justify-between gap-2 min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <Link href="/" className="flex items-center gap-1 text-mc-text-secondary hover:text-mc-accent transition-colors shrink-0">
                <ChevronLeft className="w-4 h-4" />
                <LayoutGrid className="w-4 h-4" />
              </Link>
              <div className="flex items-center gap-2 px-2.5 py-1.5 bg-mc-bg-tertiary rounded min-w-0">
                <span className="text-base">{workspace.icon}</span>
                <span className="font-medium truncate text-sm">{workspace.name}</span>
              </div>
            </div>

            <Link href="/autopilot" className="min-h-11 min-w-11 p-2 hover:bg-mc-bg-tertiary rounded text-mc-text-secondary" title="Autopilot">
              <Rocket className="w-5 h-5" />
            </Link>
            {isTerminalEnabled && (
              <Link href="/terminal" className="min-h-11 min-w-11 p-2 hover:bg-mc-bg-tertiary rounded text-mc-text-secondary" title="OpenClaw Terminal">
                <Terminal className="w-5 h-5" />
              </Link>
            )}
            <button onClick={() => router.push('/settings')} className="min-h-11 min-w-11 p-2 hover:bg-mc-bg-tertiary rounded text-mc-text-secondary shrink-0" title="Settings">
              <Settings className="w-5 h-5" />
            </button>
              <div className="relative user-menu">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="min-h-11 min-w-11 p-2 hover:bg-mc-bg-tertiary rounded text-mc-text-secondary shrink-0 flex items-center justify-center"
                  title="User Menu"
                >
                  <div className="w-6 h-6 bg-mc-accent rounded-full flex items-center justify-center text-xs font-bold text-mc-bg">
                    {user?.email.charAt(0).toUpperCase()}
                  </div>
                </button>
                {showUserMenu && (
                  <div className="absolute right-0 top-full mt-1 w-48 bg-mc-bg-secondary border border-mc-border rounded-lg shadow-lg z-50">
                    <div className="px-3 py-2 border-b border-mc-border">
                      <div className="text-sm font-medium text-mc-text">{user?.email}</div>
                      <div className="text-xs text-mc-text-secondary capitalize">{user?.role}</div>
                    </div>
                    <div className="py-1">
                      <button
                        onClick={() => {
                          setShowUserMenu(false);
                          router.push('/settings/security');
                        }}
                        className="w-full text-left px-3 py-2 text-sm text-mc-text hover:bg-mc-bg-tertiary"
                      >
                        Security Settings
                      </button>
                      <button
                        onClick={async () => {
                          setShowUserMenu(false);
                          await fetch('/api/auth/logout', { method: 'POST' });
                          router.push('/login');
                        }}
                        className="w-full text-left px-3 py-2 text-sm text-mc-text hover:bg-mc-bg-tertiary"
                      >
                        Sign Out
                      </button>
                    </div>
                  </div>
                )}
              </div>
          </div>

          <div className="flex items-center gap-2 min-w-0">
            <div
              className={`flex items-center gap-2 px-3 min-h-11 rounded border text-xs font-medium ${
                isOnline
                  ? 'bg-mc-accent-green/20 border-mc-accent-green text-mc-accent-green'
                  : 'bg-mc-accent-red/20 border-mc-accent-red text-mc-accent-red'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-mc-accent-green animate-pulse' : 'bg-mc-accent-red'}`} />
              {isOnline ? 'ONLINE' : 'OFFLINE'}
            </div>

            <div className="flex-1 grid grid-cols-2 gap-2">
              <div className="min-h-11 rounded border border-mc-border bg-mc-bg-tertiary px-2 flex items-center justify-center gap-1.5 text-xs">
                <span className="text-mc-accent-cyan font-semibold">{activeAgents}</span>
                <span className="text-mc-text-secondary">active</span>
              </div>
              <div className="min-h-11 rounded border border-mc-border bg-mc-bg-tertiary px-2 flex items-center justify-center gap-1.5 text-xs">
                <span className="text-mc-accent-purple font-semibold">{tasksInQueue}</span>
                <span className="text-mc-text-secondary">queued</span>
              </div>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="flex items-center gap-2 md:gap-4 min-w-0">
            <div className="hidden sm:flex items-center gap-2">
              <Zap className="w-5 h-5 text-mc-accent-cyan" />
              <span className="font-semibold text-mc-text uppercase tracking-wider text-sm">Mission Control</span>
            </div>

            {workspace ? (
              <div className="flex items-center gap-2 min-w-0">
                <Link href="/" className="hidden sm:flex items-center gap-1 text-mc-text-secondary hover:text-mc-accent transition-colors">
                  <ChevronLeft className="w-4 h-4" />
                  <LayoutGrid className="w-4 h-4" />
                </Link>
                <span className="hidden sm:block text-mc-text-secondary">/</span>
                <div className="flex items-center gap-2 px-2 md:px-3 py-1 bg-mc-bg-tertiary rounded min-w-0">
                  <span className="text-base md:text-lg">{workspace.icon}</span>
                  <span className="font-medium truncate text-sm md:text-base">{workspace.name}</span>
                </div>
              </div>
            ) : (
              <Link href="/" className="flex items-center gap-2 px-3 py-1 bg-mc-bg-tertiary rounded hover:bg-mc-bg transition-colors">
                <LayoutGrid className="w-4 h-4" />
                <span className="text-sm">All Workspaces</span>
              </Link>
            )}
          </div>

          {workspace && (
            <div className="hidden lg:flex items-center gap-8">
              <div className="text-center">
                <div className="text-2xl font-bold text-mc-accent-cyan">{activeAgents}</div>
                <div className="text-xs text-mc-text-secondary uppercase">Agents Active</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-mc-accent-purple">{tasksInQueue}</div>
                <div className="text-xs text-mc-text-secondary uppercase">Tasks in Queue</div>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 md:gap-4">
            <span className="hidden md:block text-mc-text-secondary text-sm font-mono">{format(currentTime, 'HH:mm:ss')}</span>
            <div
              className={`flex items-center gap-2 px-2 md:px-3 py-1 rounded border text-xs md:text-sm font-medium ${
                isOnline
                  ? 'bg-mc-accent-green/20 border-mc-accent-green text-mc-accent-green'
                  : 'bg-mc-accent-red/20 border-mc-accent-red text-mc-accent-red'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-mc-accent-green animate-pulse' : 'bg-mc-accent-red'}`} />
              {isOnline ? 'ONLINE' : 'OFFLINE'}
            </div>
            <Link href="/autopilot" className="min-h-11 min-w-11 p-2 hover:bg-mc-bg-tertiary rounded text-mc-text-secondary" title="Autopilot">
              <Rocket className="w-5 h-5" />
            </Link>
            {isTerminalEnabled && (
              <Link href="/terminal" className="min-h-11 min-w-11 p-2 hover:bg-mc-bg-tertiary rounded text-mc-text-secondary" title="OpenClaw Terminal">
                <Terminal className="w-5 h-5" />
              </Link>
            )}
            <button onClick={() => router.push('/settings')} className="min-h-11 min-w-11 p-2 hover:bg-mc-bg-tertiary rounded text-mc-text-secondary" title="Settings">
              <Settings className="w-5 h-5" />
            </button>
            {user && (
              <div className="relative user-menu">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="min-h-11 min-w-11 p-2 hover:bg-mc-bg-tertiary rounded text-mc-text-secondary flex items-center justify-center"
                  title="User Menu"
                >
                  <div className="w-6 h-6 bg-mc-accent rounded-full flex items-center justify-center text-xs font-bold text-mc-bg">
                    {user?.email.charAt(0).toUpperCase()}
                  </div>
                </button>
                {showUserMenu && (
                  <div className="absolute right-0 top-full mt-1 w-48 bg-mc-bg-secondary border border-mc-border rounded-lg shadow-lg z-50">
                    <div className="px-3 py-2 border-b border-mc-border">
                      <div className="text-sm font-medium text-mc-text">{user.email}</div>
                      <div className="text-xs text-mc-text-secondary capitalize">{user.role}</div>
                    </div>
                    <div className="py-1">
                      <button
                        onClick={() => {
                          setShowUserMenu(false);
                          router.push('/settings/security');
                        }}
                        className="w-full text-left px-3 py-2 text-sm text-mc-text hover:bg-mc-bg-tertiary"
                      >
                        Security Settings
                      </button>
                      <button
                        onClick={async () => {
                          setShowUserMenu(false);
                          await fetch('/api/auth/logout', { method: 'POST' });
                          router.push('/login');
                        }}
                        className="w-full text-left px-3 py-2 text-sm text-mc-text hover:bg-mc-bg-tertiary"
                      >
                        Sign Out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </header>
    </>
  );
}
