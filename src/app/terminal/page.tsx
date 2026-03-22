'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Terminal as TerminalIcon, Wifi, WifiOff, AlertCircle, RefreshCw, Server } from 'lucide-react';

// Terminal configuration from environment
const TERMINAL_ENABLED = process.env.NEXT_PUBLIC_TERMINAL_ENABLED === 'true';
const TERMINAL_WS_URL = process.env.NEXT_PUBLIC_TERMINAL_WS_URL || 'ws://localhost:3000';

// Derive HTTP URL from WebSocket URL for health checks
const getHttpUrl = (wsUrl: string) => {
  return wsUrl.replace('ws://', 'http://').replace('wss://', 'https://');
};

interface LogEntry {
  timestamp: Date;
  message: string;
  type: 'info' | 'success' | 'error' | 'warning';
}

export default function TerminalPage() {
  const router = useRouter();
  const terminalRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<any>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const fitAddonRef = useRef<any>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [showTerminal, setShowTerminal] = useState(false);
  const [serverStatus, setServerStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [serverInfo, setServerInfo] = useState<any>(null);

  const addLog = (message: string, type: LogEntry['type'] = 'info') => {
    setLogs(prev => [...prev, { timestamp: new Date(), message, type }]);
  };

  const checkServerStatus = async () => {
    setServerStatus('checking');
    addLog('Checking terminal server status...', 'info');
    
    try {
      const httpUrl = getHttpUrl(TERMINAL_WS_URL);
      const response = await fetch(`${httpUrl}/health`, { 
        method: 'GET',
        signal: AbortSignal.timeout(5000)
      });
      
      if (response.ok) {
        const data = await response.json();
        setServerStatus('online');
        setServerInfo(data);
        addLog(`Terminal server is online (Active connections: ${data.activeConnections})`, 'success');
        addLog(`Server URL: ${httpUrl}`, 'info');
      } else {
        setServerStatus('offline');
        addLog('Terminal server returned error status', 'error');
      }
    } catch (err) {
      setServerStatus('offline');
      addLog('Terminal server is offline or unreachable', 'error');
      addLog(`Attempted to connect to: ${getHttpUrl(TERMINAL_WS_URL)}`, 'warning');
    }
  };

  // Check server status on mount
  useEffect(() => {
    if (TERMINAL_ENABLED) {
      checkServerStatus();
    }
  }, []);

  const connectToServer = async () => {
    if (isConnecting || isConnected) return;

    // Check if terminal is enabled
    if (!TERMINAL_ENABLED) {
      setError('Terminal feature is not enabled. Set NEXT_PUBLIC_TERMINAL_ENABLED=true in your .env.local file.');
      return;
    }

    setIsConnecting(true);
    setError(null);

    addLog('Starting terminal connection sequence...', 'info');
    addLog(`WebSocket URL: ${TERMINAL_WS_URL}`, 'info');
    addLog(`HTTP Endpoint: ${getHttpUrl(TERMINAL_WS_URL)}`, 'info');

    // Check server health first
    try {
      const httpUrl = getHttpUrl(TERMINAL_WS_URL);
      addLog('Checking server health endpoint...', 'info');
      const healthResponse = await fetch(`${httpUrl}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000)
      });
      
      if (healthResponse.ok) {
        const healthData = await healthResponse.json();
        addLog(`Server health check passed (Status: ${healthData.status})`, 'success');
        addLog(`Active connections: ${healthData.activeConnections}`, 'info');
        setServerInfo(healthData);
        setServerStatus('online');
      } else {
        addLog('Server health check failed - server returned error', 'warning');
      }
    } catch (err) {
      addLog('Server health check failed - server may be offline', 'warning');
      addLog('Attempting WebSocket connection anyway...', 'info');
    }

    addLog('Establishing WebSocket connection...', 'info');

    // Use the configured WebSocket URL
    const wsUrl = TERMINAL_WS_URL;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      let authenticated = false;
      let sessionId: string | null = null;

      // Connection timeout
      const connectionTimeout = setTimeout(() => {
        if (ws.readyState !== WebSocket.OPEN) {
          ws.close();
          setError('Connection timeout - server did not respond');
          addLog('Connection timeout - server did not respond', 'error');
          setIsConnecting(false);
        }
      }, 10000);

      ws.onopen = () => {
        clearTimeout(connectionTimeout);
        addLog('WebSocket connection established successfully', 'success');
        addLog('Socket state: OPEN', 'info');
        addLog('Waiting for server challenge or welcome message...', 'info');
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          // Handle gateway challenge-response authentication
          if (data.type === 'event' && data.event === 'connect.challenge') {
            addLog('Challenge received from server', 'info');
            addLog('Preparing authentication response...', 'info');
            
            const requestId = crypto.randomUUID();
            const response = {
              type: 'req',
              id: requestId,
              method: 'connect',
              params: {
                minProtocol: 3,
                maxProtocol: 3,
                client: {
                  id: 'terminal',
                  version: '1.0.0',
                  platform: 'web',
                  mode: 'terminal',
                },
                auth: { 
                  token: process.env.NEXT_PUBLIC_OPENCLAW_GATEWAY_TOKEN || '' 
                },
                role: 'operator',
                scopes: ['operator.admin'],
              }
            };

            ws.send(JSON.stringify(response));
            addLog('Authentication request sent', 'success');
            return;
          }

          // Handle authentication response
          if (data.type === 'res' && data.id && !authenticated) {
            if (data.ok) {
              authenticated = true;
              addLog('Authentication successful', 'success');
              addLog('Creating terminal session...', 'info');
              
              // Create a terminal session
              const sessionRequestId = crypto.randomUUID();
              const sessionRequest = {
                type: 'req',
                id: sessionRequestId,
                method: 'sessions.create',
                params: {
                  channel: 'terminal',
                  peer: 'mission-control',
                }
              };
              ws.send(JSON.stringify(sessionRequest));
            } else {
              addLog('Authentication failed: ' + (data.error?.message || 'Unknown error'), 'error');
              setError('Authentication failed');
              setIsConnecting(false);
            }
            return;
          }

          // Handle session creation response
          if (data.type === 'res' && data.payload && data.payload.session_id && !sessionId) {
            sessionId = data.payload.session_id;
            addLog('Terminal session created successfully', 'success');
            addLog(`Session ID: ${sessionId}`, 'info');
            addLog('Initializing terminal interface...', 'info');
            
            setTimeout(() => {
              setIsConnected(true);
              setIsConnecting(false);
              setShowTerminal(true);
              addLog('═══════════════════════════════════════════', 'success');
              addLog('Terminal ready! You can now enter commands.', 'success');
              addLog('═══════════════════════════════════════════', 'success');
            }, 500);
            return;
          }

          // Handle terminal output
          if (data.type === 'event' && data.event === 'terminal.output' && data.payload) {
            if (termRef.current && data.payload.data) {
              termRef.current.write(data.payload.data);
            }
            return;
          }

          // Handle other events
          if (data.type === 'event') {
            console.log('[Terminal] Gateway event:', data.event);
          }

        } catch (e) {
          // Not JSON, might be raw terminal data
          if (termRef.current) {
            termRef.current.write(event.data);
          }
        }
      };

      ws.onclose = () => {
        clearTimeout(connectionTimeout);
        authenticated = false;
        sessionId = null;
        setIsConnected(false);
        setIsConnecting(false);
        setShowTerminal(false);
          addLog('WebSocket connection closed', 'warning');
          addLog('Cleaning up terminal session...', 'info');
          if (termRef.current) {
            termRef.current.writeln('\r\n\x1b[31m═══ Disconnected from terminal ═══\x1b[0m');
          }
      };

      ws.onerror = () => {
        clearTimeout(connectionTimeout);
        setError('Failed to connect to terminal server');
        addLog('WebSocket connection failed', 'error');
        addLog('Possible causes:', 'warning');
        addLog('  - Terminal server is not running', 'warning');
        addLog(`  - Server not listening on ${wsUrl}`, 'warning');
        addLog('  - Firewall blocking connection', 'warning');
        addLog('  - Network connectivity issue', 'warning');
        setIsConnecting(false);
      };
    } catch (err) {
      setError('Failed to create WebSocket connection');
      addLog('Failed to create WebSocket connection', 'error');
      setIsConnecting(false);
    }
  };

  // Initialize terminal when showTerminal becomes true
  useEffect(() => {
    if (!showTerminal || !terminalRef.current || termRef.current) return;

    let mounted = true;

    const initTerminal = async () => {
      const { Terminal } = await import('@xterm/xterm');
      const { FitAddon } = await import('@xterm/addon-fit');
      // CSS is loaded via CDN in layout or we handle it inline

      if (!mounted || !terminalRef.current) return;

      const term = new Terminal({
        cursorBlink: true,
        fontSize: 14,
        fontFamily: '"Courier New", monospace',
        theme: {
          background: '#111',
          foreground: '#00ff00',
          cursor: '#00ff00',
          selectionBackground: 'rgba(0, 255, 0, 0.3)',
        },
        scrollback: 1000,
      });

      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);

      term.open(terminalRef.current);
      fitAddon.fit();

      termRef.current = term;
      fitAddonRef.current = fitAddon;

      term.onData((data: string) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(data);
        }
      });

      const handleResize = () => {
        if (fitAddonRef.current && termRef.current) {
          fitAddonRef.current.fit();
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            const dims = { type: 'resize', cols: termRef.current.cols, rows: termRef.current.rows };
            wsRef.current.send(JSON.stringify(dims));
          }
        }
      };

      window.addEventListener('resize', handleResize);

      return () => {
        window.removeEventListener('resize', handleResize);
      };
    };

    const cleanup = initTerminal();

    return () => {
      mounted = false;
    };
  }, [showTerminal]);

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (termRef.current) {
        termRef.current.dispose();
      }
    };
  }, []);

  const handleDisconnect = () => {
    if (wsRef.current) {
      wsRef.current.close();
    }
    if (termRef.current) {
      termRef.current.dispose();
      termRef.current = null;
    }
    setShowTerminal(false);
    setIsConnected(false);
    setLogs([]);
  };

  const getLogColor = (type: LogEntry['type']) => {
    switch (type) {
      case 'success': return 'text-[#7ee787]';
      case 'error': return 'text-[#ff7b72]';
      case 'warning': return 'text-[#d29922]';
      default: return 'text-[#8b949e]';
    }
  };

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
        <div className="flex items-center gap-3">
          {/* Server Status Indicator */}
          <div className="flex items-center gap-2 px-2 py-1 bg-[#21262d] rounded">
            <Server className="w-3 h-3 text-[#8b949e]" />
            <span className={`text-xs ${
              serverStatus === 'online' ? 'text-[#7ee787]' : 
              serverStatus === 'checking' ? 'text-[#d29922]' : 'text-[#ff7b72]'
            }`}>
              Server: {serverStatus === 'online' ? 'Online' : serverStatus === 'checking' ? 'Checking...' : 'Offline'}
            </span>
          </div>
          
          {/* Connection Status */}
          <div className="flex items-center gap-2">
            {isConnected ? (
              <Wifi className="w-4 h-4 text-[#7ee787]" />
            ) : (
              <WifiOff className="w-4 h-4 text-[#8b949e]" />
            )}
            <span className={`text-xs ${isConnected ? 'text-[#7ee787]' : 'text-[#8b949e]'}`}>
              {isConnected ? 'Connected' : isConnecting ? 'Connecting...' : 'Disconnected'}
            </span>
          </div>
          
          {isConnected && (
            <button
              onClick={handleDisconnect}
              className="px-3 py-1 text-xs bg-[#21262d] hover:bg-[#30363d] text-[#c9d1d9] rounded transition-colors"
            >
              Disconnect
            </button>
          )}
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-hidden">
        {/* Connection Screen */}
        {!showTerminal && (
          <div className="h-full flex flex-col">
            {/* Connection Button */}
            {!isConnected && !isConnecting && (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center max-w-md">
                  {!TERMINAL_ENABLED ? (
                    <>
                      <AlertCircle className="w-16 h-16 text-[#d29922] mx-auto mb-4" />
                      <h2 className="text-xl font-semibold text-[#c9d1d9] mb-2">Terminal Not Available</h2>
                      <p className="text-[#8b949e] mb-4">
                        The OpenClaw Terminal feature is not enabled. This feature is only available when Mission Control is installed on the same machine as OpenClaw.
                      </p>
                      <p className="text-[#6e7681] text-sm">
                        To enable, set <code className="bg-[#21262d] px-2 py-1 rounded">NEXT_PUBLIC_TERMINAL_ENABLED=true</code> in your <code className="bg-[#21262d] px-2 py-1 rounded">.env.local</code> file.
                      </p>
                    </>
                  ) : (
                    <>
                      <TerminalIcon className="w-16 h-16 text-[#58a6ff] mx-auto mb-4" />
                    <h2 className="text-xl font-semibold text-[#c9d1d9] mb-2">OpenClaw Terminal</h2>
                    <p className="text-[#8b949e] mb-4">Connect to the terminal server to access the command line</p>
                    
                    {/* Server Info Card */}
                    <div className="mb-6 p-4 bg-[#161b22] rounded-lg border border-[#30363d] text-left">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-[#8b949e] uppercase tracking-wider">Server Status</span>
                        <button 
                          onClick={checkServerStatus}
                          className="p-1 hover:bg-[#21262d] rounded transition-colors"
                          title="Refresh status"
                        >
                          <RefreshCw className={`w-3 h-3 text-[#8b949e] ${serverStatus === 'checking' ? 'animate-spin' : ''}`} />
                        </button>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-[#8b949e]">Endpoint:</span>
                          <span className="text-[#c9d1d9] font-mono text-xs">{TERMINAL_WS_URL}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[#8b949e]">Status:</span>
                          <span className={`${
                            serverStatus === 'online' ? 'text-[#7ee787]' : 
                            serverStatus === 'checking' ? 'text-[#d29922]' : 'text-[#ff7b72]'
                          }`}>
                            {serverStatus === 'online' ? '● Online' : serverStatus === 'checking' ? '◌ Checking...' : '○ Offline'}
                          </span>
                        </div>
                        {serverInfo && (
                          <div className="flex justify-between">
                            <span className="text-[#8b949e]">Active Connections:</span>
                            <span className="text-[#c9d1d9]">{serverInfo.activeConnections}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={connectToServer}
                      disabled={serverStatus === 'offline'}
                      className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                        serverStatus === 'offline' 
                          ? 'bg-[#21262d] text-[#8b949e] cursor-not-allowed' 
                          : 'bg-[#238636] hover:bg-[#2ea043] text-white'
                      }`}
                    >
                      {serverStatus === 'offline' ? 'Server Offline' : 'Connect to Terminal'}
                    </button>
                    {error && (
                      <p className="mt-4 text-[#ff7b72] text-sm">{error}</p>
                    )}
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Connection Logs */}
            {(isConnecting || logs.length > 0) && (
              <div className="flex-1 p-4 overflow-auto bg-[#0d1117]">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-[#8b949e] uppercase tracking-wider">Connection Logs</span>
                  <button 
                    onClick={() => setLogs([])}
                    className="text-xs text-[#8b949e] hover:text-[#c9d1d9] transition-colors"
                  >
                    Clear
                  </button>
                </div>
                <div className="font-mono text-sm bg-[#0d1117] p-3 rounded border border-[#21262d]">
                  {logs.length === 0 ? (
                    <div className="text-[#6e7681]">No logs yet...</div>
                  ) : (
                    logs.map((log, index) => (
                      <div key={index} className="flex gap-2 mb-1">
                        <span className="text-[#6e7681] shrink-0">
                          [{log.timestamp.toLocaleTimeString()}]
                        </span>
                        <span className={getLogColor(log.type)}>
                          {log.message}
                        </span>
                      </div>
                    ))
                  )}
                  <div ref={logsEndRef} />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Terminal */}
        {showTerminal && (
          <div className="h-full p-2">
            <div ref={terminalRef} className="h-full w-full" />
          </div>
        )}
      </div>
    </div>
  );
}