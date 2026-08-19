import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Landing } from '@/pages/Landing';
import { Login } from '@/pages/Login';
import { TouristDashboard } from '@/pages/TouristDashboard';
import { AdminDashboard } from '@/pages/AdminDashboard';
import { TouristLayout } from '@/layouts/TouristLayout';
import { SentinelPage } from './pages/SentinelPage';
import { GeoFencePage } from './pages/GeoFencePage';
import { IncidentHistoryPage } from './pages/IncidentHistoryPage';
import { ProtectedRoute } from '@/components/ProtectedRoute';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        
        {/* Protected Routes */}
        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard/tourist" element={<TouristLayout />}>
            <Route index element={<TouristDashboard />} />
            <Route path="sentinel" element={<SentinelPage />} />
            <Route path="geofence" element={<GeoFencePage />} />
          </Route>
          <Route path="/dashboard/admin" element={<AdminDashboard />} />
          <Route path="/dashboard/admin/history" element={<IncidentHistoryPage />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
