import { useEffect, useMemo, useState } from "react";
import Topbar from "../components/Topbar";
import { Plus, X, Trash2, Loader2, KeyRound, ShieldCheck } from "lucide-react";
import type { UserLite } from "../types";

import { db, createSecondaryAuth } from "../lib/firebase";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  setDoc,
} from "firebase/firestore";
import {
  createUserWithEmailAndPassword,
  signOut as signOutAuth,
} from "firebase/auth";

type Role = "dosen" | "karyawan";

type Civitas = {
  id: string;
  nama: string;
  email: string;
  role: Role;
  nidn?: string; // khusus dosen (opsional)
  fakultas?: string;
  prodi?: string;
  createdAt?: any;
  createdBy?: string;

  // status akun login
  authUid?: string | null;
  loginActive?: boolean;
};

export default function SuperAdminPage({
  user,
  onLogout,
}: {
  user: UserLite;
  onLogout: () => void;
}) {
  // ====== modal
  const [open, setOpen] = useState(false);

  // ====== list
  const [items, setItems] = useState<Civitas[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  // ====== form master
  const [nama, setNama] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("dosen");
  const [nidn, setNidn] = useState("");
  const [fakultas, setFakultas] = useState("");
  const [prodi, setProdi] = useState("");

  // ====== form akun login
  const [buatAkun, setBuatAkun] = useState(false);
  const [passwordAkun, setPasswordAkun] = useState("");

  // ====== status
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<string | null>(null);

  const canSubmit = useMemo(() => {
    const n = nama.trim();
    const e = email.trim().toLowerCase();
    const baseOk = n.length >= 3 && e.includes("@") && e.includes(".");
    if (!baseOk) return false;

    if (buatAkun) {
      return passwordAkun.trim().length >= 6; // firebase minimal 6
    }
    return true;
  }, [nama, email, buatAkun, passwordAkun]);

  // ====== realtime load (koleksi tetap master_dosen agar gak ubah rules & struktur banyak)
  useEffect(() => {
    setLoadingList(true);
    setListError(null);

    const q = query(
      collection(db, "master_dosen"),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const rows: Civitas[] = snap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            nama: data.nama || "",
            email: data.email || "",
            role: (data.role as Role) || "dosen",
            nidn: data.nidn || "",
            fakultas: data.fakultas || "",
            prodi: data.prodi || "",
            createdAt: data.createdAt,
            createdBy: data.createdBy,
            authUid: data.authUid ?? null,
            loginActive: Boolean(data.loginActive),
          };
        });

        setItems(rows);
        setLoadingList(false);
      },
      (err) => {
        console.error("onSnapshot master_dosen error:", err);
        setListError(err?.message || "Gagal memuat data. Cek Firestore Rules.");
        setLoadingList(false);
      }
    );

    return () => unsub();
  }, []);

  function resetForm() {
    setNama("");
    setEmail("");
    setRole("dosen");
    setNidn("");
    setFakultas("");
    setProdi("");

    setBuatAkun(false);
    setPasswordAkun("");

    setFormError(null);
    setSuccessInfo(null);
  }

  async function handleSave() {
    if (saving) return;
    setFormError(null);
    setSuccessInfo(null);

    const cleanNama = nama.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanNidn = nidn.trim();
    const cleanFak = fakultas.trim();
    const cleanProdi = prodi.trim();
    const cleanPw = passwordAkun.trim();

    if (!cleanNama || cleanNama.length < 3) {
      setFormError("Nama minimal 3 karakter.");
      return;
    }
    if (!cleanEmail.includes("@")) {
      setFormError("Email tidak valid.");
      return;
    }
    if (buatAkun && cleanPw.length < 6) {
      setFormError("Password minimal 6 karakter.");
      return;
    }

    try {
      setSaving(true);

      // 1) simpan master civitas ke Firestore (koleksi master_dosen)
      const masterRef = await addDoc(collection(db, "master_dosen"), {
        nama: cleanNama,
        email: cleanEmail,
        role,
        nidn: role === "dosen" ? cleanNidn || null : null, // hanya relevan untuk dosen
        fakultas: cleanFak || null,
        prodi: cleanProdi || null,
        createdAt: serverTimestamp(),
        createdBy: user.id,

        // default status akun
        loginActive: false,
        authUid: null,
      });

      // 2) opsional buat akun login
      if (buatAkun) {
        // ✅ buat user auth memakai secondary app auth supaya sesi superadmin tidak terganggu
        const secondaryAuth = createSecondaryAuth();

        const cred = await createUserWithEmailAndPassword(
          secondaryAuth,
          cleanEmail,
          cleanPw
        );

        const newUid = cred.user.uid;

        // buat profile user untuk routing app
        await setDoc(doc(db, "users", newUid), {
          email: cleanEmail,
          name: cleanNama,
          role: role, // dosen | karyawan | mahasiswa
          fakultas: cleanFak || null,
          prodi: cleanProdi || null,
          createdAt: serverTimestamp(),
          createdBy: user.id,
        });

        // update master civitas -> login aktif
        await updateDoc(doc(db, "master_dosen", masterRef.id), {
          loginActive: true,
          authUid: newUid,
        });

        // signout secondary auth (rapih)
        await signOutAuth(secondaryAuth);

        setSuccessInfo(
          `✅ Berhasil tersimpan.\nAkun login dibuat:\nEmail: ${cleanEmail}\nRole: ${role}\nUID: ${newUid}\n\nCatat password manual yang kamu input (tidak disimpan di database).`
        );
      } else {
        setSuccessInfo("✅ Berhasil tersimpan (tanpa membuat akun login).");
      }

      // tutup modal setelah sukses (kalau kamu ingin tetap buka untuk lihat pesan sukses, comment baris ini)
      setOpen(false);
      resetForm();
    } catch (e: any) {
      console.error("handleSave error:", e);

      const code = String(e?.code || "");
      if (code.includes("auth/email-already-in-use")) {
        setFormError("Email sudah terdaftar di Firebase Auth.");
      } else if (code.includes("auth/invalid-email")) {
        setFormError("Format email tidak valid.");
      } else if (code.includes("auth/weak-password")) {
        setFormError("Password terlalu lemah (minimal 6 karakter).");
      } else {
        setFormError(
          e?.message ||
            "Gagal menyimpan. Cek Firestore Rules & pastikan login superadmin."
        );
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    const ok = confirm(
      "Hapus data ini dari Firestore?\nCatatan: ini tidak menghapus akun Firebase Auth (jika sudah dibuat)."
    );
    if (!ok) return;

    try {
      await deleteDoc(doc(db, "master_dosen", id));
    } catch (e: any) {
      alert(e?.message || "Gagal hapus. Cek Firestore Rules.");
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Topbar name={user.name} role={user.role} onLogout={onLogout} />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 grid gap-6 sm:grid-cols-2">
        {/* ====== Master Civitas (koleksi master_dosen) */}
        <div className="rounded-2xl border bg-white p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold mb-1">Master Civitas</h2>
              <p className="text-sm text-slate-600">
                Tambah data (tersimpan ke Firestore). Opsional buat akun login
                dengan role.
              </p>
            </div>

            <button
              onClick={() => {
                resetForm();
                setOpen(true);
              }}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-purple-600 text-white hover:bg-purple-700"
            >
              <Plus className="w-4 h-4" /> Tambah
            </button>
          </div>

          {/* list */}
          <div className="mt-5">
            {loadingList ? (
              <div className="text-sm text-slate-500 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Memuat data...
              </div>
            ) : listError ? (
              <div className="text-sm text-red-600">{listError}</div>
            ) : items.length === 0 ? (
              <div className="text-sm text-slate-500">Belum ada data.</div>
            ) : (
              <div className="divide-y">
                {items.map((d) => (
                  <div key={d.id} className="py-3 flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="font-medium truncate">{d.nama}</div>

                        <span className="text-xs px-2 py-0.5 rounded-full border bg-slate-50 text-slate-700">
                          {String(d.role).toUpperCase()}
                        </span>

                        {d.loginActive && (
                          <span className="text-xs px-2 py-0.5 rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700 inline-flex items-center gap-1">
                            <ShieldCheck className="w-3 h-3" />
                            Akun Login Aktif
                          </span>
                        )}
                      </div>

                      <div className="text-sm text-slate-600 truncate">
                        {d.email}
                      </div>

                      {(d.nidn || d.fakultas || d.prodi) && (
                        <div className="mt-1 text-xs text-slate-500">
                          {d.role === "dosen" && d.nidn
                            ? `NIDN: ${d.nidn}`
                            : ""}
                          {d.fakultas ? ` • Fakultas: ${d.fakultas}` : ""}
                          {d.prodi ? ` • Prodi: ${d.prodi}` : ""}
                        </div>
                      )}

                      {d.authUid && (
                        <div className="mt-1 text-xs text-slate-400">
                          authUid: {d.authUid}
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => handleDelete(d.id)}
                      className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border hover:bg-slate-50 text-slate-700"
                      title="Hapus"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span className="text-sm">Hapus</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* kanan info */}
        <div className="rounded-2xl border bg-white p-5">
          <h2 className="font-semibold mb-2">Catatan</h2>
          <p className="text-sm text-slate-600">
            Opsi 2 (tanpa Cloud Function) membuat akun login memakai secondary
            Firebase Auth agar sesi SuperAdmin tidak terganggu.
          </p>
          <div className="mt-4 text-sm text-slate-500">
            ⚠️ Tanpa Cloud Function, kamu tidak bisa hapus akun Auth user dari
            UI. Hapus akun Auth harus lewat Firebase Console.
          </div>
        </div>
      </main>

      {/* ====== MODAL (scroll + footer) */}
      {open && (
        <div className="fixed inset-0 z-50 bg-black/40 p-4">
          <div className="h-full grid place-items-center">
            <div className="w-full max-w-lg rounded-2xl bg-white border shadow-xl overflow-hidden">
              {/* header */}
              <div className="flex items-center justify-between px-5 py-4 border-b">
                <div>
                  <div className="font-semibold">Tambah Civitas</div>
                  <div className="text-xs text-slate-500">
                    Simpan ke Firestore: <code>master_dosen</code> (dan opsional
                    buat akun login)
                  </div>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  className="p-2 rounded-lg hover:bg-slate-100"
                  aria-label="close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* body */}
              <div className="max-h-[70vh] overflow-y-auto px-5 py-4 grid gap-3">
                <Field label="Nama">
                  <input
                    value={nama}
                    onChange={(e) => setNama(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                    placeholder="Contoh: Budi Santoso"
                  />
                </Field>

                <Field label="Email">
                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                    placeholder="budi@uni.ac.id"
                  />
                </Field>

                <Field label="Role">
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as Role)}
                    className="w-full px-3 py-2 rounded-xl border bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                  >
                    <option value="karyawan">Karyawan</option>
                    <option value="mahasiswa">Mahasiswa</option>
                  </select>
                </Field>

                <div className="grid sm:grid-cols-2 gap-3">
                  <Field
                    label={`NIDN (opsional) ${
                      role !== "dosen" ? "(hanya dosen)" : ""
                    }`}
                  >
                    <input
                      value={nidn}
                      onChange={(e) => setNidn(e.target.value)}
                      disabled={role !== "dosen"}
                      className="w-full px-3 py-2 rounded-xl border focus:outline-none focus:ring-2 focus:ring-purple-500/30 disabled:bg-slate-100"
                      placeholder="1234567890"
                    />
                  </Field>

                  <Field label="Fakultas (opsional)">
                    <input
                      value={fakultas}
                      onChange={(e) => setFakultas(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                      placeholder="FT / FEB / FKIP"
                    />
                  </Field>
                </div>

                <Field label="Prodi (opsional)">
                  <input
                    value={prodi}
                    onChange={(e) => setProdi(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                    placeholder="Informatika"
                  />
                </Field>

                {/* akun login */}
                <div className="rounded-2xl border bg-slate-50 p-3">
                  <label className="inline-flex items-center gap-2 text-sm font-medium">
                    <input
                      type="checkbox"
                      checked={buatAkun}
                      onChange={(e) => setBuatAkun(e.target.checked)}
                    />
                    Buat akun login
                  </label>

                  {buatAkun && (
                    <div className="mt-3">
                      <div className="text-sm font-medium text-slate-700 mb-1 inline-flex items-center gap-2">
                        <KeyRound className="w-4 h-4" />
                        Password (manual oleh SuperAdmin)
                      </div>
                      <input
                        value={passwordAkun}
                        onChange={(e) => setPasswordAkun(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                        placeholder="Minimal 6 karakter"
                      />
                      <div className="mt-1 text-xs text-slate-500">
                        Catat password ini. Sistem tidak menyimpan password.
                      </div>
                    </div>
                  )}
                </div>

                {formError && (
                  <div className="text-sm text-red-600">{formError}</div>
                )}

                {successInfo && (
                  <div className="text-sm whitespace-pre-line rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-emerald-800">
                    {successInfo}
                  </div>
                )}
              </div>

              {/* footer */}
              <div className="px-5 py-4 border-t flex items-center justify-end gap-2 bg-white">
                <button
                  onClick={() => setOpen(false)}
                  className="px-3 py-2 rounded-xl border hover:bg-slate-50"
                  disabled={saving}
                >
                  Batal
                </button>

                <button
                  onClick={handleSave}
                  disabled={!canSubmit || saving}
                  className="px-4 py-2 rounded-xl bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-60 inline-flex items-center gap-2"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  Simpan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
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
