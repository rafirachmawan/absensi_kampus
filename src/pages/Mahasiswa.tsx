import { useEffect, useMemo, useState } from "react";
import Topbar from "../components/Topbar";
import BackgroundFX from "../components/BackgroundFX";
import type { UserLite, JadwalItem, AbsensiRecord } from "../types";
import CameraCheckin from "../components/CameraCheckin";
import {
  CalendarDays,
  Clock4,
  MapPin,
  Camera,
  CheckCircle2,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { type GeoFence } from "../utils/geo";

const LS_ABSENSI = "siakad-ui-absensi-v1";

const GEOFENCES: GeoFence[] = [
  { name: "Kampus Pusat", lat: -6.2009, lng: 106.781, radiusM: 300 },
];

const HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

function formatISO(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function addDays(d: Date, n: number) {
  const nd = new Date(d);
  nd.setDate(d.getDate() + n);
  return nd;
}
function labelTanggal(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return `${HARI[d.getDay()]}, ${String(d.getDate()).padStart(2, "0")}/${String(
    d.getMonth() + 1
  ).padStart(2, "0")}/${d.getFullYear()}`;
}
function generateJadwal(kelas?: string): JadwalItem[] {
  const out: JadwalItem[] = [];
  const today = new Date();
  for (let i = 0; i < 8; i++) {
    const d = addDays(today, i);
    const dow = d.getDay();
    if (dow >= 1 && dow <= 5) {
      out.push({
        id: `j_${formatISO(d)}_1`,
        tanggalISO: formatISO(d),
        jamMulai: "08:00",
        jamSelesai: "09:40",
        mk: "Algoritma",
        ruang: "D201",
        kelas,
      });
      out.push({
        id: `j_${formatISO(d)}_2`,
        tanggalISO: formatISO(d),
        jamMulai: "10:00",
        jamSelesai: "11:40",
        mk: "Kalkulus",
        ruang: "D305",
        kelas,
      });
    }
  }
  return out;
}

export default function MahasiswaPage({
  user,
  onLogout,
}: {
  user: UserLite;
  onLogout: () => void;
}) {
  const todayISO = formatISO(new Date());

  const jadwal = useMemo(() => generateJadwal(user.kelas), [user.kelas]);
  const [absensi, setAbsensi] = useState<AbsensiRecord[]>(() => {
    try {
      const raw = localStorage.getItem(LS_ABSENSI);
      if (!raw) return [];
      return JSON.parse(raw) as AbsensiRecord[];
    } catch {
      return [];
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(LS_ABSENSI, JSON.stringify(absensi));
    } catch {}
  }, [absensi]);

  const grouped = useMemo(() => {
    const byDate = new Map<string, JadwalItem[]>();
    for (const j of jadwal) {
      if (!byDate.has(j.tanggalISO)) byDate.set(j.tanggalISO, []);
      byDate.get(j.tanggalISO)!.push(j);
    }
    return Array.from(byDate.entries())
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([tgl, items]) => ({ tgl, items }));
  }, [jadwal]);

  const [openCamFor, setOpenCamFor] = useState<JadwalItem | null>(null);

  function alreadyChecked(j: JadwalItem) {
    return absensi.find(
      (a) =>
        a.userId === user.id &&
        a.jadwalId === j.id &&
        a.tanggalISO === j.tanggalISO
    );
  }

  function onConfirmCheckin(payload: {
    selfieDataUrl: string;
    lat: number | null;
    lng: number | null;
    distanceM: number | null;
    inside: boolean;
  }) {
    if (!openCamFor) return;
    if (!payload.inside) {
      alert("Lokasi di luar area kampus. Absensi dibatalkan.");
      setOpenCamFor(null);
      return;
    }
    const rec: AbsensiRecord = {
      id: `${user.id}_${openCamFor.id}`,
      userId: user.id,
      jadwalId: openCamFor.id,
      tanggalISO: openCamFor.tanggalISO,
      status: "Hadir",
      selfieDataUrl: payload.selfieDataUrl,
      lat: payload.lat ?? undefined,
      lng: payload.lng ?? undefined,
      distanceM: payload.distanceM ?? undefined,
      createdAt: new Date().toISOString(),
    };
    setAbsensi((prev) => [...prev, rec]);
    setOpenCamFor(null);
  }

  return (
    <div className="relative min-h-screen bg-gradient-to-b from-white to-slate-50">
      <BackgroundFX />
      <Topbar name={user.name} role={user.role} onLogout={onLogout} />

      {/* hero glossy */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-8 pb-4">
        <div className="relative rounded-3xl border bg-white/60 backdrop-blur-xl p-6 shadow-sm overflow-hidden">
          <div className="absolute right-0 top-0 -translate-y-1/3 translate-x-1/3 w-[24rem] h-[24rem] rounded-full bg-gradient-to-br from-indigo-500/20 to-fuchsia-500/20 blur-3xl" />
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 relative">
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 rounded-2xl bg-indigo-600/10 text-indigo-700 grid place-items-center shadow-inner">
                <CalendarDays className="w-6 h-6" />
              </div>
              <div>
                <div className="text-[11px] tracking-widest text-slate-500">
                  MAHASISWA
                </div>
                <h2 className="text-2xl font-semibold leading-tight">
                  Jadwal & Absensi
                </h2>
                <p className="mt-1 text-sm text-slate-700">
                  {user.kelas} • {user.prodi} — Absensi menggunakan{" "}
                  <b>selfie</b> & <b>lokasi</b> (geofence kampus).
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 w-full md:w-auto">
              <Metric label="Hari Ini" value={labelTanggal(todayISO)} />
              <Metric
                label="Mata Kuliah"
                value={`${
                  grouped.find((g) => g.tgl === todayISO)?.items.length ?? 0
                }`}
              />
              <Metric
                label="Hadir"
                value={`${
                  absensi.filter((a) => a.tanggalISO === todayISO).length
                }`}
              />
            </div>
          </div>
        </div>
      </section>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 pb-12">
        <div className="grid gap-6 lg:grid-cols-12">
          {/* Jadwal hari ini */}
          <section className="lg:col-span-6">
            <Card title="Jadwal Hari Ini" hint="Perkuliahan">
              <div className="space-y-3">
                {grouped
                  .find((g) => g.tgl === todayISO)
                  ?.items.map((j) => (
                    <Row
                      key={j.id}
                      title={j.mk}
                      subtitle={`${j.jamMulai}–${j.jamSelesai} • ${j.ruang}`}
                      checked={!!alreadyChecked(j)}
                      onAction={() => setOpenCamFor(j)}
                    />
                  )) ?? <Empty text="Tidak ada jadwal hari ini." />}
              </div>
            </Card>
          </section>

          {/* Minggu ini */}
          <section className="lg:col-span-6">
            <Card title="Minggu Ini" sub="Jadwal 7 hari ke depan.">
              <div className="space-y-4">
                {grouped
                  .filter((g) => g.tgl > todayISO)
                  .map((g) => (
                    <div
                      key={g.tgl}
                      className="rounded-2xl border overflow-hidden"
                    >
                      <div className="px-4 py-2 bg-slate-50 border-b font-medium text-sm">
                        {labelTanggal(g.tgl)}
                      </div>
                      <div className="p-3 space-y-3">
                        {g.items.map((j) => (
                          <Row
                            key={j.id}
                            title={j.mk}
                            subtitle={`${j.jamMulai}–${j.jamSelesai} • ${j.ruang}`}
                            checked={!!alreadyChecked(j)}
                            onAction={() => setOpenCamFor(j)}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
            </Card>
          </section>
        </div>

        {/* Riwayat */}
        <section className="mt-6">
          <Card title="Riwayat Absensi" sub="6 terbaru.">
            {absensi.length === 0 ? (
              <Empty text="Belum ada absensi." />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {[...absensi]
                  .reverse()
                  .slice(0, 6)
                  .map((a) => (
                    <div
                      key={a.id + a.createdAt}
                      className="rounded-2xl border p-3 flex gap-3 bg-white/70"
                    >
                      {a.selfieDataUrl ? (
                        <img
                          src={a.selfieDataUrl}
                          className="w-16 h-16 object-cover rounded-md border"
                        />
                      ) : (
                        <div className="w-16 h-16 grid place-items-center rounded-md border bg-slate-50 text-slate-400">
                          <Camera className="w-5 h-5" />
                        </div>
                      )}
                      <div className="text-sm">
                        <div className="font-medium">
                          {a.status} — {a.tanggalISO}
                        </div>
                        <div className="text-slate-600 flex items-center gap-1">
                          <Clock4 className="w-3.5 h-3.5" />
                          {new Date(a.createdAt).toLocaleTimeString()}
                        </div>
                        {typeof a.distanceM === "number" && (
                          <div className="flex items-center gap-1 text-xs text-slate-500 mt-0.5">
                            <MapPin className="w-3 h-3" />{" "}
                            {Math.round(a.distanceM)} m dari titik
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </Card>
        </section>
      </main>

      <CameraCheckin
        isOpen={!!openCamFor}
        onClose={() => setOpenCamFor(null)}
        onConfirm={onConfirmCheckin}
        geofences={GEOFENCES}
      />
    </div>
  );
}

/* ====== sub components ====== */

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-white/80 backdrop-blur px-4 py-2">
      <div className="text-[11px] tracking-widest text-slate-500">{label}</div>
      <div className="text-[15px] font-semibold">{value}</div>
    </div>
  );
}

function Card({
  title,
  sub,
  hint,
  children,
}: {
  title: string;
  sub?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border bg-white/80 backdrop-blur p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="font-semibold">{title}</h3>
          {sub && <p className="text-sm text-slate-600">{sub}</p>}
        </div>
        {hint && (
          <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-indigo-500" />
            <span>{hint}</span>
          </div>
        )}
      </div>
      {children}
    </div>
  );
}

function Row({
  title,
  subtitle,
  checked,
  onAction,
}: {
  title: string;
  subtitle: string;
  checked: boolean;
  onAction: () => void;
}) {
  return (
    <div className="rounded-2xl border px-3 py-3 flex items-center justify-between bg-white">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/15 to-fuchsia-500/15 text-indigo-700 grid place-items-center">
          <Clock4 className="w-5 h-5" />
        </div>
        <div>
          <div className="font-medium">{title}</div>
          <div className="text-sm text-slate-600">{subtitle}</div>
        </div>
      </div>

      {checked ? (
        <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 px-3 py-1.5 text-sm">
          <CheckCircle2 className="w-4 h-4" />
          Hadir
        </span>
      ) : (
        <button
          onClick={onAction}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-fuchsia-600 hover:from-indigo-700 hover:to-fuchsia-700 text-white px-3.5 py-1.5 text-sm shadow-sm"
        >
          Absen Hadir <ArrowRight className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border bg-slate-50 text-slate-600 text-sm px-4 py-6 text-center">
      <Sparkles className="w-4 h-4 inline mr-1" />
      {text}
    </div>
  );
}
