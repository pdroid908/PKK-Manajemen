import { useRef, useState, type ChangeEvent, type DragEvent, type FormEvent } from "react";
import { apiFetch } from "../../lib/api";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface InventoryItem {
  id: number;
  name: string;
  total_quantity: number;
  description: string;
  image?: string;
  created_at: string;
}

interface NotificationState {
  show: boolean;
  message: string;
  type: "success" | "error";
}

export default function Inventory() {
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Modal & Notification states
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [notification, setNotification] = useState<NotificationState>({
    show: false,
    message: "",
    type: "success",
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setNotification({ show: true, message, type });
    setTimeout(() => {
      setNotification((prev) => ({ ...prev, show: false }));
    }, 3000);
  };

  // 1. FETCH INVENTARIS MENGGUNAKAN TANSTACK REACT QUERY
  const { data: items = [], isLoading: isFetching } = useQuery<InventoryItem[]>({
    queryKey: ["admin-inventory"],
    queryFn: async () => {
      const res = await apiFetch("/api/admin/barang");
      if (!res.ok) {
        throw new Error(`Gagal memuat data (${res.status})`);
      }
      const data: InventoryItem[] | null = await res.json().catch(() => null);
      return Array.isArray(data) ? data : [];
    },
  });

  // 2. MUTATION TAMBAH BARANG MENGGUNAKAN TANSTACK REACT QUERY
  const addMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const res = await apiFetch("/api/admin/barang", {
        method: "POST",
        body: formData,
      });
      const result = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(result?.err || result?.error || "Terjadi kesalahan saat menambah barang");
      }
      return result;
    },
    onSuccess: () => {
      setName("");
      setQuantity("");
      setDescription("");
      setFile(null);
      setPreviewUrl(null);
      showToast("Barang berhasil ditambahkan!", "success");
      void queryClient.invalidateQueries({ queryKey: ["admin-inventory"] });
    },
    onError: (err: unknown) => {
      console.error("Error tambah barang:", err);
      showToast(err instanceof Error ? err.message : "Terjadi kesalahan koneksi ke server.", "error");
    },
  });

  // 3. MUTATION HAPUS BARANG MENGGUNAKAN TANSTACK REACT QUERY
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiFetch("/api/admin/barang", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: Number(id) }),
      });
      const result = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(result?.error || result?.err || `Gagal menghapus barang (${res.status})`);
      }
      return result;
    },
    onSuccess: () => {
      setDeleteId(null);
      showToast("Barang berhasil dihapus!", "success");
      void queryClient.invalidateQueries({ queryKey: ["admin-inventory"] });
    },
    onError: (error: unknown) => {
      console.error("Gagal menghapus barang:", error);
      showToast(error instanceof Error ? error.message : "Gagal menghapus barang.", "error");
    },
  });

  const handleRefreshInventory = async () => {
    try {
      await apiFetch("/api/barang/refresh", {
        method: "POST",
      });
      showToast("Cache berhasil diperbarui!", "success");
      void queryClient.invalidateQueries({ queryKey: ["admin-inventory"] });
    } catch (error) {
      console.error("Gagal memicu refresh barang:", error);
      showToast("Gagal menyinkronkan data.", "error");
    }
  };

  // Handle Drag & Drop
  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const selectedFile = e.dataTransfer.files[0];
      setFile(selectedFile);
      setPreviewUrl(URL.createObjectURL(selectedFile));
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setPreviewUrl(URL.createObjectURL(selectedFile));
    }
  };

  const handleAdd = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const formData = new FormData();
    formData.append("name", name.trim());
    formData.append("total_quantity", quantity);
    formData.append("description", description.trim());
    if (file) {
      formData.append("image", file);
    }

    addMutation.mutate(formData);
  };

  return (
    // Padding kiri kanan dibuat lebih mepet (px-1.5 sm:px-6)
    <div className="relative max-w-5xl mx-auto px-1.5 sm:px-6 py-2 sm:py-6 space-y-3 sm:space-y-6">
      {/* TOAST NOTIFIKASI */}
      {notification.show && (
        <div
          className={`fixed top-5 right-5 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-xl text-white font-semibold text-xs sm:text-sm transition-all animate-bounce ${
            notification.type === "success"
              ? "bg-emerald-600 border border-emerald-500"
              : "bg-rose-600 border border-rose-500"
          }`}
        >
          <i
            className={`fa-solid ${
              notification.type === "success"
                ? "fa-circle-check text-base sm:text-xl"
                : "fa-triangle-exclamation text-base sm:text-xl"
            }`}
          ></i>
          <span>{notification.message}</span>
        </div>
      )}

      {/* HEADER & BUTTON MUAT ULANG */}
      <div className="flex items-center justify-between flex-wrap gap-3 bg-white p-3.5 sm:p-5 rounded-2xl shadow-sm border border-zinc-200">
        <div>
          <h1 className="text-lg sm:text-2xl font-bold text-zinc-900 tracking-tight">
            Manajemen Inventaris
          </h1>
          <p className="text-[11px] sm:text-sm text-zinc-600 mt-0.5">
            Kelola data barang inventaris dan stok dengan mudah.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleRefreshInventory}
            disabled={isFetching}
            className="p-1.5 sm:p-2 px-3 text-emerald-700 hover:bg-emerald-50 rounded-xl transition-colors border border-emerald-200 text-[11px] sm:text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <i
              className={`fa-solid fa-rotate ${isFetching ? "animate-spin" : ""}`}
            ></i>
            Muat Ulang
          </button>
          <span className="text-[11px] sm:text-xs font-semibold px-2.5 py-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl">
            Total: {items.length} Barang
          </span>
        </div>
      </div>

      {/* FORM ADD DENGAN DRAG & DROP */}
      <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-zinc-200">
        <div className="flex items-center gap-2.5 mb-4 pb-3 border-b border-zinc-100">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold shrink-0 shadow-sm text-xs sm:text-base">
            <i className="fa-solid fa-box-open"></i>
          </div>
          <div>
            <h2 className="font-bold text-zinc-900 text-xs sm:text-base">Tambah Barang Baru</h2>
            <p className="text-[10px] sm:text-xs text-zinc-500">Masukkan rincian barang ke dalam sistem</p>
          </div>
        </div>

        <form onSubmit={handleAdd} className="space-y-3 sm:space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
               <label className="block text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-zinc-700 mb-1">Nama Barang</label>
               <input
                 className="w-full border border-zinc-300 p-2 sm:p-2.5 rounded-xl text-xs sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500 bg-zinc-50/50"
                 placeholder="Contoh: Kursi Kantor"
                 value={name}
                 onChange={(e) => setName(e.target.value)}
                 required
               />
            </div>
            <div>
               <label className="block text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-zinc-700 mb-1">Jumlah Stok</label>
               <input
                 className="w-full border border-zinc-300 p-2 sm:p-2.5 rounded-xl text-xs sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500 bg-zinc-50/50"
                 type="number"
                 placeholder="Contoh: 15"
                 value={quantity}
                 onChange={(e) => setQuantity(e.target.value)}
                 required
               />
            </div>
          </div>

          <div>
             <label className="block text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-zinc-700 mb-1">Deskripsi Singkat</label>
             <input
               className="w-full border border-zinc-300 p-2 sm:p-2.5 rounded-xl text-xs sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500 bg-zinc-50/50"
               placeholder="Kondisi barang, lokasi simpan, dll."
               value={description}
               onChange={(e) => setDescription(e.target.value)}
             />
          </div>

          {/* DRAG & DROP AREA */}
          <div>
            <label className="block text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-zinc-700 mb-1">
              Foto Barang <span className="text-zinc-400 font-normal capitalize">(Opsional)</span>
            </label>
            <div
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-emerald-300 bg-emerald-50/50 hover:bg-emerald-50 rounded-xl p-3.5 sm:p-6 text-center cursor-pointer transition flex flex-col items-center justify-center gap-1.5"
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*"
                className="hidden"
              />
              {previewUrl ? (
                <div className="relative">
                  <img
                    src={previewUrl}
                    alt="Preview"
                    className="h-20 sm:h-32 object-contain rounded-lg shadow-sm border border-emerald-100 bg-white p-1"
                  />
                  <span className="text-[10px] sm:text-[11px] text-zinc-500 mt-1.5 block font-medium">
                    <i className="fa-solid fa-pen mr-1"></i> Klik untuk mengganti foto
                  </span>
                </div>
              ) : (
                <>
                  <i className="fa-solid fa-cloud-arrow-up text-2xl sm:text-4xl text-emerald-500 mb-0.5"></i>
                  <p className="text-[11px] sm:text-sm text-zinc-600">
                    <span className="font-bold text-emerald-700">
                      Seret & letakkan foto
                    </span>
                    , atau klik area ini
                  </p>
                  <p className="text-[9px] sm:text-[11px] text-zinc-400">
                    Mendukung format PNG, JPG, JPEG
                  </p>
                </>
              )}
            </div>
          </div>

          <button
            disabled={addMutation.isPending}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 sm:py-3 rounded-xl font-bold text-xs sm:text-sm transition shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-1"
          >
            {addMutation.isPending ? (
              <>
                <i className="fa-solid fa-spinner animate-spin"></i>
                Menyimpan...
              </>
            ) : (
              <>
                <i className="fa-solid fa-floppy-disk"></i>
                Simpan Barang
              </>
            )}
          </button>
        </form>
      </div>

      {/* DAFTAR INVENTARIS */}
      <div className="bg-transparent sm:bg-white sm:p-6 sm:rounded-2xl sm:shadow-sm sm:border sm:border-zinc-200">
        <h2 className="text-base sm:text-lg font-bold mb-3 text-zinc-800 hidden sm:block">Daftar Barang Tersimpan</h2>
        
        {isFetching ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-4">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="h-40 sm:h-48 bg-white sm:bg-zinc-100 rounded-xl animate-pulse w-full border border-zinc-100"></div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 bg-white rounded-2xl border border-zinc-200">
            <i className="fa-solid fa-box-open text-3xl sm:text-5xl text-zinc-300 mb-2"></i>
            <p className="text-[11px] sm:text-sm text-zinc-500 font-medium">Belum ada barang di inventaris.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-4">
            {items.map((item) => (
              <div key={item.id} className="bg-white border border-zinc-200/80 rounded-xl sm:rounded-2xl shadow-sm hover:shadow-md transition-all flex flex-col overflow-hidden group">
                
                {/* BAGIAN FOTO: Diubah dari aspect-square menjadi tinggi tetap yang lebih pendek (h-28 sm:h-36) agar tidak terlalu memakan ruang */}
                <div className="h-28 sm:h-36 w-full bg-zinc-50 border-b border-zinc-100 relative overflow-hidden">
                  {item.image ? (
                    <img
                      src={item.image}
                      alt={item.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-zinc-300 gap-1">
                      <i className="fa-regular fa-image text-xl sm:text-2xl"></i>
                      <span className="text-[8px] sm:text-[9px] font-medium tracking-wide">NO IMAGE</span>
                    </div>
                  )}
                  {/* Badge Total Stok */}
                  <div className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2 bg-white/90 backdrop-blur-xs border border-zinc-200 px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-md sm:rounded-lg shadow-sm flex flex-col items-center leading-none">
                    <span className="text-[8px] sm:text-[9px] font-bold text-zinc-500 uppercase">Stok</span>
                    <span className="font-black text-emerald-700 text-xs sm:text-sm mt-0.5">{item.total_quantity}</span>
                  </div>
                </div>
                
                {/* Bagian Detail */}
                <div className="p-2.5 sm:p-4 flex flex-col flex-1">
                  <h3 className="font-bold text-zinc-800 text-[11px] sm:text-sm line-clamp-2 leading-snug" title={item.name}>
                    {item.name}
                  </h3>
                  
                  <p className="text-[9px] sm:text-xs text-zinc-500 mt-1 line-clamp-2 flex-1 leading-relaxed" title={item.description || ""}>
                    {item.description || "Tidak ada rincian deskripsi."}
                  </p>
                  
                  <div className="mt-2.5 pt-2 sm:mt-3 sm:pt-3 border-t border-zinc-100 border-dashed">
                    <button
                      onClick={() => setDeleteId(item.id)}
                      className="w-full py-1.5 sm:py-2 bg-rose-50 hover:bg-rose-600 text-rose-600 hover:text-white rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1"
                    >
                      <i className="fa-solid fa-trash-can"></i> Hapus
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MODAL DELETE */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white p-5 sm:p-6 rounded-2xl space-y-3 sm:space-y-4 max-w-xs w-full shadow-2xl border border-rose-100">
            <div className="flex items-center gap-2.5 text-rose-600">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
                <i className="fa-solid fa-triangle-exclamation text-base sm:text-xl"></i>
              </div>
              <h3 className="text-sm sm:text-base font-bold text-zinc-900">
                Hapus Barang?
              </h3>
            </div>
            <p className="text-[11px] sm:text-xs text-zinc-600 leading-relaxed">
              Apakah Anda yakin ingin menghapus barang ini dari inventaris secara permanen?
            </p>
            <div className="flex gap-2 justify-end pt-1">
              <button
                disabled={deleteMutation.isPending}
                onClick={() => setDeleteId(null)}
                className="px-3.5 py-1.5 sm:px-4 sm:py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-[11px] sm:text-xs font-semibold rounded-xl transition cursor-pointer disabled:opacity-50"
              >
                Batal
              </button>
              <button
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate(deleteId)}
                className="px-3.5 py-1.5 sm:px-4 sm:py-2 bg-rose-600 hover:bg-rose-700 text-white text-[11px] sm:text-xs font-semibold rounded-xl transition shadow-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                {deleteMutation.isPending ? (
                  <><i className="fa-solid fa-spinner animate-spin"></i> Menghapus...</>
                ) : (
                  "Ya, Hapus"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}