import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AnalysisPage } from './pages/AnalysisPage';
import { ExplorerPage } from './pages/ExplorerPage';
import { useTraceExplorerState } from './hooks/useTraceExplorerState';

function ExplorerRedirect() {
  const location = useLocation();
  return <Navigate replace to={`/explorer${location.search}`} />;
}

export default function App() {
  const explorer = useTraceExplorerState();

  return (
    <Routes>
      <Route path="/" element={<ExplorerRedirect />} />
      <Route path="/explorer" element={<ExplorerPage explorer={explorer} />} />
      <Route path="/analysis" element={<AnalysisPage explorer={explorer} />} />
      <Route path="*" element={<ExplorerRedirect />} />
    </Routes>
  );
}
