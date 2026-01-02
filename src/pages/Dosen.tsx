import { useEffect, useMemo, useRef, useState } from "react";
import Topbar from "../components/Topbar";
import type { UserLite } from "../types";
import {
  X,
  Loader2,
  CheckCircle2,
  LogIn,
  LogOut,
  Camera,
  MapPin,
  Check,
  RefreshCw,
  LayoutDashboard,
  CalendarDays,
  History,
  Info,
} from "lucide-react";

import { db, firebaseConfig } from "../lib/firebase";
import {
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  orderBy,
  limit,
} from "firebase/firestore";

/** ===== helpers tanggal (samakan dengan Karyawan) ===== */
const HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

function formatISO(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function labelTanggal(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return `${HARI[d.getDay()]}, ${d.getDate().toString().padStart(2, "0")}/${(
    d.getMonth() + 1
  )
    .toString()
    .padStart(2, "0")}/${d.getFullYear()}`;
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

/** ===== helpers: geolocation + camera ===== */
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

type StaffRow = {
  id: string;
  tanggalISO: string;
  checkInAt?: any;
  checkOutAt?: any;
  fotoDataUrl?: string | null;
  lokasi?: { lat: number; lng: number; accuracy?: number | null } | null;
  role?: string;
  uid?: string;
};

export default function DosenPage({
  user,
  onLogout,
}: {
  user: UserLite;
  onLogout: () => void;
}) {
  /** ===== UI menu (SAMAKAN KARYAWAN) ===== */
  const [activeMenu, setActiveMenu] = useState<MenuKey>("absensi");

  /** ===== JAM LIVE (berjalan terus) ===== */
  const [now, setNow] = useState<Date>(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  /** ===== ABSENSI DOSEN (tetap seperti punyamu) ===== */
  const [staffSaving, setStaffSaving] = useState(false);
  const [staffError, setStaffError] = useState<string | null>(null);
  const [staffInfo, setStaffInfo] = useState<string | null>(null);

  const todayISO = formatISO(new Date());
  const staffDocId = `${user.id}_${todayISO}`;

  const [todayRec, setTodayRec] = useState<{
    checkInAt?: any;
    checkOutAt?: any;
  } | null>(null);

  useEffect(() => {
    const ref = doc(db, "staff_attendance", staffDocId);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          setTodayRec(null);
          return;
        }
        const data = snap.data() as any;
        setTodayRec({
          checkInAt: data.checkInAt,
          checkOutAt: data.checkOutAt,
        });
      },
      () => {
        setTodayRec(null);
      }
    );
    return () => unsub();
  }, [staffDocId]);

  // modal check-in (foto + lokasi)
  const [openCheckIn, setOpenCheckIn] = useState(false);
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

  function resetCheckInModalState() {
    setLoc(null);
    setLocLoading(false);
    setCamLoading(false);
    setCamError(null);
    setPhotoDataUrl(null);
    stopCamera();
  }

  async function openCheckInModal() {
    setStaffError(null);
    setStaffInfo(null);
    resetCheckInModalState();
    setOpenCheckIn(true);
  }

  async function requestLocation() {
    try {
      setLocLoading(true);
      setStaffError(null);
      setStaffInfo(null);
      const pos = await getBrowserPosition();
      setLoc(pos);
      setStaffInfo("✅ Lokasi berhasil diambil.");
    } catch (e: any) {
      setStaffError(e?.message || "Gagal ambil lokasi.");
    } finally {
      setLocLoading(false);
    }
  }

  async function startCamera() {
    try {
      setCamLoading(true);
      setCamError(null);
      setStaffError(null);
      setStaffInfo(null);

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

      setStaffInfo("✅ Kamera aktif. Silakan ambil foto.");
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
    setStaffInfo("✅ Foto berhasil diambil.");
  }

  async function handleConfirmCheckIn() {
    try {
      setStaffSaving(true);
      setStaffError(null);
      setStaffInfo(null);

      if (!loc) {
        setStaffError("Ambil lokasi dulu sebelum check-in.");
        return;
      }
      if (!photoDataUrl) {
        setStaffError("Ambil foto dulu sebelum check-in.");
        return;
      }

      await setDoc(
        doc(db, "staff_attendance", staffDocId),
        {
          uid: user.id,
          role: "dosen",
          tanggalISO: todayISO,
          checkInAt: serverTimestamp(),
          lokasi: { lat: loc.lat, lng: loc.lng, accuracy: loc.accuracy },
          fotoDataUrl: photoDataUrl,
          userAgent: navigator.userAgent,
        },
        { merge: true }
      );

      setStaffInfo("✅ Check-in berhasil tersimpan.");
      setOpenCheckIn(false);
      resetCheckInModalState();

      // UX: setelah confirm, pindah ke riwayat
      setActiveMenu("riwayat");
    } catch (e: any) {
      console.error("CHECKIN error:", e);
      setStaffError(e?.message || "Gagal check-in. Cek Firestore Rules.");
    } finally {
      setStaffSaving(false);
    }
  }

  async function handleCheckOut() {
    try {
      setStaffSaving(true);
      setStaffError(null);
      setStaffInfo(null);
      await updateDoc(doc(db, "staff_attendance", staffDocId), {
        checkOutAt: serverTimestamp(),
      });
      setStaffInfo("✅ Check-out berhasil tersimpan.");
      setActiveMenu("riwayat");
    } catch (e: any) {
      setStaffError(
        e?.message ||
          "Gagal check-out. Pastikan sudah check-in dan rules mengizinkan update."
      );
    } finally {
      setStaffSaving(false);
    }
  }

  useEffect(() => {
    return () => stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ======= util time label =======
  function tsToTime(ts: any) {
    try {
      const d: Date =
        typeof ts?.toDate === "function" ? ts.toDate() : new Date(ts);
      if (isNaN(d.getTime())) return "";
      return d.toTimeString().slice(0, 5);
    } catch {
      return "";
    }
  }

  const checkedMasuk = !!todayRec?.checkInAt;
  const checkedPulang = !!todayRec?.checkOutAt;
  const masukTime = tsToTime(todayRec?.checkInAt);
  const pulangTime = tsToTime(todayRec?.checkOutAt);

  /** ===== RIWAYAT (Firestore staff_attendance) ===== */
  const [history, setHistory] = useState<StaffRow[]>([]);
  const [histLoading, setHistLoading] = useState(false);
  const [histErr, setHistErr] = useState<string | null>(null);

  useEffect(() => {
    setHistLoading(true);
    setHistErr(null);

    const colRef = collection(db, "staff_attendance");

    const q1 = query(
      colRef,
      where("uid", "==", user.id),
      orderBy("tanggalISO", "desc"),
      limit(14)
    );

    let unsub1 = () => {};
    let unsub2 = () => {};

    unsub1 = onSnapshot(
      q1,
      (snap) => {
        const rows: StaffRow[] = snap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            tanggalISO: String(data.tanggalISO || ""),
            checkInAt: data.checkInAt,
            checkOutAt: data.checkOutAt,
            fotoDataUrl: data.fotoDataUrl ?? null,
            lokasi: data.lokasi ?? null,
            role: data.role,
            uid: data.uid,
          };
        });
        setHistory(rows);
        setHistLoading(false);
      },
      (err) => {
        const msg = String(err?.message || "");
        console.error("history snapshot error:", err);

        if (msg.toLowerCase().includes("requires an index")) {
          const q2 = query(colRef, where("uid", "==", user.id), limit(50));
          unsub2 = onSnapshot(
            q2,
            (snap2) => {
              const rows2: StaffRow[] = snap2.docs.map((d) => {
                const data = d.data() as any;
                return {
                  id: d.id,
                  tanggalISO: String(data.tanggalISO || ""),
                  checkInAt: data.checkInAt,
                  checkOutAt: data.checkOutAt,
                  fotoDataUrl: data.fotoDataUrl ?? null,
                  lokasi: data.lokasi ?? null,
                  role: data.role,
                  uid: data.uid,
                };
              });

              rows2.sort((a, b) =>
                (b.tanggalISO || "").localeCompare(a.tanggalISO || "")
              );
              setHistory(rows2.slice(0, 14));
              setHistLoading(false);
              setHistErr(null);
            },
            (err2) => {
              setHistErr(err2?.message || "Gagal memuat riwayat.");
              setHistLoading(false);
            }
          );
        } else {
          setHistErr(msg || "Gagal memuat riwayat.");
          setHistLoading(false);
        }
      }
    );

    return () => {
      try {
        unsub1();
        unsub2();
      } catch {}
    };
  }, [user.id]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="flex min-h-screen">
        {/* SIDEBAR (samakan karyawan) */}
        <aside className="hidden md:flex w-64 shrink-0 border-r bg-white">
          <div className="w-full flex flex-col p-4">
            <div className="flex items-center gap-3 px-2 py-2">
              <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white grid place-items-center">
                <LayoutDashboard className="w-5 h-5" />
              </div>
              <div className="leading-tight">
                <div className="font-semibold">DOSEN</div>
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
              Klik menu di kiri untuk menampilkan konten.
            </div>
          </div>
        </aside>

        {/* CONTENT */}
        <div className="flex-1 min-w-0">
          <div className="sticky top-0 z-20 bg-slate-50">
            <div className="px-4 sm:px-6 pt-4">
              <Topbar name={user.name} role={user.role} onLogout={onLogout} />
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
                              DOSEN
                            </div>
                            <h2 className="text-xl font-semibold leading-tight">
                              Absensi Harian
                            </h2>
                            <p className="text-sm text-slate-600 mt-1">
                              Foto + lokasi • Data:{" "}
                              <code>staff_attendance</code>
                            </p>
                          </div>
                        </div>

                        {/* ====== METRIC: JAM LIVE + TANGGAL PROFESIONAL ====== */}
                        <div className="grid grid-cols-2 gap-3 w-full md:w-auto">
                          <Metric
                            label="Waktu"
                            value={formatTimeHMS(now)}
                            suffix="WIB"
                          />
                          <Metric
                            label="Tanggal"
                            value={labelTanggal(todayISO)}
                          />
                        </div>
                      </div>

                      {(staffError || staffInfo) && (
                        <div className="mt-3 text-sm">
                          {staffError && (
                            <div className="text-red-600">{staffError}</div>
                          )}
                          {staffInfo && (
                            <div className="text-emerald-700">{staffInfo}</div>
                          )}
                        </div>
                      )}
                    </div>
                  </section>

                  <section className="grid gap-6 md:grid-cols-2">
                    <AbsCardLikeKaryawan
                      title="Absen Masuk"
                      icon={<LogIn className="w-5 h-5" />}
                      subtitle="Wajib foto + lokasi"
                      checked={checkedMasuk}
                      checkedLabel={masukTime || "Sudah"}
                      loading={staffSaving}
                      onDo={() => openCheckInModal()}
                      disabled={staffSaving}
                      cta="Ambil Foto & Lokasi"
                    />

                    <AbsCardLikeKaryawan
                      title="Absen Pulang"
                      icon={<LogOut className="w-5 h-5" />}
                      subtitle="Wajib foto + lokasi"
                      checked={checkedPulang}
                      checkedLabel={pulangTime || "Sudah"}
                      loading={staffSaving}
                      onDo={() => {
                        if (!checkedMasuk) {
                          alert("Anda belum check-in hari ini.");
                          return;
                        }
                        handleCheckOut();
                      }}
                      disabled={staffSaving}
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
                      <h3 className="font-semibold">Riwayat Terakhir</h3>
                      <button
                        onClick={() => setActiveMenu("absensi")}
                        className="px-3 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 text-sm"
                      >
                        Kembali ke Absensi
                      </button>
                    </div>

                    {histLoading ? (
                      <div className="text-sm text-slate-500 flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Memuat riwayat...
                      </div>
                    ) : histErr ? (
                      <div className="text-sm text-red-600">{histErr}</div>
                    ) : history.length === 0 ? (
                      <div className="text-sm text-slate-600">
                        Belum ada data.
                      </div>
                    ) : (
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {history.map((r) => {
                          const masuk = tsToTime(r.checkInAt);
                          const pulang = tsToTime(r.checkOutAt);
                          const mapsUrl =
                            r.lokasi?.lat != null && r.lokasi?.lng != null
                              ? `https://www.google.com/maps?q=${r.lokasi.lat},${r.lokasi.lng}`
                              : null;

                          return (
                            <div
                              key={r.id}
                              className="rounded-xl border p-3 flex gap-3"
                            >
                              {r.fotoDataUrl ? (
                                <img
                                  src={r.fotoDataUrl}
                                  className="w-16 h-16 object-cover rounded-md border"
                                />
                              ) : (
                                <div className="w-16 h-16 grid place-items-center rounded-md border bg-slate-50 text-slate-400">
                                  <Camera className="w-5 h-5" />
                                </div>
                              )}

                              <div className="text-sm min-w-0">
                                <div className="font-medium truncate">
                                  {labelTanggal(r.tanggalISO || "")}
                                </div>
                                <div className="text-slate-600">
                                  Masuk: {masuk || "-"} • Pulang:{" "}
                                  {pulang || "-"}
                                </div>

                                {r.lokasi && (
                                  <div className="mt-1 text-xs text-slate-600 space-y-0.5">
                                    <div className="truncate">
                                      Lat/Lng:{" "}
                                      {typeof r.lokasi.lat === "number"
                                        ? r.lokasi.lat.toFixed(6)
                                        : "-"}
                                      ,{" "}
                                      {typeof r.lokasi.lng === "number"
                                        ? r.lokasi.lng.toFixed(6)
                                        : "-"}
                                    </div>
                                    {typeof r.lokasi.accuracy === "number" && (
                                      <div>
                                        Akurasi: ±
                                        {Math.round(r.lokasi.accuracy)} m
                                      </div>
                                    )}
                                    {mapsUrl && (
                                      <a
                                        href={mapsUrl}
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
                          );
                        })}
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
                          Klik <b>Ambil Foto & Lokasi</b> pada kartu Absen
                          Masuk, lalu simpan check-in.
                        </div>
                      </div>

                      <div className="rounded-2xl border bg-slate-50 p-4">
                        <div className="font-medium">2) Absen Pulang</div>
                        <div className="text-slate-600 mt-1">
                          Absen pulang hanya bisa jika sudah absen masuk.
                        </div>
                      </div>

                      <div className="rounded-2xl border bg-slate-50 p-4">
                        <div className="font-medium">3) Riwayat</div>
                        <div className="text-slate-600 mt-1">
                          Riwayat diambil dari Firestore collection{" "}
                          <code>staff_attendance</code>.
                        </div>
                      </div>

                      <div className="text-xs text-slate-500 mt-2">
                        Catatan produksi: untuk foto lebih aman & ringan,
                        sebaiknya upload ke Firebase Storage (bukan simpan
                        dataUrl di Firestore).
                      </div>
                    </div>
                  </div>
                </section>
              )}
            </main>
          </div>
        </div>
      </div>

      {/* MODAL: CHECK-IN (foto + lokasi) */}
      {openCheckIn && (
        <Modal
          title="Check-in Absensi (Foto + Lokasi)"
          onClose={() => {
            setOpenCheckIn(false);
            resetCheckInModalState();
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
                  disabled={locLoading || staffSaving}
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
                    Aktifkan kamera lalu ambil foto untuk check-in.
                  </div>
                </div>
                <button
                  onClick={startCamera}
                  disabled={camLoading || staffSaving}
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
                      disabled={staffSaving || !streamRef.current}
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
                      alt="Foto Check-in"
                      className="w-full h-56 object-cover rounded-xl border bg-white"
                    />
                    <button
                      onClick={() => {
                        setPhotoDataUrl(null);
                        setStaffInfo(null);
                      }}
                      disabled={staffSaving}
                      className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-white border hover:bg-slate-100 disabled:opacity-60"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Ulang Foto
                    </button>
                  </div>
                )}
              </div>
            </div>

            {(staffError || staffInfo) && (
              <div className="text-sm">
                {staffError && <div className="text-red-600">{staffError}</div>}
                {staffInfo && (
                  <div className="text-emerald-700">{staffInfo}</div>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => {
                  setOpenCheckIn(false);
                  resetCheckInModalState();
                }}
                className="px-3 py-2 rounded-xl border hover:bg-slate-50"
                disabled={staffSaving}
              >
                Batal
              </button>

              <button
                onClick={handleConfirmCheckIn}
                disabled={staffSaving || !loc || !photoDataUrl}
                className="px-4 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60 inline-flex items-center gap-2"
              >
                {staffSaving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                Simpan Check-in
              </button>
            </div>

            <div className="text-xs text-slate-500">
              Catatan: Foto sementara disimpan sebagai <code>fotoDataUrl</code>{" "}
              di Firestore. Untuk versi produksi, pindah ke Firebase Storage.
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

      {/* lebih profesional: angka rapi + lebih tegas */}
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

function AbsCardLikeKaryawan({
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

/** UI helpers */
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
