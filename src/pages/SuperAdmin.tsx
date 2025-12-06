import Topbar from "../components/Topbar";
import { Plus } from "lucide-react";
import type { UserLite } from "../types";

export default function SuperAdminPage({
  user,
  onLogout,
}: {
  user: UserLite;
  onLogout: () => void;
}) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Topbar name={user.name} role={user.role} onLogout={onLogout} />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 grid gap-6 sm:grid-cols-2">
        <div className="rounded-2xl border bg-white p-5">
          <h2 className="font-semibold mb-2">Master Dosen</h2>
          <p className="text-sm text-slate-600">
            Tambah/edit dosen (UI dummy).
          </p>
          <button className="mt-4 inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-purple-600 text-white hover:bg-purple-700">
            <Plus className="w-4 h-4" /> Tambah Dosen
          </button>
        </div>
        <div className="rounded-2xl border bg-white p-5">
          <h2 className="font-semibold mb-2">Akun Dosen</h2>
          <p className="text-sm text-slate-600">
            Buat akun login dosen (dummy).
          </p>
        </div>
      </main>
    </div>
  );
}
