"use client";

import { Camera, LocateFixed, RefreshCw, Send } from "lucide-react";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function formatCoordinate(value) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "-";
  }

  return value.toFixed(6);
}

function getGoogleMapsUrl(latitude, longitude) {
  if (typeof latitude !== "number" || typeof longitude !== "number") {
    return "";
  }

  return `https://www.google.com/maps?q=${latitude},${longitude}`;
}

export default function AttendanceClient({ history = [], userName = "Pengguna", initError = "", scheduleContext = null }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const [message, setMessage] = useState(initError);
  const [startingCamera, setStartingCamera] = useState(false);
  const [photoBlob, setPhotoBlob] = useState(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState("");
  const [location, setLocation] = useState({
    latitude: null,
    longitude: null,
    accuracy: null,
  });
  const [nowTick, setNowTick] = useState(Date.now());

  const hasLocation = useMemo(
    () => typeof location.latitude === "number" && typeof location.longitude === "number",
    [location]
  );

  const canSubmitAttendance = Boolean(scheduleContext?.allowed) && !scheduleContext?.alreadyAttended;

  const countdownLabel = useMemo(() => {
    if (!scheduleContext?.windowStartIso) {
      return "";
    }

    const target = new Date(scheduleContext.windowStartIso).getTime();
    const diffMs = target - nowTick;

    if (Number.isNaN(target) || diffMs <= 0) {
      return "Window absensi sudah dibuka.";
    }

    const totalSeconds = Math.floor(diffMs / 1000);
    const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
    const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
    const seconds = String(totalSeconds % 60).padStart(2, "0");

    return `Countdown buka absensi: ${hours}:${minutes}:${seconds}`;
  }, [nowTick, scheduleContext]);

  async function startCamera() {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setMessage("Browser tidak mendukung kamera.");
      return;
    }

    setStartingCamera(true);
    setMessage("");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Tidak dapat membuka kamera.");
    } finally {
      setStartingCamera(false);
    }
  }

  function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }

  function clearPhotoPreview() {
    if (photoPreviewUrl) {
      URL.revokeObjectURL(photoPreviewUrl);
    }
    setPhotoPreviewUrl("");
    setPhotoBlob(null);
  }

  function capturePhoto() {
    if (!videoRef.current) {
      setMessage("Kamera belum aktif.");
      return;
    }

    const video = videoRef.current;
    const width = video.videoWidth;
    const height = video.videoHeight;

    if (!width || !height) {
      setMessage("Kamera belum siap untuk mengambil foto.");
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) {
      setMessage("Tidak dapat memproses foto dari kamera.");
      return;
    }

    context.drawImage(video, 0, 0, width, height);

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setMessage("Gagal membuat file foto.");
          return;
        }

        clearPhotoPreview();
        const url = URL.createObjectURL(blob);
        setPhotoBlob(blob);
        setPhotoPreviewUrl(url);
      },
      "image/jpeg",
      0.9
    );
  }

  function detectLocation() {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setMessage("Browser tidak mendukung lokasi.");
      return;
    }

    setMessage("");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
      },
      (error) => {
        setMessage(error.message || "Tidak dapat mendapatkan lokasi.");
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    );
  }

  function submitAttendance() {
    if (!photoBlob) {
      setMessage("Ambil foto dulu sebelum kirim absensi.");
      return;
    }

    if (!hasLocation) {
      setMessage("Lokasi belum tersedia. Klik Ambil Lokasi terlebih dahulu.");
      return;
    }

    if (!canSubmitAttendance) {
      setMessage(scheduleContext?.message || "Absensi belum dapat dilakukan pada waktu ini.");
      return;
    }

    startTransition(async () => {
      setMessage("");

      const formData = new FormData();
      formData.set("photo", new File([photoBlob], `attendance-${Date.now()}.jpg`, { type: "image/jpeg" }));
      formData.set("latitude", String(location.latitude));
      formData.set("longitude", String(location.longitude));
      formData.set("accuracy", String(location.accuracy || ""));
      formData.set("locationLabel", `${location.latitude}, ${location.longitude}`);

      const response = await fetch("/api/dashboard/attendance", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        setMessage(errorText || "Gagal menyimpan absensi.");
        return;
      }

      setMessage("Absensi berhasil disimpan.");
      clearPhotoPreview();
      router.refresh();
    });
  }

  useEffect(() => {
    startCamera();

    return () => {
      stopCamera();
      clearPhotoPreview();
    };
  }, []);

  useEffect(() => {
    if (!scheduleContext?.windowStartIso) {
      return undefined;
    }

    const interval = window.setInterval(() => {
      setNowTick(Date.now());
    }, 1000);

    return () => window.clearInterval(interval);
  }, [scheduleContext?.windowStartIso]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Absensi Anggota</CardTitle>
          <CardDescription>
            {userName}, silakan buka kamera, ambil foto, lalu kirim absensi dengan lokasi saat ini. Foto disimpan di folder tmp dan otomatis dihapus setelah 3 hari.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-2">
              <p className="text-sm font-semibold text-zinc-700">Kamera</p>
              <div className="overflow-hidden rounded-md border border-zinc-200 bg-black">
                <video ref={videoRef} autoPlay playsInline muted className="h-auto w-full" />
              </div>

              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={startCamera} disabled={startingCamera}>
                  <RefreshCw />
                  {startingCamera ? "Membuka Kamera..." : "Buka Ulang Kamera"}
                </Button>
                <Button type="button" onClick={capturePhoto}>
                  <Camera />
                  Ambil Foto
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-semibold text-zinc-700">Preview Foto</p>
              <div className="flex min-h-60 items-center justify-center rounded-md border border-zinc-200 bg-zinc-50">
                {photoPreviewUrl ? (
                  <img src={photoPreviewUrl} alt="Preview absensi" className="max-h-72 w-auto rounded-md" />
                ) : (
                  <p className="px-4 text-center text-sm text-zinc-500">Belum ada foto. Klik Ambil Foto untuk membuat snapshot.</p>
                )}
              </div>

              <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700">
                <p>Latitude: {formatCoordinate(location.latitude)}</p>
                <p>Longitude: {formatCoordinate(location.longitude)}</p>
                <p>Akurasi: {typeof location.accuracy === "number" ? `${Math.round(location.accuracy)} meter` : "-"}</p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={detectLocation}>
                  <LocateFixed />
                  Ambil Lokasi
                </Button>
                <Button type="button" onClick={submitAttendance} disabled={pending || !canSubmitAttendance}>
                  <Send />
                  {pending ? "Menyimpan..." : "Kirim Absensi"}
                </Button>
              </div>
            </div>
          </div>

          {scheduleContext ? (
            <div className={`rounded-md border p-3 text-sm ${scheduleContext.allowed ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
              <p className="font-semibold">Jadwal Hari Ini</p>
              {scheduleContext.error ? (
                <p>{scheduleContext.error}</p>
              ) : (
                <div className="mt-1 space-y-1">
                  <p>Tim: {scheduleContext.team?.name || "-"}</p>
                  <p>Shift: {scheduleContext.assignment?.shiftCode || "-"}</p>
                  <p>Window: {scheduleContext.message || "-"}</p>
                  {scheduleContext.alreadyAttended ? <p>Absensi untuk jadwal ini sudah dilakukan.</p> : null}
                  {!scheduleContext.allowed ? <p>{countdownLabel}</p> : null}
                </div>
              )}
            </div>
          ) : null}

          {message ? <p className="text-sm text-zinc-700">{message}</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Riwayat Absensi Terbaru</CardTitle>
          <CardDescription>Menampilkan 20 data absensi terakhir milik akun yang sedang login.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-zinc-500">
                  <th className="px-2 py-3">Waktu</th>
                  <th className="px-2 py-3">Lokasi</th>
                  <th className="px-2 py-3">Akurasi</th>
                  <th className="px-2 py-3">Foto</th>
                  <th className="px-2 py-3">Hapus Otomatis</th>
                </tr>
              </thead>
              <tbody>
                {history.map((item) => (
                  <tr key={item.id} className="border-b border-zinc-100">
                    <td className="px-2 py-3">{item.attendedAt}</td>
                    <td className="px-2 py-3">
                      {getGoogleMapsUrl(item.latitude, item.longitude) ? (
                        <a
                          href={getGoogleMapsUrl(item.latitude, item.longitude)}
                          target="_blank"
                          rel="noreferrer"
                          className="font-medium text-zinc-900 underline underline-offset-2 hover:text-zinc-700"
                        >
                          {item.locationLabel || `${formatCoordinate(item.latitude)}, ${formatCoordinate(item.longitude)}`}
                        </a>
                      ) : (
                        <span>{item.locationLabel || "-"}</span>
                      )}
                    </td>
                    <td className="px-2 py-3">{typeof item.accuracy === "number" ? `${Math.round(item.accuracy)} meter` : "-"}</td>
                    <td className="px-2 py-3">
                      {item.photoUrl ? (
                        <a
                          href={item.photoUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="font-medium text-zinc-900 underline underline-offset-2 hover:text-zinc-700"
                        >
                          Lihat Foto
                        </a>
                      ) : (
                        <span className="text-zinc-400">-</span>
                      )}
                    </td>
                    <td className="px-2 py-3">{item.photoExpiresAt || "-"}</td>
                  </tr>
                ))}
                {history.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-2 py-4 text-zinc-500">
                      Belum ada data absensi.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
