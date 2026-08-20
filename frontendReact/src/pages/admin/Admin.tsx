import {  useState, type DragEvent, type FormEvent } from "react";
import * as XLSX from "xlsx";
import { apiFetch } from "../../lib/api";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

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

interface NotificationState {
  show: boolean;
  message: string;
  type: "success" | "error";
}

export default function AdminDashboard() {
  const queryClient = useQueryClient();

  const [downloadExcelModal, setDownloadExcelModal] = useState<boolean>(false);
  const [title, setTitle] = useState<string>("");
  const [date, setDate] = useState<string>("");
  const [startTime, setStartTime] = useState<string>("");
  const [endTime, setEndTime] = useState<string>("");
  const [location, setLocation] = useState<string>("");
  const [description, setDescription] = useState<string>("");

  // State File & Loading Per-Proses
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Modal States
  const [createModal, setCreateModal] = useState<boolean>(false);
  const [deleteModal, setDeleteModal] = useState<{
    show: boolean;
    id: number | string | null;
    title: string;
  }>({
    show: false,
    id: null,
    title: "",
  });

  // Toast Notification State
  const [notification, setNotification] = useState<NotificationState>({
    show: false,
    message: "",
    type: "success",
  });

  const showToast = (
    message: string,
    type: "success" | "error" = "success",
  ) => {
    setNotification({ show: true, message, type });
    setTimeout(() => {
      setNotification((prev) => ({ ...prev, show: false }));
    }, 3500);
  };

  // 1. FETCH DATA PENGUMUMAN DENGAN REACT QUERY[cite: 20]
  const { data: items = [], isLoading: isFetchingInitial } = useQuery<PostItem[]>({
    queryKey: ["admin-pengumuman"],
    queryFn: async () => {
      const response = await apiFetch("/admin/pengumuman");
      if (!response.ok) {
        throw new Error(`Server error (${response.status})`);
      }
      
      const result: { data?: PengumumanApiItem[] } | null = await response.json().catch(() => null);
      if (!result) {
        throw new Error("Respon server tidak valid.");
      }

      if (Array.isArray(result.data)) {
        return result.data.map((item: PengumumanApiItem) => ({
          id: item.id,
          title: item.title,
          date: item.event_date,
          time: item.event_time,
          location: item.location,
          description: item.description,
          image: item.image_name || undefined,
        }));
      }
      return [];
    },
  });

  // 2. MUTATION TAMBAH PENGUMUMAN DENGAN REACT QUERY[cite: 20]
  const createMutation = useMutation({
    mutationFn: async () => {
      const combinedTime = `${startTime} - ${endTime}`;
      const formData = new FormData();
      formData.append("title", title);
      formData.append("event_date", date);
      formData.append("event_time", combinedTime);
      formData.append("location", location);
      formData.append("description", description);

      if (selectedFile) {
        formData.append("image", selectedFile);
      }

      const response = await apiFetch("/admin/add/dashboard", {
        method: "POST",
        body: formData,
      });

      const result: { error?: string } | null = await response.json().catch(() => null);
      if (!result) {
        throw new Error("Respon server tidak valid.");
      }

      if (!response.ok) {
        throw new Error("Gagal menyimpan: " + (result.error || "Terjadi kesalahan"));
      }

      return result;
    },
    onSuccess: () => {
      setTitle("");
      setDate("");
      setStartTime("");
      setEndTime("");
      setLocation("");
      setDescription("");
      setSelectedFile(null);

      showToast("Berhasil menambahkan pengumuman baru!", "success");
      void queryClient.invalidateQueries({ queryKey: ["admin-pengumuman"] });
    },
    onError: (error: unknown) => {
      console.error("Submit Error:", error);
      showToast(error instanceof Error ? error.message : "Tidak dapat terhubung ke server backend.", "error");
    },
  });

  // 3. MUTATION HAPUS PENGUMUMAN DENGAN REACT QUERY[cite: 20]
  const deleteMutation = useMutation({
    mutationFn: async (id: number | string) => {
      const response = await apiFetch("/admin/delet", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: Number(id) }),
      });

      const result: { error?: string; err?: string } | null = await response.json().catch(() => null);
      if (!result) {
        throw new Error("Respon server tidak valid.");
      }

      if (!response.ok) {
        throw new Error("Gagal menghapus: " + (result.error || result.err || "Terjadi kesalahan"));
      }

      return result;
    },
    onSuccess: () => {
      setDeleteModal({ show: false, id: null, title: "" });
      showToast("Pengumuman berhasil dihapus!", "success");
      void queryClient.invalidateQueries({ queryKey: ["admin-pengumuman"] });
    },
    onError: (error: unknown) => {
      console.error("Error deleting item:", error);
      showToast(error instanceof Error ? error.message : "Tidak dapat terhubung ke server backend.", "error");
    },
  });

  // Handlers Drag & Drop Foto
  const handleDragOver = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith("image/")) {
        setSelectedFile(file);
      } else {
        showToast("Hanya berkas gambar yang diperbolehkan!", "error");
      }
    }
  };

  const handleOpenCreateModal = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!title || !date || !startTime || !endTime || !location || !description) {
      showToast("Harap isi semua bidang wajib!", "error");
      return;
    }
    setCreateModal(true);
  };

  const handleConfirmCreate = () => {
    setCreateModal(false);
    createMutation.mutate();
  };

  // Refresh Data
  const handleRefreshPengumuman = async () => {
    setIsRefreshing(true);
    try {
      await apiFetch("/pengumuman/refresh");
      await queryClient.invalidateQueries({ queryKey: ["admin-pengumuman"] });
      showToast("Data berhasil diperbarui!", "success");
    } catch (error) {
      console.error("Gagal memicu refresh backend:", error);
      showToast("Gagal menyinkronkan data.", "error");
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleDeleteConfirm = () => {
    if (!deleteModal.id) return;
    deleteMutation.mutate(deleteModal.id);
  };

  // Export Excel
  const handleExportExcel = () => {
    setDownloadExcelModal(false);
    if (items.length === 0) {
      showToast("Tidak ada data untuk diunduh!", "error");
      return;
    }

    const excelData = items.map((item, index) => ({
      No: index + 1,
      ID: item.id,
      Judul: item.title,
      Tanggal: item.date,
      Waktu: item.time,
      Lokasi: item.location,
      Deskripsi: item.description,
      Nama_Gambar: item.image || "-",
    }));

    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Pengumuman");

    XLSX.writeFile(workbook, `Data_Pengumuman_${new Date().toISOString().split("T")[0]}.xlsx`);
    showToast("Berhasil mengunduh data pengumuman ke Excel!", "success");
  };

  return (
    <div className="relative">
      {/* TOAST NOTIFIKASI */}
      {notification.show && (
        <div
          className={`fixed top-5 right-5 z-50 flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-xl text-white font-semibold text-sm transition-all animate-bounce ${
            notification.type === "success"
              ? "bg-emerald-600 border border-emerald-500"
              : "bg-rose-600 border border-rose-500"
          }`}
        >
          <i
            className={`fa-solid ${
              notification.type === "success"
                ? "fa-circle-check text-xl"
                : "fa-triangle-exclamation text-xl"
            }`}
          ></i>
          <span>{notification.message}</span>
        </div>
      )}

      {/* MODAL DOWNLOAD EXCEL */}
      {downloadExcelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-emerald-100 space-y-4">
            <div className="flex items-center gap-3 text-emerald-600">
              <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                <i className="fa-solid fa-file-excel text-xl"></i>
              </div>
              <h3 className="text-lg font-bold text-zinc-900">Unduh Data Excel</h3>
            </div>
            <p className="text-sm text-zinc-600 leading-relaxed">
              Apakah Anda yakin ingin mengunduh seluruh data pengumuman (
              <strong className="text-zinc-900">{items.length} data</strong>) ke format file Excel?
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDownloadExcelModal(false)}
                className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-sm font-semibold rounded-xl transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleExportExcel}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm cursor-pointer flex items-center gap-2"
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
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-emerald-100 space-y-4">
            <div className="flex items-center gap-3 text-emerald-600">
              <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                <i className="fa-solid fa-circle-question text-xl"></i>
              </div>
              <h3 className="text-lg font-bold text-zinc-900">Konfirmasi Publikasi</h3>
            </div>
            <p className="text-sm text-zinc-600 leading-relaxed">
              Apakah Anda yakin ingin mempublikasikan pengumuman{" "}
              <strong className="text-zinc-900">"{title}"</strong> ke database?
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setCreateModal(false)}
                className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-sm font-semibold rounded-xl transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmCreate}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm cursor-pointer"
              >
                Ya, Publikasikan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL KONFIRMASI HAPUS (DENGAN LOADING STATE) */}
      {deleteModal.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-rose-100 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
                <i className="fa-solid fa-triangle-exclamation text-xl"></i>
              </div>
              <h3 className="text-lg font-bold text-zinc-900">Konfirmasi Hapus</h3>
            </div>
            <p className="text-sm text-zinc-600 leading-relaxed">
              Apakah Anda yakin ingin menghapus pengumuman{" "}
              <strong className="text-zinc-900">"{deleteModal.title}"</strong>?
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={deleteMutation.isPending}
                onClick={() => setDeleteModal({ show: false, id: null, title: "" })}
                className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-sm font-semibold rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={deleteMutation.isPending}
                onClick={handleDeleteConfirm}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm flex items-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {deleteMutation.isPending ? (
                  <>
                    <i className="fa-solid fa-spinner animate-spin"></i>
                    Menghapus...
                  </>
                ) : (
                  "Ya, Hapus"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HEADER DAN CONTROL BAR */}
      <div className="flex items-center justify-between gap-2 sm:gap-3 mb-6">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setDownloadExcelModal(true)}
            className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors text-xs font-semibold flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <i className="fa-solid fa-file-excel"></i> Excel
          </button>

          <button
            onClick={handleRefreshPengumuman}
            disabled={isRefreshing}
            className="p-2 text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors border border-emerald-200 text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
          >
            <i className={`fa-solid fa-rotate ${isRefreshing ? "animate-spin" : ""}`}></i>
            {isRefreshing ? "Memuat..." : "Muat Ulang"}
          </button>
        </div>

        <span className="text-xs font-semibold px-3 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg">
          Total Aktif: {items.length}
        </span>
      </div>

      <div className="mb-6 sm:mb-8">
        <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 tracking-tight">
          Dashboard Overview
        </h1>
        <p className="text-xs sm:text-sm text-zinc-600 mt-1">
          Kelola input pengumuman acara dan monitoring informasi untuk user di sini.
        </p>
      </div>

      <div className="flex flex-col gap-8 max-w-5xl mx-auto">
        {/* PANEL INPUT ADMIN */}
        <div className="bg-white rounded-2xl border border-emerald-200/80 shadow-md p-5 sm:p-8">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-emerald-100">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold shrink-0 shadow-sm">
              <i className="fa-solid fa-pen-to-square"></i>
            </div>
            <div>
              <h2 className="font-bold text-zinc-900 text-sm sm:text-base">Input Acara Baru</h2>
              <p className="text-xs text-zinc-500">Kirim notifikasi pengumuman ke database</p>
            </div>
          </div>

          <form onSubmit={handleOpenCreateModal} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-700 mb-1.5">
                  Judul Acara
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Contoh: Rapat Mingguan Tim..."
                  required
                  className="w-full px-3.5 py-2.5 bg-zinc-50/80 border border-zinc-300 rounded-xl text-sm focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500 transition-all text-zinc-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-700 mb-1.5">
                  Lokasi / Link Acara
                </label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Contoh: Ruang Aula / Link Zoom"
                  required
                  className="w-full px-3.5 py-2.5 bg-zinc-50/80 border border-zinc-300 rounded-xl text-sm focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500 transition-all text-zinc-900"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-700 mb-1.5">
                  Tanggal
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  className="w-full px-3 py-2.5 bg-zinc-50/80 border border-zinc-300 rounded-xl text-sm focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500 transition-all text-zinc-800"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-700 mb-1.5">
                  Jam Mulai
                </label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 bg-zinc-50/80 border border-zinc-300 rounded-xl text-sm focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500 transition-all text-zinc-800"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-700 mb-1.5">
                  Jam Selesai
                </label>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 bg-zinc-50/80 border border-zinc-300 rounded-xl text-sm focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500 transition-all text-zinc-800"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-700 mb-1.5">
                Deskripsi
              </label>
              <textarea
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Tulis detail informasi acara di sini..."
                required
                className="w-full px-3.5 py-2.5 bg-zinc-50/80 border border-zinc-300 rounded-xl text-sm focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500 transition-all resize-none text-zinc-900"
              ></textarea>
            </div>

            {/* DRAG & DROP AREA */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-700 mb-1.5">
                Foto <span className="text-zinc-400 font-normal">(Opsional)</span>
              </label>
              <label
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`flex flex-col items-center justify-center p-5 border-2 border-dashed rounded-xl cursor-pointer transition-all ${
                  isDragging
                    ? "border-emerald-500 bg-emerald-100/50 scale-[1.01]"
                    : selectedFile
                    ? "border-emerald-400 bg-emerald-50/40"
                    : "border-emerald-300 bg-emerald-50/30 hover:bg-emerald-50"
                }`}
              >
                <i
                  className={`fa-solid ${
                    selectedFile
                      ? "fa-file-image text-2xl text-emerald-600"
                      : "fa-cloud-arrow-up text-2xl text-emerald-500"
                  } mb-1.5`}
                ></i>
                <span className="text-xs text-zinc-700 font-medium truncate max-w-xs text-center">
                  {selectedFile
                    ? selectedFile.name
                    : "Tarik & lepas foto di sini, atau klik untuk memilih"}
                </span>
                <span className="text-[10px] text-zinc-400 mt-1">PNG, JPG, GIF hingga 5MB</span>

                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setSelectedFile(e.target.files[0]);
                    }
                  }}
                  className="hidden"
                />
              </label>

              {selectedFile && (
                <div className="flex items-center justify-between mt-2 px-3 py-1.5 bg-emerald-50 rounded-lg border border-emerald-200">
                  <span className="text-xs text-emerald-800 truncate font-medium">
                    <i className="fa-solid fa-paperclip mr-1.5"></i>
                    {selectedFile.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedFile(null)}
                    className="text-xs text-rose-600 hover:text-rose-800 font-semibold flex items-center gap-1 ml-2 cursor-pointer"
                  >
                    <i className="fa-solid fa-xmark"></i> Batal
                  </button>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={createMutation.isPending}
              className="w-full mt-3 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm rounded-xl shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {createMutation.isPending ? (
                <>
                  <i className="fa-solid fa-spinner animate-spin"></i>
                  Mengunggah ke Storage & DB...
                </>
              ) : (
                <>
                  <i className="fa-solid fa-floppy-disk"></i>
                  Simpan & Publikasikan
                </>
              )}
            </button>
          </form>
        </div>

        {/* PRATINJAU PENGUMUMAN */}
        <div className="bg-white rounded-2xl border border-emerald-200/80 shadow-md p-5 sm:p-8 flex flex-col">
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-emerald-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold shadow-sm shrink-0">
                <i className="fa-solid fa-bullhorn"></i>
              </div>
              <div>
                <h2 className="font-bold text-zinc-900 text-sm sm:text-base">
                  Pratinjau Pengumuman User
                </h2>
                <p className="text-xs text-zinc-500">Daftar informasi acara dari database</p>
              </div>
            </div>
            <span className="text-xs font-semibold px-3 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg">
              Total Aktif: {items.length}
            </span>
          </div>

          {isFetchingInitial ? (
            <div className="flex flex-col items-center justify-center py-16 text-zinc-400">
              <i className="fa-solid fa-spinner animate-spin text-3xl mb-3 text-emerald-500"></i>
              <p className="text-sm font-medium text-zinc-500">Memuat pengumuman...</p>
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-zinc-400">
              <i className="fa-solid fa-folder-open text-5xl mb-3 text-emerald-300"></i>
              <p className="text-sm font-medium text-zinc-500">
                Belum ada acara yang tersimpan di database.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {items.map((item, index) => (
                <div
                  key={item.id}
                  className="p-5 sm:p-6 rounded-2xl border border-emerald-200/60 bg-emerald-50/20 hover:bg-emerald-50/50 hover:border-emerald-300 transition-all flex flex-col sm:flex-row items-start justify-between gap-4 shadow-xs"
                >
                  <div className="space-y-2.5 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold px-3 py-1 bg-emerald-600 text-white rounded-lg flex items-center gap-1.5 shadow-xs">
                        <i className="fa-regular fa-calendar"></i> {item.date}
                      </span>
                      <span className="text-xs font-semibold px-3 py-1 bg-emerald-100 text-emerald-800 rounded-lg flex items-center gap-1.5">
                        <i className="fa-regular fa-clock"></i> {item.time}
                      </span>
                      <span className="text-xs font-medium px-3 py-1 bg-white text-zinc-700 rounded-lg flex items-center gap-1.5 max-w-xs truncate border border-zinc-200">
                        <i className="fa-solid fa-location-dot text-emerald-600"></i>{" "}
                        {item.location}
                      </span>

                      {index === 0 && (
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-amber-500 text-white rounded-md">
                          Terbaru
                        </span>
                      )}
                    </div>

                    <h3 className="font-bold text-zinc-900 text-lg">{item.title}</h3>
                    <p className="text-sm text-zinc-600 leading-relaxed whitespace-pre-line">
                      {item.description}
                    </p>

                    {/* Foto hanya di-render di item paling atas (index === 0) */}
                    {index === 0 && item.image && (
                      <div className="pt-2">
                        <img
                          src={item.image}
                          alt={item.title}
                          className="w-32 h-24 object-cover rounded-xl border border-emerald-200 shadow-xs cursor-pointer hover:opacity-90 transition-opacity"
                          onClick={() => window.open(item.image, "_blank")}
                        />
                      </div>
                    )}
                  </div>

                  <div className="flex sm:flex-col gap-2 w-full sm:w-auto sm:items-end">
                    <button
                      type="button"
                      disabled={deleteMutation.isPending}
                      onClick={() =>
                        setDeleteModal({
                          show: true,
                          id: item.id,
                          title: item.title,
                        })
                      }
                      className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-rose-600 text-white text-sm font-semibold hover:bg-rose-700 transition-colors shadow-sm w-full sm:w-auto cursor-pointer disabled:opacity-50"
                    >
                      <i className="fa-solid fa-trash-can"></i>
                      Hapus
                    </button>
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