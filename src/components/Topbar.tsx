import { LogOut } from "lucide-react";
import type { Role } from "../types";

const roleLabel: Record<Role, string> = {
  superadmin: "SUPERADMIN",
  dosen: "DOSEN",
  mahasiswa: "MAHASISWA",
  karyawan: "KARYAWAN",
};

function Initials({ name }: { name: string }) {
  const ini = name
    .split(" ")
    .map((s) => s[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <div className="w-8 h-8 rounded-full bg-white/20 text-white grid place-items-center text-xs font-semibold ring-1 ring-white/30">
      {ini}
    </div>
  );
}

export default function Topbar({
  name,
  role,
  onLogout,
}: {
  name: string;
  role: Role;
  onLogout: () => void;
}) {
  // Warna solid yang selaras dengan tema (indigo gelap)
  // Ingin ganti? ubah bg-indigo-700 jadi mis. bg-violet-700 / bg-slate-800.
  return (
    <header className="sticky top-0 z-40">
      <div className="bg-indigo-700 text-white border-b border-indigo-800/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          {/* Kiri: logo + brand */}
          <div className="flex items-center gap-3">
            {/* Logo universitas */}
            <img
              src="/unita.png" // letakkan file di public/unita-logo.png
              alt="Logo Universitas Tulungagung"
              className="w-9 h-9 rounded-[10px] bg-white/10 object-contain p-1.5 ring-1 ring-white/20"
            />
            <div className="leading-tight">
              <div className="text-[11px] tracking-widest/loose opacity-90">
                {roleLabel[role]}
              </div>
              {/* Nama institusi */}
              <h1 className="text-[17px] font-semibold">
                UNIVERSITAS TULUNGAGUNG
              </h1>
            </div>
          </div>

          {/* Kanan: user + logout */}
          <div className="flex items-center gap-3">
            <span className="hidden sm:block text-sm opacity-95">{name}</span>
            <Initials name={name} />
            <button
              onClick={onLogout}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white text-indigo-800 hover:bg-indigo-50 shadow-sm"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
