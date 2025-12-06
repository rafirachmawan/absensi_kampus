import React, { useMemo, useState } from "react";
import {
  Users,
  ClipboardList,
  CalendarDays,
  CheckCircle2,
  LogOut,
  Plus,
} from "lucide-react";

type Role = "superadmin" | "dosen" | "mahasiswa";

type UserLite = {
  id: string;
  role: Role;
  name: string;
  email: string;
  kelas?: string;
  prodi?: string;
};
type MahasiswaLite = {
  id: string;
  nama: string;
  nim: string;
  kelas?: string;
  prodi?: string;
};

const DUMMY_USERS: UserLite[] = [
  {
    id: "u-admin",
    role: "superadmin",
    name: "Super Admin",
    email: "admin@demo.ac.id",
  },
  {
    id: "u-dosen",
    role: "dosen",
    name: "Dr. Siti Rahma",
    email: "siti@demo.ac.id",
  },
  {
    id: "u-mhs",
    role: "mahasiswa",
    name: "Rafi Ramadhan",
    email: "rafi@demo.ac.id",
    kelas: "IF-1A",
    prodi: "Informatika",
  },
];

const SEED_MHS: MahasiswaLite[] = [
  {
    id: "m1",
    nama: "Rafi Ramadhan",
    nim: "231234567",
    kelas: "IF-1A",
    prodi: "Informatika",
  },
  {
    id: "m2",
    nama: "Nadia Putri",
    nim: "231234568",
    kelas: "IF-1A",
    prodi: "Informatika",
  },
];

export default function SIAKADLiteDemo() {
  const [current, setCurrent] = useState<UserLite | null>(null);
  const [mahasiswa, setMahasiswa] = useState<MahasiswaLite[]>(SEED_MHS);

  if (!current) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
        <header className="px-6 py-4 border-b border-white/10">
          <h1 className="text-xl font-semibold">SIAKAD Lite — UI Only</h1>
          <p className="text-white/60 text-sm">Pilih akun dummy untuk masuk</p>
        </header>
        <main className="max-w-5xl mx-auto px-6 py-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <LoginCard
            title="SuperAdmin"
            desc="Kelola dosen & akun dosen"
            icon={<Users className="w-6 h-6" />}
            gradient="from-purple-600/80 to-fuchsia-600/80"
            onClick={() => setCurrent(DUMMY_USERS[0])}
          />
          <LoginCard
            title="Dosen"
            desc="Kelola mahasiswa & buat akun mahasiswa"
            icon={<ClipboardList className="w-6 h-6" />}
            gradient="from-sky-600/80 to-emerald-600/80"
            onClick={() => setCurrent(DUMMY_USERS[1])}
          />
          <LoginCard
            title="Mahasiswa"
            desc="Absen & lihat jadwal hari ini"
            icon={<CalendarDays className="w-6 h-6" />}
            gradient="from-amber-600/90 to-rose-600/90"
            onClick={() => setCurrent(DUMMY_USERS[2])}
          />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Topbar
        name={current.name}
        role={current.role}
        onLogout={() => setCurrent(null)}
      />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {current.role === "superadmin" && <SuperAdminView />}
        {current.role === "dosen" && (
          <DosenView mahasiswa={mahasiswa} setMahasiswa={setMahasiswa} />
        )}
        {current.role === "mahasiswa" && <MahasiswaView user={current} />}
      </main>
    </div>
  );
}

function LoginCard({
  title,
  desc,
  icon,
  gradient,
  onClick,
}: {
  title: string;
  desc: string;
  icon: React.ReactNode;
  gradient: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`group rounded-2xl p-6 text-left bg-gradient-to-br ${gradient} shadow-lg hover:shadow-xl transition`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-white/15 grid place-items-center">
            {icon}
          </div>
          <div>
            <div className="text-sm uppercase tracking-wider text-white/80">
              {title}
            </div>
            <div className="text-xl font-semibold">
              {title === "SuperAdmin" ? "Super Admin" : title}
            </div>
          </div>
        </div>
        <CheckCircle2 className="w-6 h-6 opacity-0 group-hover:opacity-100 transition" />
      </div>
      <p className="mt-4 text-white/80 text-sm">{desc}</p>
    </button>
  );
}

function Topbar({
  name,
  role,
  onLogout,
}: {
  name: string;
  role: Role;
  onLogout: () => void;
}) {
  return (
    <header className="border-b bg-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-wider text-slate-500">
            {role}
          </div>
          <h1 className="text-lg font-semibold">SIAKAD Lite</h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-600 hidden sm:inline">
            {name}
          </span>
          <button
            onClick={onLogout}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border hover:bg-slate-50"
          >
            <LogOut className="w-4 h-4" /> Logout
          </button>
        </div>
      </div>
    </header>
  );
}

function SuperAdminView() {
  return (
    <section className="grid gap-6 sm:grid-cols-2">
      <div className="rounded-2xl border bg-white p-5">
        <h2 className="font-semibold mb-2">Master Dosen</h2>
        <p className="text-sm text-slate-600">Tambah/edit dosen (UI-only).</p>
        <button className="mt-4 inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-purple-600 text-white hover:bg-purple-700">
          <Plus className="w-4 h-4" /> Tambah Dosen
        </button>
      </div>
      <div className="rounded-2xl border bg-white p-5">
        <h2 className="font-semibold mb-2">Akun Dosen</h2>
        <p className="text-sm text-slate-600">Buat akun login dosen (dummy).</p>
      </div>
    </section>
  );
}

function DosenView({
  mahasiswa,
  setMahasiswa,
}: {
  mahasiswa: MahasiswaLite[];
  setMahasiswa: (m: MahasiswaLite[]) => void;
}) {
  return (
    <section className="rounded-2xl border bg-white p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold">Mahasiswa Bimbingan</h2>
        <button className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-sky-600 text-white hover:bg-sky-700">
          <Plus className="w-4 h-4" /> Tambah Mahasiswa
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="text-left p-2">Nama</th>
              <th className="text-left p-2">NIM</th>
              <th className="text-left p-2">Kelas</th>
              <th className="text-left p-2">Prodi</th>
            </tr>
          </thead>
          <tbody>
            {mahasiswa.map((m) => (
              <tr key={m.id} className="border-t">
                <td className="p-2">{m.nama}</td>
                <td className="p-2">{m.nim}</td>
                <td className="p-2">{m.kelas}</td>
                <td className="p-2">{m.prodi}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function MahasiswaView({ user }: { user: UserLite }) {
  const hariKe = useMemo(() => {
    const js = new Date().getDay(); // 0..6
    return js === 0 ? 7 : js; // 1..7
  }, []);
  const jadwalHariIni = [
    {
      id: "j1",
      jamMulai: "08:00",
      jamSelesai: "09:40",
      mk: "Algoritma",
      ruang: "D201",
    },
    {
      id: "j2",
      jamMulai: "10:00",
      jamSelesai: "11:40",
      mk: "Kalkulus",
      ruang: "D305",
    },
  ];

  return (
    <section className="grid gap-6 sm:grid-cols-2">
      <div className="rounded-2xl border bg-white p-5">
        <h2 className="font-semibold mb-1">Jadwal Hari Ini</h2>
        <p className="text-sm text-slate-600 mb-4">
          {user.kelas} • {user.prodi} • Hari ke-{hariKe}
        </p>
        <ul className="space-y-3">
          {jadwalHariIni.map((j) => (
            <li key={j.id} className="rounded-xl border p-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">{j.mk}</div>
                  <div className="text-sm text-slate-600">
                    {j.jamMulai}–{j.jamSelesai} • {j.ruang}
                  </div>
                </div>
                <button className="px-3 py-1.5 rounded-lg bg-amber-600 text-white hover:bg-amber-700">
                  Absen Hadir
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
      <div className="rounded-2xl border bg-white p-5">
        <h2 className="font-semibold">Riwayat Singkat</h2>
        <p className="text-sm text-slate-600">UI dummy untuk demo.</p>
      </div>
    </section>
  );
}
