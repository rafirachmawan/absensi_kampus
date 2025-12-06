import { useMemo, useState, useEffect } from "react";
import Topbar from "../components/Topbar";
import type { UserLite, EmployeeCheck, ShiftWindow, CheckType } from "../types";
import CameraCheckin from "../components/CameraCheckin";
import {
  CalendarDays,
  MapPin,
  Camera,
  CheckCircle2,
  LogIn,
  LogOut,
} from "lucide-react";

/* ==== JAM ABSENSI (ubah sesukamu) ==== */
const WINDOWS: ShiftWindow[] = [
  { type: "Masuk", start: "06:00", end: "22:00" },
  { type: "Pulang", start: "16:00", end: "22:00" },
];

const LS_KEY = "absensi-karyawan-v1";
const HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}
function labelTanggal(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return `${HARI[d.getDay()]}, ${d.getDate().toString().padStart(2, "0")}/${(
    d.getMonth() + 1
  )
    .toString()
    .padStart(2, "0")}/${d.getFullYear()}`;
}
function withinWindow(win: ShiftWindow, now: Date) {
  const [sh, sm] = win.start.split(":").map(Number);
  const [eh, em] = win.end.split(":").map(Number);
  const s = new Date(now);
  s.setHours(sh, sm, 0, 0);
  const e = new Date(now);
  e.setHours(eh, em, 0, 0);
  return now >= s && now <= e;
}

export default function KaryawanPage({
  user,
  onLogout,
}: {
  user: UserLite;
  onLogout: () => void;
}) {
  const tISO = todayISO();

  const [records, setRecords] = useState<EmployeeCheck[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(LS_KEY) || "[]");
    } catch {
      return [];
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(records));
    } catch {}
  }, [records]);

  const checkedMasuk = useMemo(
    () =>
      records.find(
        (r) =>
          r.userId === user.id && r.tanggalISO === tISO && r.type === "Masuk"
      ),
    [records, user.id, tISO]
  );
  const checkedPulang = useMemo(
    () =>
      records.find(
        (r) =>
          r.userId === user.id && r.tanggalISO === tISO && r.type === "Pulang"
      ),
    [records, user.id, tISO]
  );

  const now = new Date();
  const nowTime = now.toTimeString().slice(0, 8);
  const allowMasuk = withinWindow(WINDOWS[0], now);
  const allowPulang = withinWindow(WINDOWS[1], now);

  const [openType, setOpenType] = useState<CheckType | null>(null);

  function onConfirm(payload: {
    selfieDataUrl: string;
    lat: number | null;
    lng: number | null;
    accuracyM: number | null;
    mapsUrl: string | null;
  }) {
    if (!openType) return;

    const rec: EmployeeCheck = {
      id: `${user.id}_${tISO}_${openType}`,
      userId: user.id,
      tanggalISO: tISO,
      type: openType,
      time: nowTime,
      selfieDataUrl: payload.selfieDataUrl,
      lat: payload.lat ?? undefined,
      lng: payload.lng ?? undefined,
      accuracyM: payload.accuracyM ?? undefined,
      mapsUrl: payload.mapsUrl ?? undefined,
      createdAt: new Date().toISOString(),
    };

    // cegah double
    setRecords((prev) => {
      const exists = prev.find((p) => p.id === rec.id);
      if (exists) return prev;
      return [...prev, rec];
    });

    setOpenType(null);
  }

  // Riwayat 7 hari terakhir (maks 14 item: masuk + pulang)
  const history = useMemo(() => {
    const arr = [...records].filter((r) => r.userId === user.id);
    arr.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return arr.slice(0, 14);
  }, [records, user.id]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Topbar name={user.name} role="karyawan" onLogout={onLogout} />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {/* HERO */}
        <section className="mb-6">
          <div className="rounded-3xl border bg-white p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-2xl bg-indigo-600/10 text-indigo-700 grid place-items-center">
                  <CalendarDays className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-[11px] tracking-widest text-slate-500">
                    KARYAWAN
                  </div>
                  <h2 className="text-xl font-semibold leading-tight">
                    Absensi Harian
                  </h2>
                  <p className="text-sm text-slate-600 mt-1">
                    Selfie + lokasi (GPS, tanpa pembatas) • Hari ini:{" "}
                    <b>{labelTanggal(tISO)}</b>
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 w-full md:w-auto">
                <Metric
                  label="Waktu Sekarang"
                  value={now.toLocaleTimeString()}
                />
                <Metric label="Tanggal" value={labelTanggal(tISO)} />
              </div>
            </div>
          </div>
        </section>

        {/* KARTU MASUK / PULANG */}
        <section className="grid gap-6 md:grid-cols-2">
          <AbsCard
            title="Absen Masuk"
            icon={<LogIn className="w-5 h-5" />}
            window={WINDOWS[0]}
            checked={checkedMasuk}
            allowed={allowMasuk}
            onDo={() => setOpenType("Masuk")}
          />

          <AbsCard
            title="Absen Pulang"
            icon={<LogOut className="w-5 h-5" />}
            window={WINDOWS[1]}
            checked={checkedPulang}
            allowed={allowPulang}
            onDo={() => {
              if (!checkedMasuk) {
                alert("Anda belum absen Masuk hari ini.");
                return;
              }
              setOpenType("Pulang");
            }}
          />
        </section>

        {/* RIWAYAT */}
        <section className="mt-6">
          <div className="rounded-3xl border bg-white p-5">
            <h3 className="font-semibold mb-3">Riwayat 7 Hari Terakhir</h3>
            {history.length === 0 ? (
              <div className="text-sm text-slate-600">Belum ada data.</div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {history.map((r) => (
                  <div
                    key={r.id + r.createdAt}
                    className="rounded-xl border p-3 flex gap-3"
                  >
                    {r.selfieDataUrl ? (
                      <img
                        src={r.selfieDataUrl}
                        className="w-16 h-16 object-cover rounded-md border"
                      />
                    ) : (
                      <div className="w-16 h-16 grid place-items-center rounded-md border bg-slate-50 text-slate-400">
                        <Camera className="w-5 h-5" />
                      </div>
                    )}

                    <div className="text-sm">
                      <div className="font-medium">
                        {r.type} — {r.tanggalISO}
                      </div>
                      <div className="text-slate-600">{r.time}</div>

                      {typeof r.lat === "number" &&
                        typeof r.lng === "number" && (
                          <div className="mt-1 text-xs text-slate-600 space-y-0.5">
                            <div>
                              Lat/Lng: {r.lat.toFixed(6)}, {r.lng.toFixed(6)}
                            </div>
                            {typeof r.accuracyM === "number" && (
                              <div>Akurasi: ±{Math.round(r.accuracyM)} m</div>
                            )}
                            {r.mapsUrl && (
                              <a
                                href={r.mapsUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-indigo-600 hover:underline"
                              >
                                Lihat di Google Maps
                              </a>
                            )}
                          </div>
                        )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>

      {/* MODAL SELFIE + LOKASI */}
      <CameraCheckin
        isOpen={openType !== null}
        onClose={() => setOpenType(null)}
        onConfirm={onConfirm}
      />
    </div>
  );
}

/* ===== sub-komponen ===== */
function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-white/80 backdrop-blur px-4 py-2">
      <div className="text-[11px] tracking-widest text-slate-500">{label}</div>
      <div className="text-[15px] font-semibold">{value}</div>
    </div>
  );
}

function AbsCard({
  title,
  icon,
  window,
  checked,
  allowed,
  onDo,
}: {
  title: string;
  icon: React.ReactNode;
  window: ShiftWindow;
  checked?: EmployeeCheck;
  allowed: boolean;
  onDo: () => void;
}) {
  return (
    <div className="rounded-3xl border bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-xl bg-indigo-600/10 text-indigo-700 grid place-items-center">
            {icon}
          </div>
          <div>
            <h4 className="font-semibold">{title}</h4>
            <p className="text-sm text-slate-600">
              Jam {window.start}–{window.end}
            </p>
          </div>
        </div>

        {checked ? (
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 px-3 py-1.5 text-sm">
            <CheckCircle2 className="w-4 h-4" /> {checked.time}
          </span>
        ) : (
          <button
            onClick={() =>
              allowed
                ? onDo()
                : alert(`Di luar jam absensi (${window.start}–${window.end}).`)
            }
            className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm shadow-sm ${
              allowed
                ? "bg-indigo-600 hover:bg-indigo-700 text-white"
                : "bg-slate-200 text-slate-500 cursor-not-allowed"
            }`}
          >
            Ambil Selfie & Lokasi
          </button>
        )}
      </div>
    </div>
  );
}
