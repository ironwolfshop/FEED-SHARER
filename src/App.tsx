import { Navigate, Route, Routes } from 'react-router-dom'
import CamJoinPage from './pages/CamJoinPage'
import CamOverlayPage from './pages/CamOverlayPage'
import CamsControlPage from './pages/CamsControlPage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/control" replace />} />
      <Route path="/control" element={<CamsControlPage />} />
      <Route path="/control/cams" element={<Navigate to="/control" replace />} />
      <Route path="/cam" element={<CamJoinPage />} />
      <Route path="/share" element={<CamJoinPage />} />
      <Route path="/overlay/cam/:side" element={<CamOverlayPage />} />
      <Route path="*" element={<Navigate to="/control" replace />} />
    </Routes>
  )
}
