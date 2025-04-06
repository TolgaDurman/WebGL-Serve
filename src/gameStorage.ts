// First, create a utility for IndexedDB storage
// Create a file called 'gameStorage.ts'

export interface FileData {
    name: string;
    path: string;
    type: string;
    size: number;
    contentId?: string; // Reference to the content in IndexedDB
  }
  
  export interface FolderData {
    name: string;
    files: FileData[];
  }
  
  class GameStorage {
    private dbName = 'GameFilesDB';
    private dbVersion = 1;
    private db: IDBDatabase | null = null;
    
    // Initialize the database
    async init(): Promise<boolean> {
      return new Promise((resolve, reject) => {
        const request = indexedDB.open(this.dbName, this.dbVersion);
        
        request.onerror = (event) => {
          console.error('Error opening IndexedDB:', event);
          reject(false);
        };
        
        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          // Create object store for file contents
          if (!db.objectStoreNames.contains('fileContents')) {
            db.createObjectStore('fileContents', { keyPath: 'id' });
          }
          // Create object store for folder metadata
          if (!db.objectStoreNames.contains('folders')) {
            db.createObjectStore('folders', { keyPath: 'id' });
          }
        };
        
        request.onsuccess = (event) => {
          this.db = (event.target as IDBOpenDBRequest).result;
          resolve(true);
        };
      });
    }
    
    // Store the folder data and file contents
    async storeFolderData(folderId: string, folderData: FolderData, fileContents: Map<string, ArrayBuffer | string>): Promise<boolean> {
      if (!this.db) await this.init();
      
      return new Promise((resolve, reject) => {
        try {
          const transaction = this.db!.transaction(['folders', 'fileContents'], 'readwrite');
          
          // Store folder metadata
          const folderStore = transaction.objectStore('folders');
          folderStore.put({ id: folderId, data: folderData });
          
          // Store file contents separately
          const contentStore = transaction.objectStore('fileContents');
          fileContents.forEach((content, contentId) => {
            contentStore.put({ id: contentId, data: content });
          });
          
          transaction.oncomplete = () => resolve(true);
          transaction.onerror = (event) => {
            console.error('Transaction error:', event);
            reject(false);
          };
        } catch (error) {
          console.error('Error storing folder data:', error);
          reject(false);
        }
      });
    }
    
    // Retrieve folder metadata
    async getFolderData(folderId: string): Promise<FolderData | null> {
      if (!this.db) await this.init();
      
      return new Promise((resolve, reject) => {
        try {
          const transaction = this.db!.transaction(['folders'], 'readonly');
          const store = transaction.objectStore('folders');
          const request = store.get(folderId);
          
          request.onsuccess = () => {
            if (request.result) {
              resolve(request.result.data);
            } else {
              resolve(null);
            }
          };
          
          request.onerror = (event) => {
            console.error('Error retrieving folder data:', event);
            reject(null);
          };
        } catch (error) {
          console.error('Error in getFolderData:', error);
          reject(null);
        }
      });
    }
    
    // Retrieve a file's content
    async getFileContent(contentId: string): Promise<ArrayBuffer | string | null> {
      if (!this.db) await this.init();
      
      return new Promise((resolve, reject) => {
        try {
          const transaction = this.db!.transaction(['fileContents'], 'readonly');
          const store = transaction.objectStore('fileContents');
          const request = store.get(contentId);
          
          request.onsuccess = () => {
            if (request.result) {
              resolve(request.result.data);
            } else {
              resolve(null);
            }
          };
          
          request.onerror = (event) => {
            console.error('Error retrieving file content:', event);
            reject(null);
          };
        } catch (error) {
          console.error('Error in getFileContent:', error);
          reject(null);
        }
      });
    }
    
    // Clear all stored data
    async clearAll(): Promise<boolean> {
      if (!this.db) await this.init();
      
      return new Promise((resolve, reject) => {
        try {
          const transaction = this.db!.transaction(['folders', 'fileContents'], 'readwrite');
          
          transaction.objectStore('folders').clear();
          transaction.objectStore('fileContents').clear();
          
          transaction.oncomplete = () => resolve(true);
          transaction.onerror = (event) => {
            console.error('Error clearing database:', event);
            reject(false);
          };
        } catch (error) {
          console.error('Error in clearAll:', error);
          reject(false);
        }
      });
    }
  }
  
  // Export singleton instance
  export const gameStorage = new GameStorage();