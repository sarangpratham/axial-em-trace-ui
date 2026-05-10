import { Suspense, lazy } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './auth/AuthContext.tsx';
import { ProtectedRoute } from './components/ProtectedRoute.tsx';
import { useTraceExplorerState } from './hooks/useTraceExplorerState';
import { resolveHomePath } from './lib/authRouting.ts';

const ExplorerPage = lazy(async () => ({
  default: (await import('./pages/ExplorerPage')).ExplorerPage,
}));
const AnalysisPage = lazy(async () => ({
  default: (await import('./pages/AnalysisPage')).AnalysisPage,
}));
const ReviewPage = lazy(async () => ({
  default: (await import('./pages/ReviewPage')).ReviewPage,
}));
const AnomaliesPage = lazy(async () => ({
  default: (await import('./pages/AnomaliesPage')).AnomaliesPage,
}));
const LoginPage = lazy(async () => ({
  default: (await import('./pages/LoginPage')).LoginPage,
}));
const NotFoundPage = lazy(async () => ({
  default: (await import('./pages/NotFoundPage')).NotFoundPage,
}));

type WorkspaceView = 'explorer' | 'anomalies' | 'chat' | 'review';

function WorkspaceLoading() {
  return (
    <div className="loading-state">
      <div className="loading-spinner" />
      loading workspace…
    </div>
  );
}

function HomeRedirect() {
  const location = useLocation();
  const { status } = useAuth();
  const homePath = resolveHomePath(status);

  if (!homePath) {
    return <WorkspaceLoading />;
  }
  if (homePath === '/explorer') {
    return <Navigate replace to={`/explorer${location.search}`} />;
  }
  return <Navigate replace to={homePath} />;
}

function WorkspaceRoute({ view }: { view: WorkspaceView }) {
  const explorer = useTraceExplorerState();

  switch (view) {
    case 'explorer':
      return <ExplorerPage explorer={explorer} />;
    case 'anomalies':
      return <AnomaliesPage explorer={explorer} />;
    case 'chat':
      return <AnalysisPage explorer={explorer} />;
    case 'review':
      return <ReviewPage explorer={explorer} />;
    default:
      return null;
  }
}

export default function App() {
  return (
    <Suspense fallback={<WorkspaceLoading />}>
      <Routes>
        <Route path="/" element={<HomeRedirect />} />
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/explorer"
          element={(
            <ProtectedRoute>
              <WorkspaceRoute view="explorer" />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/anomalies"
          element={(
            <ProtectedRoute>
              <WorkspaceRoute view="anomalies" />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/chat"
          element={(
            <ProtectedRoute>
              <WorkspaceRoute view="chat" />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/review"
          element={(
            <ProtectedRoute>
              <WorkspaceRoute view="review" />
            </ProtectedRoute>
          )}
        />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}
