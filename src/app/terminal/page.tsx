'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Terminal as TerminalIcon, ExternalLink } from 'lucide-react';

// TTYD terminal server URL (runs alongside openclaw on localhost)
const TTYD_PORT = process.env.NEXT_PUBLIC_TTYD_PORT || '3001';
const TTYD_URL = `http://localhost:${TTYD_PORT}`;

export default function TerminalPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);

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
        <a
          href={TTYD_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 px-3 py-1 text-xs bg-[#21262d] hover:bg-[#30363d] text-[#c9d1d9] rounded transition-colors"
        >
          <ExternalLink className="w-3 h-3" />
          Open in New Tab
        </a>
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
        <iframe
          src={TTYD_URL}
          className="w-full h-full border-0"
          title="OpenClaw Terminal"
          onLoad={() => setIsLoading(false)}
          allow="clipboard-read; clipboard-write"
        />
      </div>
    </div>
  );
}