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
  LayoutDashboard,
  Users,
  Database,
  FileSpreadsheet,
  LogOut,
  MapPin,
  Crosshair,
  ExternalLink,
} from "lucide-react";
import type { UserLite } from "../types";

import { db, createSecondaryAuth, auth } from "../lib/firebase";
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
  where,
  limit,
} from "firebase/firestore";
import {
  createUserWithEmailAndPassword,
  signOut as signOutAuth,
  sendPasswordResetEmail,
} from "firebase/auth";

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

  disabled?: boolean;
  disabledAt?: any;
  disabledBy?: string | null;

  username?: string | null;
};

// ✅ tambah menu "rekap"
type MenuKey = "dashboard" | "users" | "master" | "rekap" | "catatan";

function cx(...a: Array<string | false | null | undefined>) {
  return a.filter(Boolean).join(" ");
}

function sanitizeUsername(raw: string) {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9._-]/g, "");
}

function usernameFromEmail(email: string) {
  const left = String(email || "").split("@")[0] || "";
  return sanitizeUsername(left);
}

/** =========================
 *  Rekap Absensi (sidebar menu)
 *  ========================= */
type AttRow = {
  id: string;
  uid: string;
  role?: Role | string;
  tanggalISO: string;
  checkInAt?: any;
  checkOutAt?: any;

  // model yang kamu pakai sekarang (single lokasi)
  fotoDataUrl?: string | null;
  lokasi?: { lat: number; lng: number; accuracy?: number | null } | null;

  // model opsional kalau nanti ada pisah in/out
  fotoIn?: string | null;
  fotoOut?: string | null;
  lokasiIn?: {
    lat: number | null;
    lng: number | null;
    accuracy?: number | null;
  } | null;
  lokasiOut?: {
    lat: number | null;
    lng: number | null;
    accuracy?: number | null;
  } | null;
};

function tsToHHMM(ts: any) {
  try {
    const d: Date =
      typeof ts?.toDate === "function" ? ts.toDate() : new Date(ts);
    if (isNaN(d.getTime())) return "-";
    return d.toTimeString().slice(0, 5);
  } catch {
    return "-";
  }
}

function formatCoords(lat?: number | null, lng?: number | null) {
  if (typeof lat !== "number" || typeof lng !== "number") return "-";
  return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
}
function mapsUrl(lat?: number | null, lng?: number | null) {
  if (typeof lat !== "number" || typeof lng !== "number") return "";
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

/** Sidebar item kecil */
function SideItem({
  icon,
  label,
  active = false,
  danger = false,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  danger?: boolean;
  onClick?: () => void;
}) {
  const base =
    "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition select-none border";
  const cls = danger
    ? cx(
        base,
        "text-red-700 hover:bg-red-50 border-transparent",
        active && "bg-red-50 border-red-100"
      )
    : cx(
        base,
        "text-slate-700 hover:bg-slate-100 border-transparent",
        active && "bg-indigo-50 text-indigo-700 border-indigo-100"
      );

  return (
    <button type="button" onClick={onClick} className={cls}>
      <span className="shrink-0">{icon}</span>
      <span className="truncate">{label}</span>
    </button>
  );
}

export default function SuperAdminPage({
  user,
  onLogout,
}: {
  user: UserLite;
  onLogout: () => void;
}) {
  /** =========================
   * UI: menu aktif
   * ========================= */
  const [activeMenu, setActiveMenu] = useState<MenuKey>("users");

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

  useEffect(() => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail.includes("@")) return;
    const auto = usernameFromEmail(cleanEmail);
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

      if (buatAkun) {
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

        await setDoc(doc(db, "users", newUid), {
          email: cleanEmail,
          name: cleanNama,
          role: role,
          fakultas: cleanFak || null,
          prodi: cleanProdi || null,
          createdAt: serverTimestamp(),
          createdBy: user.id,

          disabled: false,
          disabledAt: null,
          disabledBy: null,

          username: cleanUsername,
        });

        await setDoc(doc(db, "usernames", cleanUsername), {
          uid: newUid,
          email: cleanEmail,
          createdAt: serverTimestamp(),
          createdBy: user.id,
        });

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

  const [editUsername, setEditUsername] = useState("");

  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [busyUid, setBusyUid] = useState<string | null>(null);

  // ✅ untuk rekap absensi: pilih user
  const [selectedUid, setSelectedUid] = useState<string>("");

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

      const userRef = doc(db, "users", editUid);
      const currentSnap = await getDoc(userRef);
      const currentUsername = sanitizeUsername(
        String(currentSnap.data()?.username || "")
      );

      if (currentUsername && currentUsername !== uname) {
        const newRef = doc(db, "usernames", uname);
        const newSnap = await getDoc(newRef);
        if (newSnap.exists()) {
          setEditError(`Username "${uname}" sudah dipakai. Pilih yang lain.`);
          setEditSaving(false);
          return;
        }

        await setDoc(doc(db, "usernames", uname), {
          uid: editUid,
          email,
          createdAt: serverTimestamp(),
          createdBy: user.id,
        });

        try {
          await deleteDoc(doc(db, "usernames", currentUsername));
        } catch {}
      } else if (!currentUsername) {
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
    <div className="min-h-screen font-sans text-slate-900 bg-slate-50">
      {/* ===== LAYOUT: SIDEBAR + CONTENT ===== */}
      <div className="flex min-h-screen">
        {/* SIDEBAR */}
        <aside className="hidden md:flex w-64 shrink-0 border-r bg-white">
          <div className="w-full flex flex-col p-4">
            {/* Logo/Brand */}
            <div className="flex items-center gap-3 px-2 py-2">
              <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white grid place-items-center">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div className="leading-tight">
                <div className="font-semibold">ABSENSI</div>
                <div className="text-xs text-slate-500">FAKULTAS</div>
              </div>
            </div>

            {/* Menu */}
            <nav className="mt-5 grid gap-1">
              <SideItem
                icon={<LayoutDashboard className="w-4 h-4" />}
                label="Dashboard"
                active={activeMenu === "dashboard"}
                onClick={() => setActiveMenu("dashboard")}
              />
              <SideItem
                icon={<Users className="w-4 h-4" />}
                label="Manajemen Akun"
                active={activeMenu === "users"}
                onClick={() => setActiveMenu("users")}
              />
              <SideItem
                icon={<Database className="w-4 h-4" />}
                label="Master Civitas"
                active={activeMenu === "master"}
                onClick={() => setActiveMenu("master")}
              />

              {/* ✅ Rekap Absensi di atas Catatan */}
              <SideItem
                icon={<FileSpreadsheet className="w-4 h-4" />}
                label="Rekap Absensi"
                active={activeMenu === "rekap"}
                onClick={() => setActiveMenu("rekap")}
              />

              <SideItem
                icon={<FileSpreadsheet className="w-4 h-4" />}
                label="Catatan"
                active={activeMenu === "catatan"}
                onClick={() => setActiveMenu("catatan")}
              />
            </nav>

            {/* Bottom Logout */}
            <div className="mt-auto pt-4">
              <SideItem
                icon={<LogOut className="w-4 h-4" />}
                label="Logout"
                danger
                onClick={onLogout}
              />
              <div className="mt-3 text-xs text-slate-400 px-2">
                © {new Date().getFullYear()} Sistem Absensi
              </div>
            </div>
          </div>
        </aside>

        {/* CONTENT */}
        <div className="flex-1 min-w-0">
          {/* Topbar area */}
          <div className="sticky top-0 z-20 bg-slate-50">
            <div className="px-4 sm:px-6 pt-4">
              <Topbar name={user.name} role={user.role} onLogout={onLogout} />
            </div>
            <div className="h-4" />
          </div>

          {/* Main content */}
          <div className="px-4 sm:px-6 pb-10">
            <main className="max-w-6xl mx-auto grid gap-6">
              {/* ===== DASHBOARD ===== */}
              {activeMenu === "dashboard" && (
                <section className="rounded-2xl border bg-white p-5">
                  <h2 className="font-semibold">Dashboard</h2>
                  <p className="text-sm text-slate-600 mt-2">
                    Silakan pilih menu di sidebar untuk mengelola data.
                  </p>
                  <div className="mt-4 grid sm:grid-cols-3 gap-3">
                    <div className="rounded-xl border p-4">
                      <div className="text-xs text-slate-500">Total Users</div>
                      <div className="text-2xl font-bold mt-1">
                        {usersLoading ? "…" : users.length}
                      </div>
                    </div>
                    <div className="rounded-xl border p-4">
                      <div className="text-xs text-slate-500">
                        Total Master Civitas
                      </div>
                      <div className="text-2xl font-bold mt-1">
                        {loadingList ? "…" : items.length}
                      </div>
                    </div>
                    <div className="rounded-xl border p-4">
                      <div className="text-xs text-slate-500">Role Anda</div>
                      <div className="text-2xl font-bold mt-1">
                        {String(user.role).toUpperCase()}
                      </div>
                    </div>
                  </div>
                </section>
              )}

              {/* ===== USERS ===== */}
              {activeMenu === "users" && (
                <section className="rounded-2xl border bg-white p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="font-semibold">Manajemen Akun Login</h2>
                      <p className="text-sm text-slate-600 mt-1">
                        Aksi cepat: <b>Edit</b>, <b>Reset Password</b>,{" "}
                        <b>Disable/Aktifkan</b>. (Mode gratis: disable adalah
                        “hapus paling aman”.)
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
                      <div className="text-sm text-slate-500">
                        Belum ada user.
                      </div>
                    ) : (
                      <div className="grid gap-3">
                        {users.map((u) => {
                          const busy = busyUid === u.id;
                          const uname =
                            u.username || usernameFromEmail(u.email);
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
                                  <div className="font-semibold truncate">
                                    {u.name}
                                  </div>

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
                                    UID:{" "}
                                    <span className="text-slate-400">
                                      {u.id}
                                    </span>
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
                                  {u.prodi ? (
                                    <span>Prodi: {u.prodi}</span>
                                  ) : null}
                                  {u.kelas ? (
                                    <span>Kelas: {u.kelas}</span>
                                  ) : null}
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
                                  onClick={() => {
                                    setSelectedUid(u.id);
                                    setActiveMenu("rekap");
                                  }}
                                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border hover:bg-slate-50 text-slate-700"
                                  title="Lihat rekap absensi user ini"
                                >
                                  <FileSpreadsheet className="w-4 h-4" />
                                  Rekap Absen
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
              )}

              {/* ===== MASTER CIVITAS ===== */}
              {activeMenu === "master" && (
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
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700"
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
                      <div className="text-sm text-slate-500">
                        Belum ada data.
                      </div>
                    ) : (
                      <div className="grid gap-3">
                        {items.map((d) => (
                          <div
                            key={d.id}
                            className="rounded-xl border p-4 flex items-start gap-3"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <div className="font-semibold truncate">
                                  {d.nama}
                                </div>
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
                                  {d.fakultas
                                    ? ` • Fakultas: ${d.fakultas}`
                                    : ""}
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
              )}

              {/* ===== REKAP ABSENSI (menu sidebar) ===== */}
              {activeMenu === "rekap" && (
                <section className="rounded-2xl border bg-white p-5">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <h2 className="font-semibold">Rekap Absensi</h2>
                      <p className="text-sm text-slate-600 mt-1">
                        Rekapan absensi user (karyawan/dosen) dari{" "}
                        <code>staff_attendance</code>.
                      </p>
                    </div>
                  </div>

                  <RekapAbsensiPanel
                    users={users}
                    selectedUid={selectedUid}
                    setSelectedUid={setSelectedUid}
                  />
                </section>
              )}

              {/* ===== CATATAN ===== */}
              {activeMenu === "catatan" && (
                <section className="rounded-2xl border bg-white p-5">
                  <h2 className="font-semibold">Catatan</h2>
                  <div className="text-sm text-slate-600 mt-2 leading-relaxed">
                    - Mode gratis: <b>Disable</b> adalah cara terbaik untuk
                    “menghapus akses” user.
                    <br />
                    - User disabled akan otomatis logout saat mencoba login (di
                    App.tsx).
                    <br />- Tombol <b>Hapus Profil</b> hanya menghapus dokumen
                    Firestore, akun Auth tetap ada.
                    <br />- Login username memakai koleksi{" "}
                    <code>usernames</code>.
                  </div>
                </section>
              )}
            </main>
          </div>
        </div>
      </div>

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
                    className="w-full px-3 py-2 rounded-xl border focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                    placeholder="Contoh: Budi Santoso"
                  />
                </Field>

                <Field label="Email">
                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                    placeholder="budi@uni.ac.id"
                  />
                </Field>

                <Field label="Username Login (untuk masuk nanti)">
                  <input
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
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
                    className="w-full px-3 py-2 rounded-xl border bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
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
                      className="w-full px-3 py-2 rounded-xl border focus:outline-none focus:ring-2 focus:ring-indigo-500/30 disabled:bg-slate-100"
                      placeholder="1234567890"
                    />
                  </Field>

                  <Field label="Fakultas (opsional)">
                    <input
                      value={fakultas}
                      onChange={(e) => setFakultas(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                      placeholder="FT / FEB / FKIP"
                    />
                  </Field>
                </div>

                <Field label="Prodi (opsional)">
                  <input
                    value={prodi}
                    onChange={(e) => setProdi(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
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
                        className="w-full px-3 py-2 rounded-xl border focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
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
                  className="px-4 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60 inline-flex items-center gap-2"
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

function RekapAbsensiPanel({
  users,
  selectedUid,
  setSelectedUid,
}: {
  users: UserRow[];
  selectedUid: string;
  setSelectedUid: (v: string) => void;
}) {
  const [rows, setRows] = useState<AttRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const selectedUser = useMemo(
    () => users.find((u) => u.id === selectedUid) || null,
    [users, selectedUid]
  );

  useEffect(() => {
    if (!selectedUid) {
      setRows([]);
      setErr(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setErr(null);

    const colRef = collection(db, "staff_attendance");

    const q1 = query(
      colRef,
      where("uid", "==", selectedUid),
      orderBy("tanggalISO", "desc"),
      limit(62)
    );

    let unsubMain = () => {};
    let unsubFallback = () => {};

    unsubMain = onSnapshot(
      q1,
      (snap) => {
        const data = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as any),
        })) as AttRow[];
        setRows(data);
        setLoading(false);
        setErr(null);
      },
      (e) => {
        const msg = String(e?.message || "");
        console.error("RekapAbsensiPanel q1 error:", e);

        if (
          msg.toLowerCase().includes("requires an index") ||
          msg.toLowerCase().includes("index is currently building")
        ) {
          const q2 = query(colRef, where("uid", "==", selectedUid), limit(200));
          unsubFallback = onSnapshot(
            q2,
            (snap2) => {
              const data2 = snap2.docs.map((d) => ({
                id: d.id,
                ...(d.data() as any),
              })) as AttRow[];
              data2.sort((a, b) =>
                String(b.tanggalISO || "").localeCompare(
                  String(a.tanggalISO || "")
                )
              );
              setRows(data2.slice(0, 62));
              setLoading(false);
              setErr(null);
            },
            (e2) => {
              setErr(String(e2?.message || "Gagal memuat rekap absensi."));
              setLoading(false);
            }
          );
        } else {
          setErr(msg || "Gagal memuat rekap absensi.");
          setLoading(false);
        }
      }
    );

    return () => {
      try {
        unsubMain();
        unsubFallback();
      } catch {}
    };
  }, [selectedUid]);

  const totalMasuk = useMemo(
    () => rows.filter((r) => !!r.checkInAt).length,
    [rows]
  );
  const totalPulang = useMemo(
    () => rows.filter((r) => !!r.checkOutAt).length,
    [rows]
  );

  // ✅ helper lokasi: prioritas lokasiIn/lokasiOut, fallback lokasi tunggal
  function getLoc(r: AttRow, kind: "in" | "out") {
    if (kind === "in") {
      const li = r.lokasiIn;
      if (li && typeof li.lat === "number" && typeof li.lng === "number") {
        return { lat: li.lat, lng: li.lng, accuracy: li.accuracy ?? null };
      }
      const l = r.lokasi;
      if (l && typeof l.lat === "number" && typeof l.lng === "number") {
        return { lat: l.lat, lng: l.lng, accuracy: l.accuracy ?? null };
      }
      return null;
    }
    // out
    const lo = r.lokasiOut;
    if (lo && typeof lo.lat === "number" && typeof lo.lng === "number") {
      return { lat: lo.lat, lng: lo.lng, accuracy: lo.accuracy ?? null };
    }
    return null;
  }

  return (
    <div className="mt-4 rounded-2xl border bg-white p-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="font-semibold">Rekap Absensi User</div>
          <div className="text-sm text-slate-600 mt-1">
            Data diambil dari <code>staff_attendance</code>.
          </div>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={selectedUid}
            onChange={(e) => setSelectedUid(e.target.value)}
            className="px-3 py-2 rounded-xl border bg-white text-sm"
          >
            <option value="">— Pilih User —</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} • {String(u.role).toUpperCase()}
              </option>
            ))}
          </select>
        </div>
      </div>

      {selectedUser && (
        <div className="mt-3 rounded-2xl border bg-slate-50 p-4">
          <div className="font-semibold">{selectedUser.name}</div>
          <div className="text-sm text-slate-600">{selectedUser.email}</div>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            <span className="px-2 py-1 rounded-full border bg-white">
              Role: <b>{String(selectedUser.role).toUpperCase()}</b>
            </span>
            <span className="px-2 py-1 rounded-full border bg-white">
              Masuk: <b>{totalMasuk}</b>
            </span>
            <span className="px-2 py-1 rounded-full border bg-white">
              Pulang: <b>{totalPulang}</b>
            </span>
          </div>
        </div>
      )}

      <div className="mt-3">
        {!selectedUid ? (
          <div className="text-sm text-slate-600">
            Pilih user untuk menampilkan rekap.
          </div>
        ) : loading ? (
          <div className="text-sm text-slate-500 flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            Memuat rekap...
          </div>
        ) : err ? (
          <div className="text-sm text-red-600">{err}</div>
        ) : rows.length === 0 ? (
          <div className="text-sm text-slate-600">Belum ada data absensi.</div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border mt-3">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50">
                <tr className="text-left">
                  <th className="px-4 py-3">Tanggal</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Masuk</th>
                  <th className="px-4 py-3">Pulang</th>
                  {/* ✅ kolom baru */}
                  <th className="px-4 py-3">Lokasi</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const masuk = tsToHHMM(r.checkInAt);
                  const pulang = tsToHHMM(r.checkOutAt);
                  const status =
                    r.checkInAt && r.checkOutAt
                      ? "Lengkap"
                      : r.checkInAt
                      ? "Belum Pulang"
                      : "Belum Masuk";

                  const locIn = getLoc(r, "in");
                  const locOut = getLoc(r, "out");

                  return (
                    <tr key={r.id} className="border-t align-top">
                      <td className="px-4 py-3 whitespace-nowrap">
                        {String(r.tanggalISO || "-")}
                      </td>

                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2 py-1 rounded-full border bg-white text-xs text-slate-700">
                          {String(r.role || "-").toUpperCase()}
                        </span>
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={cx(
                            "inline-flex items-center gap-2 px-2 py-1 rounded-full border text-xs",
                            masuk !== "-" &&
                              "border-emerald-200 bg-emerald-50 text-emerald-700",
                            masuk === "-" &&
                              "border-slate-200 bg-white text-slate-600"
                          )}
                        >
                          {masuk}
                        </span>
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={cx(
                            "inline-flex items-center gap-2 px-2 py-1 rounded-full border text-xs",
                            pulang !== "-" &&
                              "border-indigo-200 bg-indigo-50 text-indigo-700",
                            pulang === "-" &&
                              "border-slate-200 bg-white text-slate-600"
                          )}
                        >
                          {pulang}
                        </span>
                      </td>

                      {/* ✅ LOKASI tampil rapi */}
                      <td className="px-4 py-3">
                        <div className="grid gap-2 min-w-[240px]">
                          {/* lokasi masuk */}
                          <div className="rounded-xl border bg-white p-2">
                            <div className="flex items-center justify-between gap-2">
                              <div className="text-xs font-medium text-slate-700 inline-flex items-center gap-1">
                                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                                Lokasi Masuk
                              </div>
                              {locIn ? (
                                <a
                                  href={mapsUrl(locIn.lat, locIn.lng)}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-xs inline-flex items-center gap-1 text-indigo-600 hover:underline"
                                  title="Buka Google Maps"
                                >
                                  Maps <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                              ) : (
                                <span className="text-xs text-slate-400">
                                  -
                                </span>
                              )}
                            </div>

                            <div className="mt-1 text-xs text-slate-600">
                              {locIn ? formatCoords(locIn.lat, locIn.lng) : "-"}
                            </div>

                            {locIn && typeof locIn.accuracy === "number" && (
                              <div className="mt-1 text-[11px] text-slate-500 inline-flex items-center gap-1">
                                <Crosshair className="w-3.5 h-3.5 text-slate-400" />
                                Akurasi ±{Math.round(locIn.accuracy)} m
                              </div>
                            )}
                          </div>

                          {/* lokasi pulang */}
                          <div className="rounded-xl border bg-white p-2">
                            <div className="flex items-center justify-between gap-2">
                              <div className="text-xs font-medium text-slate-700 inline-flex items-center gap-1">
                                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                                Lokasi Pulang
                              </div>
                              {locOut ? (
                                <a
                                  href={mapsUrl(locOut.lat, locOut.lng)}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-xs inline-flex items-center gap-1 text-indigo-600 hover:underline"
                                  title="Buka Google Maps"
                                >
                                  Maps <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                              ) : (
                                <span className="text-xs text-slate-400">
                                  -
                                </span>
                              )}
                            </div>

                            <div className="mt-1 text-xs text-slate-600">
                              {locOut
                                ? formatCoords(locOut.lat, locOut.lng)
                                : "-"}
                            </div>

                            {locOut && typeof locOut.accuracy === "number" && (
                              <div className="mt-1 text-[11px] text-slate-500 inline-flex items-center gap-1">
                                <Crosshair className="w-3.5 h-3.5 text-slate-400" />
                                Akurasi ±{Math.round(locOut.accuracy)} m
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <span
                          className={cx(
                            "inline-flex items-center px-2 py-1 rounded-full border text-xs",
                            status === "Lengkap" &&
                              "border-emerald-200 bg-emerald-50 text-emerald-700",
                            status === "Belum Pulang" &&
                              "border-amber-200 bg-amber-50 text-amber-700",
                            status === "Belum Masuk" &&
                              "border-slate-200 bg-white text-slate-600"
                          )}
                        >
                          {status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="mt-3 text-xs text-slate-500">
        Jika index Firestore belum siap, sistem otomatis fallback (sorting di
        client).
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
