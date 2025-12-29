import { signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "./firebase";

const normalize = (s: string) =>
  String(s || "")
    .trim()
    .toLowerCase();

export async function loginWithUsername(username: string, password: string) {
  const uname = normalize(username);

  if (uname.length < 3) throw new Error("Username minimal 3 karakter.");
  if (!password || password.length < 6)
    throw new Error("Password minimal 6 karakter.");

  // 1) username -> ambil email langsung (biar tidak perlu baca users/{uid} sebelum auth)
  const mapSnap = await getDoc(doc(db, "usernames", uname));
  if (!mapSnap.exists()) throw new Error("Username tidak ditemukan.");

  const data = mapSnap.data() as any;

  // ✅ WAJIB ADA email untuk login auth
  const email = normalize(data?.email || data?.admin || "");
  if (!email || !email.includes("@")) {
    throw new Error(
      "Mapping username rusak. Pastikan usernames/{username} punya field 'email'."
    );
  }

  // 2) login auth pakai email + password
  return await signInWithEmailAndPassword(auth, email, password);
}
