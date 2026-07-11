'use strict';

const { app, BrowserWindow, shell, Menu, dialog, ipcMain, session } = require('electron');
const path    = require('path');
const http    = require('http');
const https   = require('https');
const url     = require('url');
const fs      = require('fs');
const os      = require('os');
const { exec, spawn } = require('child_process');
const { createRequire } = require('module');

/** HTTP/HTTPS リダイレクト対応ダウンロード */
function downloadFile(fileUrl, dest, onProgress) {
  return new Promise((resolve, reject) => {
    const mod = fileUrl.startsWith('https') ? https : http;
    mod.get(fileUrl, res => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        res.resume();
        return downloadFile(res.headers.location, dest, onProgress).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      const total = parseInt(res.headers['content-length'] || '0', 10);
      let received = 0;
      let lastPct = -1;
      const out = fs.createWriteStream(dest);
      res.on('data', chunk => {
        received += chunk.length;
        if (total) {
          const pct = Math.floor(received / total * 100);
          if (pct !== lastPct) { lastPct = pct; onProgress && onProgress(pct); }
        }
      });
      res.pipe(out);
      out.on('finish', () => { out.close(); resolve(); });
      out.on('error', reject);
    }).on('error', reject);
  });
}

// dev(=next dev + HMR)は ELECTRON_DEV=true の時だけ。既定は本番同等(in-process Next・HMRなし)で
// 動かす＝TurbopackのHMR websocketがElectronと相性悪くLOADING停止する問題を根本回避。
const isDev = !app.isPackaged && process.env.ELECTRON_DEV === 'true';
const PORT  = isDev ? 3000 : 3200;
let mainWindow = null;

process.env.MMC_USER_DATA = app.getPath('userData');

// ━━━ サーバー待機 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function waitForServer(port, timeout = 90000) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeout;
    function attempt() {
      http.get(`http://127.0.0.1:${port}/`, () => resolve())
        .on('error', () => {
          if (Date.now() > deadline) reject(new Error(`Server timeout (port ${port})`));
          else setTimeout(attempt, 800);
        });
    }
    attempt();
  });
}

// ━━━ Next.js 起動（インプロセス） ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// output:standalone は JS バンドルの配信構造が変わり Electron でクリックが効かなくなるため使わない
async function startNextServer(appRoot, sendStatus) {
  // インプロセス Next.js
  sendStatus('🔧 Next.js インプロセスサーバーを起動中...');
  const appRequire = createRequire(path.join(appRoot, 'package.json'));
  const nextMod    = appRequire('next');
  const createNext = typeof nextMod === 'function'         ? nextMod
                   : typeof nextMod.default === 'function' ? nextMod.default
                   : (() => { throw new Error('next module not found'); })();

  const nextApp = createNext({ dev: false, dir: appRoot });
  const handle  = nextApp.getRequestHandler();
  await nextApp.prepare();

  await new Promise((resolve, reject) => {
    http.createServer((req, res) => {
      handle(req, res, url.parse(req.url, true));
    }).listen(PORT, '127.0.0.1', err => err ? reject(err) : resolve());
  });
}

// ━━━ ウィンドウ作成 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function createWindow() {
  Menu.setApplicationMenu(null);
  const win = new BrowserWindow({
    width: 1440, height: 900, minWidth: 1100, minHeight: 700,
    title: 'CUBICENGINE Studio',
    icon:  path.join(__dirname, '..', 'public', 'icon-512x512.png'),
    backgroundColor: '#0d0d0f',
    show: false,
    // titleBarStyle は default（ネイティブ）— hiddenにするとElectronが
    // マウスイベントを横取りしてボタンが押せなくなる
    webPreferences: {
      preload:          path.join(__dirname, 'preload.js'),
      nodeIntegration:  false,
      contextIsolation: true,
    },
  });

  win.webContents.setWindowOpenHandler(({ url: u }) => {
    shell.openExternal(u); return { action: 'deny' };
  });
  // メニュー無効化でリロード/devtoolsのショートカットが死ぬので、キー入力で直接効かせる。
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type !== 'keyDown') return;
    const k = (input.key || '').toLowerCase();
    if (k === 'f5' || (input.control && k === 'r')) win.webContents.reload();
    if (input.control && input.shift && k === 'i') win.webContents.toggleDevTools();
  });
  win.on('closed', () => { mainWindow = null; });
  mainWindow = win;
  return win;
}

// ━━━ 起動フロー ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
app.whenReady().then(async () => {
  // デスクトップ(Electron)ではPWA Service Workerを使わない。過去に登録されたSWが残っていると
  // _next/HMR を横取りして ERR_INVALID_HTTP_RESPONSE / LOADING停止 を起こすため、起動時に消す。
  try { await session.defaultSession.clearStorageData({ storages: ['serviceworkers', 'cachestorage'] }); } catch {}

  const win = createWindow();

  const EDITION = process.env.MMC_EDITION || 'full'; // 'sprout' | 'grove' | 'full'
  const startPath =
    EDITION === 'sprout' ? '/editor?mode=tsumiki'
  : EDITION === 'grove'  ? '/editor?mode=grape'
  :                        '/';

  if (isDev) {
    // 開発時: すぐアプリを開く（devtoolsも自動で開いてエラーを見えるように）
    win.show();
    await win.loadURL(`http://127.0.0.1:${PORT}${startPath}`);
    win.webContents.openDevTools({ mode: 'detach' });
    return;
  }

  // ── スプラッシュを即座に表示 ──
  await win.loadFile(path.join(__dirname, 'splash.html'));
  win.show();

  const appRoot = app.getAppPath();
  const log = (msg) => {
    console.log('[MineModCraft]', msg);
    // スプラッシュのステータス更新
    win.webContents.executeJavaScript(
      `document.querySelector('.status') && (document.querySelector('.status').textContent = ${JSON.stringify(msg)})`
    ).catch(() => {});
  };

  try {
    log('Next.js を初期化中...');
    await startNextServer(appRoot, log);
    log('準備完了！');
    // アプリに切り替え（フェードなし、直接ナビ）
    await win.loadURL(`http://127.0.0.1:${PORT}${startPath}`);
  } catch (err) {
    console.error('[MineModCraft] Error:', err);
    dialog.showErrorBox(
      'サーバー起動エラー',
      `起動に失敗しました:\n${err.message}\n\nappRoot: ${appRoot}`
    );
    app.quit();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
app.on('activate', () => { if (!mainWindow) app.whenReady().then(() => {}); });

// ━━━ Minecraft IPC ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ipcMain.handle('mc:detect', async () => {
  const result = {
    minecraftDir: null, modsDir: null, launcherPath: null,
    hasJava: false, javaVersion: null, forgeVersions: [],
  };

  const mcDir = path.join(os.homedir(), 'AppData', 'Roaming', '.minecraft');
  if (fs.existsSync(mcDir)) {
    result.minecraftDir = mcDir;
    const modsDir = path.join(mcDir, 'mods');
    if (!fs.existsSync(modsDir)) fs.mkdirSync(modsDir);
    result.modsDir = modsDir;
    const versionsDir = path.join(mcDir, 'versions');
    if (fs.existsSync(versionsDir)) {
      result.forgeVersions = fs.readdirSync(versionsDir)
        .filter(v => v.toLowerCase().includes('forge')).slice(0, 10);
    }
  }

  const candidates = [
    'C:\\Program Files (x86)\\Minecraft Launcher\\MinecraftLauncher.exe',
    'C:\\Program Files\\Minecraft Launcher\\MinecraftLauncher.exe',
    path.join(os.homedir(), 'AppData', 'Roaming', 'Microsoft', 'Windows',
      'Start Menu', 'Programs', 'Minecraft Launcher', 'Minecraft Launcher.exe'),
    path.join('C:\\XboxGames\\Minecraft Launcher\\Content\\Minecraft Launcher.exe'),
  ];
  for (const c of candidates) { if (fs.existsSync(c)) { result.launcherPath = c; break; } }

  try {
    const out = await new Promise(res => exec('java -version 2>&1', (_, o, e) => res(e || o || '')));
    if (out.includes('version')) {
      result.hasJava    = true;
      result.javaVersion = (out.match(/version "([^"]+)"/)||[])[1] || 'unknown';
    }
  } catch {}

  return result;
});

ipcMain.handle('mc:buildAndInstall', async (event, { files, modsDir, tmpDirOverride }) => {
  const send = msg => { event.sender.send('mc:buildLog', msg); console.log('[Build]', msg); };

  // ── ① Gradle の場所を決定（アプリ内蔵 → システム PATH の順）──
  send('🔍 Gradle を確認中...');
  const configPath = path.join(app.getPath('userData'), 'gradle-config.json');
  let gradleCmd = 'gradle';

  // アプリ内蔵 Gradle が保存されていれば優先使用
  if (fs.existsSync(configPath)) {
    try {
      const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      if (cfg.gradleExe && fs.existsSync(cfg.gradleExe)) {
        gradleCmd = cfg.gradleExe;
        send(`✅ アプリ内蔵 Gradle を使用: ${cfg.gradleExe}`);
      }
    } catch {}
  }

  // システム Gradle の確認
  if (gradleCmd === 'gradle') {
    const gradleVersion = await new Promise(res => {
      exec('gradle --version 2>&1', (err, out) => {
        if (!err && out.includes('Gradle')) res((out.match(/Gradle ([\d.]+)/)||[])[1] || 'found');
        else res(null);
      });
    });
    if (!gradleVersion) {
      throw new Error('Gradle がインストールされていません。\n「🪄 Gradle を自動インストール」ボタンを押してください。');
    }
    send(`✅ システム Gradle ${gradleVersion} を検出`);
  }

  // ── ② プロジェクトファイルを書き出す ──
  const tmpDir = tmpDirOverride || path.join(os.homedir(), 'AppData', 'Local', 'minemodcraft-build-' + Date.now());
  fs.mkdirSync(tmpDir, { recursive: true });

  for (const f of files) {
    const full = path.join(tmpDir, f.path);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, f.content, 'utf8');
  }

  send(`📁 プロジェクト: ${tmpDir}`);
  send('🔨 gradle build --no-daemon 実行中（初回は数分かかります）...');

  // ── ③ ビルド実行 ──
  return new Promise((resolve, reject) => {
    const proc = spawn(gradleCmd, ['build', '--no-daemon', '--stacktrace'], {
      cwd: tmpDir, shell: true,
      env: { ...process.env, JAVA_OPTS: '-Xmx2g' },
    });

    proc.stdout?.on('data', d => {
      const line = d.toString().trim();
      if (line) send(line.length > 120 ? line.slice(0, 120) + '…' : line);
    });
    proc.stderr?.on('data', d => {
      const line = d.toString().trim();
      if (line && !line.startsWith('Deprecated')) send('⚠ ' + (line.length > 120 ? line.slice(0,120)+'…' : line));
    });

    proc.on('exit', code => {
      if (code !== 0) {
        // プロジェクトフォルダを開いて手動ビルドを促す
        shell.openPath(tmpDir);
        reject(new Error(
          `Gradle ビルドが失敗しました（終了コード ${code}）。\n\n` +
          `プロジェクトフォルダを開きました:\n${tmpDir}\n\n` +
          `手動ビルド方法:\n` +
          `1. コマンドプロンプトで上記フォルダへ移動\n` +
          `2. gradle build --no-daemon を実行\n` +
          `3. build/libs/ の .jar を .minecraft/mods/ へコピー`
        ));
        return;
      }

      send('✅ ビルド成功！');
      const libsDir = path.join(tmpDir, 'build', 'libs');
      if (!fs.existsSync(libsDir)) { reject(new Error('build/libs/ が見つかりません')); return; }

      const jars = fs.readdirSync(libsDir)
        .filter(f => f.endsWith('.jar') && !f.includes('sources') && !f.includes('javadoc'));
      if (!jars.length) { reject(new Error('JAR ファイルが見つかりません')); return; }

      const src = path.join(libsDir, jars[0]);
      const dst = path.join(modsDir, jars[0]);
      fs.copyFileSync(src, dst);
      send(`📦 インストール完了: ${jars[0]}`);
      resolve({ jarPath: dst, jarName: jars[0], tmpDir });
    });
  });
});

/** Gradle を公式サイトから直接ダウンロードしてアプリ内に展開 */
ipcMain.handle('mc:installGradle', async (event) => {
  const send = msg => { event.sender.send('mc:buildLog', msg); console.log('[Gradle]', msg); };

  const GRADLE_VER  = '8.14';
  const GRADLE_URL  = `https://services.gradle.org/distributions/gradle-${GRADLE_VER}-bin.zip`;
  const gradleRoot  = path.join(app.getPath('userData'), 'gradle');
  const gradleHome  = path.join(gradleRoot, `gradle-${GRADLE_VER}`);
  const gradleExe   = path.join(gradleHome, 'bin', 'gradle.bat');
  const zipPath     = path.join(gradleRoot, `gradle-${GRADLE_VER}-bin.zip`);
  const configPath  = path.join(app.getPath('userData'), 'gradle-config.json');

  // すでにインストール済み
  if (fs.existsSync(gradleExe)) {
    send('✅ Gradle はすでにインストール済みです。');
    fs.writeFileSync(configPath, JSON.stringify({ gradleExe }), 'utf8');
    return { ok: true, gradleExe };
  }

  fs.mkdirSync(gradleRoot, { recursive: true });

  // ① ダウンロード
  send(`📥 Gradle ${GRADLE_VER} をダウンロード中... (約 110 MB)`);
  send(`   URL: ${GRADLE_URL}`);
  let lastPct = 0;
  await downloadFile(GRADLE_URL, zipPath, pct => {
    if (pct - lastPct >= 10 || pct === 100) { lastPct = pct; send(`   ⬇ ${pct}%`); }
  });
  send('✅ ダウンロード完了');

  // ② PowerShell で ZIP 解凍
  send('📦 解凍中...');
  await new Promise((resolve, reject) => {
    const ps = spawn('powershell', [
      '-NoProfile', '-Command',
      `Expand-Archive -LiteralPath "${zipPath}" -DestinationPath "${gradleRoot}" -Force`
    ]);
    ps.stderr?.on('data', d => send('⚠ ' + d.toString().trim()));
    ps.on('exit', code => code === 0 ? resolve() : reject(new Error(`解凍失敗（コード ${code}）`)));
  });

  if (!fs.existsSync(gradleExe)) {
    throw new Error(`gradle.bat が見つかりません: ${gradleExe}`);
  }

  // ③ パスを保存
  fs.writeFileSync(configPath, JSON.stringify({ gradleExe }), 'utf8');
  try { fs.unlinkSync(zipPath); } catch {}

  send(`✅ Gradle ${GRADLE_VER} インストール完了！`);
  send('▶ そのままビルドを再試行します...');
  return { ok: true, gradleExe };
});

ipcMain.handle('mc:launch', async (_, launcherPath) => {
  if (launcherPath && fs.existsSync(launcherPath)) shell.openPath(launcherPath);
  else shell.openExternal('https://www.minecraft.net/ja-jp/download');
  return { ok: true };
});

ipcMain.handle('mc:openModsDir', async (_, modsDir) => {
  shell.openPath(modsDir); return { ok: true };
});
