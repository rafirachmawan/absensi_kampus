import { useEffect, useMemo, useState } from "react";
import Topbar from "../components/Topbar";
import {
  Plus,
  X,
  Trash2,
  Loader2,
  KeyRound,
  ShieldCheck,
  Pencil,
  Mail,
  Ban,
  CheckCircle2,
  User as UserIcon,
} from "lucide-react";
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
  getDoc,
} from "firebase/firestore";
import {
  createUserWithEmailAndPassword,
  signOut as signOutAuth,
  sendPasswordResetEmail,
} from "firebase/auth";
import { auth } from "../lib/firebase";

type Role = "dosen" | "karyawan" | "mahasiswa" | "superadmin";

type Civitas = {
  id: string;
  nama: string;
  email: string;
  role: Role;
  nidn?: string;
  fakultas?: string;
  prodi?: string;
  createdAt?: any;
  createdBy?: string;
  authUid?: string | null;
  loginActive?: boolean;
};

type UserRow = {
  id: string; // uid
  name: string;
  email: string;
  role: Role;
  fakultas?: string | null;
  prodi?: string | null;
  kelas?: string | null;
  nim?: string | null;
  createdAt?: any;
  createdBy?: string;

  // ✅ tambahan
  disabled?: boolean;
  disabledAt?: any;
  disabledBy?: string | null;

  // ✅ username login (opsi B)
  username?: string | null;
};

function cx(...a: Array<string | false | null | undefined>) {
  return a.filter(Boolean).join(" ");
}

function sanitizeUsername(raw: string) {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9._-]/g, ""); // aman untuk docId
}

function usernameFromEmail(email: string) {
  const left = String(email || "").split("@")[0] || "";
  return sanitizeUsername(left);
}

export default function SuperAdminPage({
  user,
  onLogout,
}: {
  user: UserLite;
  onLogout: () => void;
}) {
  /** =========================
   * A) MASTER CIVITAS (master_dosen)
   * ========================= */
  const [openAdd, setOpenAdd] = useState(false);

  const [items, setItems] = useState<Civitas[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [nama, setNama] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] =
    useState<Exclude<Role, "mahasiswa" | "superadmin">>("dosen");
  const [nidn, setNidn] = useState("");
  const [fakultas, setFakultas] = useState("");
  const [prodi, setProdi] = useState("");

  // ✅ username login (opsi B) -> default dari email sebelum @
  const [username, setUsername] = useState("");

  const [buatAkun, setBuatAkun] = useState(false);
  const [passwordAkun, setPasswordAkun] = useState("");

  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const canSubmit = useMemo(() => {
    const n = nama.trim();
    const e = email.trim().toLowerCase();
    const u = sanitizeUsername(username);
    const baseOk = n.length >= 3 && e.includes("@") && e.includes(".");
    if (!baseOk) return false;
    if (buatAkun) return passwordAkun.trim().length >= 6 && u.length >= 3;
    return true;
  }, [nama, email, buatAkun, passwordAkun, username]);

  // auto isi username saat email diubah (hanya kalau username masih kosong / sama seperti auto)
  useEffect(() => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail.includes("@")) return;
    const auto = usernameFromEmail(cleanEmail);
    // kalau user belum isi username manual, sync otomatis
    if (
      !username.trim() ||
      usernameFromEmail(cleanEmail) === sanitizeUsername(username)
    ) {
      setUsername(auto);
    }
  }, [email]); // eslint-disable-line

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

  function resetAddForm() {
    setNama("");
    setEmail("");
    setRole("dosen");
    setNidn("");
    setFakultas("");
    setProdi("");
    setUsername("");
    setBuatAkun(false);
    setPasswordAkun("");
    setFormError(null);
  }

  async function handleSaveMaster() {
    if (saving) return;
    setFormError(null);

    const cleanNama = nama.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanNidn = nidn.trim();
    const cleanFak = fakultas.trim();
    const cleanProdi = prodi.trim();
    const cleanPw = passwordAkun.trim();
    const cleanUsername = sanitizeUsername(
      username || usernameFromEmail(cleanEmail)
    );

    if (cleanNama.length < 3) return setFormError("Nama minimal 3 karakter.");
    if (!cleanEmail.includes("@")) return setFormError("Email tidak valid.");
    if (buatAkun) {
      if (cleanPw.length < 6)
        return setFormError("Password minimal 6 karakter.");
      if (cleanUsername.length < 3)
        return setFormError("Username minimal 3 karakter.");
    }

    try {
      setSaving(true);

      // 1) simpan master civitas
      const masterRef = await addDoc(collection(db, "master_dosen"), {
        nama: cleanNama,
        email: cleanEmail,
        role,
        nidn: role === "dosen" ? cleanNidn || null : null,
        fakultas: cleanFak || null,
        prodi: cleanProdi || null,
        createdAt: serverTimestamp(),
        createdBy: user.id,
        loginActive: false,
        authUid: null,
      });

      // 2) opsional buat akun login
      if (buatAkun) {
        // ✅ cek username unik (gratis, via Firestore)
        const unameRef = doc(db, "usernames", cleanUsername);
        const unameSnap = await getDoc(unameRef);
        if (unameSnap.exists()) {
          setFormError(
            `Username "${cleanUsername}" sudah dipakai. Ganti username.`
          );
          setSaving(false);
          return;
        }

        const secondaryAuth = createSecondaryAuth();
        const cred = await createUserWithEmailAndPassword(
          secondaryAuth,
          cleanEmail,
          cleanPw
        );
        const newUid = cred.user.uid;

        // ✅ users/{uid}
        await setDoc(doc(db, "users", newUid), {
          email: cleanEmail,
          name: cleanNama,
          role: role, // dosen | karyawan
          fakultas: cleanFak || null,
          prodi: cleanProdi || null,
          createdAt: serverTimestamp(),
          createdBy: user.id,

          // ✅ default aktif
          disabled: false,
          disabledAt: null,
          disabledBy: null,

          // ✅ username untuk login
          username: cleanUsername,
        });

        // ✅ usernames/{username} -> uid (dipakai login)
        await setDoc(doc(db, "usernames", cleanUsername), {
          uid: newUid,
          email: cleanEmail,
          createdAt: serverTimestamp(),
          createdBy: user.id,
        });

        // ✅ update master_dosen supaya sinkron
        await updateDoc(doc(db, "master_dosen", masterRef.id), {
          loginActive: true,
          authUid: newUid,
        });

        await signOutAuth(secondaryAuth);
      }

      setOpenAdd(false);
      resetAddForm();
      alert("✅ Berhasil disimpan.");
    } catch (e: any) {
      console.error("handleSaveMaster error:", e);
      const code = String(e?.code || "");
      if (code.includes("auth/email-already-in-use"))
        setFormError("Email sudah terdaftar di Firebase Auth.");
      else if (code.includes("auth/invalid-email"))
        setFormError("Format email tidak valid.");
      else if (code.includes("auth/weak-password"))
        setFormError("Password terlalu lemah (minimal 6 karakter).");
      else setFormError(e?.message || "Gagal menyimpan. Cek Firestore Rules.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteMaster(id: string) {
    const ok = confirm("Hapus data master ini dari Firestore?");
    if (!ok) return;

    try {
      await deleteDoc(doc(db, "master_dosen", id));
    } catch (e: any) {
      alert(e?.message || "Gagal hapus. Cek Firestore Rules.");
    }
  }

  /** =========================
   * B) USER MANAGEMENT (users)
   * ========================= */
  const [users, setUsers] = useState<UserRow[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersErr, setUsersErr] = useState<string | null>(null);

  const [openEdit, setOpenEdit] = useState(false);
  const [editUid, setEditUid] = useState<string>("");
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editRole, setEditRole] = useState<Role>("karyawan");
  const [editFak, setEditFak] = useState("");
  const [editProdi, setEditProdi] = useState("");
  const [editKelas, setEditKelas] = useState("");
  const [editNim, setEditNim] = useState("");

  // ✅ edit username
  const [editUsername, setEditUsername] = useState("");

  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // small loading per row
  const [busyUid, setBusyUid] = useState<string | null>(null);

  useEffect(() => {
    setUsersLoading(true);
    setUsersErr(null);

    const q = query(collection(db, "users"), orderBy("createdAt", "desc"));

    const unsub = onSnapshot(
      q,
      (snap) => {
        const rows: UserRow[] = snap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            name: data.name || "",
            email: data.email || "",
            role: (data.role as Role) || "karyawan",
            fakultas: data.fakultas ?? null,
            prodi: data.prodi ?? null,
            kelas: data.kelas ?? null,
            nim: data.nim ?? null,
            createdAt: data.createdAt,
            createdBy: data.createdBy,
            disabled: Boolean(data.disabled),
            disabledAt: data.disabledAt ?? null,
            disabledBy: data.disabledBy ?? null,
            username: data.username ?? null,
          };
        });
        setUsers(rows);
        setUsersLoading(false);
      },
      (err) => {
        console.error("users snapshot error:", err);
        setUsersErr(err?.message || "Gagal load users. Cek Firestore Rules.");
        setUsersLoading(false);
      }
    );

    return () => unsub();
  }, []);

  function openEditUser(u: UserRow) {
    setEditUid(u.id);
    setEditName(u.name || "");
    setEditEmail(u.email || "");
    setEditRole(u.role || "karyawan");
    setEditFak(String(u.fakultas ?? ""));
    setEditProdi(String(u.prodi ?? ""));
    setEditKelas(String(u.kelas ?? ""));
    setEditNim(String(u.nim ?? ""));
    setEditUsername(String(u.username ?? usernameFromEmail(u.email)));
    setEditError(null);
    setOpenEdit(true);
  }

  async function saveEditUser() {
    if (!editUid) return;

    const name = editName.trim();
    const email = editEmail.trim().toLowerCase();
    const uname = sanitizeUsername(editUsername);

    if (name.length < 3) return setEditError("Nama minimal 3 karakter.");
    if (!email.includes("@")) return setEditError("Email tidak valid.");
    if (uname.length < 3) return setEditError("Username minimal 3 karakter.");

    try {
      setEditSaving(true);
      setEditError(null);

      // ✅ handle ganti username: update mapping usernames/{username}
      const userRef = doc(db, "users", editUid);
      const currentSnap = await getDoc(userRef);
      const currentUsername = sanitizeUsername(
        String(currentSnap.data()?.username || "")
      );

      if (currentUsername && currentUsername !== uname) {
        // cek username baru tersedia
        const newRef = doc(db, "usernames", uname);
        const newSnap = await getDoc(newRef);
        if (newSnap.exists()) {
          setEditError(`Username "${uname}" sudah dipakai. Pilih yang lain.`);
          setEditSaving(false);
          return;
        }

        // buat mapping baru
        await setDoc(doc(db, "usernames", uname), {
          uid: editUid,
          email,
          createdAt: serverTimestamp(),
          createdBy: user.id,
        });

        // hapus mapping lama (kalau ada)
        try {
          await deleteDoc(doc(db, "usernames", currentUsername));
        } catch {}
      } else if (!currentUsername) {
        // kalau sebelumnya belum ada mapping, bikin
        const newRef = doc(db, "usernames", uname);
        const newSnap = await getDoc(newRef);
        if (!newSnap.exists()) {
          await setDoc(newRef, {
            uid: editUid,
            email,
            createdAt: serverTimestamp(),
            createdBy: user.id,
          });
        }
      }

      // ✅ update profile Firestore (ini yang dipakai App.tsx untuk routing)
      await updateDoc(doc(db, "users", editUid), {
        name,
        email,
        role: editRole,
        fakultas: editFak.trim() || null,
        prodi: editProdi.trim() || null,
        kelas: editKelas.trim() || null,
        nim: editNim.trim() || null,
        username: uname,
      });

      setOpenEdit(false);
      alert("✅ Profile user berhasil diupdate.");
    } catch (e: any) {
      console.error("saveEditUser error:", e);
      setEditError(e?.message || "Gagal update user. Cek Firestore Rules.");
    } finally {
      setEditSaving(false);
    }
  }

  async function doResetPassword(targetEmail: string) {
    const ok = confirm(`Kirim email reset password ke:\n${targetEmail}?`);
    if (!ok) return;

    try {
      await sendPasswordResetEmail(auth, targetEmail);
      alert("✅ Email reset password terkirim.");
    } catch (e: any) {
      alert(e?.message || "Gagal kirim reset password.");
    }
  }

  /** ✅ Disable/Aktifkan user (gratis) */
  async function toggleDisable(u: UserRow) {
    if (u.id === user.id) {
      alert("Tidak boleh menonaktifkan akun sendiri.");
      return;
    }

    const willDisable = !u.disabled;
    const ok = confirm(
      willDisable
        ? `Nonaktifkan akun ini?\n\n${u.name}\n${u.email}\n\nUser tidak bisa login/akses aplikasi.`
        : `Aktifkan kembali akun ini?\n\n${u.name}\n${u.email}`
    );
    if (!ok) return;

    try {
      setBusyUid(u.id);

      await updateDoc(doc(db, "users", u.id), {
        disabled: willDisable,
        disabledAt: willDisable ? serverTimestamp() : null,
        disabledBy: willDisable ? user.id : null,
      });

      alert(willDisable ? "✅ Akun dinonaktifkan." : "✅ Akun diaktifkan.");
    } catch (e: any) {
      console.error("toggleDisable error:", e);
      alert(e?.message || "Gagal ubah status akun.");
    } finally {
      setBusyUid(null);
    }
  }

  /** Opsional: hapus profile Firestore saja (Auth tetap ada) */
  async function deleteProfileOnly(u: UserRow) {
    if (u.id === user.id) {
      alert("Tidak boleh menghapus akun sendiri.");
      return;
    }

    const ok = confirm(
      `Hapus PROFIL Firestore user ini?\n\n${u.name}\n${u.email}\n\n⚠️ Catatan: akun Firebase Auth masih ada.\nJika user login, akan otomatis logout karena profile hilang.`
    );
    if (!ok) return;

    try {
      setBusyUid(u.id);

      // hapus username mapping juga biar rapi
      const uname = sanitizeUsername(String(u.username || ""));
      if (uname) {
        try {
          await deleteDoc(doc(db, "usernames", uname));
        } catch {}
      }

      await deleteDoc(doc(db, "users", u.id));
      alert("✅ Profil Firestore terhapus.");
    } catch (e: any) {
      console.error("deleteProfileOnly error:", e);
      alert(e?.message || "Gagal hapus profil.");
    } finally {
      setBusyUid(null);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Topbar name={user.name} role={user.role} onLogout={onLogout} />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 grid gap-6">
        {/* ===== USERS ===== */}
        <section className="rounded-2xl border bg-white p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold">Manajemen Akun Login</h2>
              <p className="text-sm text-slate-600 mt-1">
                Aksi cepat: <b>Edit</b>, <b>Reset Password</b>,{" "}
                <b>Disable/Aktifkan</b>. (Mode gratis: disable adalah “hapus
                paling aman”.)
              </p>
            </div>
          </div>

          <div className="mt-5">
            {usersLoading ? (
              <div className="text-sm text-slate-500 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Memuat users...
              </div>
            ) : usersErr ? (
              <div className="text-sm text-red-600">{usersErr}</div>
            ) : users.length === 0 ? (
              <div className="text-sm text-slate-500">Belum ada user.</div>
            ) : (
              <div className="grid gap-3">
                {users.map((u) => {
                  const busy = busyUid === u.id;
                  const uname = u.username || usernameFromEmail(u.email);
                  return (
                    <div
                      key={u.id}
                      className={cx(
                        "rounded-xl border p-4 flex flex-col sm:flex-row sm:items-center gap-3",
                        u.disabled && "bg-slate-50"
                      )}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className="font-semibold truncate">{u.name}</div>

                          <span className="text-xs px-2 py-0.5 rounded-full border bg-white text-slate-700">
                            {String(u.role).toUpperCase()}
                          </span>

                          {u.disabled ? (
                            <span className="text-xs px-2 py-0.5 rounded-full border border-red-200 bg-red-50 text-red-700 inline-flex items-center gap-1">
                              <Ban className="w-3 h-3" />
                              DISABLED
                            </span>
                          ) : (
                            <span className="text-xs px-2 py-0.5 rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700 inline-flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              ACTIVE
                            </span>
                          )}
                        </div>

                        <div className="text-sm text-slate-600 truncate mt-1">
                          {u.email}
                        </div>

                        <div className="mt-1 text-xs text-slate-500 flex flex-wrap gap-x-3 gap-y-1">
                          <span>
                            UID: <span className="text-slate-400">{u.id}</span>
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <UserIcon className="w-3.5 h-3.5 text-slate-400" />
                            Username:{" "}
                            <span className="font-medium text-slate-700">
                              {uname}
                            </span>
                          </span>
                          {u.fakultas ? (
                            <span>Fakultas: {u.fakultas}</span>
                          ) : null}
                          {u.prodi ? <span>Prodi: {u.prodi}</span> : null}
                          {u.kelas ? <span>Kelas: {u.kelas}</span> : null}
                          {u.nim ? <span>NIM: {u.nim}</span> : null}
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 justify-end">
                        <button
                          onClick={() => openEditUser(u)}
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border hover:bg-slate-50 text-slate-700"
                        >
                          <Pencil className="w-4 h-4" />
                          Edit
                        </button>

                        <button
                          onClick={() => doResetPassword(u.email)}
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border hover:bg-slate-50 text-slate-700"
                        >
                          <Mail className="w-4 h-4" />
                          Reset PW
                        </button>

                        <button
                          onClick={() => toggleDisable(u)}
                          disabled={busy}
                          className={cx(
                            "inline-flex items-center gap-2 px-3 py-2 rounded-lg border",
                            u.disabled
                              ? "border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                              : "border-red-200 text-red-700 hover:bg-red-50",
                            busy && "opacity-60"
                          )}
                        >
                          {busy ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : u.disabled ? (
                            <CheckCircle2 className="w-4 h-4" />
                          ) : (
                            <Ban className="w-4 h-4" />
                          )}
                          {u.disabled ? "Aktifkan" : "Disable"}
                        </button>

                        <button
                          onClick={() => deleteProfileOnly(u)}
                          disabled={busy}
                          className={cx(
                            "inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50",
                            busy && "opacity-60"
                          )}
                          title="Hapus profil Firestore saja (Auth tetap ada)"
                        >
                          <Trash2 className="w-4 h-4" />
                          Hapus Profil
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* ===== MASTER CIVITAS ===== */}
        <section className="rounded-2xl border bg-white p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold">Master Civitas</h2>
              <p className="text-sm text-slate-600 mt-1">
                Data master + opsional buat akun login.
              </p>
            </div>

            <button
              onClick={() => {
                resetAddForm();
                setOpenAdd(true);
              }}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-purple-600 text-white hover:bg-purple-700"
            >
              <Plus className="w-4 h-4" />
              Tambah
            </button>
          </div>

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
              <div className="grid gap-3">
                {items.map((d) => (
                  <div
                    key={d.id}
                    className="rounded-xl border p-4 flex items-start gap-3"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="font-semibold truncate">{d.nama}</div>
                        <span className="text-xs px-2 py-0.5 rounded-full border bg-white text-slate-700">
                          {String(d.role).toUpperCase()}
                        </span>

                        {d.loginActive && (
                          <span className="text-xs px-2 py-0.5 rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700 inline-flex items-center gap-1">
                            <ShieldCheck className="w-3 h-3" />
                            Akun Login Aktif
                          </span>
                        )}
                      </div>

                      <div className="text-sm text-slate-600 truncate mt-1">
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
                      onClick={() => handleDeleteMaster(d.id)}
                      className="shrink-0 inline-flex items-center gap-2 px-3 py-2 rounded-lg border hover:bg-slate-50 text-slate-700"
                    >
                      <Trash2 className="w-4 h-4" />
                      Hapus
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* ===== CATATAN ===== */}
        <section className="rounded-2xl border bg-white p-5">
          <h2 className="font-semibold">Catatan</h2>
          <div className="text-sm text-slate-600 mt-2 leading-relaxed">
            - Mode gratis: <b>Disable</b> adalah cara terbaik untuk “menghapus
            akses” user.
            <br />
            - User disabled akan otomatis logout saat mencoba login (di
            App.tsx).
            <br />- Tombol <b>Hapus Profil</b> hanya menghapus dokumen
            Firestore, akun Auth tetap ada.
            <br />- Login username memakai koleksi <code>usernames</code>.
          </div>
        </section>
      </main>

      {/* ===== MODAL ADD MASTER ===== */}
      {openAdd && (
        <div className="fixed inset-0 z-50 bg-black/40 p-4">
          <div className="h-full grid place-items-center">
            <div className="w-full max-w-lg rounded-2xl bg-white border shadow-xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b">
                <div>
                  <div className="font-semibold">Tambah Civitas</div>
                  <div className="text-xs text-slate-500">
                    Simpan ke <code>master_dosen</code> (opsional buat akun
                    login)
                  </div>
                </div>
                <button
                  onClick={() => setOpenAdd(false)}
                  className="p-2 rounded-lg hover:bg-slate-100"
                  aria-label="close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

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

                {/* ✅ Username login */}
                <Field label="Username Login (untuk masuk nanti)">
                  <input
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                    placeholder="contoh: budi / dosen01 / staff1"
                  />
                  <div className="mt-1 text-xs text-slate-500">
                    Default diambil dari email sebelum @. Username harus unik.
                  </div>
                </Field>

                <Field label="Role">
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl border bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                  >
                    <option value="dosen">Dosen</option>
                    <option value="karyawan">Karyawan</option>
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
              </div>

              <div className="px-5 py-4 border-t flex items-center justify-end gap-2 bg-white">
                <button
                  onClick={() => setOpenAdd(false)}
                  className="px-3 py-2 rounded-xl border hover:bg-slate-50"
                  disabled={saving}
                >
                  Batal
                </button>

                <button
                  onClick={handleSaveMaster}
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

      {/* ===== MODAL EDIT USER ===== */}
      {openEdit && (
        <div className="fixed inset-0 z-50 bg-black/40 p-4">
          <div className="h-full grid place-items-center">
            <div className="w-full max-w-lg rounded-2xl bg-white border shadow-xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b">
                <div>
                  <div className="font-semibold">Edit User</div>
                  <div className="text-xs text-slate-500">
                    Update profile di <code>users/{editUid}</code>
                  </div>
                </div>
                <button
                  onClick={() => setOpenEdit(false)}
                  className="p-2 rounded-lg hover:bg-slate-100"
                  aria-label="close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="max-h-[70vh] overflow-y-auto px-5 py-4 grid gap-3">
                <Field label="Nama">
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                    placeholder="Nama"
                  />
                </Field>

                <Field label="Email (profile)">
                  <input
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                    placeholder="email@uni.ac.id"
                  />
                  <div className="mt-1 text-xs text-slate-500">
                    Ini mengubah email di dokumen Firestore (profile), bukan
                    email login Auth.
                  </div>
                </Field>

                {/* ✅ Username edit */}
                <Field label="Username Login">
                  <input
                    value={editUsername}
                    onChange={(e) => setEditUsername(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                    placeholder="contoh: admin / dosen01 / staff1"
                  />
                  <div className="mt-1 text-xs text-slate-500">
                    Jika username diubah, mapping <code>usernames</code> juga
                    diupdate otomatis.
                  </div>
                </Field>

                <Field label="Role">
                  <select
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value as Role)}
                    className="w-full px-3 py-2 rounded-xl border bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                  >
                    <option value="dosen">Dosen</option>
                    <option value="karyawan">Karyawan</option>
                    <option value="mahasiswa">Mahasiswa</option>
                    <option value="superadmin">SuperAdmin</option>
                  </select>
                </Field>

                <div className="grid sm:grid-cols-2 gap-3">
                  <Field label="Fakultas">
                    <input
                      value={editFak}
                      onChange={(e) => setEditFak(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                      placeholder="TI / FEB / FKIP"
                    />
                  </Field>
                  <Field label="Prodi">
                    <input
                      value={editProdi}
                      onChange={(e) => setEditProdi(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                      placeholder="Informatika"
                    />
                  </Field>
                </div>

                <div className="grid sm:grid-cols-2 gap-3">
                  <Field label="Kelas">
                    <input
                      value={editKelas}
                      onChange={(e) => setEditKelas(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                      placeholder="IF-1A"
                    />
                  </Field>
                  <Field label="NIM">
                    <input
                      value={editNim}
                      onChange={(e) => setEditNim(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                      placeholder="231234567"
                    />
                  </Field>
                </div>

                <div className="rounded-2xl border bg-slate-50 p-3">
                  <div className="text-sm font-medium text-slate-800 mb-2">
                    Aksi Password
                  </div>
                  <button
                    onClick={() => doResetPassword(editEmail)}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border bg-white hover:bg-slate-50"
                  >
                    <KeyRound className="w-4 h-4" />
                    Kirim Email Reset Password
                  </button>
                  <div className="mt-2 text-xs text-slate-500">
                    Mode gratis: reset password via email adalah cara aman.
                  </div>
                </div>

                {editError && (
                  <div className="text-sm text-red-600">{editError}</div>
                )}
              </div>

              <div className="px-5 py-4 border-t flex items-center justify-end gap-2 bg-white">
                <button
                  onClick={() => setOpenEdit(false)}
                  className="px-3 py-2 rounded-xl border hover:bg-slate-50"
                  disabled={editSaving}
                >
                  Batal
                </button>

                <button
                  onClick={saveEditUser}
                  disabled={editSaving}
                  className="px-4 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60 inline-flex items-center gap-2"
                >
                  {editSaving && <Loader2 className="w-4 h-4 animate-spin" />}
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
