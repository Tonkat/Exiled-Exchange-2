// main/src/ipc-handlers.ts
import { ipcMain, net } from 'electron';
import * as http from 'http';

/**
 * Sets up IPC handlers for communication between renderer and main processes
 */
export function setupIpcHandlers() {
  // Handler to proxy requests to the calculation server
  ipcMain.handle('fetch-calculate-item', async (event, itemData: string) => {
    console.log('Main process fetching item data...');
    
    // Try multiple methods to connect to the server
    try {
      return await tryElectronNetRequest(itemData);
    } catch (electronError) {
      console.error('Electron net request failed:', electronError);
      
      try {
        return await tryNodeHttpRequest(itemData);
      } catch (nodeError) {
        console.error('Node HTTP request failed:', nodeError);
        throw new Error(`All connection methods failed. Last error: ${(nodeError as Error).message}`);
      }
    }
  });
}

/**
 * Try to connect using Electron's net module
 */
async function tryElectronNetRequest(itemData: string): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      console.log('Trying Electron net request to http://localhost:49090...');
      
      const request = net.request({
        method: 'GET',
        url: `http://localhost:49090/calculate_item?item=${itemData}`,
        // Add these headers to help with potential CORS issues
        headers: {
          'Accept': 'text/plain, */*',
          'User-Agent': 'Exiled-Exchange-2-Electron'
        }
      });
      
      let responseData = '';
      
      request.on('response', (response) => {
        console.log('Electron net received response with status:', response.statusCode);
        
        if (response.statusCode !== 200) {
          reject(new Error(`Server responded with status: ${response.statusCode}`));
          return;
        }
        
        response.on('data', (chunk) => {
          responseData += chunk.toString();
        });
        
        response.on('end', () => {
          console.log(`Received response of length: ${responseData.length}`);
          resolve(responseData);
        });
      });
      
      request.on('error', (error) => {
        console.error('Electron net request error:', error);
        reject(error);
      });
      
      request.end();
    } catch (error) {
      console.error('Exception in Electron net request:', error);
      reject(error);
    }
  });
}

/**
 * Try to connect using Node's http module as a fallback
 */
async function tryNodeHttpRequest(itemData: string): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      console.log('Trying Node HTTP request to http://localhost:49090...');
      
      const options = {
        hostname: 'localhost',
        port: 49090,
        path: `/calculate_item?item=${itemData}`,
        method: 'GET',
        headers: {
          'Accept': 'text/plain, */*',
          'User-Agent': 'Exiled-Exchange-2-Node'
        }
      };
      
      const req = http.request(options, (res) => {
        console.log('Node HTTP received response with status:', res.statusCode);
        
        if (res.statusCode !== 200) {
          reject(new Error(`Server responded with status: ${res.statusCode}`));
          return;
        }
        
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          console.log(`Received response of length: ${data.length}`);
          resolve(data);
        });
      });
      
      req.on('error', (error) => {
        console.error('Node HTTP request error:', error);
        reject(error);
      });
      
      req.end();
    } catch (error) {
      console.error('Exception in Node HTTP request:', error);
      reject(error);
    }
  });
}