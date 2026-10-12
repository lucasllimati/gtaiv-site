import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@fontsource-variable/inter';
import '@fontsource-variable/montserrat';
import './styles/global.css';
import { Layout } from './components/Layout.tsx';
import { Home } from './pages/Home.tsx';
import { NewsPage, OfficialPage, RumorsPage } from './pages/News.tsx';
import { ArticlePage } from './pages/Article.tsx';
import { CharactersPage, GlitchesPage, GuidesPage, HistoryPage, MapPage, OffersPage, SearchPage, UniversePage } from './pages/Universe.tsx';
import { AboutPage, ContactPage, DisclosurePage, NotFound, PrivacyPage, TermsPage } from './pages/Static.tsx';
import { AdminGate } from './pages/AdminGate.tsx';
import { BASE } from './lib/env.ts';

const AdminApp = lazy(() => import('./admin/AdminApp.tsx'));

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false, retry: 1 } },
});

const router = createBrowserRouter(
  [
    {
      path: '/',
      element: <Layout />,
      children: [
        { index: true, element: <Home /> },
        { path: 'noticias', element: <NewsPage /> },
        { path: 'noticias/:slug', element: <ArticlePage /> },
        { path: 'oficiais', element: <OfficialPage /> },
        { path: 'rumores', element: <RumorsPage /> },
        { path: 'historia', element: <HistoryPage /> },
        { path: 'personagens', element: <CharactersPage /> },
        { path: 'mapa', element: <MapPage /> },
        { path: 'universo', element: <UniversePage /> },
        { path: 'glitches', element: <GlitchesPage /> },
        { path: 'guias', element: <GuidesPage /> },
        { path: 'ofertas', element: <OffersPage /> },
        { path: 'busca', element: <SearchPage /> },
        { path: 'sobre', element: <AboutPage /> },
        { path: 'contato', element: <ContactPage /> },
        { path: 'politica-de-privacidade', element: <PrivacyPage /> },
        { path: 'termos', element: <TermsPage /> },
        { path: 'divulgacao', element: <DisclosurePage /> },
        { path: '*', element: <NotFound /> },
      ],
    },
    {
      path: '/admin/*',
      element: (
        <AdminGate>
          <Suspense fallback={<div className="container section" role="status">Carregando painel…</div>}>
            <AdminApp />
          </Suspense>
        </AdminGate>
      ),
    },
  ],
  { basename: BASE.replace(/\/$/, '') || '/' },
);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
