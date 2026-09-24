import { Navigate, Route, Routes } from 'react-router-dom'
import CamJoinPage from './pages/CamJoinPage'
import CamOverlayPage from './pages/CamOverlayPage'
import CamsControlPage from './pages/CamsControlPage'
import TeamDeskOverlayPage from './pages/TeamDeskOverlayPage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<CamJoinPage />} />
      <Route path="/control" element={<CamJoinPage />} />
      <Route path="/cam" element={<CamJoinPage />} />
      <Route path="/share" element={<CamJoinPage />} />
      <Route path="/desk" element={<CamsControlPage />} />
      <Route path="/control/cams" element={<Navigate to="/desk" replace />} />
      <Route path="/overlay/cam/:side" element={<CamOverlayPage />} />
      <Route path="/overlay/team/blue" element={<TeamDeskOverlayPage />} />
      <Route path="/overlay/team/red" element={<TeamDeskOverlayPage />} />
      <Route path="/overlay/team/:side" element={<TeamDeskOverlayPage />} />
      <Route path="*" element={<Navigate to="/control" replace />} />
    </Routes>
  )
}
