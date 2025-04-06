import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { gameStorage, FileData, FolderData } from './gameStorage';
import { Unity, useUnityContext } from 'react-unity-webgl';
import './Game.css';

function Game() {
  const [folderData, setFolderData] = useState<FolderData | null>(null);
  const [currentFile, setCurrentFile] = useState<FileData | null>(null);
  const [currentFileContent, setCurrentFileContent] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadingMessage, setLoadingMessage] = useState<string>('Loading game assets...');
  const [isOverlayVisible, setIsOverlayVisible] = useState<boolean>(false);
  const [unityUrls, setUnityUrls] = useState<{
    loaderUrl: string;
    dataUrl: string;
    frameworkUrl: string;
    codeUrl: string;
  } | null>(null);
  const [unityError, setUnityError] = useState<string | null>(null);
  const navigate = useNavigate();

  const { unityProvider, isLoaded, loadingProgression } = useUnityContext(
    unityUrls || {
      loaderUrl: '',
      dataUrl: '',
      frameworkUrl: '',
      codeUrl: '',
    }
  );

  // Monitor loading state for potential errors
  useEffect(() => {
    if (unityUrls && !isLoaded && loadingProgression === 0) {
      // If we've been stuck at 0% for more than 5 seconds, show an error
      const timeout = setTimeout(() => {
        setUnityError('Unity failed to initialize. Please check the browser console for errors.');
      }, 5000);

      return () => clearTimeout(timeout);
    }
  }, [unityUrls, isLoaded, loadingProgression]);

  // Load folder data from IndexedDB
  useEffect(() => {
    const loadGameData = async () => {
      try {
        // Get the current folder ID from sessionStorage
        const folderId = sessionStorage.getItem('currentGameFolder');
        console.log('Loading game data for folder:', folderId);
        
        if (!folderId) {
          alert('No folder data found. Please select a folder first.');
          navigate('/');
          return;
        }
        
        // Initialize IndexedDB
        console.log('Initializing IndexedDB...');
        await gameStorage.init();
        
        // Get folder metadata
        console.log('Fetching folder metadata...');
        const data = await gameStorage.getFolderData(folderId);
        
        if (!data || !data.files) {
          console.error('No folder data or files found:', data);
          alert('Failed to load game data. Please try again.');
          navigate('/');
          return;
        }
        console.log('Loaded folder data:', data);
        
        setFolderData(data);

        // Find Unity build files dynamically
        const buildFiles = {
          loader: data.files.find(file => file.name.endsWith('.loader.js')),
          data: data.files.find(file => file.name.endsWith('.data')),
          framework: data.files.find(file => file.name.endsWith('.framework.js')),
          wasm: data.files.find(file => file.name.endsWith('.wasm')),
        };

        // Log found files for debugging
        console.log('Found Unity build files:', {
          loader: buildFiles.loader?.name,
          data: buildFiles.data?.name,
          framework: buildFiles.framework?.name,
          wasm: buildFiles.wasm?.name
        });

        if (!buildFiles.loader || !buildFiles.data || !buildFiles.framework || !buildFiles.wasm) {
          const missingFiles = Object.entries(buildFiles)
            .filter(([_, file]) => !file)
            .map(([type]) => type);
          throw new Error(`Missing Unity build files: ${missingFiles.join(', ')}`);
        }

        // Create blob URLs for Unity build files
        const loaderContent = await gameStorage.getFileContent(buildFiles.loader.contentId!);
        const dataContent = await gameStorage.getFileContent(buildFiles.data.contentId!);
        const frameworkContent = await gameStorage.getFileContent(buildFiles.framework.contentId!);
        const wasmContent = await gameStorage.getFileContent(buildFiles.wasm.contentId!);

        if (!loaderContent || !dataContent || !frameworkContent || !wasmContent) {
          throw new Error('Failed to load Unity build file contents');
        }

        // Create blobs with correct MIME types
        const loaderBlob = new Blob([loaderContent], { type: 'application/javascript' });
        const dataBlob = new Blob([dataContent], { type: 'application/octet-stream' });
        const frameworkBlob = new Blob([frameworkContent], { type: 'application/javascript' });
        const wasmBlob = new Blob([wasmContent], { type: 'application/wasm' });

        const urls = {
          loaderUrl: URL.createObjectURL(loaderBlob),
          dataUrl: URL.createObjectURL(dataBlob),
          frameworkUrl: URL.createObjectURL(frameworkBlob),
          codeUrl: URL.createObjectURL(wasmBlob),
        };

        console.log('Created Unity build file URLs:', urls);
        setUnityUrls(urls);
        setIsLoading(false);

        // Cleanup blob URLs when component unmounts
        return () => {
          Object.values(urls).forEach(url => URL.revokeObjectURL(url));
        };
      } catch (err) {
        console.error('Error loading game data:', err);
        alert('Error loading folder data. Please try again.');
        navigate('/');
      }
    };

    const cleanup = loadGameData();
    return () => {
      if (cleanup instanceof Function) cleanup();
    };
  }, [navigate]);

  // Load file content when a file is selected
  const selectFile = async (file: FileData) => {
    if (!file.contentId) {
      setCurrentFile(file);
      setCurrentFileContent(null);
      return;
    }
    
    setIsLoading(true);
    setLoadingMessage(`Loading ${file.name}...`);
    
    try {
      const content = await gameStorage.getFileContent(file.contentId);
      setCurrentFile(file);
      setCurrentFileContent(content);
    } catch (err) {
      console.error('Error loading file content:', err);
      setCurrentFileContent(null);
    }
    
    setIsLoading(false);
    setLoadingMessage('');
  };

  // Go back to uploader
  const goBack = () => {
    navigate('/');
  };

  // Function to handle opening the overlay
  const openOverlay = () => {
    try {
      if (!unityUrls) {
        alert('Game is still loading. Please wait...');
        return;
      }
      setIsOverlayVisible(true);
    } catch (err) {
      console.error('Error opening overlay:', err);
      alert('Failed to open the game overlay. Please try again.');
    }
  };

  // Function to handle closing the overlay
  const closeOverlay = () => {
    try {
      setIsOverlayVisible(false);
    } catch (err) {
      console.error('Error closing overlay:', err);
      alert('Failed to close the game overlay. Please try again.');
    }
  };

  // Render file content based on type
  const renderFileContent = () => {
    if (!currentFile) return null;
    if (!currentFileContent) return <p>No content available for this file</p>;
    
    // For demonstration purposes - in a real app, you'd handle different file types
    // based on your game's requirements
    if (currentFile.type.startsWith('image/')) {
      try {
        // Convert ArrayBuffer to data URL for images
        if (currentFileContent instanceof ArrayBuffer) {
          const blob = new Blob([currentFileContent], { type: currentFile.type });
          const url = URL.createObjectURL(blob);
          return <img src={url} alt={currentFile.name} onLoad={() => URL.revokeObjectURL(url)} />;
        }
        return <p>Image content could not be loaded</p>;
      } catch (e) {
        return <p>Error displaying image</p>;
      }
    } else if (currentFile.type.startsWith('text/') || 
               currentFile.type === 'application/json') {
      try {
        // For text files, convert ArrayBuffer to text
        if (currentFileContent instanceof ArrayBuffer) {
          const decoder = new TextDecoder('utf-8');
          const text = decoder.decode(currentFileContent);
          return <pre>{text}</pre>;
        }
        return <p>Text content could not be loaded</p>;
      } catch (e) {
        return <p>Error displaying text content</p>;
      }
    }
    
    // Default case - just show file info
    return (
      <div className="file-details">
        <h3>{currentFile.name}</h3>
        <p>Type: {currentFile.type || 'Unknown'}</p>
        <p>Size: {(currentFile.size / 1024).toFixed(2)} KB</p>
        <p>Path: {currentFile.path}</p>
        <p>Content available: {currentFileContent ? 'Yes' : 'No'}</p>
      </div>
    );
  };

  if (isLoading && !folderData) {
    return (
      <div className="loading">
        {loadingMessage}
      </div>
    );
  }

  return (
    <div className="game-container">
      {/* Overlay for Unity WebGL game */}
      {isOverlayVisible && (
        <div className="overlay">
          <div className="overlay-content">
            <button className="close-button" onClick={closeOverlay}>X</button>
            <div className="game-frame">
              {unityUrls && (
                <>
                  {!isLoaded && (
                    <div className="loading-progress">
                      {unityError ? (
                        <div className="error-message">
                          {unityError}
                          <button 
                            onClick={() => {
                              setUnityError(null);
                              // Try reloading the Unity context
                              setUnityUrls({...unityUrls});
                            }}
                            className="retry-button"
                          >
                            Retry
                          </button>
                        </div>
                      ) : (
                        <>
                          Loading Unity... {Math.round(loadingProgression * 100)}%
                          <div className="loading-bar">
                            <div 
                              className="loading-bar-progress" 
                              style={{ width: `${loadingProgression * 100}%` }}
                            />
                          </div>
                        </>
                      )}
                    </div>
                  )}
                  <Unity
                    unityProvider={unityProvider}
                    style={{ width: '100%', height: '100%' }}
                  />
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <header className="game-header">
        <h1>Game: {folderData?.name}</h1>
        <button onClick={goBack} className="back-button">Back to Uploader</button>
      </header>
      
      <div className="game-content">
        <div className="file-browser">
          <h2>Files</h2>
          <div className="file-list">
            {folderData?.files.map((file, index) => (
              <div 
                key={index}
                className={`file-item ${currentFile?.path === file.path ? 'selected' : ''}`}
                onClick={() => selectFile(file)}
              >
                <span className="file-icon">{getFileIcon(file.type)}</span>
                <span className="file-name">{file.name}</span>
              </div>
            ))}
          </div>
        </div>
        
        <div className="content-viewer">
          {isLoading ? (
            <div className="loading-content">{loadingMessage}</div>
          ) : currentFile ? (
            renderFileContent()
          ) : (
            <div className="empty-state">
              <p>Select a file to view its contents</p>
            </div>
          )}
        </div>
      </div>
      
      <div className="game-controls">
        <p>Game assets loaded: {folderData?.files.length} files</p>
        <button className="play-button" onClick={openOverlay}>Play Game</button>
      </div>
    </div>
  );
}

// Helper function to get an icon based on file type
function getFileIcon(type: string): string {
  if (type.startsWith('image/')) return '🖼️';
  if (type.startsWith('text/')) return '📄';
  if (type.startsWith('audio/')) return '🔊';
  if (type.startsWith('video/')) return '🎥';
  if (type.includes('json')) return '📊';
  if (type.includes('javascript')) return '📜';
  if (type.includes('css')) return '🎨';
  if (type.includes('html')) return '🌐';
  return '📁';
}

export default Game;