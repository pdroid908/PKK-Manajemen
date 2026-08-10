import { useEffect, useState, useMemo, type FormEvent } from "react";
import * as XLSX from "xlsx";
import { apiFetch } from "../../lib/api";

interface WargaItem {
  id: string;
  nama: string;
  rt_rw: string;
  no_hp: string | null;
  is_aktif: boolean;
  created_at: string;
}

interface NotificationState {
  show: boolean;
  message: string;
  type: "success" | "error";
}

export default function WargaManagement() {
  const [downloadExcelModal, setDownloadExcelModal] = useState<boolean>(false);

  // State Form Input Warga
  const [nama, setNama] = useState<string>("");
  const [rtRw, setRtRw] = useState<string>("");
  const [noHp, setNoHp] = useState<string>("");

  // Filter States
  const [filterAktifOnly, setFilterAktifOnly] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedLetter, setSelectedLetter] = useState<string>("ALL");

  // Loading States
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isFetchingInitial, setIsFetchingInitial] = useState<boolean>(true);

  const [items, setItems] = useState<WargaItem[]>([]);

  // Modal States
  const [createModal, setCreateModal] = useState<boolean>(false);
  const [deleteModal, setDeleteModal] = useState<{
    show: boolean;
    id: string | null;
    nama: string;
  }>({
    show: false,
    id: null,
    nama: "",
  });

  // Toast Notification State
  const [notification, setNotification] = useState<NotificationState>({
    show: false,
    message: "",
    type: "success",
  });

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setNotification({ show: true, message, type });
    setTimeout(() => {
      setNotification((prev) => ({ ...prev, show: false }));
    }, 3500);
  };

  // 1. Fetch Data Warga
  const fetchWarga = async () => {
    try {
      const endpoint = filterAktifOnly ? "/warga/data?aktif=true" : "/warga/data";
      const response = await apiFetch(endpoint);

      if (!response.ok) {
        throw new Error(`Server error (${response.status})`);
      }

      const result: { data?: WargaItem[] } | null = await response.json().catch(() => null);
      if (!result) {
        throw new Error("Respon server tidak valid.");
      }

      if (Array.isArray(result.data)) {
        setItems(result.data);
      } else {
        setItems([]);
      }
    } catch (error: unknown) {
      console.error("Gagal mengambil data warga:", error);
      showToast(error instanceof Error ? error.message : "Gagal memuat data warga.", "error");
    } finally {
      setIsFetchingInitial(false);
    }
  };

  useEffect(() => {
    void fetchWarga();
  }, [filterAktifOnly]);

  // Filtering Data berdasarkan Search Query dan Abjad
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesSearch =
        item.nama.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.rt_rw.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.no_hp && item.no_hp.includes(searchQuery));

      const matchesLetter =
        selectedLetter === "ALL"
          ? true
          : item.nama.trim().toUpperCase().startsWith(selectedLetter);

      return matchesSearch && matchesLetter;
    });
  }, [items, searchQuery, selectedLetter]);
    
    // Handler Aktifkan Kembali
const handleRestore = async (id: string) => {
  try {
    const response = await apiFetch(`/warga/restore/${id}`, { method: "PUT" });
    if (response.ok) {
      await fetchWarga();
      showToast("Warga berhasil diaktifkan kembali!", "success");
    }
  } catch (error) {
    showToast("Gagal mengaktifkan warga.", "error");
  }
};

// Handler Hapus Permanen
const handleHardDelete = async (id: string) => {
  if (!confirm("Apakah Anda yakin ingin menghapus PERMANEN data ini? Data tidak bisa dikembalikan!")) return;
  try {
    const response = await apiFetch(`/warga/delete/${id}`, { method: "DELETE" });
    if (response.ok) {
      await fetchWarga();
      showToast("Data warga berhasil dihapus permanen!", "success");
    }
  } catch (error) {
    showToast("Gagal menghapus data secara permanen.", "error");
  }
};

  const handleOpenCreateModal = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!nama) {
      showToast("Nama warga wajib diisi!", "error");
      return;
    }
    setCreateModal(true);
  };

  // 2. Eksekusi Tambah Data Warga (POST /warga/add)
  const handleConfirmCreate = async () => {
    setCreateModal(false);
    setIsCreating(true);

    try {
      const payload = {
        nama: nama,
        rt_rw: rtRw || "RT 01/RW 01",
        no_hp: noHp ? noHp : null,
      };

      const response = await apiFetch("/warga/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result: { error?: string } | null = await response.json().catch(() => null);
      if (!result) {
        throw new Error("Respon server tidak valid.");
      }

      if (response.ok) {
        setNama("");
        setRtRw("");
        setNoHp("");

        await fetchWarga();
        showToast("Warga berhasil ditambahkan!", "success");
      } else {
        showToast("Gagal menyimpan: " + (result.error || "Terjadi kesalahan"), "error");
      }
    } catch (error: unknown) {
      console.error("Submit Error:", error);
      showToast(error instanceof Error ? error.message : "Tidak dapat terhubung ke server backend.", "error");
    } finally {
      setIsCreating(false);
    }
  };

  // 3. Refresh Data & Invalidate Cache (POST /warga/refresh)
  const handleRefreshWarga = async () => {
    setIsRefreshing(true);
    try {
      await apiFetch("/warga/refresh", { method: "POST" });
      await fetchWarga();
      showToast("Cache dibersihkan & data warga diperbarui!", "success");
    } catch (error) {
      console.error("Gagal memicu refresh backend:", error);
      showToast("Gagal menyinkronkan data.", "error");
    } finally {
      setIsRefreshing(false);
    }
  };

  // 4. Eksekusi Soft Delete (FIX: PUT /warga/update/:id)
  const handleDeleteConfirm = async () => {
    if (!deleteModal.id) return;
    setIsDeleting(true);

    try {
      // PERBAIKAN: Menggunakan URL parameter sesuai r.PUT("/warga/update/:id")
      const response = await apiFetch(`/warga/update/${deleteModal.id}`, {
        method: "PUT",
      });

      const result: { error?: string; message?: string } | null = await response.json().catch(() => null);
      if (!result) {
        throw new Error("Respon server tidak valid.");
      }

      if (response.ok) {
        setDeleteModal({ show: false, id: null, nama: "" });
        await fetchWarga();
        showToast("Status warga berhasil dinonaktifkan!", "success");
      } else {
        showToast("Gagal mengubah status: " + (result.error || "Terjadi kesalahan"), "error");
      }
    } catch (error: unknown) {
      console.error("Error soft deleting item:", error);
      showToast(error instanceof Error ? error.message : "Tidak dapat terhubung ke server backend.", "error");
    } finally {
      setIsDeleting(false);
    }
  };

  // Export Excel
  const handleExportExcel = () => {
    setDownloadExcelModal(false);
    if (filteredItems.length === 0) {
      showToast("Tidak ada data untuk diunduh!", "error");
      return;
    }

    const excelData = filteredItems.map((item, index) => ({
      No: index + 1,
      ID: item.id,
      Nama: item.nama,
      "RT/RW": item.rt_rw,
      "No HP": item.no_hp || "-",
      Status: item.is_aktif ? "Aktif" : "Nonaktif",
      "Tanggal Dibuat": new Date(item.created_at).toLocaleDateString("id-ID"),
    }));

    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Data_Warga");

    XLSX.writeFile(workbook, `Data_Warga_${new Date().toISOString().split("T")[0]}.xlsx`);
    showToast("Berhasil mengunduh data warga ke Excel!", "success");
  };

  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

  return (
    <div className="relative">
      {/* TOAST NOTIFIKASI */}
      {notification.show && (
        <div
          className={`fixed top-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl text-white font-semibold text-xs sm:text-sm transition-all animate-bounce ${
            notification.type === "success"
              ? "bg-emerald-600 border border-emerald-500"
              : "bg-rose-600 border border-rose-500"
          }`}
        >
          <i
            className={`fa-solid ${
              notification.type === "success"
                ? "fa-circle-check text-lg"
                : "fa-triangle-exclamation text-lg"
            }`}
          ></i>
          <span>{notification.message}</span>
        </div>
      )}

      {/* MODAL DOWNLOAD EXCEL */}
      {downloadExcelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-2xl p-5 sm:p-6 max-w-md w-full shadow-2xl border border-emerald-100 space-y-4">
            <div className="flex items-center gap-3 text-emerald-600">
              <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                <i className="fa-solid fa-file-excel text-lg"></i>
              </div>
              <h3 className="text-base sm:text-lg font-bold text-zinc-900">Unduh Data Excel</h3>
            </div>
            <p className="text-xs sm:text-sm text-zinc-600 leading-relaxed">
              Apakah Anda yakin ingin mengunduh data warga yang tampil (
              <strong className="text-zinc-900">{filteredItems.length} data</strong>) ke format file Excel?
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDownloadExcelModal(false)}
                className="px-3.5 py-1.5 sm:px-4 sm:py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs sm:text-sm font-semibold rounded-xl transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleExportExcel}
                className="px-3.5 py-1.5 sm:px-4 sm:py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold rounded-xl transition-colors shadow-sm cursor-pointer flex items-center gap-2"
              >
                <i className="fa-solid fa-download"></i>
                Ya, Unduh Excel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL KONFIRMASI TAMBAH */}
      {createModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-2xl p-5 sm:p-6 max-w-md w-full shadow-2xl border border-emerald-100 space-y-4">
            <div className="flex items-center gap-3 text-emerald-600">
              <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                <i className="fa-solid fa-user-plus text-lg"></i>
              </div>
              <h3 className="text-base sm:text-lg font-bold text-zinc-900">Konfirmasi Tambah Warga</h3>
            </div>
            <p className="text-xs sm:text-sm text-zinc-600 leading-relaxed">
              Apakah Anda yakin ingin menambahkan data warga{" "}
              <strong className="text-zinc-900">"{nama}"</strong> ke database?
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setCreateModal(false)}
                className="px-3.5 py-1.5 sm:px-4 sm:py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs sm:text-sm font-semibold rounded-xl transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmCreate}
                className="px-3.5 py-1.5 sm:px-4 sm:py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold rounded-xl transition-colors shadow-sm cursor-pointer"
              >
                Ya, Simpan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL KONFIRMASI DELETE */}
      {deleteModal.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-2xl p-5 sm:p-6 max-w-md w-full shadow-2xl border border-rose-100 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-9 h-9 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
                <i className="fa-solid fa-user-slash text-lg"></i>
              </div>
              <h3 className="text-base sm:text-lg font-bold text-zinc-900">Konfirmasi Nonaktifkan</h3>
            </div>
            <p className="text-xs sm:text-sm text-zinc-600 leading-relaxed">
              Apakah Anda yakin ingin menonaktifkan warga{" "}
              <strong className="text-zinc-900">"{deleteModal.nama}"</strong>? Statusnya akan berubah menjadi Nonaktif.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeleteModal({ show: false, id: null, nama: "" })}
                className="px-3.5 py-1.5 sm:px-4 sm:py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs sm:text-sm font-semibold rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDeleteConfirm}
                className="px-3.5 py-1.5 sm:px-4 sm:py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs sm:text-sm font-semibold rounded-xl transition-colors shadow-sm flex items-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {isDeleting ? (
                  <>
                    <i className="fa-solid fa-spinner animate-spin"></i>
                    Memproses...
                  </>
                ) : (
                  "Ya, Nonaktifkan"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HEADER DAN CONTROL BAR */}
      <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3 mb-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setDownloadExcelModal(true)}
            className="px-2.5 py-1.5 sm:px-3 sm:py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors text-xs font-semibold flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <i className="fa-solid fa-file-excel"></i> Excel
          </button>

          <button
            onClick={handleRefreshWarga}
            disabled={isRefreshing}
            className="p-1.5 sm:p-2 text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors border border-emerald-200 text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
          >
            <i className={`fa-solid fa-rotate ${isRefreshing ? "animate-spin" : ""}`}></i>
            {isRefreshing ? "Memuat..." : "Muat Ulang"}
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setFilterAktifOnly(!filterAktifOnly)}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer flex items-center gap-1.5 ${
              filterAktifOnly
                ? "bg-emerald-600 text-white border-emerald-600"
                : "bg-white text-zinc-700 border-zinc-300 hover:bg-zinc-50"
            }`}
          >
            <i className={`fa-solid ${filterAktifOnly ? "fa-filter" : "fa-list"}`}></i>
            {filterAktifOnly ? "Hanya Aktif" : "Semua Warga"}
          </button>

          <span className="text-xs font-semibold px-2.5 py-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg">
            Total: {filteredItems.length}
          </span>
        </div>
      </div>

      <div className="mb-4 sm:mb-6">
        <h1 className="text-lg sm:text-2xl font-bold text-zinc-900 tracking-tight">
          Kelola Data Warga
        </h1>
        <p className="text-xs sm:text-sm text-zinc-600 mt-0.5">
          Tambah data warga baru, pantau status aktif/nonaktif, dan integrasi Redis cache.
        </p>
      </div>

      <div className="flex flex-col gap-5 sm:gap-8 max-w-5xl mx-auto">
        {/* PANEL INPUT WARGA (LEBIH RINGKAS DI MOBILE) */}
        <div className="bg-white rounded-2xl border border-emerald-200/80 shadow-xs p-4 sm:p-6">
          <div className="flex items-center gap-2.5 mb-4 pb-3 border-b border-emerald-100">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold shrink-0 shadow-xs text-sm sm:text-base">
              <i className="fa-solid fa-user-plus"></i>
            </div>
            <div>
              <h2 className="font-bold text-zinc-900 text-xs sm:text-base">Input Warga Baru</h2>
              <p className="text-[11px] sm:text-xs text-zinc-500">Tambahkan informasi warga ke database</p>
            </div>
          </div>

          <form onSubmit={handleOpenCreateModal} className="space-y-3 sm:space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-4">
              <div>
                <label className="block text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-zinc-700 mb-1">
                  Nama Lengkap *
                </label>
                <input
                  type="text"
                  value={nama}
                  onChange={(e) => setNama(e.target.value)}
                  placeholder="Contoh: Budi Santoso"
                  required
                  className="w-full px-3 py-2 bg-zinc-50/80 border border-zinc-300 rounded-xl text-xs sm:text-sm focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500 transition-all text-zinc-900"
                />
              </div>

              <div>
                <label className="block text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-zinc-700 mb-1">
                  RT / RW <span className="text-zinc-400 font-normal">(Opsional)</span>
                </label>
                <input
                  type="text"
                  value={rtRw}
                  onChange={(e) => setRtRw(e.target.value)}
                  placeholder="Contoh: RT 02/RW 01"
                  className="w-full px-3 py-2 bg-zinc-50/80 border border-zinc-300 rounded-xl text-xs sm:text-sm focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500 transition-all text-zinc-900"
                />
              </div>

              <div>
                <label className="block text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-zinc-700 mb-1">
                  No. Telepon / HP <span className="text-zinc-400 font-normal">(Opsional)</span>
                </label>
                <input
                  type="text"
                  value={noHp}
                  onChange={(e) => setNoHp(e.target.value)}
                  placeholder="Contoh: 08123456789"
                  className="w-full px-3 py-2 bg-zinc-50/80 border border-zinc-300 rounded-xl text-xs sm:text-sm focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500 transition-all text-zinc-900"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isCreating}
              className="w-full mt-2 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs sm:text-sm rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {isCreating ? (
                <>
                  <i className="fa-solid fa-spinner animate-spin"></i>
                  Menyimpan ke Database...
                </>
              ) : (
                <>
                  <i className="fa-solid fa-floppy-disk"></i>
                  Simpan Warga
                </>
              )}
            </button>
          </form>
        </div>

        {/* DAFTAR DATA WARGA WITH FILTER & SEARCH */}
        <div className="bg-white rounded-2xl border border-emerald-200/80 shadow-xs p-4 sm:p-6 flex flex-col">
          <div className="flex flex-col gap-3 mb-4 pb-3 border-b border-emerald-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold shadow-xs shrink-0 text-sm sm:text-base">
                  <i className="fa-solid fa-users"></i>
                </div>
                <div>
                  <h2 className="font-bold text-zinc-900 text-xs sm:text-base">
                    Daftar Seluruh Warga
                  </h2>
                  <p className="text-[11px] sm:text-xs text-zinc-500">Master data warga terdaftar</p>
                </div>
              </div>
            </div>

            {/* BAR PENCARIAN (SEARCH) */}
            <div className="relative w-full">
              <i className="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 text-xs"></i>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari nama warga, RT/RW, atau no. HP..."
                className="w-full pl-9 pr-8 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs sm:text-sm focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500 text-zinc-900 transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 text-xs"
                >
                  <i className="fa-solid fa-xmark"></i>
                </button>
              )}
            </div>

            {/* FILTER FILTER BY ALFABET (A-Z) */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1 pt-1 no-scrollbar text-xs">
              <button
                onClick={() => setSelectedLetter("ALL")}
                className={`px-2.5 py-1 rounded-lg font-semibold shrink-0 transition-all cursor-pointer ${
                  selectedLetter === "ALL"
                    ? "bg-emerald-600 text-white"
                    : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                }`}
              >
                Semua
              </button>
             
            </div>
          </div>

          {isFetchingInitial ? (
            <div className="flex flex-col items-center justify-center py-12 text-zinc-400">
              <i className="fa-solid fa-spinner animate-spin text-2xl mb-2 text-emerald-500"></i>
              <p className="text-xs font-medium text-zinc-500">Memuat data warga...</p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-zinc-400">
              <i className="fa-solid fa-users-slash text-4xl mb-2 text-emerald-300"></i>
              <p className="text-xs sm:text-sm font-medium text-zinc-500">
                Data warga tidak ditemukan.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5 sm:space-y-3">
              {filteredItems.map((item) => (
                <div
                  key={item.id}
                  className="p-3 sm:p-4 rounded-xl border border-emerald-200/60 bg-emerald-50/20 hover:bg-emerald-50/50 hover:border-emerald-300 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 shadow-2xs"
                >
                  <div className="space-y-1 flex-1 w-full">
                    <div className="flex items-center justify-between sm:justify-start gap-2 flex-wrap">
                      <h3 className="font-bold text-zinc-900 text-sm sm:text-base">{item.nama}</h3>
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`text-[10px] sm:text-xs font-semibold px-2 py-0.5 rounded-md flex items-center gap-1 ${
                            item.is_aktif
                              ? "bg-emerald-600 text-white"
                              : "bg-rose-100 text-rose-800 border border-rose-200"
                          }`}
                        >
                          <i
                            className={`fa-solid ${
                              item.is_aktif ? "fa-user-check" : "fa-user-xmark"
                            }`}
                          ></i>
                          {item.is_aktif ? "Aktif" : "Nonaktif"}
                        </span>
                        <span className="text-[10px] sm:text-xs font-semibold px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-md">
                          {item.rt_rw}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-zinc-500">
                      {item.no_hp && (
                        <span>
                          <i className="fa-solid fa-phone text-emerald-600 mr-1"></i>
                          {item.no_hp}
                        </span>
                      )}
                      <span>
                        <i className="fa-regular fa-calendar-days text-zinc-400 mr-1"></i>
                        {new Date(item.created_at).toLocaleDateString("id-ID")}
                      </span>
                    </div>
                  </div>

                  {/* ACTION BUTTON (LEBIH TIPIS / RINGKAS) */}
                  <div className="w-full sm:w-auto flex items-center justify-end gap-2 shrink-0 pt-1 sm:pt-0 border-t sm:border-t-0 border-emerald-100/60">
  {item.is_aktif ? (
    <button
      type="button"
      onClick={() => setDeleteModal({ show: true, id: item.id, nama: item.nama })}
      className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700 transition-colors cursor-pointer"
    >
      <i className="fa-solid fa-user-slash"></i>
      Nonaktifkan
    </button>
  ) : (
    <>
      <button
        type="button"
        onClick={() => handleRestore(item.id)}
        className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition-colors cursor-pointer"
      >
        <i className="fa-solid fa-user-check"></i>
        Aktifkan
      </button>

      <button
        type="button"
        onClick={() => handleHardDelete(item.id)}
        className="inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-100 text-rose-600 border border-zinc-200 text-xs font-semibold hover:bg-rose-50 transition-colors cursor-pointer"
        title="Hapus Permanen"
      >
        <i className="fa-solid fa-trash-can"></i>
      </button>
    </>
  )}
</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}