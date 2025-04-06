import { useLocation, useNavigate } from 'react-router-dom'

function GamePage() {
  const location = useLocation()
  const navigate = useNavigate()
  const folder = location.state?.folder

  const goBack = () => {
    navigate('/')
  }

  return (
    <div className="game-page">
      <button onClick={goBack} className="back-button">
        Back
      </button>
      <h2>Playing Game from Folder: {folder}</h2>
      <iframe
        src={`/${folder}/index.html`}
        title="WebGL Game"
        className="game-frame"
        frameBorder="0"
        style={{ width: '100%', height: '90vh' }}
      ></iframe>
    </div>
  )
}

export default GamePage