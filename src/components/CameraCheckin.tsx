import { useEffect, useMemo, useRef, useState } from "react";
import { X, Camera, Loader2, MapPin, CheckCircle2 } from "lucide-react";
import { type GeoFence, getDistanceM, isInsideAnyFence } from "../utils/geo";

export type CameraConfirmPayload = {
  selfieDataUrl: string;
  lat: number | null;
  lng: number | null;
  distanceM: number | null;
  inside: boolean;
};

export default function CameraCheckin({
  isOpen,
  onClose,
  onConfirm,
  geofences,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (payload: CameraConfirmPayload) => void;
  geofences: GeoFence[];
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [starting, setStarting] = useState(false);
  const [taking, setTaking] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [preview, setPreview] = useState<string | null>(null);

  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [distanceM, setDistanceM] = useState<number | null>(null);
  const [inside, setInside] = useState(false);

  // ===== helper: stop camera stream
  function stopStream() {
    const v = videoRef.current;
    const stream = v?.srcObject as MediaStream | null;
    if (stream) stream.getTracks().forEach((t) => t.stop());
    if (v) v.srcObject = null;
  }

  // ===== open/close lifecycle
  useEffect(() => {
    if (!isOpen) {
      stopStream();
      setPreview(null);
      setErr(null);
      setStarting(false);
      setTaking(false);
      setLat(null);
      setLng(null);
      setDistanceM(null);
      setInside(false);
      return;
    }

    async function start() {
      setStarting(true);
      setErr(null);

      try {
        // 1) start camera
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user" },
          audio: false,
        });
        if (!videoRef.current) return;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();

        // 2) get location
        if ("geolocation" in navigator) {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              const la = pos.coords.latitude;
              const lo = pos.coords.longitude;
              setLat(la);
              setLng(lo);

              const nearest = getDistanceM(la, lo, geofences);
              setDistanceM(nearest);
              setInside(isInsideAnyFence(la, lo, geofences));
            },
            () => {
              // kalau location gagal, biarkan null
              setLat(null);
              setLng(null);
              setDistanceM(null);
              setInside(false);
            },
            { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
          );
        }
      } catch (e: any) {
        setErr(e?.message || "Gagal membuka kamera.");
      } finally {
        setStarting(false);
      }
    }

    start();

    return () => {
      stopStream();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // ===== snap photo to dataURL
  async function takePhoto() {
    if (!videoRef.current || !canvasRef.current) return;
    setTaking(true);
    setErr(null);

    try {
      const v = videoRef.current;
      const c = canvasRef.current;
      const w = v.videoWidth || 640;
      const h = v.videoHeight || 480;

      c.width = w;
      c.height = h;

      const ctx = c.getContext("2d");
      if (!ctx) throw new Error("Canvas tidak tersedia.");

      ctx.drawImage(v, 0, 0, w, h);
      const dataUrl = c.toDataURL("image/jpeg", 0.85);
      setPreview(dataUrl);
    } catch (e: any) {
      setErr(e?.message || "Gagal mengambil foto.");
    } finally {
      setTaking(false);
    }
  }

  function handleConfirm() {
    if (!preview) {
      setErr("Ambil foto dulu sebelum konfirmasi.");
      return;
    }

    onConfirm({
      selfieDataUrl: preview,
      lat,
      lng,
      distanceM,
      inside,
    });

    // close modal
    onClose();
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-white rounded-2xl border shadow-xl overflow-hidden">
        {/* header */}
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div className="font-semibold">Selfie & Lokasi</div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-100"
            aria-label="close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* content */}
        <div className="p-5 grid gap-4">
          {/* status geofence */}
          <div className="rounded-xl border bg-slate-50 px-4 py-3 flex items-start gap-3">
            <div className="mt-0.5 text-slate-600">
              <MapPin className="w-5 h-5" />
            </div>
            <div className="text-sm">
              <div className="font-medium text-slate-900">Lokasi</div>
              <div className="text-slate-600">
                {lat && lng ? (
                  <>
                    {inside ? (
                      <span className="inline-flex items-center gap-1 text-emerald-700">
                        <CheckCircle2 className="w-4 h-4" />
                        Di dalam area kampus
                      </span>
                    ) : (
                      <span className="text-red-600">Di luar area kampus</span>
                    )}
                    {typeof distanceM === "number" && (
                      <span className="text-slate-500">
                        {" "}
                        • ~{Math.round(distanceM)} m
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-slate-500">
                    Lokasi belum terbaca (izinkan location di browser).
                  </span>
                )}
              </div>
            </div>
          </div>

          {err && <div className="text-sm text-red-600">{err}</div>}

          {/* camera/preview */}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="rounded-xl border overflow-hidden bg-black">
              {!preview ? (
                <div className="relative">
                  <video ref={videoRef} className="w-full h-64 object-cover" />
                  {starting && (
                    <div className="absolute inset-0 grid place-items-center bg-black/40 text-white">
                      <div className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Membuka kamera...
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <img
                  src={preview}
                  className="w-full h-64 object-cover"
                  alt="preview"
                />
              )}
            </div>

            <div className="rounded-xl border p-4">
              <div className="text-sm font-medium text-slate-800 mb-2">
                Aksi
              </div>

              <div className="grid gap-2">
                {!preview ? (
                  <button
                    onClick={takePhoto}
                    disabled={starting || taking}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60"
                  >
                    {taking ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Camera className="w-4 h-4" />
                    )}
                    Ambil Foto
                  </button>
                ) : (
                  <button
                    onClick={() => setPreview(null)}
                    className="px-4 py-2 rounded-xl border hover:bg-slate-50"
                  >
                    Ulangi Foto
                  </button>
                )}

                <button
                  onClick={handleConfirm}
                  disabled={!preview}
                  className="px-4 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
                >
                  Konfirmasi Hadir
                </button>

                <button
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl border hover:bg-slate-50"
                >
                  Batal
                </button>

                <div className="text-xs text-slate-500 pt-2">
                  * Pastikan wajah terlihat jelas dan location aktif.
                </div>
              </div>
            </div>
          </div>

          <canvas ref={canvasRef} className="hidden" />
        </div>
      </div>
    </div>
  );
}
