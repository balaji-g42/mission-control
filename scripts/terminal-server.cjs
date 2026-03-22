const express = require("express");
const http = require("http");
const { WebSocketServer } = require("ws");
const pty = require("node-pty");
const os = require("os");

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });
const activePtys = new Map();

wss.on("connection", (ws) => {
  const clientId = `terminal-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  console.log(`[Terminal] New connection: ${clientId}`);

  const shell = os.platform() === "win32" ? "powershell.exe" : "bash";
  const ptyProcess = pty.spawn(shell, [], {
    name: "xterm-256color",
    cols: 100,
    rows: 30,
    cwd: process.env.HOME || process.env.USERPROFILE || "/root",
    env: { ...process.env, TERM: "xterm-256color", COLORTERM: "truecolor" },
  });

  activePtys.set(clientId, ptyProcess);
  console.log(`[Terminal] PTY created: ${clientId}, PID: ${ptyProcess.pid}`);

  ptyProcess.onData((data) => {
    if (ws.readyState === ws.OPEN) ws.send(data);
  });

  ws.on("message", (msg) => {
    try {
      const data = msg.toString();
      try {
        const parsed = JSON.parse(data);
        if (parsed.type === "resize") {
          ptyProcess.resize(parsed.cols, parsed.rows);
          console.log(`[Terminal] Resized ${clientId} to ${parsed.cols}x${parsed.rows}`);
          return;
        }
      } catch {}
      ptyProcess.write(data);
    } catch (err) {
      console.error(`[Terminal] Error:`, err);
    }
  });

  ws.on("close", () => {
    console.log(`[Terminal] Connection closed: ${clientId}`);
    ptyProcess.kill();
    activePtys.delete(clientId);
  });

  ws.on("error", (err) => {
    console.error(`[Terminal] WebSocket error:`, err);
    ptyProcess.kill();
    activePtys.delete(clientId);
  });

  ptyProcess.onExit(({ exitCode }) => {
    console.log(`[Terminal] PTY exited: ${clientId}, code: ${exitCode}`);
    activePtys.delete(clientId);
    if (ws.readyState === ws.OPEN) ws.close();
  });
});

app.get("/health", (req, res) => {
  res.json({ 
    status: "ok", 
    activeConnections: activePtys.size, 
    timestamp: new Date().toISOString() 
  });
});

const PORT = parseInt(process.env.TERMINAL_PORT || "3000", 10);
server.listen(PORT, "0.0.0.0", () => {
  console.log(`\n🖥️  Terminal server running at http://localhost:${PORT}`);
  console.log(`🔌 WebSocket endpoint: ws://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health\n`);
});

process.on("SIGINT", () => {
  console.log("\n[Terminal] Shutting down...");
  for (const [clientId, ptyProcess] of activePtys) {
    ptyProcess.kill();
  }
  activePtys.clear();
  server.close();
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("\n[Terminal] Shutting down...");
  for (const [clientId, ptyProcess] of activePtys) {
    ptyProcess.kill();
  }
  activePtys.clear();
  server.close();
  process.exit(0);
});