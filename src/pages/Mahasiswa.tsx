import { useEffect, useMemo, useState } from "react";
import Topbar from "../components/Topbar";
import BackgroundFX from "../components/BackgroundFX";
import type { UserLite } from "../types";
import CameraCheckin from "../components/CameraCheckin";
import {
  CalendarDays,
  Clock4,
  MapPin,
  Camera,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  Loader2,
} from "lucide-react";
import { type GeoFence } from "../utils/geo";

import { db } from "../lib/firebase";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  where,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";

/** ====== GEOFENCE ====== */
const GEOFENCES: GeoFence[] = [
  { name: "Kampus Pusat", lat: -6.2009, lng: 106.781, radiusM: 300 },
];

const HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

/** ====== Types lokal untuk page ini ====== */
type Enrollment = {
  courseId: string;
  courseNama: string;
  dosenUid: string;
  createdAt?: any;
};

type SessionItem = {
  id: string; // sessionId
  courseId: string;
  courseNama: string;
  dosenUid: string;
  tanggalISO: string;
  jamMulai: string;
  jamSelesai: string;
  ruang?: string | null;
  kelas?: string | null;
};

type Attendance = {
  id: string; // uid_sessionId
  uid: string;
  sessionId: string;
  courseId: string;
  courseNama: string;
  dosenUid: string;
  tanggalISO: string;
  status: "Hadir";
  selfieDataUrl?: string;
  lat?: number;
  lng?: number;
  distanceM?: number;
  createdAt?: any;
};

/** ====== helpers ====== */
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

export default function MahasiswaPage({
  user,
  onLogout,
}: {
  user: UserLite;
  onLogout: () => void;
}) {
  const todayISO = formatISO(new Date());
  const endISO = formatISO(addDays(new Date(), 7)); // 7 hari ke depan

  /** =============================
   * 1) LOAD ENROLLMENTS mahasiswa
   * ============================= */
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [enrollLoading, setEnrollLoading] = useState(true);
  const [enrollErr, setEnrollErr] = useState<string | null>(null);

  useEffect(() => {
    setEnrollLoading(true);
    setEnrollErr(null);

    const q = query(
      collection(db, "users", user.id, "enrollments"),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const rows: Enrollment[] = snap.docs.map((d) => {
          const data = d.data() as any;
          return {
            courseId: data.courseId || d.id,
            courseNama: data.courseNama || "",
            dosenUid: data.dosenUid || "",
            createdAt: data.createdAt,
          };
        });
        setEnrollments(rows);
        setEnrollLoading(false);
      },
      (err) => {
        console.error("enrollments onSnapshot error:", err);
        setEnrollErr(err?.message || "Gagal memuat enrollments.");
        setEnrollLoading(false);
      }
    );

    return () => unsub();
  }, [user.id]);

  /** =============================
   * 2) LOAD SESSIONS per course
   *    (gabung jadi list jadwal)
   * ============================= */
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [sessionsErr, setSessionsErr] = useState<string | null>(null);

  useEffect(() => {
    setSessionsLoading(true);
    setSessionsErr(null);

    if (enrollments.length === 0) {
      setSessions([]);
      setSessionsLoading(false);
      return;
    }

    // Subscribe per course (simple, cukup untuk awal)
    let unsubs: Array<() => void> = [];
    let buffer: SessionItem[] = [];

    function rebuild() {
      const sorted = [...buffer].sort((a, b) => {
        if (a.tanggalISO !== b.tanggalISO)
          return a.tanggalISO < b.tanggalISO ? -1 : 1;
        if (a.jamMulai !== b.jamMulai) return a.jamMulai < b.jamMulai ? -1 : 1;
        return a.courseNama.localeCompare(b.courseNama);
      });
      setSessions(sorted);
      setSessionsLoading(false);
    }

    enrollments.forEach((en) => {
      const q = query(
        collection(db, "courses", en.courseId, "sessions"),
        where("tanggalISO", ">=", todayISO),
        where("tanggalISO", "<=", endISO),
        orderBy("tanggalISO", "asc")
      );

      const unsub = onSnapshot(
        q,
        (snap) => {
          // remove old sessions for this course
          buffer = buffer.filter((x) => x.courseId !== en.courseId);

          const rows: SessionItem[] = snap.docs.map((d) => {
            const data = d.data() as any;
            return {
              id: d.id,
              courseId: en.courseId,
              courseNama: data.courseNama || en.courseNama || "",
              dosenUid: data.dosenUid || en.dosenUid || "",
              tanggalISO: data.tanggalISO,
              jamMulai: data.jamMulai,
              jamSelesai: data.jamSelesai,
              ruang: data.ruang ?? null,
              kelas: data.kelas ?? null,
            };
          });

          buffer = [...buffer, ...rows];
          rebuild();
        },
        (err) => {
          console.error("sessions onSnapshot error:", err);
          setSessionsErr(err?.message || "Gagal memuat jadwal perkuliahan.");
          setSessionsLoading(false);
        }
      );

      unsubs.push(unsub);
    });

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [enrollments, todayISO, endISO]);

  /** =============================
   * 3) LOAD ATTENDANCE mahasiswa
   * ============================= */
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [attLoading, setAttLoading] = useState(true);
  const [attErr, setAttErr] = useState<string | null>(null);

  useEffect(() => {
    setAttLoading(true);
    setAttErr(null);

    const q = query(
      collection(db, "attendance_records"),
      where("uid", "==", user.id),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const rows: Attendance[] = snap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            uid: data.uid,
            sessionId: data.sessionId,
            courseId: data.courseId,
            courseNama: data.courseNama || "",
            dosenUid: data.dosenUid || "",
            tanggalISO: data.tanggalISO,
            status: "Hadir",
            selfieDataUrl: data.selfieDataUrl,
            lat: data.lat,
            lng: data.lng,
            distanceM: data.distanceM,
            createdAt: data.createdAt,
          };
        });
        setAttendance(rows);
        setAttLoading(false);
      },
      (err) => {
        console.error("attendance onSnapshot error:", err);
        setAttErr(err?.message || "Gagal memuat riwayat absensi.");
        setAttLoading(false);
      }
    );

    return () => unsub();
  }, [user.id]);

  /** grouped sessions by date */
  const grouped = useMemo(() => {
    const byDate = new Map<string, SessionItem[]>();
    for (const s of sessions) {
      if (!byDate.has(s.tanggalISO)) byDate.set(s.tanggalISO, []);
      byDate.get(s.tanggalISO)!.push(s);
    }
    return Array.from(byDate.entries())
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([tgl, items]) => ({ tgl, items }));
  }, [sessions]);

  /** modal camera */
  const [openCamFor, setOpenCamFor] = useState<SessionItem | null>(null);

  function alreadyChecked(s: SessionItem) {
    const id = `${user.id}_${s.id}`; // uid_sessionId
    return attendance.find((a) => a.id === id);
  }

  async function onConfirmCheckin(payload: {
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

    try {
      const docId = `${user.id}_${openCamFor.id}`;
      await setDoc(doc(db, "attendance_records", docId), {
        uid: user.id,
        role: "mahasiswa",
        sessionId: openCamFor.id,
        courseId: openCamFor.courseId,
        courseNama: openCamFor.courseNama,
        dosenUid: openCamFor.dosenUid,
        tanggalISO: openCamFor.tanggalISO,
        status: "Hadir",
        selfieDataUrl: payload.selfieDataUrl,
        lat: payload.lat ?? null,
        lng: payload.lng ?? null,
        distanceM: payload.distanceM ?? null,
        createdAt: serverTimestamp(),
      });

      setOpenCamFor(null);
    } catch (e: any) {
      console.error("save attendance error:", e);
      alert(e?.message || "Gagal menyimpan absensi. Cek Rules Firestore.");
    }
  }

  const todayCount = grouped.find((g) => g.tgl === todayISO)?.items.length ?? 0;
  const hadirToday = attendance.filter((a) => a.tanggalISO === todayISO).length;

  return (
    <div className="relative min-h-screen bg-gradient-to-b from-white to-slate-50">
      <BackgroundFX />
      <Topbar name={user.name} role={user.role} onLogout={onLogout} />

      {/* hero */}
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
                  {user.kelas} • {user.prodi} — Absensi pakai <b>selfie</b> &{" "}
                  <b>geofence</b>.
                </p>

                {(enrollLoading || sessionsLoading) && (
                  <div className="mt-2 text-xs text-slate-500 flex items-center gap-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Memuat jadwal dari Firestore...
                  </div>
                )}
                {(enrollErr || sessionsErr) && (
                  <div className="mt-2 text-xs text-red-600">
                    {enrollErr || sessionsErr}
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 w-full md:w-auto">
              <Metric label="Hari Ini" value={labelTanggal(todayISO)} />
              <Metric label="Jadwal" value={`${todayCount}`} />
              <Metric label="Hadir" value={`${hadirToday}`} />
            </div>
          </div>
        </div>
      </section>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 pb-12">
        {/* Jika belum punya course */}
        {!enrollLoading && enrollments.length === 0 && (
          <section className="mb-6">
            <Card
              title="Belum ada Mata Kuliah"
              sub="Dosen belum menambahkan kamu ke mata kuliah."
            >
              <Empty text="Belum ada jadwal karena kamu belum di-enroll ke mata kuliah." />
            </Card>
          </section>
        )}

        <div className="grid gap-6 lg:grid-cols-12">
          {/* Jadwal hari ini */}
          <section className="lg:col-span-6">
            <Card title="Jadwal Hari Ini" hint="Perkuliahan">
              <div className="space-y-3">
                {sessionsLoading ? (
                  <div className="text-sm text-slate-500 flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Memuat jadwal...
                  </div>
                ) : (
                  grouped
                    .find((g) => g.tgl === todayISO)
                    ?.items.map((s) => (
                      <Row
                        key={s.id}
                        title={`${s.courseNama}`}
                        subtitle={`${s.jamMulai}–${s.jamSelesai} • ${
                          s.ruang ?? "-"
                        }`}
                        checked={!!alreadyChecked(s)}
                        onAction={() => setOpenCamFor(s)}
                      />
                    )) ?? <Empty text="Tidak ada jadwal hari ini." />
                )}
              </div>
            </Card>
          </section>

          {/* Minggu ini */}
          <section className="lg:col-span-6">
            <Card title="Minggu Ini" sub="Jadwal 7 hari ke depan.">
              <div className="space-y-4">
                {sessionsLoading ? (
                  <div className="text-sm text-slate-500 flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Memuat jadwal...
                  </div>
                ) : (
                  grouped
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
                          {g.items.map((s) => (
                            <Row
                              key={s.id}
                              title={`${s.courseNama}`}
                              subtitle={`${s.jamMulai}–${s.jamSelesai} • ${
                                s.ruang ?? "-"
                              }`}
                              checked={!!alreadyChecked(s)}
                              onAction={() => setOpenCamFor(s)}
                            />
                          ))}
                        </div>
                      </div>
                    ))
                )}
              </div>
            </Card>
          </section>
        </div>

        {/* Riwayat absensi */}
        <section className="mt-6">
          <Card title="Riwayat Absensi" sub="6 terbaru.">
            {attLoading ? (
              <div className="text-sm text-slate-500 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Memuat riwayat...
              </div>
            ) : attErr ? (
              <div className="text-sm text-red-600">{attErr}</div>
            ) : attendance.length === 0 ? (
              <Empty text="Belum ada absensi." />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {[...attendance].slice(0, 6).map((a) => (
                  <div
                    key={a.id}
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
                      <div className="text-slate-600">{a.courseNama}</div>
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
