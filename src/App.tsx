import { useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { gameStorage, FileData } from './gameStorage';
import './App.css';

// Generate a unique ID for content
const generateId = () => `file_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

function App() {
  const [folderName, setFolderName] = useState<string | null>(null);
  const [files, setFiles] = useState<FileData[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingProgress, setLoadingProgress] = useState<number>(0);
  const [loadingMessage, setLoadingMessage] = useState<string>('');
  const navigate = useNavigate();

  // File content cache - kept in memory while processing
  const fileContentsRef = useRef<Map<string, ArrayBuffer | string>>(new Map());

  // Handle folder drop
  const handleDrop = useCallback(async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (e.dataTransfer.items) {
      setIsLoading(true);
      setLoadingProgress(0);
      setLoadingMessage('Processing dropped files...');
      
      const fileEntries: FileData[] = [];
      const fileContents = new Map<string, ArrayBuffer | string>();
      const items = Array.from(e.dataTransfer.items);
      
      // Check if we're dropping a folder
      const entry = items[0]?.webkitGetAsEntry?.();
      
      if (entry && entry.isDirectory) {
        const folderName = entry.name;
        setFolderName(folderName);
        await processDirectoryEntry(entry, fileEntries, fileContents);
        setFiles(fileEntries);
      } else {
        // Handle files directly dropped
        const droppedFiles = Array.from(e.dataTransfer.files);
        
        if (droppedFiles.length > 0) {
          // Try to get folder name
          const firstFilePath = (droppedFiles[0] as any).webkitRelativePath || '';
          const commonFolder = firstFilePath.split('/')[0] || 'Unknown Folder';
          setFolderName(commonFolder);
          
          await processFiles(droppedFiles, fileEntries, fileContents);
          setFiles(fileEntries);
        }
      }
      
      // Store the reference to file contents
      fileContentsRef.current = fileContents;
      
      setIsLoading(false);
      setLoadingMessage('');
    }
  }, []);

  // Process directory entries recursively
  const processDirectoryEntry = async (
    directoryEntry: any, 
    fileEntries: FileData[], 
    fileContents: Map<string, ArrayBuffer | string>,
    basePath = ''
  ) => {
    return new Promise<void>((resolve) => {
      const dirReader = directoryEntry.createReader();
      
      const readEntries = () => {
        dirReader.readEntries(async (entries: any[]) => {
          if (entries.length === 0) {
            resolve();
            return;
          }
          
          for (const entry of entries) {
            const path = basePath ? `${basePath}/${entry.name}` : entry.name;
            
            if (entry.isFile) {
              await new Promise<void>((fileResolve) => {
                entry.file((file: File) => {
                  const contentId = generateId();
                  
                  // Add file metadata to entries
                  fileEntries.push({
                    name: file.name,
                    path: path,
                    type: file.type,
                    size: file.size,
                    contentId: contentId
                  });
                  
                  // Read file content
                  const reader = new FileReader();
                  reader.onload = (e) => {
                    if (e.target?.result) {
                      // Store content in memory map
                      fileContents.set(contentId, e.target.result);
                    }
                    fileResolve();
                    
                    // Update progress
                    setLoadingProgress(prev => {
                      const newProgress = Math.min(prev + (100 / (entries.length * 2)), 99);
                      return newProgress;
                    });
                  };
                  
                  setLoadingMessage(`Reading ${path}`);
                  reader.readAsArrayBuffer(file);
                });
              });
            } else if (entry.isDirectory) {
              await processDirectoryEntry(entry, fileEntries, fileContents, path);
            }
          }
          
          // Continue reading (directories are read in chunks)
          readEntries();
        });
      };
      
      readEntries();
    });
  };

  // Process files directly
  const processFiles = async (
    files: File[], 
    fileEntries: FileData[],
    fileContents: Map<string, ArrayBuffer | string>
  ) => {
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const relativePath = (file as any).webkitRelativePath || file.name;
      const contentId = generateId();
      
      fileEntries.push({
        name: file.name,
        path: relativePath,
        type: file.type,
        size: file.size,
        contentId: contentId
      });
      
      setLoadingMessage(`Reading ${file.name} (${i+1}/${files.length})`);
      
      // Read and cache file content
      await new Promise<void>((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          if (e.target?.result) {
            fileContents.set(contentId, e.target.result);
          }
          resolve();
          
          // Update progress
          setLoadingProgress(prev => {
            const newProgress = Math.min(prev + (100 / files.length), 99);
            return newProgress;
          });
        };
        reader.readAsArrayBuffer(file);
      });
    }
    
    setLoadingProgress(100);
  };

  // Handle folder selection via file input
  const handleFolderSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;
    
    setIsLoading(true);
    setLoadingProgress(0);
    setLoadingMessage('Processing selected files...');
    
    const fileEntries: FileData[] = [];
    const fileContents = new Map<string, ArrayBuffer | string>();
    const filesArray = Array.from(selectedFiles);
    
    // Get folder name from first file's path
    const firstFilePath = (selectedFiles[0] as any).webkitRelativePath || '';
    const folderName = firstFilePath.split('/')[0] || 'Selected Folder';
    setFolderName(folderName);
    
    await processFiles(filesArray, fileEntries, fileContents);
    setFiles(fileEntries);
    
    // Store the reference to file contents
    fileContentsRef.current = fileContents;
    
    setIsLoading(false);
    setLoadingMessage('');
  };

  // Start the game with cached files
  const startGame = async () => {
    try {
      setLoadingMessage('Preparing game data...');
      setIsLoading(true);
      
      // Use a unique folder ID based on name and timestamp
      const folderId = `folder_${Date.now()}`;
      
      // Store the current session ID in sessionStorage (small data, safe to store)
      sessionStorage.setItem('currentGameFolder', folderId);
      
      // Store the actual folder data and contents in IndexedDB
      const folderData = {
        name: folderName || 'Unknown Folder',
        files: files
      };
      
      // Store in IndexedDB (could take time for large folders)
      await gameStorage.storeFolderData(folderId, folderData, fileContentsRef.current);
      
      setIsLoading(false);
      setLoadingMessage('');
      
      // Navigate to game page
      navigate('/game');
    } catch (error) {
      console.error('Error preparing game data:', error);
      setIsLoading(false);
      setLoadingMessage('');
      alert('Failed to prepare game data. See console for details.');
    }
  };

  // Handle drag events
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  // Open folder dialog
  const openFolderDialog = () => {
    document.getElementById('folder-input')?.click();
  };

  return (
    <div className="app-container">
      <h1>Game Folder Uploader</h1>
      
      <div 
        className={`dropzone ${folderName ? 'has-folder' : ''}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      >
        <input
          id="folder-input"
          type="file"
          onChange={handleFolderSelect}
          style={{ display: 'none' }}
          {...({ webkitdirectory: '', directory: '', multiple: true } as any)}
        />
        
        {!folderName ? (
          <>
            <div className="upload-icon">📁</div>
            <p>Drag and drop a folder here</p>
            <button onClick={openFolderDialog} className="select-button">
              Select Folder
            </button>
          </>
        ) : (
          <div className="folder-info">
            <h2>{folderName}</h2>
            <p>{files.length} files loaded</p>
            
            {isLoading ? (
              <div className="loading-container">
                <div className="progress-bar-container">
                  <div 
                    className="progress-bar" 
                    style={{ width: `${loadingProgress}%` }}
                  ></div>
                  <span>{Math.round(loadingProgress)}%</span>
                </div>
                <p className="loading-message">{loadingMessage}</p>
              </div>
            ) : (
              <>
                <button 
                  onClick={startGame} 
                  className="start-game-button"
                  disabled={files.length === 0}
                >
                  Run Game
                </button>
                <button 
                  onClick={() => {
                    setFolderName(null);
                    setFiles([]);
                    fileContentsRef.current.clear();
                    const fileInput = document.getElementById('folder-input') as HTMLInputElement;
                    if (fileInput) {
                      fileInput.value = ''; // Reset file input value
                    }
                  }} 
                  className="reset-button"
                >
                  Reset
                </button>
              </>
            )}
          </div>
        )}
      </div>
      
      {files.length > 0 && !isLoading && (
        <div className="file-list">
          <h3>Files ({files.length}):</h3>
          <div className="files-container">
            {files.slice(0, 10).map((file, index) => (
              <div key={index} className="file-item">
                <span className="file-name">{file.path}</span>
                <span className="file-size">{(file.size / 1024).toFixed(1)} KB</span>
              </div>
            ))}
            {files.length > 10 && (
              <div className="more-files">
                And {files.length - 10} more files...
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;