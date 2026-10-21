const {contextBridge, ipcRenderer} = require('electron');
contextBridge.exposeInMainWorld('pemaraExports', {
  save: request => ipcRenderer.invoke('pemara:education:export', request),
  saveBundle: requests => ipcRenderer.invoke('pemara:education:export-bundle', requests),
});
