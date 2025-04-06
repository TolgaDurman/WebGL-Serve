import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { gameStorage, FileData, FolderData } from './gameStorage';
import { Unity, useUnityContext } from "react-unity-webgl";
import './Game.css';

function Game() {
  const [folderData, setFolderData] = useState<FolderData | null>(null);
  const [currentFile, setCurrentFile] = useState<FileData | null>(null);
  const [currentFileContent, setCurrentFileContent] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadingMessage, setLoadingMessage] = useState<string>('Loading game assets...');
  const [isOverlayVisible, setIsOverlayVisible] = useState<boolean>(false);
  const [unityConfig, setUnityConfig] = useState({
    loaderUrl: "",
    dataUrl: "",
    frameworkUrl: "",
    codeUrl: "",
  });
  const navigate = useNavigate();

  const { unityProvider } = useUnityContext(unityConfig);

  // Load folder data from IndexedDB
  useEffect(() => {
    const loadGameData = async () => {
      try {
        // Get the current folder ID from sessionStorage
        const folderId = sessionStorage.getItem('currentGameFolder');
        
        if (!folderId) {
          alert('No folder data found. Please select a folder first.');
          navigate('/');
          return;
        }
        
        // Initialize IndexedDB
        await gameStorage.init();
        
        // Get folder metadata
        const data = await gameStorage.getFolderData(folderId);
        
        if (!data || !data.files) {
          alert('Failed to load game data. Please try again.');
          navigate('/');
          return;
        }
        console.log('Loaded folder data:', data);
        
        setFolderData(data);

        // Dynamically fetch Unity WebGL files from IndexedDB
        const loaderFile = data.files.find(file => file.name.endsWith('.loader.js'));
        const dataFile = data.files.find(file => file.name.endsWith('.data'));
        const frameworkFile = data.files.find(file => file.name.endsWith('.framework.js'));
        const wasmFile = data.files.find(file => file.name.endsWith('.wasm'));

        if (!loaderFile || !dataFile || !frameworkFile || !wasmFile) {
          throw new Error('Unity WebGL files are missing in the folder data.');
        }

        // Fetch file content and create blob URLs
        const createBlobUrl = async (file: FileData, type: string) => {
          const content = await gameStorage.getFileContent(file.contentId!);
          if (!content) {
            throw new Error(`Failed to load content for file: ${file.name}`);
          }
          return URL.createObjectURL(new Blob([content], { type }));
        };

        const loaderUrl = await createBlobUrl(loaderFile, 'text/javascript');
        const dataUrl = await createBlobUrl(dataFile, 'application/octet-stream');
        const frameworkUrl = await createBlobUrl(frameworkFile, 'text/javascript');
        const wasmUrl = await createBlobUrl(wasmFile, 'application/wasm');

        // Configure Unity context
        setUnityConfig({
          loaderUrl,
          dataUrl,
          frameworkUrl,
          codeUrl: wasmUrl,
        });

        setIsLoading(false);

        // Cleanup blob URLs when the component unmounts
        return () => {
          URL.revokeObjectURL(loaderUrl);
          URL.revokeObjectURL(dataUrl);
          URL.revokeObjectURL(frameworkUrl);
          URL.revokeObjectURL(wasmUrl);
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
            <div className="unity-container">
              <Unity unityProvider={unityProvider} />
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