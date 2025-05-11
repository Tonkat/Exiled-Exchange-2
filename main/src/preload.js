// Preload script to expose limited functionality to the renderer process
const { contextBridge, ipcRenderer } = require('electron');

// Expose a limited API to the renderer process
contextBridge.exposeInMainWorld('electron', {
  // Only expose the specific IPC functionality needed
  ipcRenderer: {
    // Allow invoking only specific channels
    invoke: (channel, ...args) => {
      // Whitelist channels that can be invoked from renderer
      const validChannels = ['fetch-calculate-item'];
      if (validChannels.includes(channel)) {
        return ipcRenderer.invoke(channel, ...args);
      }
      
      throw new Error(`Unauthorized IPC channel: ${channel}`);
    }
  }
});
