import { useEffect, useState, type FormEvent } from "react";
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
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  // State Form Peminjaman
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [borrowerName, setBorrowerName] = useState("");
  const [quantityBorrowed, setQuantityBorrowed] = useState<number | "">(1);
  const [eventName, setEventName] = useState("");
  const [plannedBorrowDate, setPlannedBorrowDate] = useState("");
  const [plannedReturnDate, setPlannedReturnDate] = useState("");

  // State UI/UX Modal Konfirmasi & Feedback
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{
    type: "success" | "error";
    title: string;
    desc: string;
  } | null>(null);

  const fetchInventory = async () => {
    try {
      const res = await apiFetch("/admin/barang");
      if (!res.ok) throw new Error("Gagal mengambil data dari server.");
      
      let data: InventoryItem[] = [];
      try {
        data = await res.json();
      } catch {
        throw new Error("Respon server tidak valid.");
      }
      setItems(Array.isArray(data) ? data : []);
    } catch (err: unknown) {
      console.error("Gagal mengambil data barang:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;

    const loadInventory = async () => {
      try {
        const res = await apiFetch("/admin/barang");
        if (!res.ok) throw new Error("Gagal mengambil data dari server.");

        let data: InventoryItem[] = [];
        try {
          data = await res.json();
        } catch {
          throw new Error("Respon server tidak valid.");
        }

        if (isMounted) {
          setItems(Array.isArray(data) ? data : []);
        }
      } catch (error) {
        console.error("Gagal mengambil data barang:", error);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadInventory();

    return () => {
      isMounted = false;
    };
  }, []);

  // Tahap 1: Validasi awal lalu buka Modal Konfirmasi
  const handlePreSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedItem) return;

    if (!borrowerName.trim() || !eventName.trim() || !plannedBorrowDate || !plannedReturnDate) {
      setFeedbackMessage({
        type: "error",
        title: "Data Belum Lengkap",
        desc: "Mohon isi semua bidang formulir yang tersedia.",
      });
      return;
    }

    const qty = Number(quantityBorrowed);
    if (!qty || qty <= 0 || qty > selectedItem.total_quantity) {
      setFeedbackMessage({
        type: "error",
        title: "Jumlah Tidak Valid",
        desc: `Jumlah pinjam harus antara 1 sampai ${selectedItem.total_quantity} unit.`,
      });
      return;
    }

    if (new Date(plannedBorrowDate) > new Date(plannedReturnDate)) {
      setFeedbackMessage({
        type: "error",
        title: "Tanggal Tidak Valid",
        desc: "Tanggal kembali tidak boleh lebih awal dari tanggal pinjam.",
      });
      return;
    }

    // Tampilkan modal konfirmasi
    setShowConfirmModal(true);
  };

  // Tahap 2: Eksekusi Kirim ke Server
  const handleFinalSubmit = async () => {
    if (!selectedItem) return;

    setShowConfirmModal(false);
    setIsSubmitting(true);

    try {
      const response = await apiFetch("/user/pinjam", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          item_id: selectedItem.id,
          borrower_name: borrowerName,
          quantity_borrowed: Number(quantityBorrowed),
          event_name: eventName,
          planned_borrow_date: new Date(plannedBorrowDate).toISOString(),
          planned_return_date: new Date(plannedReturnDate).toISOString(),
        }),
      });

      const result: { err?: string; error?: string } | null = await response.json().catch(() => null);
      if (!result) {
        throw new Error("Server mengirimkan tanggapan yang tidak valid.");
      }

      if (!response.ok) throw new Error(result.err || "Gagal mengajukan pinjaman");

      // Sukses
      setSelectedItem(null);
      setBorrowerName("");
      setQuantityBorrowed(1);
      setEventName("");
      setPlannedBorrowDate("");
      setPlannedReturnDate("");

      setFeedbackMessage({
        type: "success",
        title: "Pengajuan Berhasil!",
        desc: "Permintaan peminjaman Anda telah dikirim dan sedang menunggu persetujuan admin.",
      });

      // Refresh data barang untuk memastikan ketersediaan terbaru
      fetchInventory();
    } catch (err: unknown) {
      setFeedbackMessage({
        type: "error",
        title: "Pengajuan Gagal",
        desc: err instanceof Error ? err.message : "Terjadi kesalahan saat menghubungkan ke server.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredItems = items.filter(
    (item) =>
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6 font-sans">
      
      {/* OVERLAY LOADING SAAT MEMPROSES REQUEST */}
      {isSubmitting && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex flex-col items-center justify-center">
          <div className="bg-white p-6 rounded-2xl shadow-xl flex flex-col items-center space-y-3">
            <div className="animate-spin rounded-full h-10 w-10 border-4 border-emerald-600 border-t-transparent"></div>
            <p className="text-zinc-700 text-xs font-semibold">Mengirim pengajuan pinjaman...</p>
          </div>
        </div>
      )}

      {/* MODAL FEEDBACK (SUCCESS / ERROR) */}
      {feedbackMessage && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 text-center space-y-4 shadow-xl animate-in fade-in zoom-in-95 duration-150">
            <div
              className={`w-12 h-12 mx-auto rounded-full flex items-center justify-center text-xl ${
                feedbackMessage.type === "success"
                  ? "bg-emerald-100 text-emerald-600"
                  : "bg-rose-100 text-rose-600"
              }`}
            >
              {feedbackMessage.type === "success" ? "✓" : "✕"}
            </div>
            <div>
              <h3 className="font-bold text-zinc-800 text-base">{feedbackMessage.title}</h3>
              <p className="text-zinc-500 text-xs mt-1 leading-relaxed">{feedbackMessage.desc}</p>
            </div>
            <button
              onClick={() => setFeedbackMessage(null)}
              className="w-full py-2 bg-zinc-900 hover:bg-zinc-800 text-white font-medium text-xs rounded-xl transition cursor-pointer"
            >
              Tutup
            </button>
          </div>
        </div>
      )}

      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-gradient-to-r from-emerald-600 to-teal-700 px-6 py-5 rounded-2xl text-white shadow-md">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">Katalog Barang PKK</h1>
          <p className="text-emerald-100 text-xs md:text-sm">Pilih barang untuk mengajukan peminjaman inventaris kegiatan.</p>
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
                onClick={() => isAvailable && setSelectedItem(item)}
                className={`bg-white rounded-xl border border-zinc-200 shadow-xs transition-all flex flex-col justify-between overflow-hidden group ${
                  isAvailable ? "cursor-pointer hover:shadow-md hover:border-emerald-500" : "opacity-60 cursor-not-allowed bg-zinc-50"
                }`}
              >
                <div className="w-full h-32 bg-zinc-100 relative flex items-center justify-center border-b border-zinc-100">
                  {item.image ? (
                    <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-[11px] text-zinc-400">Tanpa Foto</span>
                  )}
                  <span className={`absolute top-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-semibold text-white shadow-xs ${isAvailable ? "bg-emerald-500" : "bg-rose-500"}`}>
                    {isAvailable ? `Stok: ${item.total_quantity}` : "Habis"}
                  </span>
                </div>
                <div className="p-3.5 space-y-1">
                  <h3 className="font-semibold text-zinc-800 text-sm truncate">{item.name}</h3>
                  <p className="text-zinc-500 text-xs line-clamp-2">{item.description || "Tidak ada deskripsi."}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL FORM PEMINJAMAN LENGKAP */}
      {selectedItem && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 sm:p-8 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150 border-2 border-emerald-500">
            {/* Header Modal */}
            <div className="flex justify-between items-start border-b border-zinc-200 pb-4">
              <div>
                <h2 className="text-xl font-bold text-zinc-900">Form Pengajuan Pinjaman</h2>
                <p className="text-sm font-medium text-zinc-600 mt-1">
                  Barang: <span className="font-bold text-emerald-800 text-base">{selectedItem.name}</span>
                </p>
              </div>
              <button 
                onClick={() => setSelectedItem(null)} 
                className="text-zinc-500 hover:text-zinc-800 font-bold text-xl p-1.5 rounded-lg hover:bg-zinc-100 transition"
              >
                ✕
              </button>
            </div>

            {/* Form Input */}
            <form onSubmit={handlePreSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-zinc-900 mb-1.5">
                  Nama Peminjam / Perwakilan
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Bu Siti (RT 02)"
                  value={borrowerName}
                  onChange={(e) => setBorrowerName(e.target.value)}
                  className="w-full px-4 py-3 text-sm font-medium text-zinc-900 bg-zinc-50 rounded-xl border-2 border-zinc-300 focus:bg-white focus:border-emerald-600 focus:outline-none placeholder-zinc-400"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-zinc-900 mb-1.5">
                  Keperluan Acara & Kontak WA/HP
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Arisan PKK (08123456789)"
                  value={eventName}
                  onChange={(e) => setEventName(e.target.value)}
                  className="w-full px-4 py-3 text-sm font-medium text-zinc-900 bg-zinc-50 rounded-xl border-2 border-zinc-300 focus:bg-white focus:border-emerald-600 focus:outline-none placeholder-zinc-400"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-bold text-zinc-900 mb-1.5">
                    Tanggal Pinjam
                  </label>
                  <input
                    type="date"
                    required
                    value={plannedBorrowDate}
                    onChange={(e) => setPlannedBorrowDate(e.target.value)}
                    className="w-full px-3 py-3 text-sm font-semibold text-zinc-900 bg-zinc-50 rounded-xl border-2 border-zinc-300 focus:bg-white focus:border-emerald-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-zinc-900 mb-1.5">
                    Tanggal Kembali
                  </label>
                  <input
                    type="date"
                    required
                    value={plannedReturnDate}
                    onChange={(e) => setPlannedReturnDate(e.target.value)}
                    className="w-full px-3 py-3 text-sm font-semibold text-zinc-900 bg-zinc-50 rounded-xl border-2 border-zinc-300 focus:bg-white focus:border-emerald-600 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-zinc-900 mb-1.5">
                  Jumlah Pinjam <span className="text-xs font-semibold text-emerald-700">(Maksimal: {selectedItem.total_quantity} unit)</span>
                </label>
                <input
                  type="number"
                  min="1"
                  max={selectedItem.total_quantity}
                  required
                  value={quantityBorrowed}
                  onChange={(e) => {
                    const val = e.target.value;
                    setQuantityBorrowed(val === "" ? "" : Number(val));
                  }}
                  className="w-full px-4 py-3 text-sm font-bold text-zinc-900 bg-zinc-50 rounded-xl border-2 border-zinc-300 focus:bg-white focus:border-emerald-600 focus:outline-none"
                />
              </div>

              {/* Tombol Aksi */}
              <div className="flex justify-end gap-3 pt-4 border-t border-zinc-200">
                <button
                  type="button"
                  onClick={() => setSelectedItem(null)}
                  className="px-5 py-3 rounded-xl border-2 border-zinc-300 text-zinc-800 text-sm font-bold hover:bg-zinc-100 cursor-pointer transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-6 py-3 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 transition cursor-pointer shadow-md"
                >
                  Lanjut ke Konfirmasi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL KONFIRMASI RINGKASAN SEBELUM SUBMIT */}
      {showConfirmModal && selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-base font-bold text-zinc-800 border-b border-zinc-100 pb-2">
              Konfirmasi Pengajuan
            </h3>
            
            <p className="text-xs text-zinc-600">Pastikan rincian peminjaman barang Anda sudah sesuai:</p>

            <div className="bg-zinc-50 p-3 rounded-xl text-xs space-y-2 border border-zinc-200/60">
              <div className="flex justify-between">
                <span className="text-zinc-500">Barang:</span>
                <span className="font-semibold text-zinc-800">{selectedItem.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Peminjam:</span>
                <span className="font-semibold text-zinc-800">{borrowerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Jumlah:</span>
                <span className="font-semibold text-zinc-800">{quantityBorrowed} unit</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Keperluan:</span>
                <span className="font-semibold text-zinc-800">{eventName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Tanggal:</span>
                <span className="font-semibold text-zinc-800">{plannedBorrowDate} s/d {plannedReturnDate}</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 rounded-xl bg-zinc-100 text-zinc-700 text-xs font-semibold hover:bg-zinc-200 transition cursor-pointer"
              >
                Cek Kembali
              </button>
              <button
                type="button"
                onClick={handleFinalSubmit}
                className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition cursor-pointer shadow-xs"
              >
                Ya, Kirim Pengajuan
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}