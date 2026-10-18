const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('pemaraNavigation', { open: area => ipcRenderer.invoke('pemara:education:navigate', area) });
