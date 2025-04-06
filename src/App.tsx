import { useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { useNavigate } from 'react-router-dom'
import './App.css'

function App() {
  const [droppedFolder, setDroppedFolder] = useState<string | null>(null)
  const navigate = useNavigate()

  const onDrop = (acceptedFiles: File[]) => {
    const folderName = acceptedFiles[0]?.webkitRelativePath?.split('/')[0]
    setDroppedFolder(folderName || 'Unknown Folder')
  }

  const { getRootProps, getInputProps } = useDropzone({
    onDrop,
    multiple: true, // Allow multiple files (required for folder uploads)
  })

  const startGame = () => {
    navigate('/game', { state: { folder: droppedFolder } })
  }

  return (
    <>
      <div {...getRootProps()} className="dropzone">
        <input
          {...getInputProps()}
          // Use type assertion to bypass TypeScript error for webkitdirectory
          {...({ webkitdirectory: 'true' } as React.InputHTMLAttributes<HTMLInputElement>)}
        />
        <p>Drag and drop a folder here</p>
      </div>
      {droppedFolder && (
        <div className="folder-info">
          <h2>Folder Dropped:</h2>
          <p>{droppedFolder}</p>
          <button onClick={startGame} className="start-game-button">
            Start Game
          </button>
        </div>
      )}
    </>
  )
}

export default App
