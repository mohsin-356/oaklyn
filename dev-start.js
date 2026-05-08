import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import http from 'http';
import net from 'net';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Function to detect the actual Vite dev server by probing the Vite client endpoint
function waitForVite(ports = [5173, 5174], timeoutMs = 30000, intervalMs = 500) {
  return new Promise((resolve) => {
    const start = Date.now();
    const checkOnce = () => {
      Promise.all(
        ports.map((port) =>
          new Promise((res) => {
            const req = http.get(
              { hostname: 'localhost', port, path: '/@vite/client' },
              (resp) => {
                // drain response to free socket
                resp.resume();
                res(resp.statusCode === 200);
              }
            );
            req.on('error', () => res(false));
          })
        )
      ).then((results) => {
        const idx = results.findIndex(Boolean);
        if (idx !== -1) {
          resolve(ports[idx]);
        } else if (Date.now() - start < timeoutMs) {
          setTimeout(checkOnce, intervalMs);
        } else {
          // Fallback: return the first preferred port
          resolve(ports[0]);
        }
      });
    };
    checkOnce();
  });
}

function isPortFree(port) {
  return new Promise((resolve) => {
    const srv = net
      .createServer()
      .once('error', () => resolve(false))
      .once('listening', () => srv.close(() => resolve(true)))
      .listen(port, '127.0.0.1');
  });
}

async function findFreePort(start = 5173, end = 5200) {
  for (let p = start; p <= end; p++) {
    if (await isPortFree(p)) return p;
  }
  return start;
}

let vite;

(async () => {
  const preferredPort = await findFreePort(5173, 5200);

  // Start Vite dev server
  vite = spawn('npm', ['run', 'dev:vite', '--', '--port', String(preferredPort), '--strictPort'], {
    cwd: __dirname,
    shell: true,
    stdio: 'inherit',
    env: { ...process.env }
  });

  // Wait for Vite to be ready, then start Electron
  waitForVite([preferredPort]).then((port) => {
    console.log(`\nDetected Vite dev server on port ${port}, starting Electron...\n`);

    const electron = spawn('electron', ['.'], {
      cwd: __dirname,
      shell: true,
      stdio: 'inherit',
      env: { ...process.env, NODE_ENV: 'development', VITE_DEV_SERVER_URL: `http://localhost:${port}` }
    });

    electron.on('exit', (code) => {
      try { vite?.kill(); } catch {}
      process.exit(code);
    });
  });
})();

process.on('SIGINT', () => {
  try { vite?.kill(); } catch {}
  process.exit(0);
});
