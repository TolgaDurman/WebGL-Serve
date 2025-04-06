import { BrowserRouter, Routes, Route } from 'react-router-dom';
import App from './App';
import Game from './Game';

function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/game" element={<Game />} />
      </Routes>
    </BrowserRouter>
  );
}

export default AppRoutes;