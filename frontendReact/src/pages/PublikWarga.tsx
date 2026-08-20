import { useMemo } from "react";
import { apiFetch } from "../lib/api";
import { useQuery } from "@tanstack/react-query";

interface WargaPublik {
  id: string;
  nama: string;
}

export default function PublikWarga() {
  const { data: wargaList = [], isLoading } = useQuery<WargaPublik[]>({
    queryKey: ["warga-public"],
    queryFn: async () => {
      const response = await apiFetch("/api/warga/data?aktif=true");
      if (!response.ok) throw new Error("Gagal memuat data warga.");
      const result = await response.json();
      if (Array.isArray(result.data)) {
        return result.data.map((item: { id: string; nama: string }) => ({
          id: item.id,
          nama: item.nama,
        }));
      }
      return [];
    },
  });

  // Duplikasi array agar aliran marquee berjalan mulus tanpa jeda
  const loopList = useMemo(() => {
    if (wargaList.length === 0) return [];
    return [...wargaList, ...wargaList, ...wargaList];
  }, [wargaList]);

  return (
    <div className="min-h-full rounded-2xl bg-slate-950 text-white overflow-hidden relative flex flex-col justify-between p-4 sm:p-6 shadow-2xl border border-slate-800">
      <style>{`
        @keyframes marqueeLeft {
          0% { transform: translateX(0%); }
          100% { transform: translateX(-33.33%); }
        }
        @keyframes marqueeRight {
          0% { transform: translateX(-33.33%); }
          100% { transform: translateX(0%); }
        }

        .animate-marquee-left {
          display: flex;
          width: max-content;
          will-change: transform;
          animation: marqueeLeft 90s linear infinite;
        }
        .animate-marquee-right {
          display: flex;
          width: max-content;
          will-change: transform;
          animation: marqueeRight 80s linear infinite;
        }

        /* Berhenti saat hover/touch agar nama mudah dibaca */
        .animate-marquee-left:hover, .animate-marquee-right:hover {
          animation-play-state: paused;
        }
      `}</style>

      {/* HEADER HALAMAN */}
      <header className="relative z-10 text-center my-2 space-y-1.5 shrink-0">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-medium">
          <i className="fa-solid fa-users"></i>
          <span>Data Terdaftar</span>
        </div>
        <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white">
          DAFTAR WARGA
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 max-w-sm sm:max-w-md mx-auto">
          Daftar seluruh anggota warga yang terdaftar aktif
        </p>
      </header>

      {/* KONTEN UTAMA: BARIS NAMA BERJALAN */}
      <main className="relative z-10 flex-1 flex flex-col justify-center my-4 overflow-hidden rounded-xl">
        {/* GRADIENT OVERLAY DI KIRI & KANAN */}
        <div className="absolute top-0 bottom-0 left-0 w-8 bg-gradient-to-r from-slate-950 to-transparent z-20 pointer-events-none"></div>
        <div className="absolute top-0 bottom-0 right-0 w-8 bg-gradient-to-l from-slate-950 to-transparent z-20 pointer-events-none"></div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center space-y-2 text-slate-400 py-12">
            <i className="fa-solid fa-spinner animate-spin text-2xl"></i>
            <p className="text-xs">Memuat data...</p>
          </div>
        ) : wargaList.length === 0 ? (
          <div className="text-center text-slate-500 py-8">
            <p className="text-sm">Belum ada data warga untuk ditampilkan.</p>
          </div>
        ) : (
          <div className="w-full space-y-3 py-2">
            {/* BARIS 1: Arah Kiri */}
            <div className="relative w-full overflow-hidden">
              <div className="animate-marquee-left gap-3 pr-3">
                {loopList.map((item, idx) => (
                  <div
                    key={`track1-${item.id}-${idx}`}
                    className="inline-flex items-center gap-2.5 px-4 py-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-100 shadow-sm shrink-0 cursor-default"
                  >
                    <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                    <span className="font-bold text-sm sm:text-base tracking-wide">{item.nama}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* BARIS 2: Arah Kanan */}
            <div className="relative w-full overflow-hidden">
              <div className="animate-marquee-right gap-3 pr-3">
                {[...loopList].reverse().map((item, idx) => (
                  <div
                    key={`track2-${item.id}-${idx}`}
                    className="inline-flex items-center gap-2.5 px-4 py-2 rounded-lg bg-slate-800/60 border border-slate-700/50 text-slate-200 shadow-sm shrink-0 cursor-default"
                  >
                    <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                    <span className="font-bold text-sm sm:text-base tracking-wide">{item.nama}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* BARIS 3: Arah Kiri */}
            <div className="relative w-full overflow-hidden">
              <div className="animate-marquee-left gap-3 pr-3">
                {loopList.map((item, idx) => (
                  <div
                    key={`track3-${item.id}-${idx}`}
                    className="inline-flex items-center gap-2.5 px-4 py-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-100 shadow-sm shrink-0 cursor-default"
                  >
                    <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                    <span className="font-bold text-sm sm:text-base tracking-wide">{item.nama}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* FOOTER INFORMASI */}
      <footer className="relative z-10 text-center pt-3 border-t border-slate-800/80 text-xs text-slate-400 flex items-center justify-between shrink-0">
        <span>Status: Aktif</span>
        <div>
          Total Warga: <strong className="text-white font-semibold">{wargaList.length}</strong>
        </div>
      </footer>
    </div>
  );
}