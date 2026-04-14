import { Suspense, lazy } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useTraceExplorerState } from './hooks/useTraceExplorerState';

const ExplorerPage = lazy(async () => ({
  default: (await import('./pages/ExplorerPage')).ExplorerPage,
}));
const AnalysisPage = lazy(async () => ({
  default: (await import('./pages/AnalysisPage')).AnalysisPage,
}));
const GraphPage = lazy(async () => ({
  default: (await import('./pages/GraphPage')).GraphPage,
}));
const ReviewPage = lazy(async () => ({
  default: (await import('./pages/ReviewPage')).ReviewPage,
}));

function ExplorerRedirect() {
  const location = useLocation();
  return <Navigate replace to={`/explorer${location.search}`} />;
}

function AnalysisRedirect() {
  const location = useLocation();
  return <Navigate replace to={`/chat${location.search}`} />;
}

export default function App() {
  const explorer = useTraceExplorerState();

  return (
    <Suspense
      fallback={(
        <div className="loading-state">
          <div className="loading-spinner" />
          loading workspace…
        </div>
      )}
    >
      <Routes>
        <Route path="/" element={<ExplorerRedirect />} />
        <Route path="/explorer" element={<ExplorerPage explorer={explorer} />} />
        <Route path="/chat" element={<AnalysisPage explorer={explorer} />} />
        <Route path="/analysis" element={<AnalysisRedirect />} />
        <Route path="/graph" element={<GraphPage explorer={explorer} />} />
        <Route path="/review" element={<ReviewPage explorer={explorer} />} />
        <Route path="*" element={<ExplorerRedirect />} />
      </Routes>
    </Suspense>
  );
}
