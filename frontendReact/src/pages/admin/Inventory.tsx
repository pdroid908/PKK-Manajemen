import { useEffect, useRef, useState, type ChangeEvent, type DragEvent, type FormEvent } from "react";
import { apiFetch } from "../../lib/api";

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
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Loading states
  const [isFetching, setIsFetching] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

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

  const fetchInventory = async () => {
    setIsFetching(true);
    try {
      const res = await apiFetch("/admin/barang");
      if (!res.ok) {
        throw new Error(`Gagal memuat data (${res.status})`);
      }

      const data: InventoryItem[] | null = await res.json().catch(() => null);
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Gagal ambil data:", err);
      showToast("Gagal mengambil data inventaris dari server.", "error");
    } finally {
      setIsFetching(false);
    }
  };

  useEffect(() => {
    let isMounted = true;

    const loadInventory = async () => {
      setIsFetching(true);
      try {
        const res = await apiFetch("/admin/barang");
        if (!res.ok) {
          throw new Error(`Gagal memuat data (${res.status})`);
        }

        const data: InventoryItem[] | null = await res.json().catch(() => null);
        if (isMounted) {
          setItems(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        if (isMounted) {
          console.error("Gagal ambil data:", err);
          showToast("Gagal mengambil data inventaris dari server.", "error");
        }
      } finally {
        if (isMounted) {
          setIsFetching(false);
        }
      }
    };

    void loadInventory();

    return () => {
      isMounted = false;
    };
  }, []);

  // PERBAIKAN: Menembak Endpoint r.POST("/barang/refresh", BarangDb.RefreshB())
  const handleRefreshInventory = async () => {
    setIsFetching(true);
    try {
      await apiFetch("/barang/refresh", {
        method: "POST",
      });
      showToast("Cache berhasil diperbarui!", "success");
    } catch (error) {
      console.error("Gagal memicu refresh barang:", error);
    } finally {
      await fetchInventory();
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

  const handleAdd = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    const formData = new FormData();
    formData.append("name", name.trim());
    formData.append("total_quantity", quantity);
    formData.append("description", description.trim());
    if (file) {
      formData.append("image", file);
    }

    try {
      const res = await apiFetch("/admin/barang", {
        method: "POST",
        body: formData,
      });

      const result = await res.json().catch(() => null);

      if (res.ok) {
        setName("");
        setQuantity("");
        setDescription("");
        setFile(null);
        setPreviewUrl(null);
        await fetchInventory();
        showToast("Barang berhasil ditambahkan!", "success");
      } else {
        showToast(
          `Gagal menambahkan barang: ${result?.err || result?.error || "Terjadi kesalahan"}`,
          "error"
        );
      }
    } catch (err) {
      console.error("Error jaringan/koneksi:", err);
      showToast("Terjadi kesalahan koneksi ke server.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    setIsDeleting(true);
    try {
      const res = await apiFetch("/admin/barang", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: Number(id) }),
      });

      const result = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(result?.error || result?.err || `Gagal menghapus barang (${res.status})`);
      }

      setDeleteId(null);
      await fetchInventory();
      showToast("Barang berhasil dihapus!", "success");
    } catch (error) {
      console.error("Gagal menghapus barang:", error);
      showToast(
        error instanceof Error ? error.message : "Gagal menghapus barang.",
        "error"
      );
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="relative max-w-4xl mx-auto p-6 space-y-8">
      {/* TOAST NOTIFIKASI */}
      {notification.show && (
        <div
          className={`fixed top-5 right-5 z-50 flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-xl text-white font-semibold text-xs sm:text-sm transition-all animate-bounce ${
            notification.type === "success"
              ? "bg-emerald-600 border border-emerald-500"
              : "bg-rose-600 border border-rose-500"
          }`}
        >
          <i
            className={`fa-solid ${
              notification.type === "success"
                ? "fa-circle-check text-lg sm:text-xl"
                : "fa-triangle-exclamation text-lg sm:text-xl"
            }`}
          ></i>
          <span>{notification.message}</span>
        </div>
      )}

      {/* HEADER & BUTTON MUAT ULANG */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 tracking-tight">
            Manajemen Inventaris
          </h1>
          <p className="text-xs sm:text-sm text-zinc-600 mt-1">
            Kelola data barang inventaris dan muat ulang cache data barang.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleRefreshInventory}
            disabled={isFetching}
            className="p-2 px-3.5 text-emerald-700 hover:bg-emerald-50 rounded-xl transition-colors border border-emerald-200 text-xs font-semibold flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <i
              className={`fa-solid fa-rotate ${isFetching ? "animate-spin" : ""}`}
            ></i>
            Muat Ulang
          </button>
          <span className="text-xs font-semibold px-3 py-2 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl">
            Total: {items.length}
          </span>
        </div>
      </div>

      {/* FORM ADD DENGAN DRAG & DROP */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-zinc-200">
        <h2 className="text-lg font-bold mb-4 text-zinc-800">Tambah Barang Baru</h2>
        <form onSubmit={handleAdd} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <input
              className="border p-2.5 rounded-xl text-sm focus:outline-emerald-500"
              placeholder="Nama Barang"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <input
              className="border p-2.5 rounded-xl text-sm focus:outline-emerald-500"
              type="number"
              placeholder="Jumlah"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              required
            />
          </div>

          <input
            className="border p-2.5 rounded-xl w-full text-sm focus:outline-emerald-500"
            placeholder="Deskripsi"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />

          {/* DRAG & DROP AREA */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-700 mb-1.5">
              Foto Barang
            </label>
            <div
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-emerald-300 bg-emerald-50/50 hover:bg-emerald-50 rounded-xl p-6 text-center cursor-pointer transition flex flex-col items-center justify-center gap-2"
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
                    className="h-32 object-contain rounded-lg border shadow-sm"
                  />
                  <span className="text-xs text-zinc-500 mt-1 block">
                    Klik atau seret foto lain untuk mengganti
                  </span>
                </div>
              ) : (
                <>
                  <i className="fa-solid fa-cloud-arrow-up text-3xl text-emerald-600"></i>
                  <p className="text-xs text-zinc-600">
                    <span className="font-bold text-emerald-700">
                      Seret & letakkan foto di sini
                    </span>
                    , atau klik untuk memilih
                  </p>
                  <p className="text-[10px] text-zinc-400">
                    PNG, JPG, atau WEBP
                  </p>
                </>
              )}
            </div>
          </div>

          <button
            disabled={isLoading}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl font-bold text-sm transition shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <i className="fa-solid fa-spinner animate-spin"></i>
                Menambahkan Barang...
              </>
            ) : (
              <>
                <i className="fa-solid fa-plus"></i>
                Tambah Barang
              </>
            )}
          </button>
        </form>
      </div>

      {/* TABLE GET */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-zinc-200">
        <h2 className="text-lg font-bold mb-4 text-zinc-800">Daftar Inventaris</h2>
        {isFetching ? (
          <div className="space-y-3 py-4">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="h-12 bg-zinc-100 rounded-xl animate-pulse w-full"
              ></div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <p className="text-center py-8 text-xs text-zinc-400">
            Belum ada barang di dalam inventaris.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b text-xs text-zinc-500 uppercase tracking-wider">
                  <th className="p-3">Foto</th>
                  <th className="p-3">Nama</th>
                  <th className="p-3">Jumlah</th>
                  <th className="p-3">Deskripsi</th>
                  <th className="p-3 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-emerald-50/30 transition text-sm">
                    <td className="p-3">
                      {item.image ? (
                        <img
                          src={item.image}
                          alt={item.name}
                          className="w-10 h-10 object-cover rounded-md border"
                        />
                      ) : (
                        <div className="w-10 h-10 bg-zinc-100 rounded-md flex items-center justify-center text-[10px] text-zinc-400">
                          No img
                        </div>
                      )}
                    </td>
                    <td className="p-3 font-semibold text-zinc-800">{item.name}</td>
                    <td className="p-3 font-bold text-emerald-700">{item.total_quantity}</td>
                    <td className="p-3 text-zinc-600 text-xs">{item.description || "-"}</td>
                    <td className="p-3 text-center">
                      <button
                        onClick={() => setDeleteId(item.id)}
                        className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-xl text-xs font-semibold transition cursor-pointer"
                      >
                        <i className="fa-solid fa-trash-can mr-1"></i> Hapus
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL DELETE */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white p-6 rounded-2xl space-y-4 max-w-xs w-full shadow-2xl border border-rose-100">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
                <i className="fa-solid fa-triangle-exclamation text-xl"></i>
              </div>
              <h3 className="text-base font-bold text-zinc-900">
                Hapus Barang?
              </h3>
            </div>
            <p className="text-xs text-zinc-600 leading-relaxed">
              Apakah Anda yakin ingin menghapus barang ini dari inventaris?
            </p>
            <div className="flex gap-2 justify-end pt-2">
              <button
                disabled={isDeleting}
                onClick={() => setDeleteId(null)}
                className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-semibold rounded-xl transition cursor-pointer disabled:opacity-50"
              >
                Batal
              </button>
              <button
                disabled={isDeleting}
                onClick={() => handleDelete(deleteId)}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-xl transition shadow-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                {isDeleting && (
                  <i className="fa-solid fa-spinner animate-spin"></i>
                )}
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}