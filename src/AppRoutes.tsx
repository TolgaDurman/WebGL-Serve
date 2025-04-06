import { BrowserRouter, Routes, Route } from 'react-router-dom';
import App from './App';
import Game from './Game';
import GameTest from './GameTest';

function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/game" element={<Game />} />
        <Route path="/gametest" element={<GameTest />} />
      </Routes>
    </BrowserRouter>
  );
}

export default AppRoutes;