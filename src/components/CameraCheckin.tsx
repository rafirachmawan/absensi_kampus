import { useEffect, useRef, useState } from "react";
import { Camera, MapPin, Loader2, X, Check } from "lucide-react";

type ConfirmPayload = {
  selfieDataUrl: string;
  lat: number | null;
  lng: number | null;
  accuracyM: number | null;
  mapsUrl: string | null;
};

export default function CameraCheckin({
  isOpen,
  onClose,
  onConfirm,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (payload: ConfirmPayload) => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [selfieDataUrl, setSelfieDataUrl] = useState<string | null>(null);

  const [locLoading, setLocLoading] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [accuracyM, setAccuracyM] = useState<number | null>(null);

  // buka kamera saat modal open
  useEffect(() => {
    if (!isOpen) return;
    setSelfieDataUrl(null);
    setLocError(null);
    startCamera();
    return () => stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch (e) {
      console.error(e);
      setLocError("Kamera tidak dapat diakses. Izinkan kamera di browser.");
    }
  }

  function stopCamera() {
    const s = streamRef.current;
    if (s) s.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  function takePhoto() {
    if (!videoRef.current) return;
    const v = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    setSelfieDataUrl(dataUrl);
  }

  function retake() {
    setSelfieDataUrl(null);
  }

  function checkLocation() {
    setLocError(null);
    setLocLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocLoading(false);
        setLat(pos.coords.latitude);
        setLng(pos.coords.longitude);
        setAccuracyM(pos.coords.accuracy ?? null);

        // perbaiki akurasi jika masih besar dengan watchPosition
        if (
          pos.coords.accuracy &&
          pos.coords.accuracy > 50 &&
          "watchPosition" in navigator.geolocation
        ) {
          const id = navigator.geolocation.watchPosition(
            (p) => {
              if (p.coords.accuracy <= 50) {
                setLat(p.coords.latitude);
                setLng(p.coords.longitude);
                setAccuracyM(p.coords.accuracy ?? null);
                navigator.geolocation.clearWatch(id);
              }
            },
            () => {},
            { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 }
          );
        }
      },
      (err) => {
        setLocLoading(false);
        setLocError(err.message || "Gagal mendapatkan lokasi.");
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    );
  }

  function handleConfirm() {
    if (!selfieDataUrl) {
      setLocError("Ambil selfie terlebih dahulu.");
      return;
    }
    const mapsUrl =
      lat != null && lng != null
        ? `https://www.google.com/maps?q=${lat},${lng}`
        : null;

    onConfirm({
      selfieDataUrl,
      lat,
      lng,
      accuracyM,
      mapsUrl,
    });
    onClose();
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
      <div className="w-full max-w-4xl rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold">Selfie & Lokasi</h3>
          <button
            onClick={() => {
              onClose();
            }}
            className="p-2 rounded-md hover:bg-slate-100"
            aria-label="Tutup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid gap-4 p-4 md:grid-cols-2">
          {/* Kamera */}
          <div className="rounded-xl border p-4">
            <div className="font-medium mb-2 flex items-center gap-2">
              <Camera className="w-4 h-4" /> Kamera
            </div>

            {!selfieDataUrl ? (
              <div className="aspect-video rounded-lg overflow-hidden bg-black">
                <video ref={videoRef} className="w-full h-full object-cover" />
              </div>
            ) : (
              <img
                src={selfieDataUrl}
                alt="selfie"
                className="aspect-video w-full rounded-lg object-cover border"
              />
            )}

            <div className="mt-3 flex items-center gap-2">
              {!selfieDataUrl ? (
                <button
                  onClick={takePhoto}
                  className="px-3 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"
                >
                  Ambil Foto
                </button>
              ) : (
                <button
                  onClick={retake}
                  className="px-3 py-2 rounded-lg bg-slate-200 hover:bg-slate-300"
                >
                  Ulang
                </button>
              )}
            </div>
          </div>

          {/* Lokasi */}
          <div className="rounded-xl border p-4">
            <div className="font-medium mb-2 flex items-center gap-2">
              <MapPin className="w-4 h-4" /> Lokasi
            </div>

            <button
              onClick={checkLocation}
              className="px-3 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60"
              disabled={locLoading}
            >
              {locLoading ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Memeriksa…
                </span>
              ) : (
                "Cek Lokasi"
              )}
            </button>

            <div className="mt-3 rounded-lg border p-3 text-sm">
              {lat != null && lng != null ? (
                <>
                  <div>Lat: {lat}</div>
                  <div>Lng: {lng}</div>
                  {accuracyM != null && (
                    <div>Akurasi: ±{Math.round(accuracyM)} m</div>
                  )}
                  <div className="mt-1">
                    <a
                      href={`https://www.google.com/maps?q=${lat},${lng}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-indigo-600 hover:underline"
                    >
                      Lihat di Google Maps
                    </a>
                  </div>
                  <div className="mt-2 inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-2 py-1">
                    <Check className="w-3 h-3" /> Lokasi direkam.
                  </div>
                </>
              ) : (
                <div className="text-slate-500">
                  Belum diambil. Klik <b>Cek Lokasi</b> untuk merekam posisi.
                </div>
              )}
            </div>

            {locError && (
              <div className="mt-2 text-xs text-red-600">{locError}</div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 p-4 border-t">
          <button
            onClick={onClose}
            className="px-3 py-2 rounded-lg bg-slate-200 hover:bg-slate-300"
          >
            Batal
          </button>
          <button
            onClick={handleConfirm}
            className="px-3 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
          >
            Konfirmasi
          </button>
        </div>
      </div>
    </div>
  );
}
