'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  platform:   process.platform,
  isElectron: true,

  minecraft: {
    /** Minecraft Java の環境を調査 */
    detect:          ()         => ipcRenderer.invoke('mc:detect'),
    /** Gradleプロジェクトをビルドして mods/ へインストール */
    buildAndInstall: (data)     => ipcRenderer.invoke('mc:buildAndInstall', data),
    /** Minecraft ランチャーを起動 */
    launch:          (path)     => ipcRenderer.invoke('mc:launch', path),
    /** mods/ フォルダを開く */
    openModsDir:     (modsDir)  => ipcRenderer.invoke('mc:openModsDir', modsDir),
    /** ビルドログをストリーム（進捗コールバック） */
    onBuildLog:      (cb)       => ipcRenderer.on('mc:buildLog', (_, msg) => cb(msg)),
    offBuildLog:     ()         => ipcRenderer.removeAllListeners('mc:buildLog'),
  },
});
