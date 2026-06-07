import { Routes, Route } from 'react-router-dom';
import { useEffect } from 'react';
import { seedDemoData } from '@/lib/localStore';
import GuestLayout from '@/components/layout/GuestLayout';
import AdminLayout from '@/components/layout/AdminLayout';
import LandingScreen from '@/screens/LandingScreen';
import JoinScreen from '@/screens/JoinScreen';
import UploadScreen from '@/screens/UploadScreen';
import GalleryScreen from '@/screens/GalleryScreen';
import PhotoDetailScreen from '@/screens/PhotoDetailScreen';
import MessageWallScreen from '@/screens/MessageWallScreen';
import AdminLoginScreen from '@/screens/AdminLoginScreen';
import AdminDashboard from '@/screens/AdminDashboard';
import UploadsManagementScreen from '@/screens/UploadsManagementScreen';
import QRScreen from '@/screens/QRScreen';
import SlideshowScreen from '@/screens/SlideshowScreen';
import SettingsScreen from '@/screens/SettingsScreen';

export default function App() {
  useEffect(() => {
    seedDemoData();
  }, []);

  return (
    <Routes>
      {/* Guest Routes */}
      <Route element={<GuestLayout />}>
        <Route path="/" element={<LandingScreen />} />
        <Route path="/wedding/:slug" element={<LandingScreen />} />
        <Route path="/join" element={<JoinScreen />} />
        <Route path="/upload" element={<UploadScreen />} />
        <Route path="/gallery" element={<GalleryScreen />} />
        <Route path="/photo/:id" element={<PhotoDetailScreen />} />
        <Route path="/messages" element={<MessageWallScreen />} />
      </Route>

      {/* Admin Routes */}
      <Route path="/admin" element={<AdminLoginScreen />} />
      <Route element={<AdminLayout />}>
        <Route path="/admin/dashboard" element={<AdminDashboard />} />
        <Route path="/admin/uploads" element={<UploadsManagementScreen />} />
        <Route path="/admin/gallery" element={<GalleryScreen />} />
        <Route path="/admin/qr" element={<QRScreen />} />
        <Route path="/admin/slideshow" element={<SlideshowScreen />} />
        <Route path="/admin/settings" element={<SettingsScreen />} />
      </Route>
    </Routes>
  );
}
