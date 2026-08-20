import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../lib/api";

interface PostItem {
  id: number | string;
  title: string;
  date: string;
  time: string;
  location: string;
  description: string;
  image?: string;
}

interface PengumumanApiItem {
  id: number;
  title: string;
  event_date: string;
  event_time: string;
  location: string;
  description: string;
  image_name?: string | null;
}

interface PengumumanResponse {
  data?: PengumumanApiItem[];
  error?: string;
}

export default function Dashboard() {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const formatDate = (dateString: string) => {
    if (!dateString) return "";
    try {
      const cleanDate = dateString.split("T")[0];
      const parts = cleanDate.split("-");
      if (parts.length === 3) {
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);

        const dateObj = new Date(year, month, day);
        return dateObj.toLocaleDateString("id-ID", {
          day: "numeric",
          month: "long",
          year: "numeric",
        });
      }
      return dateString;
    } catch {
      return dateString;
    }
  };

  const formatTime = (timeString: string) => {
    if (!timeString) return "";
    return timeString
      .split(" ")
      .map((part) => {
        if (part.includes(":") && part.length > 5) {
          return part.substring(0, 5);
        }
        return part;
      })
      .join(" ");
  };

  // MENGGUNAKAN REACT QUERY (DATA DICACHE OTOMATIS)
  const { data: latestItem = null, isLoading } = useQuery<PostItem | null>({
    queryKey: ["pengumuman-latest"],
    queryFn: async () => {
      const response = await apiFetch("/admin/pengumuman");
      const result: PengumumanResponse = await response.json();

      if (response.ok && result.data && result.data.length > 0) {
        const mappedData: PostItem[] = result.data.map((item) => ({
          id: item.id,
          title: item.title,
          date: formatDate(item.event_date),
          time: formatTime(item.event_time),
          location: item.location,
          description: item.description,
          image: item.image_name || undefined,
        }));
        return mappedData[0];
      }
      return null;
    },
  });

  return (
    <div className="max-w-5xl mx-auto space-y-4 pb-12">
      {/* KONTEN UTAMA PENGUMUMAN */}
{isLoading ? (
  <div className="bg-amber-50/60 rounded-3xl border border-emerald-100 shadow-sm p-5 sm:p-8 space-y-5 animate-pulse">
    {/* Simulasi Header Badge & Title */}
    <div className="space-y-3">
      <div className="w-32 h-6 bg-emerald-100 rounded-xl"></div>
      <div className="w-full h-8 bg-slate-200 rounded-xl"></div>
      <div className="w-3/4 h-8 bg-slate-200 rounded-xl"></div>
    </div>
    {/* Simulasi Grid Tanggal */}
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
      <div className="h-16 bg-amber-50/50 rounded-2xl"></div>
      <div className="h-16 bg-emerald-50/50 rounded-2xl"></div>
    </div>
    {/* Simulasi Konten */}
    <div className="h-48 bg-slate-100 rounded-2xl"></div>
  </div>
) : !latestItem ? (
        <div className="bg-white rounded-3xl border border-emerald-100 shadow-sm p-10 text-center space-y-3">
          <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl mx-auto flex items-center justify-center text-xl shadow-inner">
            <i className="fa-solid fa-bullhorn"></i>
          </div>
          <h3 className="text-sm font-bold text-slate-800">
            Belum Ada Pengumuman
          </h3>
          <p className="text-xs text-slate-400 max-w-xs mx-auto">
            Belum ada jadwal acara baru yang diunggah oleh pengurus.
          </p>
        </div>
      ) : (
        <div className="bg-amber-50/60 rounded-3xl border-2 border-emerald-100 shadow-xl overflow-hidden p-5 sm:p-8 transition-all space-y-5">
          {/* HEADER: Badge & Judul */}
          <div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-100/80 text-emerald-800 text-[11px] font-black uppercase tracking-wider border border-emerald-200">
              <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse"></span>
              Agenda Mendatang
            </span>

            <h2 className="text-xl sm:text-3xl font-black text-slate-900 tracking-tight mt-3 leading-snug">
              {latestItem.title}
            </h2>
          </div>

          {/* KOTAK TANGGAL & LOKASI */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div className="flex items-center gap-2.5 p-2.5 sm:p-3.5 rounded-2xl bg-amber-50/90 border border-amber-200 shadow-2xs">
              <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs text-xs">
                <i className="fa-regular fa-calendar-days"></i>
              </div>
              <div className="overflow-hidden">
                <p className="text-[9px] uppercase font-extrabold text-amber-800 tracking-wider">
                  Tanggal & Jam
                </p>
                <p className="text-xs font-bold text-slate-900 truncate">
                  {latestItem.date} • {latestItem.time}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 p-2.5 sm:p-3.5 rounded-2xl bg-emerald-50/90 border border-emerald-200 shadow-2xs">
              <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs text-xs">
                <i className="fa-solid fa-location-dot"></i>
              </div>
              <div className="overflow-hidden">
                <p className="text-[9px] uppercase font-extrabold text-emerald-800 tracking-wider">
                  Lokasi / Tempat
                </p>
                <p className="text-xs font-bold text-slate-900 truncate">
                  {latestItem.location}
                </p>
              </div>
            </div>
          </div>

          {/* BAGIAN UTAMA: FOTO & DESKRIPSI */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {latestItem.image && (
              <div className="lg:col-span-5 lg:order-last w-full flex flex-col items-center">
                <div className="w-full space-y-1.5">
                  <p className="text-[11px] uppercase font-extrabold text-slate-400 tracking-wider px-1">
                    Dokumentasi / Brosur
                  </p>
                  <div
                    onClick={() => setSelectedImage(latestItem.image || null)}
                    className="w-full h-56 sm:h-72 lg:h-[320px] rounded-2xl overflow-hidden shadow-md border-2 border-emerald-100 relative group bg-slate-100 cursor-pointer"
                  >
                    <img
                      src={latestItem.image}
                      alt={latestItem.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
                      <span className="text-[11px] font-bold text-white bg-slate-900/90 backdrop-blur-xs px-3 py-2 rounded-xl w-full text-center shadow-md">
                        <i className="fa-solid fa-expand mr-1.5"></i> Perbesar Foto (Zoom)
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div
              className={`w-full space-y-1.5 ${latestItem.image ? "lg:col-span-7" : "lg:col-span-12"}`}
            >
              <p className="text-[11px] uppercase font-extrabold text-emerald-800 tracking-wider px-1">
                Detail Informasi Acara
              </p>
              <div className="text-slate-800 text-sm sm:text-base leading-relaxed whitespace-pre-line bg-gradient-to-br from-emerald-50/80 to-teal-50/50 p-4 sm:p-6 rounded-2xl border-2 border-emerald-100/80 shadow-sm">
                {latestItem.description}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SEKSI JADWAL RUTIN, PENGURUS, & SPONSOR */}
      <div className="space-y-4 pt-2">
        <div className="bg-amber-50/60 rounded-3xl border-2 border-emerald-100 p-5 sm:p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-emerald-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <i className="fa-solid fa-calendar-check text-sm"></i>
              </div>
              <div>
                <h3 className="font-black text-slate-900 text-sm sm:text-base">
                  Agenda & Kegiatan Rutin
                </h3>
                <p className="text-xs font-semibold text-slate-600">
                  Jadwal berkala mingguan dan bulanan warga
                </p>
              </div>
            </div>
            <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 bg-emerald-100 text-emerald-900 rounded-lg border border-emerald-300">
              Rutin
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-2xl bg-amber-50/60 border border-amber-200 flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-600 text-white flex items-center justify-center shrink-0 shadow-xs text-xs font-bold">
                <i className="fa-solid fa-coins"></i>
              </div>
              <div className="overflow-hidden">
                <p className="text-xs font-extrabold text-slate-900">Arisan & Pertemuan</p>
                <p className="text-xs font-bold text-amber-900 mt-0.5">
                  Minggu Ke-2 • 15.30 WIB
                </p>
                <p className="text-[11px] font-semibold text-slate-600 mt-1">
                  Tempat: Rumah Warga (Bergiliran)
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-rose-50/60 border border-rose-200 flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-xs text-xs font-bold">
                <i className="fa-solid fa-heart-pulse"></i>
              </div>
              <div className="overflow-hidden">
                <p className="text-xs font-extrabold text-slate-900">Posyandu Balita & Lansia</p>
                <p className="text-xs font-bold text-rose-900 mt-0.5">
                  Tanggal 10 Setiap Bulan
                </p>
                <p className="text-[11px] font-semibold text-slate-600 mt-1">
                  Tempat: Posko Balai RW
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-emerald-50/60 border border-emerald-200 flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs text-xs font-bold">
                <i className="fa-solid fa-child-reaching"></i>
              </div>
              <div className="overflow-hidden">
                <p className="text-xs font-extrabold text-slate-900">Senam Sehat</p>
                <p className="text-xs font-bold text-emerald-900 mt-0.5">
                  Setiap Minggu Pagi • 06.00 WIB
                </p>
                <p className="text-[11px] font-semibold text-slate-600 mt-1">
                  Tempat: Lapangan Utama
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-amber-50/60 rounded-3xl border-2 border-emerald-100 p-5 sm:p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2.5 border-b border-emerald-100 pb-3">
            <div className="w-8 h-8 rounded-xl bg-teal-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <i className="fa-solid fa-users text-sm"></i>
            </div>
            <div>
              <h3 className="font-black text-slate-900 text-sm sm:text-base">
                Pengurus Inti PKK
              </h3>
              <p className="text-xs font-semibold text-slate-600">
                Tim pengelola dan penanggung jawab kegiatan
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-1">
              <p className="text-[11px] font-black uppercase text-emerald-800 tracking-wider">
                Ketua PKK
              </p>
              <p className="text-xs font-bold text-slate-900 truncate">Haji Nanang </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-1">
              <p className="text-[11px] font-black uppercase text-emerald-800 tracking-wider">
                Wakil Ketua
              </p>
              <p className="text-xs font-bold text-slate-900 truncate">Haji Nanang</p>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-1">
              <p className="text-[11px] font-black uppercase text-emerald-800 tracking-wider">
                Sekretaris
              </p>
              <p className="text-xs font-bold text-slate-900 truncate">Haji Nanang</p>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-1">
              <p className="text-[11px] font-black uppercase text-emerald-800 tracking-wider">
                Bendahara
              </p>
              <p className="text-xs font-bold text-slate-900 truncate">Haji Nanang</p>
            </div>
          </div>
        </div>

        <div className="bg-slate-900 text-white rounded-3xl p-5 sm:p-6 shadow-md space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/30">
                <i className="fa-solid fa-handshake text-sm"></i>
              </div>
              <div>
                <h3 className="font-black text-white text-sm sm:text-base">
                  Didukung & Disponsori Oleh
                </h3>
                <p className="text-xs font-medium text-slate-400">
                  Mitra penyelenggara dan pendukung kegiatan warga
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 pt-1">
            <div className="flex items-center gap-2.5 px-4 py-2.5 bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 rounded-2xl transition">
              <i className="fa-solid fa-school text-emerald-400 text-base"></i>
              <span className="text-xs font-bold text-slate-200">
                ARTUP STUDIO
              </span>
            </div>

            <div className="flex items-center gap-2.5 px-4 py-2.5 bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 rounded-2xl transition">
              <i className="fa-solid fa-building-columns text-emerald-400 text-base"></i>
              <span className="text-xs font-bold text-slate-200">
                Pengurus RT/RW KELATEN
              </span>
            </div>

            <div className="flex items-center gap-2.5 px-4 py-2.5 bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 rounded-2xl transition">
              <i className="fa-solid fa-users-line text-emerald-400 text-base"></i>
              <span className="text-xs font-bold text-slate-200">
                Karang Taruna PERMAB
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL LIGHTBOX FOTO */}
      {selectedImage && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setSelectedImage(null)}
        >
          <div
            className="relative max-w-4xl w-full max-h-[90vh] flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute -top-12 right-0 text-white bg-white/10 hover:bg-white/20 p-2.5 rounded-full text-sm transition cursor-pointer"
              title="Tutup"
            >
              <i className="fa-solid fa-xmark text-lg"></i>
            </button>
            <img
              src={selectedImage}
              alt="Zoom Preview"
              className="max-h-[80vh] w-auto object-contain rounded-2xl shadow-2xl border-2 border-white/20 bg-slate-900"
            />
          </div>
        </div>
      )}
    </div>
  );
}