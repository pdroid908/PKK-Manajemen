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
    const response = await apiFetch("/warga/data?aktif=true");
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

  const decorationStyles = [
    { bg: "bg-rose-500/90", text: "text-white", border: "border-rose-300/50", icon: "fa-heart", badge: "❤️" },
    { bg: "bg-emerald-500/90", text: "text-white", border: "border-emerald-300/50", icon: "fa-seedling", badge: "🌿" },
    { bg: "bg-amber-400", text: "text-zinc-900", border: "border-amber-200", icon: "fa-star", badge: "⭐" },
    { bg: "bg-purple-500/90", text: "text-white", border: "border-purple-300/50", icon: "fa-gem", badge: "💎" },
    { bg: "bg-sky-500/90", text: "text-white", border: "border-sky-300/50", icon: "fa-sparkles", badge: "✨" },
    { bg: "bg-pink-500/90", text: "text-white", border: "border-pink-300/50", icon: "fa-flower", badge: "🌸" },
  ];

  const decoratedWarga = useMemo(() => {
    return wargaList.map((warga, index) => ({
      ...warga,
      style: decorationStyles[index % decorationStyles.length],
    }));
  }, [wargaList]);

  // Duplikasi array agar aliran teks berputar mulus tanpa jeda
  const loopList = useMemo(() => {
    if (decoratedWarga.length === 0) return [];
    return [...decoratedWarga, ...decoratedWarga, ...decoratedWarga];
  }, [decoratedWarga]);

  return (
    <div className="min-h-full rounded-2xl bg-gradient-to-br from-emerald-950 via-teal-900 to-slate-900 text-white overflow-hidden relative flex flex-col justify-between p-3 sm:p-6 shadow-xl">
      {/* CSS ANIMASI EKSTRA PELAN (SUPER RELAXED FOR IBU-IBU) */}
      <style>{`
        @keyframes marqueeLeft {
          0% { transform: translateX(0%); }
          100% { transform: translateX(-33.33%); }
        }
        @keyframes marqueeRight {
          0% { transform: translateX(-33.33%); }
          100% { transform: translateX(0%); }
        }
        @keyframes pulseGlow {
          0%, 100% { transform: scale(1); opacity: 0.9; }
          50% { transform: scale(1.03); opacity: 1; }
        }

        /* Dibuat sangat pelan dan bervariasi */
        .animate-marquee-slow-1 {
          display: flex;
          width: max-content;
          will-change: transform;
          animation: marqueeLeft 180s linear infinite;
        }
        .animate-marquee-slow-2 {
          display: flex;
          width: max-content;
          will-change: transform;
          animation: marqueeRight 125s linear infinite;
        }
        .animate-marquee-slow-3 {
          display: flex;
          width: max-content;
          will-change: transform;
          animation: marqueeLeft 130s linear infinite;
        }
        .animate-marquee-slow-4 {
          display: flex;
          width: max-content;
          will-change: transform;
          animation: marqueeRight 150s linear infinite;
        }
        .animate-marquee-slow-5 {
          display: flex;
          width: max-content;
          will-change: transform;
          animation: marqueeLeft 145s linear infinite;
        }
        .animate-marquee-slow-6 {
          display: flex;
          width: max-content;
          will-change: transform;
          animation: marqueeRight 135s linear infinite;
        }

        /* Saat disentuh di HP atau kursor di Laptop, jalanan berhenti agar gampang dibaca */
        .animate-marquee-slow-1:hover, .animate-marquee-slow-1:active,
        .animate-marquee-slow-2:hover, .animate-marquee-slow-2:active,
        .animate-marquee-slow-3:hover, .animate-marquee-slow-3:active,
        .animate-marquee-slow-4:hover, .animate-marquee-slow-4:active,
        .animate-marquee-slow-5:hover, .animate-marquee-slow-5:active,
        .animate-marquee-slow-6:hover, .animate-marquee-slow-6:active {
          animation-play-state: paused;
        }

        .animate-glow {
          animation: pulseGlow 3s ease-in-out infinite;
        }
      `}</style>

      {/* BACKGROUND PATTERN */}
      <div className="absolute inset-0 pointer-events-none opacity-15 bg-[radial-gradient(#34d399_1px,transparent_1px)] [background-size:20px_20px]"></div>

      {/* HEADER HALAMAN */}
      <header className="relative z-10 text-center my-1 sm:my-2 space-y-1 shrink-0">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-[11px] sm:text-xs font-semibold backdrop-blur-md animate-glow">
          <i className="fa-solid fa-users text-amber-300"></i>
          <span>Daftar Warga Terdaftar</span>
          <i className="fa-solid fa-sparkles text-amber-300"></i>
        </div>
        <h1 className="text-xl sm:text-3xl font-black tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-emerald-200 via-teal-100 to-amber-200 drop-shadow-md">
          WARGA PAGUYUBAN PKK
        </h1>
        <p className="text-[11px] sm:text-xs text-emerald-200/80 max-w-xs sm:max-w-md mx-auto leading-relaxed">
          Terima kasih atas partisipasi aktif seluruh warga dalam kegiatan paguyuban!
        </p>
      </header>

      {/* KONTEN UTAMA: 6 BARIS NAMA BERJALAN SANTAI */}
      <main className="relative z-10 flex-1 flex flex-col justify-center my-1 py-1 overflow-hidden rounded-xl">
        {/* GRADIENT OVERLAY DI KIRI DAN KANAN AGAR UJUNG TIKUNGAN PUDAR HALUS */}
        <div className="absolute top-0 bottom-0 left-0 w-3 sm:w-6 bg-gradient-to-r from-emerald-950 via-emerald-950/80 to-transparent z-20 pointer-events-none"></div>
        <div className="absolute top-0 bottom-0 right-0 w-3 sm:w-6 bg-gradient-to-l from-emerald-950 via-emerald-950/80 to-transparent z-20 pointer-events-none"></div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center space-y-2 text-emerald-300 py-12">
            <i className="fa-solid fa-spinner animate-spin text-3xl"></i>
            <p className="text-xs font-medium">Memuat data warga...</p>
          </div>
        ) : wargaList.length === 0 ? (
          <div className="text-center text-emerald-200/60 py-8">
            <i className="fa-solid fa-users-slash text-4xl mb-2 opacity-40"></i>
            <p className="text-xs sm:text-sm">Belum ada data warga untuk ditampilkan.</p>
          </div>
        ) : (
          <div className="w-full space-y-2 sm:space-y-2.5 py-1">
            {/* BARIS 1: Warna-warni Badge */}
            <div className="relative w-full overflow-hidden">
              <div className="animate-marquee-slow-1 gap-2 sm:gap-3 pr-2 sm:pr-3">
                {loopList.map((item, idx) => (
                  <div
                    key={`track1-${item.id}-${idx}`}
                    className={`inline-flex items-center gap-1.5 px-3 py-1 sm:px-3.5 sm:py-1.5 rounded-xl ${item.style.bg} ${item.style.text} ${item.style.border} border shadow-md shrink-0 font-bold text-xs cursor-pointer`}
                  >
                    <span className="text-xs">{item.style.badge}</span>
                    <span>{item.nama}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* BARIS 2: Kaca Transparan Elegant */}
            <div className="relative w-full overflow-hidden">
              <div className="animate-marquee-slow-2 gap-2 sm:gap-3 pr-2 sm:pr-3">
                {[...loopList].reverse().map((item, idx) => (
                  <div
                    key={`track2-${item.id}-${idx}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1 sm:px-3.5 sm:py-1.5 rounded-xl bg-white/10 text-white border border-white/20 shadow-md backdrop-blur-md shrink-0 font-semibold text-xs cursor-pointer"
                  >
                    <i className={`fa-solid ${item.style.icon} text-amber-300 text-[10px]`}></i>
                    <span className="tracking-wide">{item.nama}</span>
                    <span className="text-[10px] opacity-75">🌸</span>
                  </div>
                ))}
              </div>
            </div>

            {/* BARIS 3: Highlight Mahkota Ibu Warga */}
            <div className="relative w-full overflow-hidden">
              <div className="animate-marquee-slow-3 gap-2 sm:gap-3 pr-2 sm:pr-3">
                {loopList.map((item, idx) => (
                  <div
                    key={`track3-${item.id}-${idx}`}
                    className="inline-flex items-center gap-2 px-3 py-1 sm:px-3.5 sm:py-1.5 rounded-full bg-gradient-to-r from-amber-400 to-rose-400 text-zinc-900 border border-amber-200 shadow-md shrink-0 font-extrabold text-xs cursor-pointer"
                  >
                    <span className="w-3.5 h-3.5 rounded-full bg-white/90 flex items-center justify-center text-[9px]">
                      ⭐
                    </span>
                    <span>{item.nama}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* BARIS 4: Fresh Teal & Mint Badge */}
            <div className="relative w-full overflow-hidden">
              <div className="animate-marquee-slow-4 gap-2 sm:gap-3 pr-2 sm:pr-3">
                {[...loopList].reverse().map((item, idx) => (
                  <div
                    key={`track4-${item.id}-${idx}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1 sm:px-3.5 sm:py-1.5 rounded-xl bg-teal-500/80 text-teal-950 border border-teal-300/60 shadow-md shrink-0 font-extrabold text-xs cursor-pointer"
                  >
                    <i className="fa-solid fa-leaf text-emerald-900 text-[10px]"></i>
                    <span>{item.nama}</span>
                    <span className="text-[10px]">✨</span>
                  </div>
                ))}
              </div>
            </div>

            {/* BARIS 5 (BARU): Indigo & Violet Theme */}
            <div className="relative w-full overflow-hidden">
              <div className="animate-marquee-slow-5 gap-2 sm:gap-3 pr-2 sm:pr-3">
                {loopList.map((item, idx) => (
                  <div
                    key={`track5-${item.id}-${idx}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1 sm:px-3.5 sm:py-1.5 rounded-xl bg-indigo-600/90 text-white border border-indigo-300/50 shadow-md shrink-0 font-bold text-xs cursor-pointer"
                  >
                    <i className="fa-solid fa-shield-heart text-amber-300 text-[10px]"></i>
                    <span>{item.nama}</span>
                    <span className="text-[10px]">💎</span>
                  </div>
                ))}
              </div>
            </div>

            {/* BARIS 6 (BARU): Warm Orange & Yellow Theme */}
            <div className="relative w-full overflow-hidden">
              <div className="animate-marquee-slow-6 gap-2 sm:gap-3 pr-2 sm:pr-3">
                {[...loopList].reverse().map((item, idx) => (
                  <div
                    key={`track6-${item.id}-${idx}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1 sm:px-3.5 sm:py-1.5 rounded-xl bg-orange-500/90 text-white border border-orange-300/50 shadow-md shrink-0 font-bold text-xs cursor-pointer"
                  >
                    <i className="fa-solid fa-sun text-yellow-200 text-[10px]"></i>
                    <span>{item.nama}</span>
                    <span className="text-[10px]">🌻</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* FOOTER INFORMASI */}
      <footer className="relative z-10 text-center py-1.5 border-t border-emerald-500/20 text-[10px] sm:text-xs text-emerald-300/80 flex flex-col sm:flex-row items-center justify-between gap-1 shrink-0">
        <div className="flex items-center gap-1.5">
          <i className="fa-solid fa-shield-halved text-emerald-400"></i>
          <span>Data aman &amp; terjaga privasinya</span>
        </div>
        <div>
          Total Warga Terdaftar: <strong className="text-amber-300 font-bold">{wargaList.length} Warga</strong>
        </div>
      </footer>
    </div>
  );
}