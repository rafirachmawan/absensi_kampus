import { useMemo, useState } from "react";
import {
  GraduationCap,
  ShieldCheck,
  AtSign,
  Lock,
  Eye,
  EyeOff,
  AlertTriangle,
} from "lucide-react";
import type { UserLite } from "../types";

// ==== DUMMY ACCOUNTS (email / password / role -> user object) ====
type DummyAccount = {
  email: string;
  password: string;
  user: UserLite;
};

const DUMMY_ACCOUNTS: DummyAccount[] = [
  {
    email: "admin@uni.ac.id",
    password: "admin123",
    user: {
      id: "u-admin",
      role: "superadmin",
      name: "Super Admin",
      email: "admin@uni.ac.id",
    },
  },
  {
    email: "dosen@uni.ac.id",
    password: "dosen123",
    user: {
      id: "u-dosen",
      role: "dosen",
      name: "Dr. Siti Rahma",
      email: "dosen@uni.ac.id",
    },
  },
  // KARYAWAN (baru)
  {
    email: "staff@uni.ac.id",
    password: "staff123",
    user: {
      id: "u-staff",
      role: "karyawan",
      name: "Rafi Ramadhan",
      email: "staff@uni.ac.id",
    },
  },
  {
    email: "mhs001@uni.ac.id",
    password: "mhs123",
    user: {
      id: "u-mhs",
      role: "mahasiswa",
      name: "Rafi Ramadhan",
      email: "mhs001@uni.ac.id",
      kelas: "IF-1A",
      prodi: "Informatika",
    },
  },
];

export default function Home({
  onPickUser,
}: {
  onPickUser: (u: UserLite) => void;
}) {
  // ---- state form
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // auto-suggest akun dari email
  const suggestedRole = useMemo(() => {
    const found = DUMMY_ACCOUNTS.find(
      (a) => a.email.toLowerCase() === email.toLowerCase()
    );
    return found?.user.role ?? null;
  }, [email]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    // simulasi cek kredensial dummy
    const found = DUMMY_ACCOUNTS.find(
      (a) => a.email.toLowerCase() === email.toLowerCase() && a.password === pw
    );
    await new Promise((r) => setTimeout(r, 450)); // animasi loading ringan

    setSubmitting(false);
    if (!found) {
      setError(
        "Email atau password salah. Coba: admin@uni.ac.id/admin123, dosen@uni.ac.id/dosen123, staff@uni.ac.id/staff123, mhs001@uni.ac.id/mhs123"
      );
      return;
    }

    // “remember me” dummy (opsional)
    try {
      if (remember)
        localStorage.setItem("siakad-ui-last-login", JSON.stringify({ email }));
      else localStorage.removeItem("siakad-ui-last-login");
    } catch {}

    onPickUser(found.user);
  }

  // muat email tersimpan (opsional)
  useMemo(() => {
    try {
      const raw = localStorage.getItem("siakad-ui-last-login");
      if (raw) {
        const { email: last } = JSON.parse(raw);
        if (last) setEmail(last);
      }
    } catch {}
    // jalankan sekali
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
