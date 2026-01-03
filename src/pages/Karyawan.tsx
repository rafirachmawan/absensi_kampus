import { useMemo, useState, useEffect, useRef } from "react";
import Topbar from "../components/Topbar";
import type { UserLite, EmployeeCheck, ShiftWindow, CheckType } from "../types";
import {
  CalendarDays,
  Camera,
  CheckCircle2,
  LogIn,
  LogOut,
  LayoutDashboard,
  History,
  Info,
  X,
  Loader2,
  MapPin,
  RefreshCw,
  Check,
} from "lucide-react";

// ✅ TAMBAH: Firestore sync agar muncul di SuperAdmin
import { db } from "../lib/firebase";
import { doc, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";

/* ==== JAM ABSENSI (tetap punyamu) ==== */
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

/** ===== helpers jam profesional ===== */
function pad2(n: number) {
  return String(n).padStart(2, "0");
}
function formatTimeHMS(d: Date) {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(
    d.getSeconds()
  )}`;
}

/** ===== helpers: geolocation ===== */
function getBrowserPosition(): Promise<{
  lat: number;
  lng: number;
  accuracy: number | null;
}> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(new Error("Browser tidak mendukung geolocation."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy:
            typeof pos.coords.accuracy === "number"
              ? pos.coords.accuracy
              : null,
        });
      },
      (err) => {
        reject(
          new Error(
            err?.message ||
              "Gagal mengambil lokasi. Pastikan izin Location di browser sudah di-allow."
          )
        );
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  });
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

  // ✅ DocID Firestore supaya 1 hari 1 dokumen per user (dibaca SuperAdmin)
  const staffDocId = `${user.id}_${tISO}`;

  // UI: sidebar menu
  const [activeMenu, setActiveMenu] = useState<MenuKey>("absensi");

  /** ===== JAM LIVE (berjalan terus) ===== */
  const [now, setNow] = useState<Date>(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  /** ===== Storage (tetap localStorage) ===== */
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

  /** ===== pakai now (live) ===== */
  const nowTime = formatTimeHMS(now);
  const allowMasuk = withinWindow(WINDOWS[0], now);
  const allowPulang = withinWindow(WINDOWS[1], now);

  /** ===== Modal selfie+lokasi ===== */
  const [openType, setOpenType] = useState<CheckType | null>(null);
  const [saving, setSaving] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  const [locLoading, setLocLoading] = useState(false);
  const [loc, setLoc] = useState<{
    lat: number;
    lng: number;
    accuracy: number | null;
  } | null>(null);

  const [camLoading, setCamLoading] = useState(false);
  const [camError, setCamError] = useState<string | null>(null);
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  function stopCamera() {
    try {
      if (streamRef.current)
        streamRef.current.getTracks().forEach((t) => t.stop());
    } catch {}
    streamRef.current = null;
    if (videoRef.current) {
      try {
        // @ts-ignore
        videoRef.current.srcObject = null;
      } catch {}
    }
  }

  function resetModalState() {
    setErrMsg(null);
    setInfoMsg(null);
    setLoc(null);
    setLocLoading(false);
    setCamLoading(false);
    setCamError(null);
    setPhotoDataUrl(null);
    stopCamera();
  }

  function openModal(type: CheckType) {
    resetModalState();
    setOpenType(type);
  }

  async function requestLocation() {
    try {
      setLocLoading(true);
      setErrMsg(null);
      setInfoMsg(null);
      const pos = await getBrowserPosition();
      setLoc(pos);
      setInfoMsg("✅ Lokasi berhasil diambil.");
    } catch (e: any) {
      setErrMsg(e?.message || "Gagal ambil lokasi.");
    } finally {
      setLocLoading(false);
    }
  }

  async function startCamera() {
    try {
      setCamLoading(true);
      setCamError(null);
      setErrMsg(null);
      setInfoMsg(null);

      if (!navigator.mediaDevices?.getUserMedia) {
        setCamError("Browser tidak mendukung kamera (getUserMedia).");
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        // @ts-ignore
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }

      setInfoMsg("✅ Kamera aktif. Silakan ambil foto.");
    } catch (e: any) {
      setCamError(e?.message || "Gagal mengaktifkan kamera. Cek izin kamera.");
    } finally {
      setCamLoading(false);
    }
  }

  function capturePhoto() {
    if (!videoRef.current) return;
    const v = videoRef.current;

    const w = v.videoWidth || 640;
    const h = v.videoHeight || 480;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(v, 0, 0, w, h);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    setPhotoDataUrl(dataUrl);

    stopCamera();
    setInfoMsg("✅ Foto berhasil diambil.");
  }

  // ✅ SYNC ke Firestore (agar tampil di SuperAdmin Rekap)
  async function syncToFirestore(params: {
    type: CheckType;
    photo: string;
    loc: { lat: number; lng: number; accuracy: number | null };
  }) {
    const ref = doc(db, "staff_attendance", staffDocId);

    const base = {
      uid: user.id,
      role: "karyawan",
      tanggalISO: tISO,
      updatedAt: serverTimestamp(),
      // optional meta
      name: user.name || null,
    };

    if (params.type === "Masuk") {
      // setDoc merge (aman jika doc belum ada)
      await setDoc(
        ref,
        {
          ...base,
          checkInAt: serverTimestamp(),
          fotoIn: params.photo,
          lokasiIn: {
            lat: params.loc.lat,
            lng: params.loc.lng,
            accuracy: params.loc.accuracy ?? null,
          },
        },
        { merge: true }
      );
      return;
    }

    // Pulang: updateDoc, tapi kalau dok belum ada, fallback ke setDoc merge
    try {
      await updateDoc(ref, {
        ...base,
        checkOutAt: serverTimestamp(),
        fotoOut: params.photo,
        lokasiOut: {
          lat: params.loc.lat,
          lng: params.loc.lng,
          accuracy: params.loc.accuracy ?? null,
        },
      });
    } catch {
      await setDoc(
        ref,
        {
          ...base,
          checkOutAt: serverTimestamp(),
          fotoOut: params.photo,
          lokasiOut: {
            lat: params.loc.lat,
            lng: params.loc.lng,
            accuracy: params.loc.accuracy ?? null,
          },
        },
        { merge: true }
      );
    }
  }

  async function handleConfirmSave() {
    if (!openType) return;

    setSaving(true);
    setErrMsg(null);
    setInfoMsg(null);

    try {
      if (!loc) {
        setErrMsg("Ambil lokasi dulu sebelum menyimpan.");
        return;
      }
      if (!photoDataUrl) {
        setErrMsg("Ambil foto dulu sebelum menyimpan.");
        return;
      }

      // validasi pulang harus sudah masuk (logika kamu tetap)
      if (openType === "Pulang" && !checkedMasuk) {
        setErrMsg("Anda belum absen Masuk hari ini.");
        return;
      }

      const mapsUrl =
        typeof loc.lat === "number" && typeof loc.lng === "number"
          ? `https://www.google.com/maps?q=${loc.lat},${loc.lng}`
          : null;

      // ✅ 1) LOGIKA ASLI: simpan ke localStorage (records)
      const rec: EmployeeCheck = {
        id: `${user.id}_${tISO}_${openType}`,
        userId: user.id,
        tanggalISO: tISO,
        type: openType,
        time: nowTime,
        selfieDataUrl: photoDataUrl,
        lat: loc.lat ?? undefined,
        lng: loc.lng ?? undefined,
        accuracyM: typeof loc.accuracy === "number" ? loc.accuracy : undefined,
        mapsUrl: mapsUrl ?? undefined,
        createdAt: new Date().toISOString(),
      };

      setRecords((prev) => {
        const exists = prev.find((p) => p.id === rec.id);
        if (exists) return prev;
        return [...prev, rec];
      });

      // ✅ 2) TAMBAHAN: sync ke Firestore supaya SuperAdmin bisa lihat
      await syncToFirestore({
        type: openType,
        photo: photoDataUrl,
        loc: { lat: loc.lat, lng: loc.lng, accuracy: loc.accuracy ?? null },
      });

      setOpenType(null);
      resetModalState();
      setActiveMenu("riwayat");
      setInfoMsg("✅ Absensi tersimpan (local + Firestore).");
    } catch (e: any) {
      console.error("Karyawan attendance save error:", e);
      setErrMsg(e?.message || "Gagal menyimpan absensi. Cek Firestore Rules.");
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    return () => stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Riwayat 7 hari terakhir (maks 14 item: masuk + pulang)
  const history = useMemo(() => {
    const arr = [...records].filter((r) => r.userId === user.id);
    arr.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return arr.slice(0, 14);
  }, [records, user.id]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="flex min-h-screen">
        {/* SIDEBAR */}
        <aside className="hidden md:flex w-64 shrink-0 border-r bg-white">
          <div className="w-full flex flex-col p-4">
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
          <div className="sticky top-0 z-20 bg-slate-50">
            <div className="px-4 sm:px-6 pt-4">
              <Topbar name={user.name} role="karyawan" onLogout={onLogout} />
            </div>
            <div className="h-4" />
          </div>

          <div className="px-4 sm:px-6 pb-10">
            <main className="max-w-6xl mx-auto">
              {/* ===== ABSENSI ===== */}
              {activeMenu === "absensi" && (
                <>
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
                              Foto + lokasi • Hari ini:{" "}
                              <b>{labelTanggal(tISO)}</b>
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 w-full md:w-auto">
                          <Metric
                            label="Waktu"
                            value={formatTimeHMS(now)}
                            suffix="WIB"
                          />
                          <Metric label="Tanggal" value={labelTanggal(tISO)} />
                        </div>
                      </div>
                    </div>
                  </section>

                  <section className="grid gap-6 md:grid-cols-2">
                    <AbsCardLikeDosen
                      title="Absen Masuk"
                      icon={<LogIn className="w-5 h-5" />}
                      subtitle={`Wajib foto + lokasi • Jam ${WINDOWS[0].start}–${WINDOWS[0].end}`}
                      checked={!!checkedMasuk}
                      checkedLabel={checkedMasuk?.time || "Sudah"}
                      loading={saving}
                      disabled={saving}
                      onDo={() => {
                        if (!allowMasuk) {
                          alert(
                            `Di luar jam absensi (${WINDOWS[0].start}–${WINDOWS[0].end}).`
                          );
                          return;
                        }
                        openModal("Masuk");
                      }}
                      cta="Ambil Foto & Lokasi"
                    />

                    <AbsCardLikeDosen
                      title="Absen Pulang"
                      icon={<LogOut className="w-5 h-5" />}
                      subtitle={`Wajib foto + lokasi • Jam ${WINDOWS[1].start}–${WINDOWS[1].end}`}
                      checked={!!checkedPulang}
                      checkedLabel={checkedPulang?.time || "Sudah"}
                      loading={saving}
                      disabled={saving}
                      onDo={() => {
                        if (!checkedMasuk) {
                          alert("Anda belum absen Masuk hari ini.");
                          return;
                        }
                        if (!allowPulang) {
                          alert(
                            `Di luar jam absensi (${WINDOWS[1].start}–${WINDOWS[1].end}).`
                          );
                          return;
                        }
                        openModal("Pulang");
                      }}
                      cta="Ambil Foto & Lokasi"
                    />
                  </section>
                </>
              )}

              {/* ===== RIWAYAT ===== */}
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
                                alt="foto"
                              />
                            ) : (
                              <div className="w-16 h-16 grid place-items-center rounded-md border bg-slate-50 text-slate-400">
                                <Camera className="w-5 h-5" />
                              </div>
                            )}

                            <div className="text-sm min-w-0">
                              <div className="font-medium truncate">
                                {r.type} — {labelTanggal(r.tanggalISO)}
                              </div>
                              <div className="text-slate-600">{r.time}</div>

                              {typeof r.lat === "number" &&
                                typeof r.lng === "number" && (
                                  <div className="mt-1 text-xs text-slate-600 space-y-0.5">
                                    <div className="truncate">
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

              {/* ===== PANDUAN ===== */}
              {activeMenu === "panduan" && (
                <section>
                  <div className="rounded-3xl border bg-white p-6">
                    <h3 className="font-semibold">Panduan Absensi</h3>
                    <div className="mt-3 text-sm text-slate-700 space-y-2">
                      <div className="rounded-2xl border bg-slate-50 p-4">
                        <div className="font-medium">1) Absen Masuk</div>
                        <div className="text-slate-600 mt-1">
                          Klik <b>Ambil Foto & Lokasi</b> pada kartu Absen Masuk
                          sesuai jam {WINDOWS[0].start}–{WINDOWS[0].end}.
                        </div>
                      </div>

                      <div className="rounded-2xl border bg-slate-50 p-4">
                        <div className="font-medium">2) Absen Pulang</div>
                        <div className="text-slate-600 mt-1">
                          Absen pulang hanya bisa jika sudah absen masuk, dan
                          juga wajib foto + lokasi. Jam {WINDOWS[1].start}–
                          {WINDOWS[1].end}.
                        </div>
                      </div>

                      <div className="rounded-2xl border bg-slate-50 p-4">
                        <div className="font-medium">3) Riwayat</div>
                        <div className="text-slate-600 mt-1">
                          Data tersimpan di perangkat (localStorage) dan juga
                          disinkron ke Firestore agar tampil di SuperAdmin.
                        </div>
                      </div>
                    </div>
                  </div>
                </section>
              )}
            </main>
          </div>
        </div>
      </div>

      {/* MODAL: FOTO + LOKASI */}
      {openType && (
        <Modal
          title={`Absensi ${openType} (Foto + Lokasi)`}
          onClose={() => {
            setOpenType(null);
            resetModalState();
          }}
        >
          <div className="grid gap-4">
            {/* lokasi */}
            <div className="rounded-2xl border bg-slate-50 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-800 inline-flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    Lokasi
                  </div>
                  <div className="text-xs text-slate-600 mt-1">
                    Ambil lokasi untuk validasi absensi.
                  </div>
                </div>
                <button
                  onClick={requestLocation}
                  disabled={locLoading || saving}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white border hover:bg-slate-100 disabled:opacity-60"
                >
                  {locLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                  Ambil Lokasi
                </button>
              </div>

              {loc && (
                <div className="mt-3 text-xs text-slate-700">
                  <div>
                    <span className="font-medium">Lat:</span> {loc.lat}
                  </div>
                  <div>
                    <span className="font-medium">Lng:</span> {loc.lng}
                  </div>
                  <div>
                    <span className="font-medium">Akurasi:</span>{" "}
                    {loc.accuracy != null
                      ? `${Math.round(loc.accuracy)} m`
                      : "-"}
                  </div>
                </div>
              )}
            </div>

            {/* kamera */}
            <div className="rounded-2xl border bg-slate-50 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-800 inline-flex items-center gap-2">
                    <Camera className="w-4 h-4" />
                    Foto
                  </div>
                  <div className="text-xs text-slate-600 mt-1">
                    Aktifkan kamera lalu ambil foto untuk absensi.
                  </div>
                </div>
                <button
                  onClick={startCamera}
                  disabled={camLoading || saving}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white border hover:bg-slate-100 disabled:opacity-60"
                >
                  {camLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Camera className="w-4 h-4" />
                  )}
                  Buka Kamera
                </button>
              </div>

              {camError && (
                <div className="mt-2 text-xs text-red-600">{camError}</div>
              )}

              <div className="mt-3 grid gap-3">
                {!photoDataUrl ? (
                  <div className="grid gap-2">
                    <div className="rounded-xl overflow-hidden border bg-black">
                      <video
                        ref={videoRef}
                        className="w-full h-56 object-cover"
                        playsInline
                        muted
                      />
                    </div>

                    <button
                      onClick={capturePhoto}
                      disabled={saving || !streamRef.current}
                      className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60"
                    >
                      <Camera className="w-4 h-4" />
                      Ambil Foto
                    </button>

                    <div className="text-[11px] text-slate-500">
                      Jika video tidak muncul, pastikan izin kamera di browser
                      sudah Allow.
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-2">
                    <img
                      src={photoDataUrl}
                      alt="Foto Absensi"
                      className="w-full h-56 object-cover rounded-xl border bg-white"
                    />
                    <button
                      onClick={() => {
                        setPhotoDataUrl(null);
                        setInfoMsg(null);
                      }}
                      disabled={saving}
                      className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-white border hover:bg-slate-100 disabled:opacity-60"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Ulang Foto
                    </button>
                  </div>
                )}
              </div>
            </div>

            {(errMsg || infoMsg) && (
              <div className="text-sm">
                {errMsg && <div className="text-red-600">{errMsg}</div>}
                {infoMsg && <div className="text-emerald-700">{infoMsg}</div>}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => {
                  setOpenType(null);
                  resetModalState();
                }}
                className="px-3 py-2 rounded-xl border hover:bg-slate-50"
                disabled={saving}
              >
                Batal
              </button>

              <button
                onClick={handleConfirmSave}
                disabled={saving || !loc || !photoDataUrl}
                className="px-4 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60 inline-flex items-center gap-2"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                Simpan
              </button>
            </div>

            <div className="text-xs text-slate-500">
              Data disimpan ke <code>localStorage</code> dan disinkron ke{" "}
              <code>Firestore staff_attendance</code> agar tampil di Rekap
              SuperAdmin.
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ===== sub-komponen ===== */
function Metric({
  label,
  value,
  suffix,
}: {
  label: string;
  value: string;
  suffix?: string;
}) {
  return (
    <div className="rounded-2xl border bg-white/80 backdrop-blur px-4 py-3">
      <div className="text-[11px] tracking-widest text-slate-500">{label}</div>
      <div className="mt-0.5 flex items-baseline gap-2">
        <div className="text-[18px] font-semibold tabular-nums leading-none">
          {value}
        </div>
        {suffix ? (
          <div className="text-[11px] tracking-widest text-slate-500">
            {suffix}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function AbsCardLikeDosen({
  title,
  icon,
  subtitle,
  checked,
  checkedLabel,
  loading,
  onDo,
  disabled,
  cta,
}: {
  title: string;
  icon: React.ReactNode;
  subtitle: string;
  checked: boolean;
  checkedLabel?: string;
  loading: boolean;
  onDo: () => void;
  disabled: boolean;
  cta: string;
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
            <p className="text-sm text-slate-600">{subtitle}</p>
          </div>
        </div>

        {checked ? (
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 px-3 py-1.5 text-sm">
            <CheckCircle2 className="w-4 h-4" /> {checkedLabel || "Sudah"}
          </span>
        ) : (
          <button
            onClick={onDo}
            disabled={disabled}
            className={cx(
              "inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm shadow-sm",
              disabled
                ? "bg-slate-200 text-slate-500 cursor-not-allowed"
                : "bg-indigo-600 hover:bg-indigo-700 text-white"
            )}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {cta}
          </button>
        )}
      </div>
    </div>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="w-full max-w-xl rounded-2xl bg-white border shadow-xl overflow-hidden flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b shrink-0">
          <div className="font-semibold">{title}</div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-100"
            aria-label="close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-5 py-4 overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  );
}
