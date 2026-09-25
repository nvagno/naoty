// Application de bureau : démarre le serveur Next autonome sur un port local
// libre, dans un processus utilitaire, et l'affiche dans une fenêtre.
import { app, BrowserWindow, dialog, Menu, shell, utilityProcess } from "electron";
import http from "node:http";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const projectDir = path.join(here, "..");

const serverDir = app.isPackaged
  ? path.join(process.resourcesPath, "server")
  : path.join(projectDir, ".next", "standalone");
const migrationsDir = app.isPackaged
  ? path.join(process.resourcesPath, "migrations")
  : path.join(projectDir, "prisma", "migrations");
const dataDir = process.env.CARNET_DATA_DIR ?? path.join(app.getPath("userData"), "data");

let server = null;
let serverLog = "";
let origin = null;
let mainWindow = null;

function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

function waitForServer(url, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const attempt = () => {
      if (!server) return reject(new Error("Le serveur s'est arrêté au démarrage."));
      http
        .get(url, (res) => {
          res.resume();
          resolve();
        })
        .on("error", () => {
          if (Date.now() > deadline) reject(new Error("Le serveur ne répond pas."));
          else setTimeout(attempt, 150);
        });
    };
    attempt();
  });
}

async function startServer() {
  const port = await freePort();
  origin = `http://127.0.0.1:${port}`;
  server = utilityProcess.fork(path.join(here, "server.mjs"), [], {
    serviceName: "Serveur du carnet",
    stdio: "pipe",
    env: {
      ...process.env,
      NODE_ENV: "production",
      PORT: String(port),
      HOSTNAME: "127.0.0.1",
      CARNET_SERVER_DIR: serverDir,
      CARNET_MIGRATIONS_DIR: migrationsDir,
      CARNET_DATA_DIR: dataDir,
      DATABASE_URL: `file:${path.join(dataDir, "carnet.db")}`,
      NEXT_TELEMETRY_DISABLED: "1",
    },
  });
  const collect = (chunk) => {
    serverLog = (serverLog + chunk.toString()).slice(-8000);
    if (!app.isPackaged) process.stdout.write(chunk);
  };
  server.stdout?.on("data", collect);
  server.stderr?.on("data", collect);
  server.on("message", (msg) => {
    if (msg?.type === "error") serverLog += "\n" + msg.message;
  });
  server.on("exit", (code) => {
    server = null;
    if (mainWindow && code !== 0) {
      dialog.showErrorBox("Mon Carnet de Recherche", `Le serveur local s'est arrêté (code ${code}).\n\n${serverLog}`);
      app.quit();
    }
  });
  await waitForServer(origin);
}

function isInternal(url) {
  return url.startsWith(origin + "/") || url === origin;
}

// Aucune fenêtre ne quitte le carnet : les adresses externes s'ouvrent dans le navigateur.
app.on("web-contents-created", (_e, contents) => {
  contents.on("will-navigate", (event, url) => {
    if (isInternal(url)) return;
    event.preventDefault();
    if (/^(https?|mailto):/.test(url)) shell.openExternal(url);
  });
});

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 720,
    minHeight: 500,
    title: "Mon Carnet de Recherche",
    show: false,
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, sandbox: true },
  });
  mainWindow.once("ready-to-show", () => mainWindow.show());
  mainWindow.on("closed", () => (mainWindow = null));

  const { webContents } = mainWindow;
  // Pages du carnet (impression, pièces jointes) : nouvelle fenêtre ; liens web : navigateur.
  webContents.setWindowOpenHandler(({ url }) => {
    if (isInternal(url)) {
      return { action: "allow", overrideBrowserWindowOptions: { autoHideMenuBar: true, width: 900, height: 1000 } };
    }
    if (/^(https?|mailto):/.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.loadURL(origin);
}

function buildMenu() {
  const isMac = process.platform === "darwin";
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      ...(isMac ? [{ role: "appMenu" }] : []),
      {
        label: "Fichier",
        submenu: [
          {
            label: "Ouvrir le dossier des données",
            click: () => shell.openPath(dataDir),
          },
          { type: "separator" },
          isMac ? { role: "close", label: "Fermer la fenêtre" } : { role: "quit", label: "Quitter" },
        ],
      },
      {
        label: "Édition",
        submenu: [
          { role: "undo", label: "Annuler" },
          { role: "redo", label: "Rétablir" },
          { type: "separator" },
          { role: "cut", label: "Couper" },
          { role: "copy", label: "Copier" },
          { role: "paste", label: "Coller" },
          { role: "selectAll", label: "Tout sélectionner" },
        ],
      },
      {
        label: "Affichage",
        submenu: [
          { role: "reload", label: "Recharger" },
          { role: "toggleDevTools", label: "Outils de développement" },
          { type: "separator" },
          { role: "resetZoom", label: "Taille réelle" },
          { role: "zoomIn", label: "Zoom avant" },
          { role: "zoomOut", label: "Zoom arrière" },
          { type: "separator" },
          { role: "togglefullscreen", label: "Plein écran" },
        ],
      },
    ]),
  );
}

if (!app.requestSingleInstanceLock()) {
  // Une seule instance : deux serveurs sur la même base SQLite seraient une source d'erreurs.
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });

  app.whenReady().then(async () => {
    buildMenu();
    try {
      await startServer();
    } catch (err) {
      dialog.showErrorBox("Mon Carnet de Recherche", `Impossible de démarrer le carnet.\n\n${err.message}\n\n${serverLog}`);
      app.quit();
      return;
    }
    createWindow();
    app.on("activate", () => {
      if (!mainWindow) createWindow();
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });

  app.on("will-quit", () => {
    server?.kill();
    server = null;
  });
}
