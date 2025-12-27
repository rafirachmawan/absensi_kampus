import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

admin.initializeApp();
const db = admin.firestore();

export const createDosenAccount = onCall(async (request) => {
  // request.auth, request.data
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Harus login.");
  }

  const requesterUid = request.auth.uid;

  // cek role superadmin di Firestore users/{uid}
  const requesterSnap = await db.collection("users").doc(requesterUid).get();
  const role = String(requesterSnap.data()?.role || "")
    .toLowerCase()
    .trim();

  if (role !== "superadmin") {
    throw new HttpsError("permission-denied", "Hanya superadmin.");
  }

  // ambil data dari request.data
  const email = String(request.data?.email || "")
    .trim()
    .toLowerCase();
  const password = String(request.data?.password || "");
  const name = String(request.data?.name || "").trim();
  const masterDosenId = request.data?.masterDosenId
    ? String(request.data.masterDosenId)
    : null;

  if (!email || !email.includes("@")) {
    throw new HttpsError("invalid-argument", "Email tidak valid.");
  }
  if (!password || password.length < 6) {
    throw new HttpsError("invalid-argument", "Password minimal 6 karakter.");
  }
  if (!name || name.length < 3) {
    throw new HttpsError("invalid-argument", "Nama minimal 3 karakter.");
  }

  // buat user Auth (kalau email sudah ada, update password & displayName)
  let uid: string;

  try {
    const userRecord = await admin.auth().createUser({
      email,
      password,
      displayName: name,
    });
    uid = userRecord.uid;
  } catch (e: any) {
    if (e?.code === "auth/email-already-exists") {
      const existing = await admin.auth().getUserByEmail(email);
      uid = existing.uid;

      await admin.auth().updateUser(uid, {
        password,
        displayName: name,
      });
    } else {
      throw new HttpsError("internal", e?.message || "Gagal buat akun auth.");
    }
  }

  // simpan profile users/{uid}
  await db
    .collection("users")
    .doc(uid)
    .set(
      {
        role: "dosen",
        name,
        email,
        masterDosenId: masterDosenId || null,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedBy: requesterUid,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        createdBy: requesterUid,
      },
      { merge: true }
    );

  return { ok: true, uid };
});
