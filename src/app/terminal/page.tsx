'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Terminal as TerminalIcon, ExternalLink } from 'lucide-react';

export default function TerminalPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [ttydUrl, setTtydUrl] = useState<string>('');

  // Load terminal configuration at runtime
  useEffect(() => {
    const loadTerminalConfig = async () => {
      try {
        const res = await fetch('/api/config/terminal');
        if (res.ok) {
          const config = await res.json();
          if (config.enabled && config.port) {
            setTtydUrl(`http://localhost:${config.port}`);
          }
        }
      } catch (error) {
        console.error('Failed to load terminal config:', error);
      }
    };

    loadTerminalConfig();
  }, []);

  return (
    <div className="flex flex-col h-screen bg-[#0d1117]">
      {/* Terminal Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#161b22] border-b border-[#30363d]">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1 text-[#8b949e] hover:text-[#c9d1d9] transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            <span className="text-sm">Back</span>
          </button>
          <div className="w-px h-4 bg-[#30363d]" />
          <div className="flex items-center gap-2">
            <TerminalIcon className="w-4 h-4 text-[#58a6ff]" />
            <span className="text-sm font-medium text-[#c9d1d9]">OpenClaw Terminal</span>
          </div>
        </div>
        {ttydUrl && (
          <a
            href={ttydUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 px-3 py-1 text-xs bg-[#21262d] hover:bg-[#30363d] text-[#c9d1d9] rounded transition-colors"
          >
            <ExternalLink className="w-3 h-3" />
            Open in New Tab
          </a>
        )}
      </div>

      {/* TTYD Terminal iframe */}
      <div className="flex-1 relative">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#0d1117]">
            <div className="text-center">
              <div className="w-8 h-8 border-2 border-[#58a6ff] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-[#8b949e] text-sm">Loading terminal...</p>
            </div>
          </div>
        )}
        {ttydUrl ? (
          <iframe
            src={ttydUrl}
            className="w-full h-full border-0"
            title="OpenClaw Terminal"
            onLoad={() => setIsLoading(false)}
            allow="clipboard-read; clipboard-write"
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <TerminalIcon className="w-12 h-12 text-[#8b949e] mx-auto mb-3" />
              <p className="text-[#8b949e]">Terminal not configured</p>
              <p className="text-[#8b949e] text-sm mt-1">Set TTYD_PORT environment variable to enable terminal access</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}