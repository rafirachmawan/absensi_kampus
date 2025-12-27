import { useEffect, useState } from "react";
import Home from "./pages/Home";
import SuperAdminPage from "./pages/SuperAdmin";
import DosenPage from "./pages/Dosen";
import MahasiswaPage from "./pages/Mahasiswa";
import KaryawanPage from "./pages/Karyawan";
import type { UserLite } from "./types";

import { auth, db } from "./lib/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

export default function App() {
  const [user, setUser] = useState<UserLite | null>(null);
  const [loading, setLoading] = useState(true);

  // ✅ debug status biar kamu lihat di layar
  const [debug, setDebug] = useState<string>("init");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      setLoading(true);

      if (!fbUser) {
        console.log("AUTH STATE: null (belum login)");
        setDebug("auth:null");
        setUser(null);
        setLoading(false);
        return;
      }

      console.log("AUTH STATE:", fbUser.uid, fbUser.email);
      setDebug(`auth:ok uid=${fbUser.uid}`);

      try {
        const ref = doc(db, "users", fbUser.uid);
        const snap = await getDoc(ref);

        console.log("PROFILE EXISTS?", snap.exists(), snap.data());
        setDebug((prev) =>
          snap.exists() ? `${prev} | profile:ok` : `${prev} | profile:missing`
        );

        if (!snap.exists()) {
          // Auth ada tapi profile belum dibuat di Firestore
          // fallback aman (biar app tetap jalan)
          setUser({
            id: fbUser.uid,
            role: "karyawan",
            name: fbUser.displayName || "User",
            email: fbUser.email || "",
          });
          setLoading(false);
          return;
        }

        const data = snap.data() as any;

        setUser({
          id: fbUser.uid,
          role: data.role,
          name: data.name,
          email: data.email,
          kelas: data.kelas,
          prodi: data.prodi,
        });
      } catch (e: any) {
        console.error("Gagal load user profile:", e);
        setDebug(`profile:error ${String(e?.code || e?.message || e)}`);
        setUser(null);
      } finally {
        setLoading(false);
      }
    });

    return () => unsub();
  }, []);

  const onLogout = async () => {
    await signOut(auth);
    setUser(null);
  };

  // loading screen kecil
  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-slate-50 text-slate-700">
        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
          <div className="font-medium">Memuat sesi...</div>
          <div className="mt-1 text-xs text-slate-500 break-all">{debug}</div>
        </div>
      </div>
    );
  }

  // belum login -> halaman login
  if (!user) return <Home />;

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
      return <KaryawanPage user={user} onLogout={onLogout} />;
  }
}
