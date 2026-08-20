import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../lib/api";

interface InventoryItem {
  id: number;
  name: string;
  total_quantity: number;
  description: string;
  image?: string;
  created_at: string;
}

export default function BarangUser() {
  const [searchQuery, setSearchQuery] = useState("");

  // FETCH DATA BARANG DENGAN REACT QUERY
  const { data: items = [], isLoading } = useQuery<InventoryItem[]>({
    queryKey: ["inventory-user"],
    queryFn: async () => {
      const res = await apiFetch("admin/barang");
      if (!res.ok) throw new Error("Gagal mengambil data dari server.");
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
  });

  const filteredItems = items.filter(
    (item) =>
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6 font-sans">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-gradient-to-r from-emerald-600 to-teal-700 px-6 py-5 rounded-2xl text-white shadow-md">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">Katalog Barang PKK</h1>
          <p className="text-emerald-100 text-xs md:text-sm">
            Daftar inventaris barang dan jumlah ketersediaan unit.
          </p>
        </div>
        <div className="w-full md:w-64 relative">
          <input
            type="text"
            placeholder="Cari barang..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-3 pr-3 py-2 text-sm rounded-xl bg-white/10 border border-white/20 text-white placeholder-emerald-200 focus:outline-none focus:ring-2 focus:ring-white/30"
          />
        </div>
      </div>

      {/* KATALOG BARANG */}
      {isLoading ? (
        <div className="flex justify-center items-center py-20 text-zinc-400 text-sm">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600 mr-3"></div>
          Memuat data barang...
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="text-center py-16 text-zinc-400 text-sm bg-white rounded-2xl border border-zinc-200">
          Barang tidak ditemukan.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filteredItems.map((item) => {
            const isAvailable = item.total_quantity > 0;
            return (
              <div
                key={item.id}
                className="bg-white rounded-xl border border-zinc-200 shadow-xs flex flex-col justify-between overflow-hidden"
              >
                <div className="w-full h-36 bg-zinc-100 relative flex items-center justify-center border-b border-zinc-100">
                  {item.image ? (
                    <img
                      src={item.image}
                      alt={item.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-xs text-zinc-400">Tanpa Foto</span>
                  )}
                  <span
                    className={`absolute top-2 right-2 px-2.5 py-1 rounded-full text-[10px] font-bold text-white shadow-xs ${
                      isAvailable ? "bg-emerald-600" : "bg-rose-500"
                    }`}
                  >
                    {isAvailable ? `Tersedia: ${item.total_quantity}` : "Habis"}
                  </span>
                </div>
                <div className="p-3.5 space-y-1">
                  <h3 className="font-semibold text-zinc-900 text-sm truncate">
                    {item.name}
                  </h3>
                  <p className="text-zinc-500 text-xs line-clamp-2">
                    {item.description || "Tidak ada deskripsi."}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}