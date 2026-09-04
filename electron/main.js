'use strict';

const { app, BrowserWindow, shell, Menu, dialog, ipcMain, session, protocol } = require('electron');
const path    = require('path');
const http    = require('http');
const https   = require('https');
const url     = require('url');
const fs      = require('fs');
const os      = require('os');
const { exec, spawn } = require('child_process');
const { createRequire } = require('module');

/* ═══════════════════════════════════════════
   新しい版のお知らせ
   ═══════════════════════════════════════════
   サイトから .exe / .dmg を入れた人には、これまで**更新を知る方法が無かった**。
   新しい版を出しても、本人がサイトを見に来ない限り古いまま。
   実害の例: Mac のマイクラ検出の修正(2026-09-04)は、既存ユーザーには届かない。

   ⚠️ 自動更新（ダウンロードして入れ替え）はここではやらない。
      macOS は署名されたアプリでないと自動更新できず（Apple の仕様。回避不可）、
      署名には Apple Developer Program が要る。Windows だけ自動更新にすると
      両OSで挙動が食い違い、説明も分岐する。まずは両方で動く「知らせるだけ」にする。

   ⚠️ Microsoft Store 版では**絶対に出さないこと**。Store 版は Windows が自動更新するので
      不要なうえ、ストアアプリから外部のダウンロードページへ誘導するのは審査に触れる。
      判定は process.windowsStore（Electron が Store パッケージ実行時に true にする）。 */
const UPDATE_FEED = 'https://api.github.com/repos/hahaCH314/CUBICENGINE/releases/latest';
const DOWNLOAD_PAGE = 'https://cubicengine.vercel.app/';

/** "v0.1.5" / "0.1.5" を [0,1,5] にする。数字以外は 0 として扱う。 */
function parseVersion(v) {
  return String(v || '').replace(/^v/, '').split('.').map(n => parseInt(n, 10) || 0);
}

/** a が b より新しければ true */
function isNewer(a, b) {
  const pa = parseVersion(a), pb = parseVersion(b);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d !== 0) return d > 0;
  }
  return false;
}

function fetchLatestTag() {
  return new Promise(resolve => {
    const req = https.get(UPDATE_FEED, {
      headers: { 'User-Agent': 'CUBICENGINE', 'Accept': 'application/vnd.github+json' },
      timeout: 8000,
    }, res => {
      if (res.statusCode !== 200) { res.resume(); return resolve(null); }
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        try { resolve(JSON.parse(body).tag_name || null); } catch { resolve(null); }
      });
    });
    // 通信できないときは黙って諦める。起動を妨げないこと。
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
  });
}

async function notifyIfUpdateAvailable(win) {
  if (isDev) return;
  if (process.windowsStore) return;  // Store 版は Windows が自動更新する

  const latest = await fetchLatestTag();
  if (!latest) return;
  const current = app.getVersion();
  if (!isNewer(latest, current)) return;

  const { response } = await dialog.showMessageBox(win, {
    type: 'info',
    buttons: ['ダウンロードページを開く', 'あとで'],
    defaultId: 0,
    cancelId: 1,
    title: '新しいバージョンがあります',
    message: `新しいバージョン ${latest} が出ています`,
    detail: `いまお使いのバージョン: ${current}\n\n`
          + 'ダウンロードページから新しいものを入れると、追加された機能や\n'
          + '直された不具合が使えるようになります。',
  });
  if (response === 0) shell.openExternal(DOWNLOAD_PAGE);
}

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

// ━━━ 起動の自己修復 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ElectronはGPU処理を子プロセスに分離するが、環境によってはその子プロセスを
// 作れない（セキュリティソフトがインストール先からのプロセス生成を止める等）。
// その場合 Chromium は7回リトライしたのち "GPU process isn't usable. Goodbye." で
// 本体ごと終了する＝ユーザーには「一瞬ウィンドウが出て消えた」としか見えず、
// 理由がどこにも残らない。実際 %LOCALAPPDATA%\Programs から起動した環境で発生した。
//
// 対策: 前回の起動が「画面を出す前に終わっていた」ら、今回はGPUを分離せずに起動する。
// 一度それで起動できた端末はその設定を覚える（毎回失敗→成功を繰り返さないため）。
// 問題の無い端末は通常どおり分離したまま＝全員の性能を落とさない。
const BOOT_STATE = path.join(app.getPath('userData'), 'boot-state.json');
const readBoot = () => { try { return JSON.parse(fs.readFileSync(BOOT_STATE, 'utf8')); } catch { return {}; } };
const writeBoot = (v) => {
  try { fs.mkdirSync(path.dirname(BOOT_STATE), { recursive: true }); fs.writeFileSync(BOOT_STATE, JSON.stringify(v)); } catch {}
};
const _boot = readBoot();
// pending=前回は起動途中で落ちた / safeGpu=この端末では分離しないと動かないと確定済み
const SAFE_GPU = _boot.safeGpu === true || _boot.pending === true;
if (SAFE_GPU) {
  app.commandLine.appendSwitch('in-process-gpu');
  console.log('[MineModCraft] 前回の起動に失敗しているため、GPUを分離せずに起動します');
}
writeBoot({ ..._boot, pending: true });

// ━━━ 自分自身への接続にプロキシを通さない ━━━━━━━━━━━━━━━━━━━━━━━━
// このアプリは中で Next.js を立てて 127.0.0.1:3200 を読み込む。**外に出ない通信**。
// ところが Chromium は「プロキシの自動検出(WPAD)」が有効だと、起動直後に
// ネットワーク上のプロキシを探しに行き、その解決が終わるまで接続を保留する。
// 環境によっては、そこで最初の1回が ERR_FAILED で弾かれる。
//   → 画面は一瞬で消え、「サーバー起動エラー」だけが出る（2026-09-04 に報告あり）
//
// ⚠️ プロキシ自体を無効にはしないこと。会社や学校のプロキシ越しに
//    使っている人の更新確認まで切れてしまう。**loopback だけ除外する。**
app.commandLine.appendSwitch('proxy-bypass-list', '<local>;127.0.0.1;localhost;[::1]');
/** 画面が出たら「起動できた」と記録する。ここまで来れば次回は普通に起動してよい。 */
const markBootOk = () => writeBoot({ safeGpu: SAFE_GPU, pending: false });

// 握りつぶすと原因が分からなくなるので、拾えなかった例外は必ず出す
process.on('unhandledRejection', (e) => console.error('[MineModCraft] unhandledRejection:', e));

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
/* ═══════════════════════════════════════════
   画面の読み込み（サーバーを使わない）
   ═══════════════════════════════════════════
   out/ に書き出した静的ファイルを app:// という独自の名前で読む。
   ⚠️ file:// を直接使わないこと。ページ内の絶対パス(/_next/... )が
      ドライブのルートを指してしまい、何も読めなくなる。
      app:// なら out/ を基準にできる。

   これでサーバーが要らなくなる＝ポートの奪い合いも、プロキシも、
   ファイアウォールも関係なくなる。2026-09-04 の起動不能はそこが原因だった。 */
const APP_SCHEME = 'app';
protocol.registerSchemesAsPrivileged([
  { scheme: APP_SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

/** out/ を app:// で読めるようにする。呼ぶのは app.whenReady() の後。 */
function registerAppProtocol(outDir) {
  protocol.handle(APP_SCHEME, async (request) => {
    const { pathname } = new URL(request.url);
    let rel = decodeURIComponent(pathname);
    if (rel.endsWith('/')) rel += 'index.html';
    if (rel === '' || rel === '/') rel = '/index.html';

    // ⚠️ out/ の外へ出さない。`..` を含むURLで任意のファイルを読まれるのを防ぐ。
    const full = path.resolve(outDir, '.' + rel);
    if (!full.startsWith(path.resolve(outDir) + path.sep)) {
      return new Response('forbidden', { status: 403 });
    }
    // 拡張子が無いパスは trailingSlash 付きのディレクトリとして解決する
    const target = fs.existsSync(full) && fs.statSync(full).isDirectory()
      ? path.join(full, 'index.html')
      : full;
    try {
      return new Response(fs.readFileSync(target), { headers: { 'content-type': mimeOf(target) } });
    } catch {
      return new Response('not found', { status: 404 });
    }
  });
}

function mimeOf(p) {
  const e = path.extname(p).toLowerCase();
  return {
    '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
    '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml',
    '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff',
    '.mp3': 'audio/mpeg', '.jar': 'application/java-archive', '.txt': 'text/plain; charset=utf-8',
  }[e] || 'application/octet-stream';
}

async function startNextServer(appRoot, sendStatus) {
  // ⚠️ Next 16 は dir を **カレントディレクトリ基準** で解決する。絶対パスを渡しても
  //    cwd と連結されるため、cwd を合わせないと全リクエストが 500 になる。
  //    配布版の cwd はインストール先（resources/app の親）なので、
  //      <install>\<install>\resources\app\.next\routes-manifest.json
  //    という二重パスを開こうとして ENOENT で落ちていた（v0.1.0 の実害）。
  //    開発時は cwd がリポジトリ直下＝appRoot と一致するので表面化しない。
  try { process.chdir(appRoot); } catch { /* 失敗しても下で拾えるので握りつぶす */ }

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
const WIN_STATE = path.join(app.getPath('userData'), 'window-state.json');
function readWinState() { try { return JSON.parse(fs.readFileSync(WIN_STATE, 'utf8')); } catch { return null; } }

function createWindow() {
  Menu.setApplicationMenu(null);
  const st = readWinState();
  const win = new BrowserWindow({
    width: st?.width ?? 1600, height: st?.height ?? 1000,
    x: st?.x, y: st?.y,
    minWidth: 1000, minHeight: 640,
    title: 'CUBICENGINEstudio',
    icon:  path.join(__dirname, '..', 'public', 'icon-512.png'),
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

  // 初回 or 前回最大化なら最大化で開く＝広くて自由・没入感。
  if (st?.max ?? true) win.maximize();

  // 新規ウィンドウは開かず、外部ブラウザへ渡す。
  // ※ openExternal はOSにURLを丸投げする＝file:// や独自スキームだと外部プログラムが
  //   起動しうるので、http/https だけを通す（それ以外は黙って捨てる）。
  win.webContents.setWindowOpenHandler(({ url: u }) => {
    let ok = false;
    try { ok = /^https?:$/.test(new URL(u).protocol); } catch { /* 不正URLは弾く */ }
    if (ok) shell.openExternal(u);
    return { action: 'deny' };
  });
  // メニュー無効化でショートカットが死ぬので直接効かせる：
  //  F11=全画面(枠が全部消えて没入)/Esc=解除/F5・Ctrl+R=再読込/Ctrl+Shift+I=devtools
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type !== 'keyDown') return;
    const k = (input.key || '').toLowerCase();
    if (k === 'f11') win.setFullScreen(!win.isFullScreen());
    else if (k === 'escape' && win.isFullScreen()) win.setFullScreen(false);
    else if (k === 'f5' || (input.control && k === 'r')) win.webContents.reload();
    else if (input.control && input.shift && k === 'i') win.webContents.toggleDevTools();
  });
  // 窓の大きさ・位置・最大化状態を記憶（次回もそこで開く）
  win.on('close', () => {
    try { fs.writeFileSync(WIN_STATE, JSON.stringify({ ...win.getNormalBounds(), max: win.isMaximized() })); } catch {}
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

  // 版の判定。MMC_EDITION はビルド時にしか設定されず、パッケージ版の実行時には
  // 未設定になる＝どの版を入れても 'full' 扱いでトップページが開いてしまっていた。
  // ビルド時に package.json へ焼き込んだ mmcEdition を読む（--config.extraMetadata）。
  let pkgEdition = '';
  try { pkgEdition = require(path.join(app.getAppPath(), 'package.json')).mmcEdition || ''; } catch {}
  const EDITION = process.env.MMC_EDITION || pkgEdition || 'full'; // 'sprout' | 'grove' | 'full'
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
  // ここは try の外だったため、読み込みに失敗しても unhandledRejection になるだけで
  // 何も表示されないまま終了していた。失敗しても先へ進めて、原因は下の catch で出す。
  try {
    await win.loadFile(path.join(__dirname, 'splash.html'));
  } catch (e) {
    console.error('[MineModCraft] splash 読み込み失敗:', e);
  }
  win.show();

  const appRoot = app.getAppPath();
  const log = (msg) => {
    console.log('[MineModCraft]', msg);
    // スプラッシュのステータス更新
    win.webContents.executeJavaScript(
      `document.querySelector('.status') && (document.querySelector('.status').textContent = ${JSON.stringify(msg)})`
    ).catch(() => {});
  };

  // ── サーバーを使わない道を優先する ──
  // out/ が同梱されていれば、静的ファイルを app:// で直接読む。
  // ポートもプロキシもファイアウォールも関係なくなる（2026-09-04 の起動不能対策）。
  const outDir = path.join(appRoot, 'out');
  if (fs.existsSync(path.join(outDir, 'index.html'))) {
    try {
      log('画面を読み込んでいます...');
      registerAppProtocol(outDir);
      await win.loadURL(`${APP_SCHEME}://local${startPath.startsWith('/') ? startPath : '/' + startPath}`);
      markBootOk();
      setTimeout(() => { notifyIfUpdateAvailable(win).catch(() => {}); }, 3000);
      return;
    } catch (err) {
      // ここで失敗しても、下のサーバー方式を試す（out/ が壊れている場合の保険）
      console.error('[MineModCraft] 静的読み込みに失敗。サーバー方式を試します:', err);
    }
  }

  try {
    log('Next.js を初期化中...');
    await startNextServer(appRoot, log);

    // ⚠️ listen できた＝すぐ応答できる、ではない。
    //    以前はここから即 loadURL していたので、まだ応答できない一瞬に当たると
    //    ERR_FAILED で落ち、そのまま「サーバー起動エラー」を出して終わっていた。
    //    waitForServer は前からあったのに**一度も呼ばれていなかった**（2026-09-04 に判明）。
    log('サーバーの応答を待っています...');
    try {
      await waitForServer(PORT, 60000);
    } catch (e) {
      // 応答が無くても、この後の loadURL で改めて試す。ここで諦めない。
      console.warn('[MineModCraft] waitForServer:', e.message);
    }

    // ⚠️ 1回の失敗で諦めないこと。
    //    ERR_FAILED は「繋がらなかった」だけで、原因も継続性も分からない。
    //    環境によっては最初の1回だけ弾かれる（実際にその報告があった）。
    //    間隔を空けて数回試し、それでも駄目なときだけエラーにする。
    log('準備完了！');
    let lastErr = null;
    for (let i = 1; i <= 5; i++) {
      try {
        await win.loadURL(`http://127.0.0.1:${PORT}${startPath}`);
        lastErr = null;
        break;
      } catch (e) {
        lastErr = e;
        console.warn(`[MineModCraft] 画面の読み込みに失敗 (${i}/5):`, e.message);
        log(`つながらないので、もう一度試します… (${i}/5)`);
        await new Promise(r => setTimeout(r, 1000 * i));  // 1秒, 2秒, 3秒… と間隔を広げる
      }
    }
    if (lastErr) throw lastErr;

    // ここまで来たら起動成功。次回の自己修復判定に使う。
    markBootOk();

    // 起動が終わってから新しい版を確認する。
    // ⚠️ await しないこと。通信が遅い/落ちているときに起動を待たせない。
    //    失敗しても黙って諦める作りにしてある（notifyIfUpdateAvailable 参照）。
    setTimeout(() => { notifyIfUpdateAvailable(win).catch(() => {}); }, 3000);
  } catch (err) {
    console.error('[MineModCraft] Error:', err);
    // ⚠️ 「もう一度起動してください」だけでは、直らなかった人がそこで詰む。
    //    実際に起きた（2026-09-04）。何を試せばいいかと、**待たずに作れる道**を必ず出す。
    dialog.showErrorBox(
      'アプリを開けませんでした',
      `${err.message}\n\n`
      + `── 試せること ──\n`
      + `1. もう一度アプリを起動する（別の方法で立ち上げ直します）\n`
      + `2. セキュリティソフトの除外に、このフォルダを入れる:\n`
      + `   ${path.dirname(appRoot)}\n`
      + `3. パソコンを再起動する\n\n`
      + `── 待てないときは ──\n`
      + `ブラウザでも同じものが作れます（インストール不要・すぐ使えます）:\n`
      + `${DOWNLOAD_PAGE}editor?mode=grape\n\n`
      + `直らないときは、この画面を撮って知らせてください。\n`
      + `appRoot: ${appRoot}\nGPU分離なし: ${SAFE_GPU}`
    );
    app.quit();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
app.on('activate', () => { if (!mainWindow) app.whenReady().then(() => {}); });

// ━━━ Minecraft IPC ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// Java版マイクラの置き場所。OSごとに違う。
// ⚠️ ここを Windows 決め打ちにしていたため、Mac版では**永遠に見つからず**、
//    「マイクラのフォルダへ自動で入れる」機能が黙って使えなかった（2026-09-03 修正）。
//    エラーは出ない。「マイクラが見つかりません」と出るだけなので、
//    使う側は「入れてないのかな」と思ってしまう。
function minecraftDirFor(platform, home) {
  switch (platform) {
    case 'win32':  return path.join(home, 'AppData', 'Roaming', '.minecraft');
    // Mac は先頭のドットが付かない。Finder では「ライブラリ」と表示される。
    case 'darwin': return path.join(home, 'Library', 'Application Support', 'minecraft');
    default:       return path.join(home, '.minecraft');  // Linux
  }
}

// ランチャーの実体。見つからなければ公式のダウンロードページを開く（mc:launch）。
function launcherCandidatesFor(platform, home) {
  if (platform === 'win32') {
    return [
      'C:\\Program Files (x86)\\Minecraft Launcher\\MinecraftLauncher.exe',
      'C:\\Program Files\\Minecraft Launcher\\MinecraftLauncher.exe',
      path.join(home, 'AppData', 'Roaming', 'Microsoft', 'Windows',
        'Start Menu', 'Programs', 'Minecraft Launcher', 'Minecraft Launcher.exe'),
      path.join('C:\\XboxGames\\Minecraft Launcher\\Content\\Minecraft Launcher.exe'),
    ];
  }
  if (platform === 'darwin') {
    // .app はフォルダなので existsSync で判定でき、shell.openPath でそのまま起動する
    return [
      '/Applications/Minecraft.app',
      path.join(home, 'Applications', 'Minecraft.app'),
    ];
  }
  return [];
}

// 作業用の一時フォルダを置く場所。Windows の挙動は変えない。
// ⚠️ Mac で AppData/Local を使うと、ホームに見慣れない AppData フォルダが作られる。
function localWorkRootFor(platform, home) {
  switch (platform) {
    case 'win32':  return path.join(home, 'AppData', 'Local');
    case 'darwin': return path.join(home, 'Library', 'Caches');
    default:       return os.tmpdir();
  }
}

ipcMain.handle('mc:detect', async () => {
  const result = {
    minecraftDir: null, modsDir: null, launcherPath: null,
    hasJava: false, javaVersion: null, forgeVersions: [],
  };

  const mcDir = minecraftDirFor(process.platform, os.homedir());
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

  const candidates = launcherCandidatesFor(process.platform, os.homedir());
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

  // ── ① 生成物に gradle wrapper(gradlew) を同梱しているので、システムGradleは不要。
  //     JDK17 だけあれば ./gradlew が Gradle 本体(8.8)を自動DLしてビルドする（自己完結）。
  const isWin = process.platform === 'win32';

  // ── ② プロジェクトファイルを書き出す ──
  const tmpDir = tmpDirOverride || path.join(
    localWorkRootFor(process.platform, os.homedir()),
    'minemodcraft-build-' + Date.now()
  );
  fs.mkdirSync(tmpDir, { recursive: true });

  // 書き出し先は必ず tmpDir の内側に収める。exporter 側でも名前を sanitize 済みだが、
  // 取り込んだ .cubic 由来の値がここまで来る経路がある以上、書き込む直前でも検査する
  // （`../` を含むパスで tmpDir の外＝任意の場所に書かれるのを防ぐ多層防御）。
  const tmpRoot = path.resolve(tmpDir) + path.sep;
  for (const f of files) {
    const full = path.resolve(tmpDir, f.path);
    if (!full.startsWith(tmpRoot)) {
      throw new Error(`不正なファイルパスが含まれています: ${f.path}`);
    }
    fs.mkdirSync(path.dirname(full), { recursive: true });
    // バイナリ(テクスチャpng / gradle-wrapper.jar 等)は base64 で渡ってくるのでバイナリ書き込み。
    if (f.base64) fs.writeFileSync(full, Buffer.from(f.content, 'base64'));
    else fs.writeFileSync(full, f.content, 'utf8');
  }
  // unix系では gradlew に実行権限を付ける（Windowsは gradlew.bat を使うので不要）
  if (!isWin) { try { fs.chmodSync(path.join(tmpDir, 'gradlew'), 0o755); } catch {} }

  send(`📁 プロジェクト: ${tmpDir}`);
  send('🔨 gradlew build --no-daemon 実行中（初回はGradle本体のDLで数分かかります）...');

  // ── ③ ビルド実行（同梱の gradle wrapper を使用＝システムGradle不要）──
  return new Promise((resolve, reject) => {
    // ※Windowsは gradlew.bat を「絶対パス」で渡す。cwd 任せの相対名だと、環境変数
    //   NoDefaultCurrentDirectoryInExePath=1 の環境で cmd がカレントを探さなくなり
    //   「'gradlew.bat' は認識されていません」で必ず失敗する（開発者シェル等で既定ON）。
    const proc = isWin
      ? spawn('cmd', ['/c', path.join(tmpDir, 'gradlew.bat'), 'build', '--no-daemon', '--stacktrace'],
          { cwd: tmpDir, env: { ...process.env, JAVA_OPTS: '-Xmx2g' } })
      : spawn('./gradlew', ['build', '--no-daemon', '--stacktrace'],
          { cwd: tmpDir, shell: true, env: { ...process.env, JAVA_OPTS: '-Xmx2g' } });

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
          `1. ${isWin ? 'コマンドプロンプト' : 'ターミナル'}で上記フォルダへ移動\n` +
          `2. ${isWin ? 'gradlew build --no-daemon' : './gradlew build --no-daemon'} を実行\n` +
          `3. build/libs/ の .jar を下記へコピー\n` +
          `   ${path.join(minecraftDirFor(process.platform, os.homedir()), 'mods')}`
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
