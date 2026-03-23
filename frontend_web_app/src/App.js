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

import WsStatusPage from './pages/ws/WsStatusPage';
import WsReconnectPage from './pages/ws/WsReconnectPage';
import WsLogsPage from './pages/ws/WsLogsPage';

// PUBLIC_INTERFACE
function App() {
  /** IEC 61850 SIV-Tool main React app: top tabs + context-aware left modules menu + module routing. */
  return (
    <AppProvider>
      <BrowserRouter>
        <div className="App">
          <div className="shell">
            <TopNav />

            <div className="shellBody">
              <Sidebar />

              <main className="main" role="main">
                <Routes>
                  {/* Default: land in Backend Configuration context */}
                  <Route path="/" element={<Navigate to="/backend/upload" replace />} />

                  {/* Backend Configuration context */}
                  <Route path="/backend/upload" element={<FileUploadPage />} />
                  <Route path="/backend/ln-tree" element={<LnTreePage />} />
                  <Route path="/backend/datasets" element={<DatasetViewerPage />} />
                  <Route path="/backend/settings" element={<SettingsPage />} />

                  {/* Health context */}
                  <Route path="/health/anomaly" element={<AnomalyDetectionPage />} />
                  <Route path="/health/recommendations" element={<RecommendationsPage />} />
                  <Route path="/health/report" element={<ValidationReportPage />} />
                  <Route path="/health/interop-map" element={<InteroperabilityMapPage />} />
                  <Route path="/health/scada" element={<ScadaTablePage />} />

                  {/* WS context */}
                  <Route path="/ws/status" element={<WsStatusPage />} />
                  <Route path="/ws/reconnect" element={<WsReconnectPage />} />
                  <Route path="/ws/logs" element={<WsLogsPage />} />

                  {/* Backward-compatible redirects from older routes */}
                  <Route path="/upload" element={<Navigate to="/backend/upload" replace />} />
                  <Route path="/ln-tree" element={<Navigate to="/backend/ln-tree" replace />} />
                  <Route path="/datasets" element={<Navigate to="/backend/datasets" replace />} />
                  <Route path="/settings" element={<Navigate to="/backend/settings" replace />} />

                  <Route path="/anomaly" element={<Navigate to="/health/anomaly" replace />} />
                  <Route path="/recommendations" element={<Navigate to="/health/recommendations" replace />} />
                  <Route path="/report" element={<Navigate to="/health/report" replace />} />
                  <Route path="/interop-map" element={<Navigate to="/health/interop-map" replace />} />
                  <Route path="/scada" element={<Navigate to="/health/scada" replace />} />

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
