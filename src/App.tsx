import { useState } from "react";
import Home from "./pages/Home";
import SuperAdminPage from "./pages/SuperAdmin";
import DosenPage from "./pages/Dosen";
import MahasiswaPage from "./pages/Mahasiswa";
import KaryawanPage from "./pages/Karyawan";
import type { UserLite } from "./types";

export default function App() {
  const [user, setUser] = useState<UserLite | null>(null);

  // Belum login -> halaman login
  if (!user) return <Home onPickUser={setUser} />;

  const onLogout = () => setUser(null);

  // Routing per role
  switch (user.role) {
    case "superadmin":
      return <SuperAdminPage user={user} onLogout={onLogout} />;
    case "dosen":
      return <DosenPage user={user} onLogout={onLogout} />;
    case "mahasiswa":
      return <MahasiswaPage user={user} onLogout={onLogout} />;
    case "karyawan":
      return <KaryawanPage user={user} onLogout={onLogout} />;
    default:
      // Fallback aman jika ada role baru belum di-handle
      return <KaryawanPage user={user} onLogout={onLogout} />;
  }
}
