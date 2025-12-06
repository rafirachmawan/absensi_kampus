import Topbar from "../components/Topbar";
import { Plus } from "lucide-react";
import type { UserLite } from "../types";

type MahasiswaLite = {
  id: string;
  nama: string;
  nim: string;
  kelas?: string;
  prodi?: string;
};

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

export default function DosenPage({
  user,
  onLogout,
}: {
  user: UserLite;
  onLogout: () => void;
}) {
  const mahasiswa = SEED_MHS;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Topbar name={user.name} role={user.role} onLogout={onLogout} />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
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
      </main>
    </div>
  );
}
