import { useEffect, useMemo, useState } from "react";
import {
  GraduationCap,
  ShieldCheck,
  AtSign,
  Lock,
  Eye,
  EyeOff,
  AlertTriangle,
} from "lucide-react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../lib/firebase";

export default function Home() {
  // ---- state form
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // status info (biar jelas login sukses walau app.tsx belum pindah)
  const [info, setInfo] = useState<string | null>(null);

  // (opsional) auto-suggest role hanya berdasarkan email demo yang kamu pakai
  const suggestedRole = useMemo(() => {
    const e = email.toLowerCase().trim();
    if (e === "admin@uni.ac.id") return "superadmin";
    if (e === "dosen@uni.ac.id") return "dosen";
    if (e === "staff@uni.ac.id") return "karyawan";
    if (e === "mhs001@uni.ac.id") return "mahasiswa";
    return null;
  }, [email]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;

    setError(null);
    setInfo(null);
    setSubmitting(true);

    const cleanEmail = email.trim().toLowerCase();

    try {
      const cred = await signInWithEmailAndPassword(auth, cleanEmail, pw);

      // ✅ debug login sukses
      console.log("✅ LOGIN OK", {
        uid: cred.user.uid,
        email: cred.user.email,
      });

      setInfo(`Login sukses: ${cred.user.email} (uid: ${cred.user.uid})`);

      // remember email (opsional)
      try {
        if (remember)
          localStorage.setItem(
            "siakad-ui-last-login",
            JSON.stringify({ email: cleanEmail })
          );
        else localStorage.removeItem("siakad-ui-last-login");
      } catch {}

      // sukses login -> App.tsx akan otomatis pindah halaman (nanti kita bereskan)
    } catch (err: any) {
      console.error("❌ LOGIN FAIL", err);

      const code = err?.code as string | undefined;

      let msg = "Login gagal. Coba lagi.";
      if (code === "auth/invalid-credential")
        msg = "Email atau password salah.";
      else if (code === "auth/user-not-found") msg = "Akun tidak ditemukan.";
      else if (code === "auth/wrong-password") msg = "Password salah.";
      else if (code === "auth/too-many-requests")
        msg = "Terlalu banyak percobaan. Coba lagi beberapa saat.";
      else if (code === "auth/network-request-failed")
        msg = "Koneksi bermasalah. Coba cek internet.";
      else if (err?.message) msg = String(err.message);

      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  // muat email tersimpan (opsional)
  useEffect(() => {
    try {
      const raw = localStorage.getItem("siakad-ui-last-login");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.email) setEmail(parsed.email);
      }
    } catch {}
  }, []);

  return (
    <div className="min-h-screen relative bg-gradient-to-br from-indigo-900 via-slate-900 to-slate-950 text-white">
      {/* background dekor */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 -left-24 h-80 w-80 rounded-full bg-indigo-600/30 blur-3xl" />
        <div className="absolute -bottom-20 -right-20 h-96 w-96 rounded-full bg-fuchsia-600/25 blur-3xl" />
      </div>

      {/* header brand */}
      <header className="relative z-10 px-6 py-5 border-b border-white/10 backdrop-blur-sm bg-white/5">
        <div className="max-w-6xl mx-auto flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/15 grid place-items-center">
            <GraduationCap className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-widest text-white/70">
              Sistem Informasi Akademik
            </p>
            <h1 className="text-xl font-semibold">
              Universitas Nusantara — SIAKAD
            </h1>
          </div>
        </div>
      </header>

      {/* card login */}
      <main className="relative z-10 max-w-6xl mx-auto px-6 py-10 grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Kiri: tagline */}
        <section className="hidden lg:block self-center">
          <div className="rounded-3xl p-8 border border-white/10 bg-white/5 backdrop-blur-md">
            <h2 className="text-3xl font-semibold leading-tight">
              Selamat datang di <span className="text-indigo-300">SIAKAD</span>{" "}
              Universitas.
            </h2>
            <p className="mt-3 text-white/80">
              Kelola administrasi akademik lebih cepat: absensi, jadwal, dan
              data civitas. Gunakan akun institusi Anda untuk masuk.
            </p>

            <div className="mt-6 grid sm:grid-cols-3 gap-4">
              <Badge title="Keamanan" desc="Akses berbasis role" />
              <Badge title="Efisien" desc="Antarmuka modern" />
              <Badge title="Mobile-ready" desc="Responsif di semua device" />
            </div>
          </div>
        </section>

        {/* Kanan: form login */}
        <section className="w-full">
          <div className="rounded-3xl p-7 border border-white/10 bg-white/10 backdrop-blur-xl shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/15 grid place-items-center">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm uppercase tracking-wider text-white/80">
                  Portal Login
                </p>
                <h3 className="text-lg font-semibold">Masuk ke Akun Anda</h3>
              </div>
            </div>

            <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
              <div>
                <label className="block text-sm text-white/80 mb-1">
                  Email Kampus
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 opacity-70">
                    <AtSign className="w-4 h-4" />
                  </span>
                  <input
                    type="email"
                    className="w-full pl-10 pr-3 py-2 rounded-xl bg-white/10 border border-white/15 focus:outline-none focus:ring-2 focus:ring-indigo-400/60"
                    placeholder="nama@uni.ac.id"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                {suggestedRole && (
                  <p className="mt-1 text-xs text-white/70">
                    Terdeteksi akun role:{" "}
                    <span className="uppercase">{suggestedRole}</span>
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm text-white/80 mb-1">
                  Kata Sandi
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 opacity-70">
                    <Lock className="w-4 h-4" />
                  </span>
                  <input
                    type={showPw ? "text" : "password"}
                    className="w-full pl-10 pr-10 py-2 rounded-xl bg-white/10 border border-white/15 focus:outline-none focus:ring-2 focus:ring-indigo-400/60"
                    placeholder="••••••••"
                    value={pw}
                    onChange={(e) => setPw(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((s) => !s)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-lg hover:bg-white/10"
                    aria-label="toggle password"
                  >
                    {showPw ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-sm">
                <label className="inline-flex items-center gap-2 select-none">
                  <input
                    type="checkbox"
                    className="accent-indigo-500"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                  />
                  Ingat saya
                </label>
                <span className="opacity-70">Lupa password?</span>
              </div>

              {/* ✅ info sukses login */}
              {info && (
                <div className="flex items-start gap-2 rounded-xl border border-emerald-400/40 bg-emerald-400/10 p-3 text-sm">
                  <span className="mt-0.5">✅</span>
                  <p className="break-all">{info}</p>
                </div>
              )}

              {error && (
                <div className="flex items-start gap-2 rounded-xl border border-red-400/40 bg-red-400/10 p-3 text-sm">
                  <AlertTriangle className="w-4 h-4 mt-0.5" />
                  <p>{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-600 disabled:opacity-60 font-medium shadow-lg shadow-indigo-900/20 transition"
              >
                {submitting ? "Memproses..." : "Masuk"}
              </button>

              {/* hint akun demo */}
              <div className="mt-3 text-xs text-white/70 leading-relaxed">
                <p className="font-semibold text-white/80">Akun demo:</p>
                <ul className="list-disc ml-5">
                  <li>
                    SuperAdmin — <code>admin@uni.ac.id</code> /{" "}
                    <code>admin123</code>
                  </li>
                  <li>
                    Dosen — <code>dosen@uni.ac.id</code> / <code>dosen123</code>
                  </li>
                  <li>
                    Karyawan — <code>staff@uni.ac.id</code> /{" "}
                    <code>staff123</code>
                  </li>
                  <li>
                    Mahasiswa — <code>mhs001@uni.ac.id</code> /{" "}
                    <code>mhs123</code>
                  </li>
                </ul>
                <p className="mt-2 opacity-80">
                  Pastikan akun tersebut sudah dibuat di Firebase
                  Authentication, dan profilnya ada di Firestore{" "}
                  <code>users/&lt;uid&gt;</code>.
                </p>
              </div>
            </form>
          </div>
        </section>
      </main>

      <footer className="relative z-10 px-6 pb-8">
        <div className="max-w-6xl mx-auto text-xs text-white/60">
          © {new Date().getFullYear()} Universitas Nusantara • SIAKAD
        </div>
      </footer>
    </div>
  );
}

function Badge({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="rounded-2xl border border-white/15 bg-white/5 p-4">
      <div className="text-sm font-medium">{title}</div>
      <div className="text-xs text-white/70">{desc}</div>
    </div>
  );
}
