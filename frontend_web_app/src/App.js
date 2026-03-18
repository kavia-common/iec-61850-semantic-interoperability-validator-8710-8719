import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import './App.css';
import TopNav from './components/TopNav';
import Sidebar from './components/Sidebar';
import { AppProvider } from './state/AppContext';

import FileUploadPage from './pages/FileUploadPage';
import LnTreePage from './pages/LnTreePage';
import DatasetViewerPage from './pages/DatasetViewerPage';
import AnomalyDetectionPage from './pages/AnomalyDetectionPage';
import ValidationReportPage from './pages/ValidationReportPage';
import RecommendationsPage from './pages/RecommendationsPage';
import InteroperabilityMapPage from './pages/InteroperabilityMapPage';
import ScadaTablePage from './pages/ScadaTablePage';
import SettingsPage from './pages/SettingsPage';
import NotFoundPage from './pages/NotFoundPage';

// PUBLIC_INTERFACE
function App() {
  /** IEC 61850 SIV-Tool main React app: top-nav + sidebar layout with module routing. */
  return (
    <AppProvider>
      <BrowserRouter>
        <div className="App">
          <div className="shell">
            <TopNav />
            <div className="contentGrid">
              <Sidebar />
              <main className="main" role="main">
                <Routes>
                  <Route path="/" element={<Navigate to="/upload" replace />} />
                  <Route path="/upload" element={<FileUploadPage />} />
                  <Route path="/ln-tree" element={<LnTreePage />} />
                  <Route path="/datasets" element={<DatasetViewerPage />} />
                  <Route path="/anomaly" element={<AnomalyDetectionPage />} />
                  <Route path="/report" element={<ValidationReportPage />} />
                  <Route path="/recommendations" element={<RecommendationsPage />} />
                  <Route path="/interop-map" element={<InteroperabilityMapPage />} />
                  <Route path="/scada" element={<ScadaTablePage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="*" element={<NotFoundPage />} />
                </Routes>
              </main>
            </div>
          </div>
        </div>
      </BrowserRouter>
    </AppProvider>
  );
}

export default App;
