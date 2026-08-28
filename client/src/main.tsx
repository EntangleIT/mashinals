import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { App } from './App';
import { LandingPage } from './pages/Landing';
import { BoardPage } from './pages/Board';
import { GalleryPage } from './pages/Gallery';
import { FeedPage } from './pages/Feed';
import { DetailPage } from './pages/Detail';
import './index.css';

const basename = import.meta.env.BASE_URL.replace(/\/$/, '') || '/';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter basename={basename === '/' ? undefined : basename}>
      <Routes>
        <Route element={<App />}>
          <Route index element={<LandingPage />} />
          <Route path="play" element={<BoardPage />} />
          <Route path="gallery" element={<GalleryPage />} />
          <Route path="feed" element={<FeedPage />} />
          <Route path="c/:id" element={<DetailPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
