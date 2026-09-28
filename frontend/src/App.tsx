import { RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from './components/ui/sonner';
import { router } from './routes/router';

// « offlineFirst » : les requêtes partent même hors ligne, le service worker
// répond alors avec la dernière copie connue ; les écritures échouent vite et
// passent par la file d'attente hors ligne au lieu de rester bloquées.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { networkMode: 'offlineFirst', retry: 1 },
    mutations: { networkMode: 'offlineFirst' },
  },
});


export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster richColors position="top-center" />
    </QueryClientProvider>
  );
}
