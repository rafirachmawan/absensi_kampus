import { useEffect, useMemo, useRef, useState } from "react";
import Topbar from "../components/Topbar";
import type { UserLite } from "../types";
import {
  Plus,
  X,
  Trash2,
  Loader2,
  CheckCircle2,
  LogIn,
  LogOut,
  Camera,
  MapPin,
  Check,
  RefreshCw,
} from "lucide-react";

import { db, firebaseConfig } from "../lib/firebase";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";

// secondary auth agar dosen tidak logout saat buat akun mahasiswa
import { initializeApp, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  createUserWithEmailAndPassword,
  type Auth,
} from "firebase/auth";

type Course = {
  id: string;
  nama: string;
  dosenUid: string;
  kelas?: string | null;
  prodi?: string | null;
  createdAt?: any;
};

type StudentRow = {
  uid: string;
  nama: string;
  email: string;
  nim?: string | null; // optional, tidak ada di UserLite, hanya data mahasiswa
  kelas?: string | null;
  prodi?: string | null;
  createdAt?: any;
};

function formatISO(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** secondary auth singleton */
let _secondaryApp: FirebaseApp | null = null;
let _secondaryAuth: Auth | null = null;
function getSecondaryAuth() {
  if (!_secondaryApp)
    _secondaryApp = initializeApp(firebaseConfig, "secondary");
  if (!_secondaryAuth) _secondaryAuth = getAuth(_secondaryApp);
  return _secondaryAuth;
}

/** ===== helpers: geolocation + camera (tanpa ubah logika lain) ===== */
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

export default function DosenPage({
  user,
  onLogout,
}: {
  user: UserLite;
  onLogout: () => void;
}) {
  /** =========================
   * 0) CHECKIN/CHECKOUT dosen
   * (ditambah: foto + lokasi via modal, tanpa mengubah flow course/mhs)
   * ========================= */
  const [staffSaving, setStaffSaving] = useState(false);
  const [staffError, setStaffError] = useState<string | null>(null);
  const [staffInfo, setStaffInfo] = useState<string | null>(null);

  const todayISO = formatISO(new Date());
  const staffDocId = `${user.id}_${todayISO}`;

  // modal checkin (foto+lokasi)
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

  function resetCheckInModalState() {
    setLoc(null);
    setLocLoading(false);
    setCamLoading(false);
    setCamError(null);
    setPhotoDataUrl(null);
    stopCamera();
  }

  function stopCamera() {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    } catch {}
    streamRef.current = null;
    if (videoRef.current) {
      try {
        // @ts-ignore
        videoRef.current.srcObject = null;
      } catch {}
    }
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

      // prefer front camera (untuk selfie absensi)
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

    // setelah capture, matikan kamera supaya hemat
    stopCamera();
    setStaffInfo("✅ Foto berhasil diambil.");
  }

  async function handleConfirmCheckIn() {
    try {
      setStaffSaving(true);
      setStaffError(null);
      setStaffInfo(null);

      // wajib ada lokasi + foto (sesuai kebutuhan kamu)
      if (!loc) {
        setStaffError("Ambil lokasi dulu sebelum check-in.");
        return;
      }
      if (!photoDataUrl) {
        setStaffError("Ambil foto dulu sebelum check-in.");
        return;
      }

      // simpan ke Firestore
      // NOTE: foto disimpan sebagai dataURL untuk sementara (tanpa Firebase Storage).
      // Kalau kamu sudah siap pakai Firebase Storage, nanti kita ganti photoDataUrl -> photoUrl.
      await setDoc(
        doc(db, "staff_attendance", staffDocId),
        {
          uid: user.id,
          role: "dosen",
          tanggalISO: todayISO,
          checkInAt: serverTimestamp(),

          // tambahan (tanpa mengganggu logika lain)
          lokasi: {
            lat: loc.lat,
            lng: loc.lng,
            accuracy: loc.accuracy,
          },
          fotoDataUrl: photoDataUrl,
          userAgent: navigator.userAgent,
        },
        { merge: true }
      );

      setStaffInfo("✅ Check-in berhasil tersimpan.");
      setOpenCheckIn(false);
      resetCheckInModalState();
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
    // cleanup camera saat unmount / modal close
    return () => stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** =========================
   * 1) COURSES milik dosen
   * ========================= */
  const [courses, setCourses] = useState<Course[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [coursesErr, setCoursesErr] = useState<string | null>(null);

  useEffect(() => {
    setLoadingCourses(true);
    setCoursesErr(null);

    const q = query(
      collection(db, "courses"),
      where("dosenUid", "==", user.id),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const rows: Course[] = snap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            nama: data.nama || "",
            dosenUid: data.dosenUid || "",
            kelas: data.kelas ?? null,
            prodi: data.prodi ?? null,
            createdAt: data.createdAt,
          };
        });
        setCourses(rows);
        setLoadingCourses(false);
      },
      (err) => {
        console.error("courses snapshot error:", err);
        setCoursesErr(err?.message || "Gagal load mata kuliah.");
        setLoadingCourses(false);
      }
    );

    return () => unsub();
  }, [user.id]);

  /** =========================
   * 2) Modal: tambah course
   * ========================= */
  const [openCourse, setOpenCourse] = useState(false);
  const [courseNama, setCourseNama] = useState("");
  const [courseKelas, setCourseKelas] = useState("");
  const [courseProdi, setCourseProdi] = useState("");
  const [courseSaving, setCourseSaving] = useState(false);
  const [courseErr, setCourseErr] = useState<string | null>(null);

  async function saveCourse() {
    const nama = courseNama.trim();
    if (nama.length < 3) {
      setCourseErr("Nama mata kuliah minimal 3 karakter.");
      return;
    }

    try {
      setCourseSaving(true);
      setCourseErr(null);

      await addDoc(collection(db, "courses"), {
        nama,
        dosenUid: user.id,
        kelas: courseKelas.trim() || null,
        prodi: courseProdi.trim() || null,
        createdAt: serverTimestamp(),
      });

      setOpenCourse(false);
      setCourseNama("");
      setCourseKelas("");
      setCourseProdi("");
    } catch (e: any) {
      setCourseErr(e?.message || "Gagal simpan mata kuliah.");
    } finally {
      setCourseSaving(false);
    }
  }

  /** =========================
   * 3) Modal: tambah mahasiswa + assign course
   * ========================= */
  const [openMhs, setOpenMhs] = useState(false);
  const [pickCourseId, setPickCourseId] = useState<string>("");
  const pickedCourse = useMemo(
    () => courses.find((c) => c.id === pickCourseId),
    [courses, pickCourseId]
  );

  const [mhsNama, setMhsNama] = useState("");
  const [mhsEmail, setMhsEmail] = useState("");
  const [mhsPass, setMhsPass] = useState("");
  const [mhsNim, setMhsNim] = useState("");
  const [mhsKelas, setMhsKelas] = useState("");
  const [mhsProdi, setMhsProdi] = useState("");

  const [mhsSaving, setMhsSaving] = useState(false);
  const [mhsErr, setMhsErr] = useState<string | null>(null);

  const canSubmitMhs = useMemo(() => {
    return (
      !!pickedCourse &&
      mhsNama.trim().length >= 3 &&
      mhsEmail.trim().includes("@") &&
      mhsPass.trim().length >= 6
    );
  }, [pickedCourse, mhsNama, mhsEmail, mhsPass]);

  function resetMhsForm() {
    setPickCourseId("");
    setMhsNama("");
    setMhsEmail("");
    setMhsPass("");
    setMhsNim("");
    setMhsKelas("");
    setMhsProdi("");
    setMhsErr(null);
  }

  async function saveMahasiswaAndAssign() {
    if (!pickedCourse) {
      setMhsErr("Pilih mata kuliah dulu.");
      return;
    }

    const nama = mhsNama.trim();
    const email = mhsEmail.trim().toLowerCase();
    const password = mhsPass.trim();

    if (nama.length < 3) return setMhsErr("Nama minimal 3 karakter.");
    if (!email.includes("@")) return setMhsErr("Email tidak valid.");
    if (password.length < 6) return setMhsErr("Password minimal 6 karakter.");

    try {
      setMhsSaving(true);
      setMhsErr(null);

      // 1) create auth user mahasiswa (secondary auth)
      const secAuth = getSecondaryAuth();
      const cred = await createUserWithEmailAndPassword(
        secAuth,
        email,
        password
      );
      const mhsUid = cred.user.uid;

      // 2) profile users/{uid}
      await setDoc(doc(db, "users", mhsUid), {
        email,
        name: nama,
        role: "mahasiswa",
        kelas: mhsKelas.trim() || pickedCourse.kelas || null,
        prodi: mhsProdi.trim() || pickedCourse.prodi || null,
        nim: mhsNim.trim() || null,
        createdAt: serverTimestamp(),
        createdBy: user.id,
      });

      // 3) enrollment (dipakai MahasiswaPage)
      await setDoc(doc(db, "users", mhsUid, "enrollments", pickedCourse.id), {
        courseId: pickedCourse.id,
        courseNama: pickedCourse.nama,
        dosenUid: user.id,
        createdAt: serverTimestamp(),
      });

      // 4) course students list (buat dosen)
      await setDoc(doc(db, "courses", pickedCourse.id, "students", mhsUid), {
        uid: mhsUid,
        nama,
        email,
        nim: mhsNim.trim() || null,
        kelas: mhsKelas.trim() || pickedCourse.kelas || null,
        prodi: mhsProdi.trim() || pickedCourse.prodi || null,
        createdAt: serverTimestamp(),
      });

      setOpenMhs(false);
      resetMhsForm();
      alert("Akun mahasiswa berhasil dibuat & di-assign ke mata kuliah.");
    } catch (e: any) {
      console.error("create mahasiswa error:", e);
      setMhsErr(e?.message || "Gagal membuat akun mahasiswa.");
    } finally {
      setMhsSaving(false);
    }
  }

  /** =========================
   * 4) List mahasiswa per course
   * ========================= */
  const [activeCourseId, setActiveCourseId] = useState<string>("");
  const activeCourse = useMemo(
    () => courses.find((c) => c.id === activeCourseId),
    [courses, activeCourseId]
  );

  const [students, setStudents] = useState<StudentRow[]>([]);
  const [studLoading, setStudLoading] = useState(false);
  const [studErr, setStudErr] = useState<string | null>(null);

  useEffect(() => {
    if (!activeCourseId) {
      setStudents([]);
      return;
    }

    setStudLoading(true);
    setStudErr(null);

    const q = query(
      collection(db, "courses", activeCourseId, "students"),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const rows: StudentRow[] = snap.docs.map((d) => {
          const data = d.data() as any;
          return {
            uid: data.uid || d.id,
            nama: data.nama || "",
            email: data.email || "",
            nim: data.nim ?? null,
            kelas: data.kelas ?? null,
            prodi: data.prodi ?? null,
            createdAt: data.createdAt,
          };
        });
        setStudents(rows);
        setStudLoading(false);
      },
      (err) => {
        console.error("students snapshot error:", err);
        setStudErr(err?.message || "Gagal load mahasiswa.");
        setStudLoading(false);
      }
    );

    return () => unsub();
  }, [activeCourseId]);

  async function removeStudent(studentUid: string) {
    if (!activeCourseId) return;
    const ok = confirm("Hapus mahasiswa dari mata kuliah ini?");
    if (!ok) return;

    try {
      await deleteDoc(
        doc(db, "courses", activeCourseId, "students", studentUid)
      );
      // jika mau sekalian hapus enrollment:
      // await deleteDoc(doc(db, "users", studentUid, "enrollments", activeCourseId));
    } catch (e: any) {
      alert(e?.message || "Gagal hapus mahasiswa.");
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Topbar name={user.name} role={user.role} onLogout={onLogout} />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* CHECKIN/CHECKOUT */}
        <section className="rounded-2xl border bg-white p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold">Absensi Dosen</h2>
              <p className="text-sm text-slate-600">
                Check-in & check-out (Firestore: <code>staff_attendance</code>)
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={openCheckInModal}
                disabled={staffSaving}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                {staffSaving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <LogIn className="w-4 h-4" />
                )}
                Check-in
              </button>
              <button
                onClick={handleCheckOut}
                disabled={staffSaving}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-800 text-white hover:bg-slate-900 disabled:opacity-60"
              >
                {staffSaving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <LogOut className="w-4 h-4" />
                )}
                Check-out
              </button>
            </div>
          </div>

          {(staffError || staffInfo) && (
            <div className="mt-3 text-sm">
              {staffError && <div className="text-red-600">{staffError}</div>}
              {staffInfo && <div className="text-emerald-700">{staffInfo}</div>}
            </div>
          )}
        </section>

        {/* COURSES */}
        <section className="rounded-2xl border bg-white p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold mb-1">Mata Kuliah</h2>
              <p className="text-sm text-slate-600">
                Buat mata kuliah yang kamu ajar, lalu assign mahasiswa.
              </p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setOpenCourse(true)}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-sky-600 text-white hover:bg-sky-700"
              >
                <Plus className="w-4 h-4" /> Tambah MK
              </button>

              <button
                onClick={() => {
                  resetMhsForm();
                  setOpenMhs(true);
                }}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700"
              >
                <Plus className="w-4 h-4" /> Tambah Mahasiswa
              </button>
            </div>
          </div>

          <div className="mt-5">
            {loadingCourses ? (
              <div className="text-sm text-slate-500 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Memuat mata kuliah...
              </div>
            ) : coursesErr ? (
              <div className="text-sm text-red-600">{coursesErr}</div>
            ) : courses.length === 0 ? (
              <div className="text-sm text-slate-500">
                Belum ada mata kuliah.
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-3">
                {courses.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setActiveCourseId(c.id)}
                    className={`text-left rounded-2xl border p-4 hover:bg-slate-50 ${
                      activeCourseId === c.id
                        ? "border-indigo-300 bg-indigo-50/30"
                        : ""
                    }`}
                  >
                    <div className="font-semibold">{c.nama}</div>
                    <div className="text-sm text-slate-600">
                      {c.kelas ?? "-"} • {c.prodi ?? "-"}
                    </div>
                    {activeCourseId === c.id && (
                      <div className="mt-2 inline-flex items-center gap-2 text-xs text-indigo-700">
                        <CheckCircle2 className="w-4 h-4" /> Dipilih
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* STUDENTS */}
        <section className="rounded-2xl border bg-white p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold">Mahasiswa untuk Mata Kuliah</h2>
              <p className="text-sm text-slate-600">
                {activeCourse ? (
                  <>
                    <span className="font-medium">{activeCourse.nama}</span> •{" "}
                    {activeCourse.kelas ?? "-"} • {activeCourse.prodi ?? "-"}
                  </>
                ) : (
                  "Pilih mata kuliah dulu."
                )}
              </p>
            </div>
          </div>

          <div className="mt-4">
            {!activeCourseId ? (
              <div className="text-sm text-slate-500">
                Belum memilih mata kuliah.
              </div>
            ) : studLoading ? (
              <div className="text-sm text-slate-500 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Memuat mahasiswa...
              </div>
            ) : studErr ? (
              <div className="text-sm text-red-600">{studErr}</div>
            ) : students.length === 0 ? (
              <div className="text-sm text-slate-500">
                Belum ada mahasiswa di mata kuliah ini.
              </div>
            ) : (
              <div className="divide-y">
                {students.map((s) => (
                  <div key={s.uid} className="py-3 flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{s.nama}</div>
                      <div className="text-sm text-slate-600 truncate">
                        {s.email}
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        {s.nim ? `NIM: ${s.nim}` : ""}
                        {s.kelas ? ` • ${s.kelas}` : ""}
                        {s.prodi ? ` • ${s.prodi}` : ""}
                      </div>
                    </div>

                    <button
                      onClick={() => removeStudent(s.uid)}
                      className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border hover:bg-slate-50 text-slate-700"
                      title="Hapus dari MK"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span className="text-sm">Hapus</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>

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

              {/* preview camera / photo */}
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

            {/* info/error */}
            {(staffError || staffInfo) && (
              <div className="text-sm">
                {staffError && <div className="text-red-600">{staffError}</div>}
                {staffInfo && (
                  <div className="text-emerald-700">{staffInfo}</div>
                )}
              </div>
            )}

            {/* tombol simpan */}
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
              di Firestore. Jika kamu mau versi produksi, nanti kita pindah ke
              Firebase Storage (lebih aman & ringan).
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL: ADD COURSE */}
      {openCourse && (
        <Modal title="Tambah Mata Kuliah" onClose={() => setOpenCourse(false)}>
          <div className="grid gap-3">
            <Field label="Nama Mata Kuliah">
              <input
                value={courseNama}
                onChange={(e) => setCourseNama(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                placeholder="Contoh: Algoritma"
              />
            </Field>

            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Kelas (opsional)">
                <input
                  value={courseKelas}
                  onChange={(e) => setCourseKelas(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                  placeholder="IF-1A"
                />
              </Field>
              <Field label="Prodi (opsional)">
                <input
                  value={courseProdi}
                  onChange={(e) => setCourseProdi(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                  placeholder="Informatika"
                />
              </Field>
            </div>

            {courseErr && (
              <div className="text-sm text-red-600">{courseErr}</div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setOpenCourse(false)}
                className="px-3 py-2 rounded-xl border hover:bg-slate-50"
                disabled={courseSaving}
              >
                Batal
              </button>
              <button
                onClick={saveCourse}
                className="px-4 py-2 rounded-xl bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-60 inline-flex items-center gap-2"
                disabled={courseSaving}
              >
                {courseSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                Simpan
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL: ADD MAHASISWA */}
      {openMhs && (
        <Modal
          title="Tambah Mahasiswa (buat akun + assign MK)"
          onClose={() => setOpenMhs(false)}
        >
          <div className="grid gap-3">
            <Field label="Pilih Mata Kuliah">
              <select
                value={pickCourseId}
                onChange={(e) => setPickCourseId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
              >
                <option value="">-- pilih mata kuliah --</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nama} ({c.kelas ?? "-"} / {c.prodi ?? "-"})
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Nama Mahasiswa">
              <input
                value={mhsNama}
                onChange={(e) => setMhsNama(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                placeholder="Contoh: Rafi Ramadhan"
              />
            </Field>

            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Email Mahasiswa">
                <input
                  value={mhsEmail}
                  onChange={(e) => setMhsEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                  placeholder="rafi@uni.ac.id"
                />
              </Field>
              <Field label="Password (manual dosen)">
                <input
                  value={mhsPass}
                  onChange={(e) => setMhsPass(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                  placeholder="min 6 karakter"
                />
              </Field>
            </div>

            <div className="grid sm:grid-cols-3 gap-3">
              <Field label="NIM (opsional)">
                <input
                  value={mhsNim}
                  onChange={(e) => setMhsNim(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                  placeholder="231234567"
                />
              </Field>
              <Field label="Kelas (opsional)">
                <input
                  value={mhsKelas}
                  onChange={(e) => setMhsKelas(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                  placeholder="IF-1A"
                />
              </Field>
              <Field label="Prodi (opsional)">
                <input
                  value={mhsProdi}
                  onChange={(e) => setMhsProdi(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                  placeholder="Informatika"
                />
              </Field>
            </div>

            <div className="text-xs text-slate-500">
              Password hanya untuk login mahasiswa. Sistem tidak menyimpan
              password di Firestore.
            </div>

            {mhsErr && <div className="text-sm text-red-600">{mhsErr}</div>}

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setOpenMhs(false)}
                className="px-3 py-2 rounded-xl border hover:bg-slate-50"
                disabled={mhsSaving}
              >
                Batal
              </button>
              <button
                onClick={saveMahasiswaAndAssign}
                className="px-4 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60 inline-flex items-center gap-2"
                disabled={!canSubmitMhs || mhsSaving}
              >
                {mhsSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                Buat Akun & Assign
              </button>
            </div>
          </div>
        </Modal>
      )}
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
      {/* container modal */}
      <div className="w-full max-w-xl rounded-2xl bg-white border shadow-xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* header */}
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

        {/* body (scroll) */}
        <div className="px-5 py-4 overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-sm font-medium text-slate-700 mb-1">{label}</div>
      {children}
    </div>
  );
}
