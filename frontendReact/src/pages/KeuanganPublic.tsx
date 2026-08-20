import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../lib/api";

interface FinanceTransaction {
  id: number;
  title: string;
  type: "INCOME" | "EXPENSE";
  amount: number;
  balance_after: number;
  proof_image?: string;
  transaction_date: string;
}

interface FinanceResponse {
  message?: string;
  data?: FinanceTransaction[];
  error?: string;
}

export default function KeuanganPublic() {
  const [hoveredItem, setHoveredItem] = useState<FinanceTransaction | null>(null);

  // MENGGUNAKAN REACT QUERY (DATA DICACHE OTOMATIS)
  const {
    data: transactions = [],
    isLoading: isFetching,
    isError,
    error,
    refetch: fetchKeuanganPublic,
  } = useQuery<FinanceTransaction[]>({
    queryKey: ["keuangan-public"],
    queryFn: async () => {
      const response = await apiFetch("admin/data/amount");
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("Server tidak mengembalikan format JSON.");
      }

      const result: FinanceResponse = await response.json();

      if (response.ok && (result.data || Array.isArray(result))) {
        return Array.isArray(result) ? result : result.data || [];
      }
      throw new Error(result.error || "Gagal memuat data keuangan.");
    },
  });

  const formatRupiah = (val: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(val);
  };

  const currentBalance =
    transactions.length > 0
      ? transactions[transactions.length - 1].balance_after
      : 0;
  const totalIncome = transactions
    .filter((t) => t.type === "INCOME")
    .reduce((acc, curr) => acc + curr.amount, 0);
  const totalExpense = transactions
    .filter((t) => t.type === "EXPENSE")
    .reduce((acc, curr) => acc + curr.amount, 0);

  const chartData = [...transactions].slice(-12);

  const isOverallUp =
    chartData.length >= 2
      ? chartData[chartData.length - 1].balance_after >= chartData[0].balance_after
      : true;

  const themeColor = isOverallUp ? "#10b981" : "#ef4444";

  const maxBalance =
    chartData.length > 0
      ? Math.max(...chartData.map((t) => t.balance_after))
      : 1;

  const activeDisplayItem =
    hoveredItem ||
    (chartData.length > 0 ? chartData[chartData.length - 1] : null);

  const svgHeight = 280;
  const paddingTop = 25;
  const paddingBottom = 45;
  const chartHeight = svgHeight - paddingTop - paddingBottom;

  const columnWidth = 44;
  const dynamicInnerWidth = Math.max(320, chartData.length * columnWidth);

  return (
    <div className="max-w-4xl mx-auto space-y-3 pb-12 px-3 sm:px-4 font-sans">
      {/* HEADER */}
      <div className="flex items-center justify-between bg-gradient-to-r from-emerald-900 to-emerald-800 p-4 rounded-2xl shadow-sm text-white">
        <div>
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-200 bg-emerald-800/80 px-2.5 py-0.5 rounded-md border border-emerald-700">
            Keuangan Kas PKK
          </span>
          <h1 className="text-lg sm:text-xl font-black mt-0.5 tracking-tight">
            Transparansi Warga
          </h1>
        </div>
        <button
          type="button"
          onClick={() => void fetchKeuanganPublic()}
          disabled={isFetching}
          className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl transition text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 border border-white/10"
        >
          <i
            className={`fa-solid fa-rotate ${isFetching ? "animate-spin" : ""}`}
          ></i>
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </div>

      {/* MINI STATS */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <div className="bg-white p-3 rounded-2xl border border-slate-100 shadow-xs">
          <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Saldo Aktif
          </p>
          <p className="text-xs sm:text-base font-black text-slate-900 mt-0.5 truncate">
            {isFetching ? "..." : formatRupiah(currentBalance)}
          </p>
        </div>
        <div className="bg-white p-3 rounded-2xl border border-slate-100 shadow-xs">
          <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Pemasukan
          </p>
          <p className="text-xs sm:text-base font-black text-emerald-600 mt-0.5 truncate">
            {isFetching ? "..." : formatRupiah(totalIncome)}
          </p>
        </div>
        <div className="bg-white p-3 rounded-2xl border border-slate-100 shadow-xs">
          <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Pengeluaran
          </p>
          <p className="text-xs sm:text-base font-black text-rose-600 mt-0.5 truncate">
            {isFetching ? "..." : formatRupiah(totalExpense)}
          </p>
        </div>
      </div>

      {/* SECTION UTAMA: GRAFIK */}
      <div className="bg-white text-slate-900 rounded-3xl p-4 sm:p-6 shadow-sm border border-slate-100 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span
                className={`w-2.5 h-2.5 rounded-full ${isOverallUp ? "bg-emerald-500" : "bg-rose-500"} animate-pulse`}
              ></span>
              <h3 className="text-xs sm:text-sm font-black tracking-wide text-slate-800 uppercase">
                Statistik & Tren Saldo Kas
              </h3>
            </div>
            <p className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
              {activeDisplayItem
                ? formatRupiah(activeDisplayItem.balance_after)
                : formatRupiah(currentBalance)}
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5 font-medium">
              {activeDisplayItem
                ? `📅 ${activeDisplayItem.transaction_date} • ${activeDisplayItem.title}`
                : "💡 Arahkan kursor ke batang grafik untuk melihat detail transaksi."}
            </p>
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-2">
            <span
              className={`text-[10px] font-black px-3 py-1.5 rounded-xl border ${isOverallUp ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-rose-50 text-rose-700 border-rose-200"}`}
            >
              {isOverallUp ? "▲ Performa Naik" : "▼ Performa Turun"}
            </span>
          </div>
        </div>

        {isFetching ? (
          <div className="h-64 sm:h-72 flex items-center justify-center bg-slate-50 rounded-2xl animate-pulse">
            <p className="text-xs font-bold text-slate-400">
              Memuat visualisasi statistik...
            </p>
          </div>
        ) : chartData.length < 2 ? (
          <div className="h-64 sm:h-72 flex items-center justify-center bg-slate-50 rounded-2xl text-slate-400 text-xs">
            Data transaksi belum cukup untuk menampilkan statistik grafik.
          </div>
        ) : (
          <div className="relative w-full bg-slate-50/80 rounded-2xl p-1 sm:p-3 border border-slate-100 flex overflow-hidden">
            <div className="w-[30px] sm:w-[42px] shrink-0 select-none pointer-events-none bg-slate-50/90 z-10">
              <svg viewBox={`0 0 42 ${svgHeight}`} className="w-full h-64 sm:h-72">
                {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
                  const y = paddingTop + chartHeight * (1 - ratio);
                  const val = maxBalance * ratio;
                  return (
                    <text
                      key={idx}
                      x="34"
                      y={y + 3}
                      fill="#64748b"
                      fontSize="9"
                      textAnchor="end"
                      fontWeight="700"
                    >
                      {val >= 1000000
                        ? `${(val / 1000000).toFixed(1)}jt`
                        : `${Math.round(val / 1000)}rb`}
                    </text>
                  );
                })}
                <line
                  x1="40"
                  y1={paddingTop}
                  x2="40"
                  y2={svgHeight - paddingBottom}
                  stroke="#cbd5e1"
                  strokeWidth="2"
                />
              </svg>
            </div>

            <div
              className="relative flex-1 overflow-x-auto scroll-smooth pb-1"
              ref={(el) => {
                if (el) {
                  el.scrollLeft = el.scrollWidth;
                }
              }}
            >
              <svg
                viewBox={`0 0 ${dynamicInnerWidth} ${svgHeight}`}
                className="h-64 sm:h-72 overflow-visible"
                style={{ width: `${dynamicInnerWidth}px` }}
              >
                {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
                  const y = paddingTop + chartHeight * (1 - ratio);
                  return (
                    <line
                      key={idx}
                      x1="0"
                      y1={y}
                      x2={dynamicInnerWidth}
                      y2={y}
                      stroke="#e2e8f0"
                      strokeDasharray="3 3"
                      strokeWidth="1"
                    />
                  );
                })}

                <line
                  x1="0"
                  y1={svgHeight - paddingBottom}
                  x2={dynamicInnerWidth}
                  y2={svgHeight - paddingBottom}
                  stroke="#cbd5e1"
                  strokeWidth="2"
                />

                {chartData.map((item, index) => {
                  const actualBarW = 28;
                  const x = index * columnWidth + (columnWidth - actualBarW) / 2;
                  const barHeight = Math.max(
                    (item.balance_after / maxBalance) * chartHeight,
                    10,
                  );
                  const y = svgHeight - paddingBottom - barHeight;
                  const isSelected = activeDisplayItem?.id === item.id;
                  const rawDate = item.transaction_date.slice(0, 10);
                  const parts = rawDate.split("-");

                  return (
                    <g
                      key={index}
                      className="cursor-pointer group"
                      onMouseEnter={() => setHoveredItem(item)}
                      onMouseLeave={() => setHoveredItem(null)}
                    >
                      <rect
                        x={x}
                        y={y}
                        width={actualBarW}
                        height={barHeight}
                        rx="4"
                        fill={isSelected ? "#0f172a" : themeColor}
                        className="transition-all duration-200 opacity-90 hover:opacity-100"
                      />
                      <text
                        x={x + actualBarW / 2}
                        y={svgHeight - paddingBottom + 16}
                        fill={isSelected ? "#0f172a" : "#64748b"}
                        fontSize="9"
                        fontWeight={isSelected ? "800" : "600"}
                        textAnchor="middle"
                      >
                        {parts.length === 3
                          ? `${parts[2]}-${parts[1]}`
                          : rawDate}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>
        )}
      </div>

      {/* TABEL RIWAYAT ARUS KAS */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-4 sm:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xs sm:text-sm font-black text-slate-900">
              Riwayat Arus Kas Lengkap
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Daftar seluruh transaksi masuk dan keluar kas warga PKK.
            </p>
          </div>
          <span className="text-[10px] font-extrabold px-3 py-1 bg-slate-100 text-slate-700 rounded-xl">
            {transactions.length} Transaksi Tercatat
          </span>
        </div>

        {isFetching ? (
          <div className="space-y-2 py-4">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="h-12 bg-slate-100 rounded-xl animate-pulse w-full"
              ></div>
            ))}
          </div>
        ) : isError ? (
          <div className="py-6 text-center text-rose-600 text-xs font-semibold">
            {error instanceof Error ? error.message : "Gagal memuat data."}
          </div>
        ) : transactions.length === 0 ? (
          <div className="py-8 text-center text-slate-400 text-xs font-medium">
            Belum ada data transaksi yang tersedia.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50/70 text-slate-700 font-bold uppercase text-[9px] tracking-wider border-b border-slate-100">
                <tr>
                  <th className="py-3.5 px-4 rounded-l-2xl">Tanggal & Waktu</th>
                  <th className="py-3.5 px-4">Keterangan Transaksi</th>
                  <th className="py-3.5 px-4">Tipe</th>
                  <th className="py-3.5 px-4">Nominal</th>
                  <th className="py-3.5 px-4 rounded-r-2xl">Saldo Akhir</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[...transactions].reverse().map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-slate-50/80 transition-colors group"
                  >
                    <td className="py-4 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 group-hover:bg-white group-hover:shadow-xs transition">
                          <i className="fa-regular fa-calendar-days text-[11px]"></i>
                        </div>
                        <div>
                          <p className="font-bold text-slate-800">
                            {new Date(item.transaction_date).toLocaleDateString(
                              "id-ID",
                              {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              },
                            )}
                          </p>
                          <p className="text-[10px] text-slate-400 font-medium">
                            {new Date(item.transaction_date).toLocaleTimeString(
                              "id-ID",
                              {
                                hour: "2-digit",
                                minute: "2-digit",
                              },
                            )}{" "}
                            WIB
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="py-4 px-4">
                      <p className="font-bold text-slate-900 text-xs sm:text-sm line-clamp-2 max-w-xs sm:max-w-md">
                        {item.title}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        ID Transaksi: #{item.id}
                      </p>
                    </td>

                    <td className="py-4 px-4 whitespace-nowrap">
                      {item.type === "INCOME" ? (
                        <span className="px-2.5 py-1 rounded-lg text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200 inline-flex items-center gap-1">
                          <i className="fa-solid fa-arrow-down-left"></i> Masuk
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-lg text-[10px] font-black bg-rose-50 text-rose-700 border border-rose-200 inline-flex items-center gap-1">
                          <i className="fa-solid fa-arrow-up-right"></i> Keluar
                        </span>
                      )}
                    </td>

                    <td
                      className={`py-4 px-4 font-black whitespace-nowrap text-sm ${item.type === "INCOME" ? "text-emerald-600" : "text-rose-600"}`}
                    >
                      {item.type === "INCOME" ? "+" : "-"}{" "}
                      {formatRupiah(item.amount)}
                    </td>

                    <td className="py-4 px-4 font-black text-slate-900 whitespace-nowrap text-sm">
                      {formatRupiah(item.balance_after)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}