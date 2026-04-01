import { app, BrowserWindow, ipcMain, dialog, session, shell } from 'electron';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDev = process.env.NODE_ENV !== 'production';

function createWindow() {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Cross-Origin-Opener-Policy': ['same-origin'],
        'Cross-Origin-Embedder-Policy': ['credentialless'],
      }
    });
  });

  const win = new BrowserWindow({
    width: 1100,
    height: 750,
    backgroundColor: '#0a0a0f',
    webPreferences: {
      preload: path.join(__dirname, 'electron/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    }
  });

  if (isDev) {
    win.loadURL('http://localhost:5173');
  } else {
    win.loadFile(path.join(__dirname, 'dist/index.html'));
  }
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ── Pick folder ───────────────────────────────────────
ipcMain.handle('pick-folder', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory'],
    title: 'Select folder to index'
  });
  return result.canceled ? null : result.filePaths[0];
});

// ── Open file in OS default app ───────────────────────
ipcMain.handle('open-file', async (_, filePath) => {
  await shell.openPath(filePath);
});

// ── Get folder size ───────────────────────────────────
function getFolderSize(dir) {
  let size = 0;
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory() && !e.name.startsWith('.')) {
        size += getFolderSize(full);
      } else if (e.isFile()) {
        try { size += fs.statSync(full).size; } catch {}
      }
    }
  } catch {}
  return size;
}

// ── Scan folder ───────────────────────────────────────
ipcMain.handle('scan-folder', async (event, folderPath) => {
  const allFiles = [];

  function walk(dir) {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
    catch { return; }
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
          walk(fullPath);
        }
      } else {
        allFiles.push(fullPath);
      }
    }
  }

  walk(folderPath);

  const supported = allFiles.filter(f => {
    const ext = path.extname(f).toLowerCase();
    return [
      '.txt', '.md', '.pdf', '.docx', '.js', '.ts',
      '.py', '.json', '.csv', '.c', '.cpp', '.h',
      '.java', '.html', '.css', '.jsx', '.tsx'
    ].includes(ext);
  });

  const extracted = [];
  const total = supported.length;

  for (const filePath of supported.slice(0, 100)) {
    const ext = path.extname(filePath).toLowerCase();
    const fileName = path.basename(filePath);
    const relativePath = path.relative(folderPath, filePath);

    // Send progress to renderer
    event.sender.send('index-progress', {
      fileName,
      current: extracted.length + 1,
      total
    });

    try {
      let text = '';

      if (ext === '.pdf') {
        const pdfParse = (await import('pdf-parse')).default;
        const buffer = fs.readFileSync(filePath);
        const data = await pdfParse(buffer);
        text = data.text?.slice(0, 1000) || '';
      } else if (ext === '.docx') {
        const mammoth = await import('mammoth');
        const result = await mammoth.extractRawText({ path: filePath });
        text = result.value?.slice(0, 1000) || '';
      } else {
        text = fs.readFileSync(filePath, 'utf8').slice(0, 1000);
      }

      if (text.trim().length > 10) {
        const stats = fs.statSync(filePath);
        extracted.push({
          filePath,
          fileName,
          relativePath,
          fileType: ext.replace('.', ''),
          fileSize: stats.size,
          text: `${fileName} ${text.trim()}`,
        });
      }
    } catch (e) {
      console.error('Error reading:', filePath, e);
    }
  }

  const folderSize = getFolderSize(folderPath);
  return { files: extracted, total, folderSize };
});