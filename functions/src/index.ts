import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

admin.initializeApp();
const db = admin.firestore();

// ✅ Samakan dengan client (SuperAdminPage.tsx)
// Kalau kamu tidak pernah set region, default us-central1 aman.
const FN_REGION = "us-central1";

/** =========================
 * Helpers
 * ========================= */
async function assertSuperadmin(request: any) {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Harus login.");
  }

  const requesterUid = request.auth.uid;

  const requesterSnap = await db.collection("users").doc(requesterUid).get();
  const role = String(requesterSnap.data()?.role || "")
    .toLowerCase()
    .trim();

  if (role !== "superadmin") {
    throw new HttpsError("permission-denied", "Hanya superadmin.");
  }

  return { requesterUid, role };
}

/**
 * Hapus semua dokumen dari query (batch delete).
 * Aman untuk jumlah kecil-menengah. Kalau jumlah sangat besar, perlu strategi paging lebih advance.
 */
async function deleteByQuery(q: FirebaseFirestore.Query) {
  const snap = await q.get();
  if (snap.empty) return 0;

  let deleted = 0;
  const chunks: FirebaseFirestore.QueryDocumentSnapshot[][] = [];
  let cur: FirebaseFirestore.QueryDocumentSnapshot[] = [];

  snap.docs.forEach((d) => {
    cur.push(d);
    if (cur.length === 450) {
      chunks.push(cur);
      cur = [];
    }
  });
  if (cur.length) chunks.push(cur);

  for (const group of chunks) {
    const batch = db.batch();
    group.forEach((docSnap) => batch.delete(docSnap.ref));
    await batch.commit();
    deleted += group.length;
  }

  return deleted;
}

/** =========================================================
 * 1) CREATE DOSEN ACCOUNT (punyamu) - TETAP
 * ========================================================= */
export const createDosenAccount = onCall(
  { region: FN_REGION },
  async (request) => {
    const { requesterUid } = await assertSuperadmin(request);

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
  }
);

/** =========================================================
 * 2) DELETE USER PERMANENTLY (Auth + Firestore)
 * =========================================================
 * Menghapus:
 * - Firebase Auth user (uid)
 * - Firestore users/{uid}
 * - users/{uid}/enrollments/*
 * - master_dosen yang nyimpan authUid == uid (kalau ada)
 * - attendance_records yg uid == uid
 * - staff_attendance yg uid == uid
 * - courses yg dosenUid == uid (kalau dia dosen)
 *
 * Catatan: ini tidak "ubah" rules karena Admin SDK bypass rules.
 */
export const deleteUserPermanently = onCall(
  { region: FN_REGION },
  async (request) => {
    const { requesterUid } = await assertSuperadmin(request);

    const targetUid = String(request.data?.uid || "").trim();
    if (!targetUid) {
      throw new HttpsError("invalid-argument", "uid wajib diisi.");
    }
    if (targetUid === requesterUid) {
      throw new HttpsError(
        "failed-precondition",
        "Tidak boleh menghapus diri sendiri."
      );
    }

    // ambil profile target dulu (buat info role, dll)
    const userRef = db.collection("users").doc(targetUid);
    const userSnap = await userRef.get();
    const targetRole = String(userSnap.data()?.role || "")
      .toLowerCase()
      .trim();

    // 1) delete subcollection enrollments (kalau ada)
    let enrollmentsDeleted = 0;
    try {
      const enrollSnap = await userRef.collection("enrollments").get();
      if (!enrollSnap.empty) {
        const batch = db.batch();
        enrollSnap.docs.forEach((d) => batch.delete(d.ref));
        await batch.commit();
        enrollmentsDeleted = enrollSnap.size;
      }
    } catch {
      // biarin—kalau tidak ada, skip
    }

    // 2) hapus attendance_records yg milik user ini (mahasiswa)
    const attendanceDeleted = await deleteByQuery(
      db.collection("attendance_records").where("uid", "==", targetUid)
    );

    // 3) hapus staff_attendance yg milik user ini (dosen/karyawan)
    const staffDeleted = await deleteByQuery(
      db.collection("staff_attendance").where("uid", "==", targetUid)
    );

    // 4) hapus master_dosen yang terhubung (authUid == targetUid)
    const masterDeleted = await deleteByQuery(
      db.collection("master_dosen").where("authUid", "==", targetUid)
    );

    // 5) kalau dia dosen, hapus courses miliknya (optional tapi biasanya perlu)
    //    NOTE: kalau course punya subcollection sessions/students,
    //    kamu perlu hapus manual juga kalau ada.
    let coursesDeleted = 0;
    if (targetRole === "dosen") {
      const coursesSnap = await db
        .collection("courses")
        .where("dosenUid", "==", targetUid)
        .get();
      for (const c of coursesSnap.docs) {
        // hapus subcollection sessions
        const sessionsSnap = await c.ref.collection("sessions").get();
        if (!sessionsSnap.empty) {
          const batch1 = db.batch();
          sessionsSnap.docs.forEach((d) => batch1.delete(d.ref));
          await batch1.commit();
        }

        // hapus subcollection students
        const studentsSnap = await c.ref.collection("students").get();
        if (!studentsSnap.empty) {
          const batch2 = db.batch();
          studentsSnap.docs.forEach((d) => batch2.delete(d.ref));
          await batch2.commit();
        }

        // hapus course doc
        await c.ref.delete();
        coursesDeleted += 1;
      }
    }

    // 6) hapus users/{uid}
    if (userSnap.exists) {
      await userRef.delete();
    }

    // 7) hapus Firebase Auth user
    try {
      await admin.auth().deleteUser(targetUid);
    } catch (e: any) {
      // kalau user auth tidak ada, tetap lanjut
      const code = String(e?.code || "");
      if (!code.includes("auth/user-not-found")) {
        throw new HttpsError(
          "internal",
          e?.message || "Gagal hapus Auth user."
        );
      }
    }

    return {
      ok: true,
      deletedUid: targetUid,
      role: targetRole || null,
      enrollmentsDeleted,
      attendanceDeleted,
      staffDeleted,
      masterDeleted,
      coursesDeleted,
    };
  }
);
