import { useEffect, useMemo, useState } from "react";
import {
  GraduationCap,
  ShieldCheck,
  User,
  Lock,
  Eye,
  EyeOff,
  AlertTriangle,
} from "lucide-react";

import { loginWithUsername } from "../lib/loginUsername";

export default function Home() {
  // ---- state form
  const [username, setUsername] = useState("");
  const [pw, setPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(true);

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // status info (biar jelas login sukses walau app.tsx belum pindah)
  const [info, setInfo] = useState<string | null>(null);

  const canSubmit = useMemo(() => {
    const u = username.trim();
    return u.length >= 3 && pw.trim().length >= 6 && !submitting;
  }, [username, pw, submitting]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;

    setError(null);
    setInfo(null);
    setSubmitting(true);

    const cleanUsername = username.trim().toLowerCase();

    try {
      const cred = await loginWithUsername(cleanUsername, pw);

      console.log("✅ LOGIN OK", {
        uid: cred.user.uid,
        email: cred.user.email,
      });

      setInfo(`Login sukses: ${cleanUsername} (uid: ${cred.user.uid})`);

      // remember username (opsional)
      try {
        if (remember) {
          localStorage.setItem(
            "siakad-ui-last-login",
            JSON.stringify({ username: cleanUsername })
          );
        } else {
          localStorage.removeItem("siakad-ui-last-login");
        }
      } catch {}

      // sukses login -> App.tsx akan otomatis pindah halaman
    } catch (err: any) {
      console.error("❌ LOGIN FAIL", err);

      // error bisa datang dari helper (username tidak ditemukan / mapping rusak / dll)
      const code = String(err?.code || "");
      let msg = "Login gagal. Coba lagi.";

      if (code.includes("auth/invalid-credential"))
        msg = "Username atau password salah.";
      else if (code.includes("auth/user-not-found"))
        msg = "Akun tidak ditemukan.";
      else if (code.includes("auth/wrong-password")) msg = "Password salah.";
      else if (code.includes("auth/too-many-requests"))
        msg = "Terlalu banyak percobaan. Coba lagi beberapa saat.";
      else if (code.includes("auth/network-request-failed"))
        msg = "Koneksi bermasalah. Coba cek internet.";
      else if (err?.message) msg = String(err.message);

      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  // muat username tersimpan (opsional)
  useEffect(() => {
    try {
      const raw = localStorage.getItem("siakad-ui-last-login");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.username) setUsername(parsed.username);
        // fallback lama (kalau sebelumnya kamu simpan email)
        if (!parsed?.username && parsed?.email)
          setUsername(String(parsed.email).split("@")[0]);
      }
    } catch {}
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Header */}
      <header className="border-b bg-white">
        <div className="max-w-5xl mx-auto px-5 py-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white grid place-items-center">
            <GraduationCap className="w-6 h-6" />
          </div>
          <div className="leading-tight">
            <p className="text-xs uppercase tracking-widest text-slate-500">
              Sistem Informasi Akademik
            </p>
            <h1 className="text-lg font-semibold">
              Universitas Nusantara — SIAKAD
            </h1>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-5xl mx-auto px-5 py-10 grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left info (simple) */}
        <section className="hidden lg:block">
          <div className="rounded-3xl border bg-white p-8">
            <h2 className="text-2xl font-semibold">
              Masuk cepat dengan{" "}
              <span className="text-indigo-600">Username</span>
            </h2>
            <p className="mt-3 text-slate-600">
              Admin mengisi email saat pembuatan akun, tapi pengguna cukup login
              pakai username saja.
            </p>

            <div className="mt-6 grid sm:grid-cols-3 gap-3">
              <MiniStat title="Aman" desc="Role-based access" />
              <MiniStat title="Simple" desc="Username login" />
              <MiniStat title="Rapi" desc="UI ringan & jelas" />
            </div>

            <div className="mt-6 text-sm text-slate-600">
              <div className="font-medium text-slate-800 mb-1">Contoh:</div>
              <ul className="list-disc ml-5 space-y-1">
                <li>
                  Username:{" "}
                  <code className="px-1 rounded bg-slate-100">admin</code>{" "}
                  Password:{" "}
                  <code className="px-1 rounded bg-slate-100">admin123</code>
                </li>
                <li>
                  Username:{" "}
                  <code className="px-1 rounded bg-slate-100">dosen</code>{" "}
                  Password:{" "}
                  <code className="px-1 rounded bg-slate-100">dosen123</code>
                </li>
                <li>
                  Username:{" "}
                  <code className="px-1 rounded bg-slate-100">staff</code>{" "}
                  Password:{" "}
                  <code className="px-1 rounded bg-slate-100">staff123</code>
                </li>
                <li>
                  Username:{" "}
                  <code className="px-1 rounded bg-slate-100">mhs001</code>{" "}
                  Password:{" "}
                  <code className="px-1 rounded bg-slate-100">mhs123</code>
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* Login Card */}
        <section>
          <div className="rounded-3xl border bg-white p-7 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-700 grid place-items-center">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-slate-500">
                  Portal Login
                </p>
                <h3 className="text-lg font-semibold">Masuk ke Akun Anda</h3>
              </div>
            </div>

            <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
              {/* Username */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Username
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                    <User className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-white border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/25"
                    placeholder="contoh: admin / dosen / staff / mhs001"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    autoComplete="username"
                  />
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  Username ini dicari di koleksi <code>usernames</code>.
                </p>
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Kata Sandi
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                    <Lock className="w-4 h-4" />
                  </span>

                  <input
                    type={showPw ? "text" : "password"}
                    className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-white border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/25"
                    placeholder="••••••••"
                    value={pw}
                    onChange={(e) => setPw(e.target.value)}
                    required
                    autoComplete="current-password"
                  />

                  <button
                    type="button"
                    onClick={() => setShowPw((s) => !s)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg hover:bg-slate-100"
                    aria-label="toggle password"
                  >
                    {showPw ? (
                      <EyeOff className="w-4 h-4 text-slate-600" />
                    ) : (
                      <Eye className="w-4 h-4 text-slate-600" />
                    )}
                  </button>
                </div>
              </div>

              {/* Remember */}
              <div className="flex items-center justify-between text-sm">
                <label className="inline-flex items-center gap-2 select-none text-slate-700">
                  <input
                    type="checkbox"
                    className="accent-indigo-600"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                  />
                  Ingat saya
                </label>
                <span className="text-slate-400">Lupa password?</span>
              </div>

              {/* Info / Error */}
              {info && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                  ✅ {info}
                </div>
              )}

              {error && (
                <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  <AlertTriangle className="w-4 h-4 mt-0.5" />
                  <p>{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={!canSubmit}
                className="w-full py-2.5 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60 font-medium transition"
              >
                {submitting ? "Memproses..." : "Masuk"}
              </button>

              {/* hint */}
              <div className="text-xs text-slate-500 leading-relaxed">
                <p>
                  Catatan: email tetap disimpan di Firestore <code>users</code>,
                  namun login menggunakan username.
                </p>
              </div>
            </form>
          </div>
        </section>
      </main>

      <footer className="px-5 pb-8">
        <div className="max-w-5xl mx-auto text-xs text-slate-400">
          © {new Date().getFullYear()} Universitas Nusantara • SIAKAD
        </div>
      </footer>
    </div>
  );
}

function MiniStat({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="rounded-2xl border bg-slate-50 p-4">
      <div className="text-sm font-medium text-slate-900">{title}</div>
      <div className="text-xs text-slate-600">{desc}</div>
    </div>
  );
}
