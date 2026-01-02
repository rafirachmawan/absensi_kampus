import { useMemo, useState, useEffect } from "react";
import Topbar from "../components/Topbar";
import type { UserLite, EmployeeCheck, ShiftWindow, CheckType } from "../types";
import CameraCheckin from "../components/CameraCheckin";
import {
  CalendarDays,
  Camera,
  CheckCircle2,
  LogIn,
  LogOut,
  LayoutDashboard,
  History,
  Info,
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

/** UI helper */
function cx(...a: Array<string | false | null | undefined>) {
  return a.filter(Boolean).join(" ");
}

/** Sidebar item */
function SideItem({
  active,
  icon,
  label,
  onClick,
}: {
  active?: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition select-none border",
        active
          ? "bg-indigo-50 text-indigo-700 border-indigo-100"
          : "bg-white text-slate-700 border-transparent hover:bg-slate-100"
      )}
    >
      <span className="shrink-0">{icon}</span>
      <span className="truncate">{label}</span>
    </button>
  );
}

type MenuKey = "absensi" | "riwayat" | "panduan";

export default function KaryawanPage({
  user,
  onLogout,
}: {
  user: UserLite;
  onLogout: () => void;
}) {
  const tISO = todayISO();

  // UI: sidebar menu (tanpa mengubah logika absensi)
  const [activeMenu, setActiveMenu] = useState<MenuKey>("absensi");

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

    // UX: setelah confirm, pindah ke riwayat (hanya tampilan, tidak ubah data)
    setActiveMenu("riwayat");
  }

  // Riwayat 7 hari terakhir (maks 14 item: masuk + pulang)
  const history = useMemo(() => {
    const arr = [...records].filter((r) => r.userId === user.id);
    arr.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return arr.slice(0, 14);
  }, [records, user.id]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* ===== LAYOUT: SIDEBAR + CONTENT ===== */}
      <div className="flex min-h-screen">
        {/* SIDEBAR */}
        <aside className="hidden md:flex w-64 shrink-0 border-r bg-white">
          <div className="w-full flex flex-col p-4">
            {/* brand */}
            <div className="flex items-center gap-3 px-2 py-2">
              <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white grid place-items-center">
                <LayoutDashboard className="w-5 h-5" />
              </div>
              <div className="leading-tight">
                <div className="font-semibold">KARYAWAN</div>
                <div className="text-xs text-slate-500">
                  {user.name || "Absensi"}
                </div>
              </div>
            </div>

            {/* menu 3 item */}
            <nav className="mt-5 grid gap-1">
              <SideItem
                active={activeMenu === "absensi"}
                icon={<LogIn className="w-4 h-4" />}
                label="Absensi"
                onClick={() => setActiveMenu("absensi")}
              />
              <SideItem
                active={activeMenu === "riwayat"}
                icon={<History className="w-4 h-4" />}
                label="Riwayat"
                onClick={() => setActiveMenu("riwayat")}
              />
              <SideItem
                active={activeMenu === "panduan"}
                icon={<Info className="w-4 h-4" />}
                label="Panduan"
                onClick={() => setActiveMenu("panduan")}
              />
            </nav>

            <div className="mt-auto pt-4 text-xs text-slate-400 px-2">
              Pilih menu di kiri untuk melihat konten.
            </div>
          </div>
        </aside>

        {/* CONTENT */}
        <div className="flex-1 min-w-0">
          {/* topbar */}
          <div className="sticky top-0 z-20 bg-slate-50">
            <div className="px-4 sm:px-6 pt-4">
              <Topbar name={user.name} role="karyawan" onLogout={onLogout} />
            </div>
            <div className="h-4" />
          </div>

          <div className="px-4 sm:px-6 pb-10">
            <main className="max-w-6xl mx-auto">
              {/* ===== MENU: ABSENSI ===== */}
              {activeMenu === "absensi" && (
                <>
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
                </>
              )}

              {/* ===== MENU: RIWAYAT ===== */}
              {activeMenu === "riwayat" && (
                <section>
                  <div className="rounded-3xl border bg-white p-5">
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <h3 className="font-semibold">Riwayat 7 Hari Terakhir</h3>
                      <button
                        onClick={() => setActiveMenu("absensi")}
                        className="px-3 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 text-sm"
                      >
                        Kembali ke Absensi
                      </button>
                    </div>

                    {history.length === 0 ? (
                      <div className="text-sm text-slate-600">
                        Belum ada data.
                      </div>
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
                                      Lat/Lng: {r.lat.toFixed(6)},{" "}
                                      {r.lng.toFixed(6)}
                                    </div>
                                    {typeof r.accuracyM === "number" && (
                                      <div>
                                        Akurasi: ±{Math.round(r.accuracyM)} m
                                      </div>
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
              )}

              {/* ===== MENU: PANDUAN (static, tidak ganggu logika) ===== */}
              {activeMenu === "panduan" && (
                <section>
                  <div className="rounded-3xl border bg-white p-6">
                    <h3 className="font-semibold">Panduan Absensi</h3>
                    <div className="mt-3 text-sm text-slate-700 space-y-2">
                      <div className="rounded-2xl border bg-slate-50 p-4">
                        <div className="font-medium">1) Absen Masuk</div>
                        <div className="text-slate-600 mt-1">
                          Klik <b>Ambil Selfie & Lokasi</b> pada kartu Absen
                          Masuk sesuai jam {WINDOWS[0].start}–{WINDOWS[0].end}.
                        </div>
                      </div>

                      <div className="rounded-2xl border bg-slate-50 p-4">
                        <div className="font-medium">2) Absen Pulang</div>
                        <div className="text-slate-600 mt-1">
                          Absen pulang hanya bisa jika sudah absen masuk. Jam
                          {WINDOWS[1].start}–{WINDOWS[1].end}.
                        </div>
                      </div>

                      <div className="rounded-2xl border bg-slate-50 p-4">
                        <div className="font-medium">3) Riwayat</div>
                        <div className="text-slate-600 mt-1">
                          Semua data tersimpan di perangkat (localStorage) dan
                          bisa dilihat di menu <b>Riwayat</b>.
                        </div>
                      </div>

                      <div className="text-xs text-slate-500 mt-2">
                        Catatan: jika ingin versi sinkron ke Firestore
                        (multi-device), nanti kita pindahkan penyimpanan dari
                        localStorage → Firestore.
                      </div>
                    </div>
                  </div>
                </section>
              )}
            </main>
          </div>
        </div>
      </div>

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
            {/* ✅ DIGANTI seperti UI dosen */}
            <p className="text-sm text-slate-600">Wajib foto + lokasi</p>
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
