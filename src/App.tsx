import { Navigate, Route, Routes } from 'react-router-dom'
import CamJoinPage from './pages/CamJoinPage'
import CamOverlayPage from './pages/CamOverlayPage'
import CamsControlPage from './pages/CamsControlPage'

export default function App() {
  return (
    <Routes>
      {/* Players: code entry only */}
      <Route path="/" element={<CamJoinPage />} />
      <Route path="/control" element={<CamJoinPage />} />
      <Route path="/cam" element={<CamJoinPage />} />
      <Route path="/share" element={<CamJoinPage />} />
      {/* Operator desk */}
      <Route path="/desk" element={<CamsControlPage />} />
      <Route path="/control/cams" element={<Navigate to="/desk" replace />} />
      <Route path="/overlay/cam/:side" element={<CamOverlayPage />} />
      <Route path="*" element={<Navigate to="/control" replace />} />
    </Routes>
  )
}
