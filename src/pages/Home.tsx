import { useEffect, useMemo, useState } from "react";
import {
  ShieldCheck,
  User,
  Lock,
  Eye,
  EyeOff,
  AlertTriangle,
  Clock,
  Fingerprint,
  CheckCircle2,
  Sparkles,
} from "lucide-react";

import { loginWithUsername } from "../lib/loginUsername";

export default function Home() {
  const [username, setUsername] = useState("");
  const [pw, setPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(true);

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
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

      setInfo(`Login sukses: ${cleanUsername} (uid: ${cred.user.uid})`);

      if (remember) {
        localStorage.setItem(
          "siakad-ui-last-login",
          JSON.stringify({ username: cleanUsername })
        );
      } else {
        localStorage.removeItem("siakad-ui-last-login");
      }
    } catch (err: any) {
      const code = String(err?.code || "");
      let msg = "Login gagal. Coba lagi.";

      if (code.includes("auth/invalid-credential"))
        msg = "Username atau password salah.";
      else if (code.includes("auth/user-not-found"))
        msg = "Akun tidak ditemukan.";
      else if (code.includes("auth/wrong-password")) msg = "Password salah.";
      else if (code.includes("auth/too-many-requests"))
        msg = "Terlalu banyak percobaan. Coba lagi nanti.";
      else if (err?.message) msg = String(err.message);

      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  useEffect(() => {
    try {
      const raw = localStorage.getItem("siakad-ui-last-login");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.username) setUsername(parsed.username);
      }
    } catch {}
  }, []);

  // Tinggi elemen (biar hitungan presisi & no-scroll)
  const HEADER_H = 52; // px
  const FOOTER_H = 36; // px (footer fixed)

  return (
    <div
      className="
        min-h-screen text-slate-900
        font-sans antialiased
        overflow-hidden
        bg-[radial-gradient(70%_55%_at_12%_0%,rgba(99,102,241,0.12),transparent_60%),radial-gradient(65%_55%_at_88%_8%,rgba(56,189,248,0.12),transparent_60%),linear-gradient(to_bottom,#f8fafc,#ffffff)]
      "
    >
      {/* bg blobs */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute -top-28 -left-28 h-72 w-72 rounded-full bg-indigo-200/12 blur-3xl" />
        <div className="absolute top-24 -right-24 h-80 w-80 rounded-full bg-sky-200/12 blur-3xl" />
      </div>

      {/* HEADER */}
      <header className="sticky top-0 z-10 border-b border-slate-200/70 bg-white/75 backdrop-blur">
        <div className="w-full px-6"></div>
        <div className="max-w-7xl mx-auto h-[70px] flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative">
              <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white grid place-items-center shadow-sm">
                <Fingerprint className="w-5 h-5" />
              </div>
              <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 ring-2 ring-white" />
            </div>

            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-[0.22em] text-indigo-700 font-semibold">
                Sistem Absensi
              </p>
              <h1 className="text-[14px] sm:text-[15px] font-semibold truncate">
                Absensi Fakultas — Portal Login
              </h1>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-2 text-[12px] text-slate-700">
            <span className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-slate-50/80 px-3 py-1">
              <Clock className="w-4 h-4" />
              Realtime • Aman • Role-based
            </span>
          </div>
        </div>
      </header>

      {/* MAIN: tinggi = 100svh - header - footer, dan kasih padding bawah agar tidak ketiban footer */}
      <main
        className="max-w-6xl mx-auto px-5 flex items-center"
        style={{
          height: `calc(100svh - ${HEADER_H + FOOTER_H}px)`,
          paddingBottom: FOOTER_H,
        }}
      >
        <div className="w-full grid grid-cols-1 lg:grid-cols-2 gap-7 items-stretch">
          {/* LEFT */}
          <section className="lg:pr-1">
            <div className="relative h-full rounded-3xl border border-indigo-200/70 bg-indigo-50/30 backdrop-blur shadow-sm overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-100/25 via-white/18 to-sky-100/20" />
              <div className="absolute -top-16 -right-20 h-48 w-48 rounded-full bg-indigo-300/12 blur-2xl" />
              <div className="absolute -bottom-20 -left-24 h-56 w-56 rounded-full bg-sky-300/10 blur-2xl" />

              <div className="relative p-5">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-100/90 text-indigo-800 grid place-items-center ring-1 ring-indigo-200/70">
                    <ShieldCheck className="w-5 h-5" />
                  </div>

                  <div className="min-w-0">
                    <div className="inline-flex items-center gap-2 rounded-full bg-white/60 text-indigo-800 border border-indigo-200/60 px-3 py-1 text-[11px] font-semibold">
                      <Sparkles className="w-3.5 h-3.5" />
                      Portal Absensi Fakultas
                    </div>

                    <h2 className="mt-2.5 text-[18px] sm:text-[20px] font-semibold leading-snug">
                      Login cepat, rapi, dan siap dipakai operasional
                    </h2>

                    <p className="mt-2 text-slate-700/90 leading-relaxed text-[13px]">
                      Gunakan <span className="font-semibold">username</span>{" "}
                      untuk masuk. Sistem memetakan akun dan menerapkan akses
                      sesuai role.
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid sm:grid-cols-3 gap-3">
                  <FeatureCard
                    icon={<CheckCircle2 className="w-4 h-4" />}
                    title="Akses Terarah"
                    desc="Role-based access."
                  />
                  <FeatureCard
                    icon={<Fingerprint className="w-4 h-4" />}
                    title="Satu Identitas"
                    desc="Login pakai username."
                  />
                  <FeatureCard
                    icon={<Clock className="w-4 h-4" />}
                    title="Responsif"
                    desc="Mobile & desktop."
                  />
                </div>

                <div className="mt-4 rounded-2xl border border-slate-200/70 bg-slate-50/70 p-3.5">
                  <p className="text-[13px] font-semibold text-slate-900">
                    Tips singkat
                  </p>
                  <ul className="mt-1.5 text-[13px] text-slate-700 space-y-1 list-disc ml-5">
                    <li>Username min. 3 karakter.</li>
                    <li>Password min. 6 karakter.</li>
                    <li>
                      Centang <b>Ingat saya</b> untuk auto isi.
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </section>

          {/* RIGHT */}
          <section className="lg:pl-1">
            <div className="h-full rounded-3xl border border-slate-200/80 bg-slate-50/75 backdrop-blur shadow-sm overflow-hidden">
              <div className="h-2 w-full bg-gradient-to-r from-indigo-600 via-violet-600 to-sky-600" />

              <div className="p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-100/90 text-indigo-800 grid place-items-center ring-1 ring-indigo-200/70">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.20em] text-indigo-700 font-semibold">
                      Portal Login
                    </p>
                    <h3 className="text-[15px] sm:text-base font-semibold">
                      Masuk ke Akun Anda
                    </h3>
                  </div>
                </div>

                <form className="space-y-3" onSubmit={handleSubmit}>
                  <div>
                    <label className="text-[13px] font-medium text-slate-800">
                      Username
                    </label>
                    <div className="relative mt-1">
                      <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                      <input
                        className="
                          w-full pl-10 pr-3 py-2.5 rounded-2xl
                          border border-slate-200 bg-white/70 text-[14px]
                          focus:outline-none focus:ring-4 focus:ring-indigo-500/15 focus:border-indigo-300 transition
                        "
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="Masukkan username"
                        autoComplete="username"
                      />
                    </div>
                    <p className="mt-1 text-[12px] text-slate-600">
                      Username dicari di koleksi <code>usernames</code>.
                    </p>
                  </div>

                  <div>
                    <label className="text-[13px] font-medium text-slate-800">
                      Kata Sandi
                    </label>
                    <div className="relative mt-1">
                      <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                      <input
                        type={showPw ? "text" : "password"}
                        className="
                          w-full pl-10 pr-10 py-2.5 rounded-2xl
                          border border-slate-200 bg-white/70 text-[14px]
                          focus:outline-none focus:ring-4 focus:ring-indigo-500/15 focus:border-indigo-300 transition
                        "
                        value={pw}
                        onChange={(e) => setPw(e.target.value)}
                        placeholder="••••••••"
                        autoComplete="current-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPw(!showPw)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-xl hover:bg-slate-100/70 transition"
                        aria-label="toggle password"
                      >
                        {showPw ? (
                          <EyeOff className="w-4 h-4 text-slate-700" />
                        ) : (
                          <Eye className="w-4 h-4 text-slate-700" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="flex justify-between items-center text-[13px]">
                    <label className="flex items-center gap-2 text-slate-800 font-medium">
                      <input
                        type="checkbox"
                        checked={remember}
                        onChange={(e) => setRemember(e.target.checked)}
                        className="accent-indigo-600"
                      />
                      Ingat saya
                    </label>
                    <button
                      type="button"
                      className="text-indigo-700 hover:text-indigo-800 font-semibold"
                      onClick={() => {}}
                    >
                      Lupa password?
                    </button>
                  </div>

                  {info && (
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-2.5 text-[13px] text-emerald-800">
                      ✅ {info}
                    </div>
                  )}

                  {error && (
                    <div className="bg-red-50/80 border border-red-200 p-2.5 rounded-2xl text-[13px] text-red-700 flex gap-2">
                      <AlertTriangle className="w-4 h-4 mt-0.5" />
                      {error}
                    </div>
                  )}

                  <button
                    disabled={!canSubmit}
                    className="
                      w-full py-3 rounded-2xl text-white text-[14px] font-semibold transition
                      bg-gradient-to-r from-indigo-600 to-violet-600
                      hover:from-indigo-700 hover:to-violet-700
                      disabled:opacity-60 disabled:cursor-not-allowed
                      shadow-sm active:scale-[0.99]
                    "
                  >
                    {submitting ? "Memproses..." : "Masuk"}
                  </button>

                  <div className="text-[12px] text-slate-600 leading-relaxed">
                    Email disimpan di Firestore <code>users</code>, login
                    menggunakan username.
                  </div>
                </form>
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* FOOTER: fixed + tidak menambah tinggi halaman */}
      <footer
        className="fixed bottom-0 left-0 right-0 z-10 border-t border-slate-200/70 bg-white/70 backdrop-blur"
        style={{ height: FOOTER_H }}
      >
        <div className="h-full flex items-center justify-center text-[12px] text-slate-600">
          © {new Date().getFullYear()} Sistem Absensi Fakultas
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="rounded-2xl bg-slate-50/70 backdrop-blur border border-slate-200/70 p-3">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-xl bg-indigo-100/90 text-indigo-800 grid place-items-center ring-1 ring-indigo-200/70">
          {icon}
        </div>
        <p className="font-semibold text-slate-900 tracking-tight text-[13px]">
          {title}
        </p>
      </div>
      <p className="text-[12px] text-slate-700 mt-1 leading-relaxed">{desc}</p>
    </div>
  );
}
