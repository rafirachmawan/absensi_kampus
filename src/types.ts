/* ===== ROLES & USER ===== */
export type Role = "superadmin" | "dosen" | "mahasiswa" | "karyawan";

export type UserLite = {
  id: string;
  role: Role;
  name: string;
  email: string;
  // legacy mahasiswa (biarkan ada agar kompatibel)
  kelas?: string;
  prodi?: string;
};

/* ===== LEGACY MAHASISWA (biarkan ada) ===== */
export type JadwalItem = {
  id: string;
  tanggalISO: string;
  jamMulai: string;
  jamSelesai: string;
  mk: string;
  ruang: string;
  kelas?: string;
};

export type AbsensiStatus = "Hadir" | "Sakit" | "Izin" | "Alfa";
export type AbsensiRecord = {
  id: string;
  userId: string;
  jadwalId: string;
  tanggalISO: string;
  status: AbsensiStatus;
  selfieDataUrl?: string;
  lat?: number;
  lng?: number;
  distanceM?: number;
  createdAt: string;
};

/* ===== KARYAWAN (ABSEN HARIAN) ===== */
export type CheckType = "Masuk" | "Pulang";

export type EmployeeCheck = {
  id: string; // `${userId}_${tanggalISO}_${type}`
  userId: string;
  tanggalISO: string; // YYYY-MM-DD
  type: CheckType; // "Masuk" | "Pulang"
  time: string; // HH:mm:ss
  selfieDataUrl?: string;

  // detail lokasi yang disimpan setiap absen
  lat?: number;
  lng?: number;
  accuracyM?: number; // akurasi dari geolocation (meter)
  mapsUrl?: string; // link Google Maps

  // sisa field lama (biarin ada agar kompatibel)
  distanceM?: number;

  createdAt: string; // ISO
};

export type ShiftWindow = {
  type: CheckType;
  start: string; // "06:00"
  end: string; // "09:00"
};
