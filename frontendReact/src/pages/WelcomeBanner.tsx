import { useState, useEffect } from "react";

export default function DeveloperSignature() {
  const [show, setShow] = useState(true);
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    // 6.5 detik tampil sebelum slide out
    const timerExit = setTimeout(() => {
      setIsLeaving(true);
    }, 6500);

    // Hilang dari DOM setelah animasi selesai
    const timerRemove = setTimeout(() => {
      setShow(false);
    }, 7200);

    return () => {
      clearTimeout(timerExit);
      clearTimeout(timerRemove);
    };
  }, []);

  if (!show) return null;

  return (
    <>
      {/* CSS KEYFRAMES LANGSUNG INLINE */}
      <style>{`
        @keyframes inlineSlideIn {
          0% {
            opacity: 0;
            transform: translateX(120%) scale(0.95);
          }
          70% {
            opacity: 1;
            transform: translateX(-8px) scale(1.02);
          }
          100% {
            opacity: 1;
            transform: translateX(0) scale(1);
          }
        }

        @keyframes inlineSlideOut {
          0% {
            opacity: 1;
            transform: translateX(0) scale(1);
          }
          100% {
            opacity: 0;
            transform: translateX(130%) scale(0.9);
          }
        }

        @keyframes inlineWave {
          0%, 100% { transform: rotate(0deg); }
          20% { transform: rotate(26deg); }
          60% { transform: rotate(-18deg); }
        }

        @keyframes inlineFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-3px); }
        }

        @keyframes inlineProgress {
          from { width: 100%; }
          to { width: 0%; }
        }

        .animate-inline-in {
          animation: inlineSlideIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        .animate-inline-out {
          animation: inlineSlideOut 0.7s cubic-bezier(0.7, 0, 0.84, 0) forwards;
        }

        .inline-wave-hand {
          display: inline-block !important;
          transform-origin: 70% 70%;
          animation: inlineWave 1.3s infinite ease-in-out;
        }

        .inline-float-box {
          animation: inlineFloat 2.5s ease-in-out infinite;
        }

        .inline-progress-bar {
          animation: inlineProgress 6.5s linear forwards;
        }
      `}</style>

      {/* CONTAINER POPUP FLOATING */}
      <div className="fixed top-3 right-3 sm:top-5 sm:right-5 z-[9999] w-[88%] max-w-[280px] sm:max-w-xs pointer-events-none">
        <div
          className={`pointer-events-auto relative overflow-hidden rounded-xl bg-emerald-950/95 border border-emerald-500/50 p-3 shadow-xl backdrop-blur-2xl transition-all ${isLeaving ? "animate-inline-out" : "animate-inline-in"}`}
        >
          <div className="relative z-10 flex items-start gap-3">
            {/* ICON */}
            <div className="inline-float-box shrink-0 flex items-center justify-center w-9 h-9 rounded-lg bg-emerald-600 text-white">
              <span className="text-lg">👋</span>
            </div>

            {/* CONTENT */}
            <div className="flex-1 min-w-0">
              {/* LABEL PENGURUS */}
              <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-400 block mb-0.5">
                Pengurus PKK
              </span>

              <h3 className="text-sm font-bold text-white leading-tight">
                Halo Warga Temboro Kidul!
              </h3>

              <p className="text-[11px] text-emerald-200 mt-1 leading-relaxed">
                Selamat datang di portal kami. Pantau keuangan & inventaris
                lingkungan dengan mudah dan transparan.
              </p>
            </div>

            {/* CLOSE BUTTON */}
            <button
              onClick={() => setIsLeaving(true)}
              className="text-emerald-400 hover:text-white transition"
            >
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>

          {/* PROGRESS TIMER */}
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-900">
            <div className="inline-progress-bar h-full bg-emerald-400"></div>
          </div>
        </div>
      </div>
    </>
  );
}
