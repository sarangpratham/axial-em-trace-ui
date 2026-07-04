import { Suspense, lazy } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './auth/AuthContext.tsx';
import { ProtectedRoute } from './components/ProtectedRoute.tsx';
import { AppShell, type WorkspaceView } from './components/workbench/AppShell';
import { LoadingState } from './components/workbench/layout';
import { useTraceExplorerState } from './hooks/useTraceExplorerState';
import { resolveHomePath } from './lib/authRouting.ts';

const ExplorerPage = lazy(async () => ({
  default: (await import('./pages/ExplorerPage')).ExplorerPage,
}));
const ReviewPage = lazy(async () => ({
  default: (await import('./pages/ReviewPage')).ReviewPage,
}));
const IssuesPage = lazy(async () => ({
  default: (await import('./pages/IssuesPage')).IssuesPage,
}));
const CostPage = lazy(async () => ({
  default: (await import('./pages/CostPage')).CostPage,
}));
const LoginPage = lazy(async () => ({
  default: (await import('./pages/LoginPage')).LoginPage,
}));
const NotFoundPage = lazy(async () => ({
  default: (await import('./pages/NotFoundPage')).NotFoundPage,
}));

function WorkspaceLoading() {
  return <div className="grid min-h-dvh place-items-center bg-background"><LoadingState label="Loading workspace" /></div>;
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
  let page;
  switch (view) {
    case 'explorer':
      page = <ExplorerPage explorer={explorer} />;
      break;
    case 'issues':
      page = <IssuesPage explorer={explorer} />;
      break;
    case 'review':
      page = <ReviewPage explorer={explorer} />;
      break;
    case 'cost':
      page = <CostPage explorer={explorer} />;
      break;
    default:
      page = null;
  }
  return <AppShell currentView={view} explorer={explorer}>{page}</AppShell>;
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
          path="/issues"
          element={(
            <ProtectedRoute>
              <WorkspaceRoute view="issues" />
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
        <Route
          path="/cost"
          element={(
            <ProtectedRoute>
              <WorkspaceRoute view="cost" />
            </ProtectedRoute>
          )}
        />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}
