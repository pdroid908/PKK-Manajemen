import { useEffect, useState, type DragEvent, type FormEvent } from "react";
import * as XLSX from "xlsx";
import { apiFetch, apiUrl } from "../../lib/api";
// URL Public Supabase digunakan hanya untuk melihat gambar nota

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

interface NotificationState {
  show: boolean;
  message: string;
  type: "success" | "error";
}

const formatDisplayAmount = (val: string) => {
  const rawNumber = val.replace(/\D/g, "");
  if (!rawNumber) return "";
  return new Intl.NumberFormat("id-ID").format(Number(rawNumber));
};

const getRawAmount = (val: string) => {
  return parseFloat(val.replace(/\D/g, "")) || 0;
};

export default function Keuangan() {
  const [title, setTitle] = useState<string>("");
  const [type, setType] = useState<"INCOME" | "EXPENSE">("INCOME");
  const [amount, setAmount] = useState<string>("");

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  const [isFetching, setIsFetching] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  const [transactions, setTransactions] = useState<FinanceTransaction[]>([]);

  const [createModal, setCreateModal] = useState<boolean>(false);

  const [deleteModal, setDeleteModal] = useState<{
    show: boolean;
    id: number | null;
    title: string;
  }>({
    show: false,
    id: null,
    title: "",
  });

  const [notification, setNotification] = useState<NotificationState>({
    show: false,
    message: "",
    type: "success",
  });

  const [downloadExcelModal, setDownloadExcelModal] = useState<boolean>(false);

  const handleExportExcel = () => {
    setDownloadExcelModal(false);

    if (transactions.length === 0) {
      showToast("Tidak ada data keuangan untuk diunduh!", "error");
      return;
    }

    // Format data transaksi untuk Excel
    const excelData = transactions.map((item, index) => ({
      No: index + 1,
      ID: item.id,
      Tanggal: new Date(item.transaction_date).toLocaleString("id-ID"),
      Keterangan: item.title,
      Tipe: item.type === "INCOME" ? "Pemasukan" : "Pengeluaran",
      Nominal: item.amount,
      Saldo_Akhir: item.balance_after,
      Bukti_Nota: item.proof_image || "-",
    }));

    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Data Keuangan");

    // Download file Excel
    XLSX.writeFile(
      workbook,
      `Data_Keuangan_${new Date().toISOString().split("T")[0]}.xlsx`,
    );
    showToast("Berhasil mengunduh data keuangan ke Excel!", "success");
  };

  const showToast = (
    message: string,
    type: "success" | "error" = "success",
  ) => {
    setNotification({ show: true, message, type });
    setTimeout(() => {
      setNotification((prev) => ({ ...prev, show: false }));
    }, 3000);
  };

  const getErrorMessage = (error: unknown, fallback: string) =>
    error instanceof Error ? error.message : fallback;

  const fetchKeuangan = async () => {
    setIsFetching(true);
    try {
      const response = await apiFetch("/admin/data/amount");
      const result: FinanceResponse | null = await response.json().catch(() => null);

      if (response.ok && result?.data) {
        setTransactions(result.data);
      } else if (!response.ok) {
        throw new Error(result?.error || `Gagal memuat data keuangan (${response.status})`);
      }
    } catch (error) {
      console.error("Gagal mengambil data keuangan:", error);
      showToast("Gagal terhubung ke backend server.", "error");
    } finally {
      setIsFetching(false);
    }
  };

  useEffect(() => {
    let isMounted = true;

    const loadKeuangan = async () => {
      try {
        const response = await apiFetch("/admin/data/amount");
        const result: FinanceResponse | null = await response.json().catch(() => null);

        if (isMounted && response.ok && result?.data) {
          setTransactions(result.data);
        }
      } catch (error) {
        if (isMounted) {
          console.error("Gagal mengambil data keuangan:", error);
          showToast("Gagal terhubung ke backend server.", "error");
        }
      } finally {
        if (isMounted) {
          setIsFetching(false);
        }
      }
    };

    void loadKeuangan();

    return () => {
      isMounted = false;
    };
  }, []);

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
        showToast("Hanya berkas gambar nota yang diperbolehkan!", "error");
      }
    }
  };

  const handleOpenCreateModal = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const numAmount = getRawAmount(amount);
    if (!title || isNaN(numAmount) || numAmount <= 0) {
      showToast(
        "Mohon isi deskripsi transaksi dan nominal yang valid!",
        "error",
      );
      return;
    }
    setCreateModal(true);
  };

  const handleRefreshKeuangan = async () => {
    setIsFetching(true);
    try {
      // 1. Panggil endpoint refresh backend Go
      await apiFetch("/keuangan/refresh");
    } catch (error) {
      console.error("Gagal memicu refresh backend:", error);
    } finally {
      // 2. Ambil ulang data keuangan terbaru
      await fetchKeuangan();
    }
  };

  // Mengirimkan FormData multipart langsung ke Go Backend
  const handleConfirmCreate = async () => {
    setCreateModal(false);
    setIsLoading(true);

    const numAmount = getRawAmount(amount);

    try {
      const formData = new FormData();
      // 1. Pastikan key sesuai dengan ctx.PostForm(...) di Go
      formData.append("title", title.trim());
      formData.append("type", type);
      formData.append("amount", String(numAmount));

      // 2. Kirim file hanya jika benar-benar berupa instance File
      if (selectedFile instanceof File) {
        formData.append("proof_image", selectedFile, selectedFile.name);
      }

      const response = await apiFetch("/admin/amount", {
        method: "POST",
        // JANGAN tambahkan 'Content-Type': 'application/json' atau 'multipart/form-data'
        // Browser akan otomatis menyusun boundary multipart
        body: formData,
      });

      const result: { error?: string } | null = await response.json().catch(() => null);

      if (response.ok) {
        setTitle("");
        setAmount("");
        setSelectedFile(null);
        setType("INCOME");
        await fetchKeuangan();
        showToast("Berhasil menambahkan catatan keuangan!", "success");
      } else {
        showToast(
          "Gagal menyimpan: " + (result?.error || "Terjadi kesalahan"),
          "error",
        );
      }
    } catch (error: unknown) {
      showToast(getErrorMessage(error, "Tidak dapat terhubung ke server backend."), "error");
    } finally {
      setIsLoading(false);
    }
  };

  // Cukup kirimkan ID ke Backend Go (penghapusan file dikelola backend)
  const handleDeleteConfirm = async () => {
    if (!deleteModal.id) return;
    setIsDeleting(true);

    try {
      const response = await apiFetch("/admin/data/amount", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: Number(deleteModal.id) }),
      });

      const result: { error?: string } | null = await response.json().catch(() => null);

      if (response.ok) {
        await fetchKeuangan();
        showToast("Transaksi berhasil dihapus!", "success");
      } else {
        showToast(
          "Gagal menghapus: " + (result?.error || "Terjadi kesalahan"),
          "error",
        );
      }
    } catch {
      showToast("Tidak dapat terhubung ke server backend.", "error");
    } finally {
      setIsDeleting(false);
      setDeleteModal({ show: false, id: null, title: "" });
    }
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

  const formatRupiah = (val: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(val);
  };

  return (
    <div className="relative space-y-6 sm:space-y-8 max-w-5xl mx-auto pb-12 px-2 sm:px-4">
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
            className={`fa-solid ${notification.type === "success" ? "fa-circle-check text-lg sm:text-xl" : "fa-triangle-exclamation text-lg sm:text-xl"}`}
          ></i>
          <span>{notification.message}</span>
        </div>
      )}

      {/* MODAL KONFIRMASI DOWNLOAD EXCEL KEUANGAN */}
      {downloadExcelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-emerald-100 space-y-4">
            <div className="flex items-center gap-3 text-emerald-600">
              <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                <i className="fa-solid fa-file-excel text-xl"></i>
              </div>
              <h3 className="text-lg font-bold text-zinc-900">
                Unduh Laporan Excel
              </h3>
            </div>
            <p className="text-sm text-zinc-600 leading-relaxed">
              Apakah Anda yakin ingin mengunduh seluruh data riwayat keuangan (
              <strong className="text-zinc-900">
                {transactions.length} transaksi
              </strong>
              ) ke format file Excel?
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
              <h3 className="text-lg font-bold text-zinc-900">
                Simpan Transaksi?
              </h3>
            </div>
            <p className="text-xs sm:text-sm text-zinc-600 leading-relaxed">
              Tambahkan transaksi{" "}
              <strong className="text-zinc-900">"{title}"</strong> dengan
              nominal{" "}
              <strong className="text-emerald-600">
                {formatRupiah(getRawAmount(amount))}
              </strong>
              ?
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setCreateModal(false)}
                className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs sm:text-sm font-semibold rounded-xl transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmCreate}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold rounded-xl transition-colors shadow-xs cursor-pointer"
              >
                Ya, Simpan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL KONFIRMASI HAPUS */}
      {deleteModal.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-rose-100 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
                <i className="fa-solid fa-triangle-exclamation text-xl"></i>
              </div>
              <h3 className="text-lg font-bold text-zinc-900">
                Konfirmasi Hapus
              </h3>
            </div>
            <p className="text-xs sm:text-sm text-zinc-600 leading-relaxed">
              Apakah Anda yakin ingin menghapus transaksi{" "}
              <strong className="text-zinc-900">"{deleteModal.title}"</strong>?
              Foto nota (jika ada) dan transaksi akan dihapus secara permanen.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() =>
                  setDeleteModal({ show: false, id: null, title: "" })
                }
                className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs sm:text-sm font-semibold rounded-xl transition-colors cursor-pointer disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDeleteConfirm}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs sm:text-sm font-semibold rounded-xl transition-colors shadow-xs cursor-pointer flex items-center gap-2 disabled:opacity-50"
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

      {/* HEADER */}
      <div className="mb-2 sm:mb-4">
        <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 tracking-tight">
          Manajemen Keuangan
        </h1>
        <p className="text-xs sm:text-sm text-zinc-600 mt-1">
          Pantau arus kas masuk, pengeluaran, serta bukti nota transaksi kas
          organisasi.
        </p>
      </div>
      <div className="flex items-center gap-2">
        {/* TOMBOL EXCEL BARU */}
        <button
          type="button"
          onClick={() => setDownloadExcelModal(true)}
          className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-colors text-xs font-semibold flex items-center gap-1.5 shadow-xs cursor-pointer"
        >
          <i className="fa-solid fa-file-excel"></i> Excel
        </button>

        <button
          onClick={handleRefreshKeuangan}
          disabled={isFetching}
          className="p-2 px-3 text-emerald-700 hover:bg-emerald-50 rounded-xl transition-colors border border-emerald-200 text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
        >
          <i
            className={`fa-solid fa-rotate ${isFetching ? "animate-spin" : ""}`}
          ></i>{" "}
          Muat Ulang
        </button>
        <span className="text-xs font-semibold px-3 py-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl">
          Total: {transactions.length}
        </span>
      </div>

      {/* RINGKASAN SALDO */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        {/* SALDO KAS */}
        <div className="bg-gradient-to-br from-white to-emerald-50/40 p-5 rounded-2xl border border-emerald-200/80 shadow-md flex items-center justify-between hover:shadow-lg transition-all">
          <div>
            <p className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">
              Saldo Kas Saat Ini
            </p>
            <h3 className="text-lg sm:text-2xl font-black text-emerald-700 mt-1">
              {isFetching ? (
                <div className="h-7 w-28 bg-emerald-100/60 rounded-md animate-pulse mt-1"></div>
              ) : (
                formatRupiah(currentBalance)
              )}
            </h3>
          </div>
          <div className="w-11 h-11 rounded-xl bg-emerald-600 text-white flex items-center justify-center text-xl font-bold shadow-sm shrink-0">
            <i className="fa-solid fa-vault"></i>
          </div>
        </div>

        {/* TOTAL PEMASUKAN */}
        <div className="bg-gradient-to-br from-white to-teal-50/40 p-5 rounded-2xl border border-teal-200/80 shadow-md flex items-center justify-between hover:shadow-lg transition-all">
          <div>
            <p className="text-[11px] font-bold text-teal-800 uppercase tracking-wider">
              Total Pemasukan
            </p>
            <h3 className="text-lg sm:text-2xl font-black text-teal-600 mt-1">
              {isFetching ? (
                <div className="h-7 w-28 bg-teal-100/60 rounded-md animate-pulse mt-1"></div>
              ) : (
                formatRupiah(totalIncome)
              )}
            </h3>
          </div>
          <div className="w-11 h-11 rounded-xl bg-teal-600 text-white flex items-center justify-center text-xl font-bold shadow-sm shrink-0">
            <i className="fa-solid fa-arrow-down"></i>{" "}
            {/* FIX: fa-arrow-down */}
          </div>
        </div>

        {/* TOTAL PENGELUARAN */}
        <div className="bg-gradient-to-br from-white to-rose-50/40 p-5 rounded-2xl border border-rose-200/80 shadow-md flex items-center justify-between hover:shadow-lg transition-all">
          <div>
            <p className="text-[11px] font-bold text-rose-800 uppercase tracking-wider">
              Total Pengeluaran
            </p>
            <h3 className="text-lg sm:text-2xl font-black text-rose-600 mt-1">
              {isFetching ? (
                <div className="h-7 w-28 bg-rose-100/60 rounded-md animate-pulse mt-1"></div>
              ) : (
                formatRupiah(totalExpense)
              )}
            </h3>
          </div>
          <div className="w-11 h-11 rounded-xl bg-rose-600 text-white flex items-center justify-center text-xl font-bold shadow-sm shrink-0">
            <i className="fa-solid fa-arrow-up"></i> {/* FIX: fa-arrow-up */}
          </div>
        </div>
      </div>

      {/* FORM INPUT TRANSAKSI */}
      <div className="bg-white rounded-2xl border border-emerald-200/80 shadow-md p-5 sm:p-8">
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-emerald-100">
          <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold shrink-0 shadow-sm">
            <i className="fa-solid fa-money-bill-transfer"></i>
          </div>
          <div>
            <h2 className="font-bold text-zinc-900 text-sm sm:text-base">
              Catat Transaksi Baru
            </h2>
            <p className="text-xs text-zinc-500">
              Masukkan rincian arus kas pemasukan atau pengeluaran
            </p>
          </div>
        </div>

        <form
          onSubmit={handleOpenCreateModal}
          className="space-y-4 sm:space-y-5"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-700 mb-1.5">
                Jenis Transaksi
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setType("INCOME")}
                  className={`py-2.5 px-3 rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 border transition-all cursor-pointer ${
                    type === "INCOME"
                      ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                      : "bg-zinc-50 text-zinc-600 border-zinc-200 hover:bg-zinc-100"
                  }`}
                >
                  <i className="fa-solid fa-circle-arrow-down"></i> Uang Masuk
                </button>
                <button
                  type="button"
                  onClick={() => setType("EXPENSE")}
                  className={`py-2.5 px-3 rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 border transition-all cursor-pointer ${
                    type === "EXPENSE"
                      ? "bg-rose-600 text-white border-rose-600 shadow-sm"
                      : "bg-zinc-50 text-zinc-600 border-zinc-200 hover:bg-zinc-100"
                  }`}
                >
                  <i className="fa-solid fa-circle-arrow-up"></i> Uang Keluar
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-700 mb-1.5">
                Nominal (Rp)
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={amount}
                onChange={(e) => setAmount(formatDisplayAmount(e.target.value))}
                placeholder="Contoh: 150.000"
                required
                className="w-full px-3.5 py-2.5 bg-zinc-50/80 border border-zinc-300 rounded-xl text-sm focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500 transition-all text-zinc-900"
              />
            </div>
          </div>

          {/* FIXED: Mengembalikan input text untuk Keterangan/Judul */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-700 mb-1.5">
              Keterangan / Deskripsi
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Contoh: Pembelian Alat Tulis Kantor"
              required
              className="w-full px-3.5 py-2.5 bg-zinc-50/80 border border-zinc-300 rounded-xl text-sm focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500 transition-all text-zinc-900"
            />
          </div>

          {/* UPLOAD FOTO BUKTI */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-700 mb-1.5">
              Upload Nota/Foto Bukti{" "}
              <span className="text-zinc-400 font-normal capitalize">
                (Opsional)
              </span>
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
                className={`fa-solid ${selectedFile ? "fa-file-image text-2xl text-emerald-600" : "fa-cloud-arrow-up text-2xl text-emerald-500"} mb-1.5`}
              ></i>
              <span className="text-xs text-zinc-700 font-medium truncate max-w-xs text-center">
                {selectedFile
                  ? selectedFile.name
                  : "Tarik & lepas file nota di sini, atau klik untuk memilih"}
              </span>
              <span className="text-[10px] text-zinc-400 mt-1">
                PNG, JPG, JPEG hingga 5MB
              </span>

              <input
                type="file"
                name="proof_image"
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
              <div className="flex items-center justify-between mt-2 px-3.5 py-2 bg-emerald-50 rounded-xl border border-emerald-200">
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
            disabled={isLoading}
            className="w-full mt-2 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm rounded-xl shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <i className="fa-solid fa-spinner animate-spin"></i>
                Mengunggah & Menyimpan...
              </>
            ) : (
              <>
                <i className="fa-solid fa-floppy-disk"></i>
                Simpan Transaksi Keuangan
              </>
            )}
          </button>
        </form>
      </div>

      {/* RIWAYAT TRANSAKSI */}
      <div className="bg-white rounded-2xl border border-emerald-200/80 shadow-md p-5 sm:p-8">
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-emerald-100 flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold shadow-sm shrink-0">
              <i className="fa-solid fa-receipt"></i>
            </div>
            <div>
              <h2 className="font-bold text-zinc-900 text-sm sm:text-base">
                Riwayat Transaksi Kas
              </h2>
              <p className="text-xs text-zinc-500">
                Daftar transaksi tersimpan di database
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-3 py-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl">
              Total: {transactions.length}
            </span>
          </div>
        </div>

        {isFetching ? (
          <div className="space-y-3 py-4">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="h-16 bg-zinc-100 rounded-xl animate-pulse w-full"
              ></div>
            ))}
          </div>
        ) : transactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-zinc-400">
            <i className="fa-solid fa-folder-open text-4xl sm:text-5xl mb-3 text-emerald-300"></i>
            <p className="text-xs sm:text-sm font-medium text-zinc-500">
              Belum ada catatan transaksi keuangan.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-2 sm:mx-0">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-emerald-50/60 text-emerald-900 font-bold uppercase text-[10px] sm:text-xs tracking-wider border-b border-emerald-100 rounded-xl">
                <tr>
                  <th className="py-3 px-3.5 rounded-l-xl">Tanggal</th>
                  <th className="py-3 px-3.5">Keterangan</th>
                  <th className="py-3 px-3.5">Tipe</th>
                  <th className="py-3 px-3.5">Nominal</th>
                  <th className="py-3 px-3.5">Saldo</th>
                  <th className="py-3 px-3.5 text-center rounded-r-xl">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {[...transactions].reverse().map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-emerald-50/30 transition-colors"
                  >
                    <td className="py-3.5 px-3.5 text-zinc-500 whitespace-nowrap text-xs">
                      {new Date(item.transaction_date).toLocaleDateString(
                        "id-ID",
                        {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        },
                      )}
                    </td>
                    <td className="py-3.5 px-3.5 font-semibold text-zinc-800 max-w-xs truncate">
                      {item.title}
                    </td>
                    <td className="py-3.5 px-3.5 whitespace-nowrap">
                      {item.type === "INCOME" ? (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] sm:text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          <i className="fa-solid fa-arrow-down mr-1"></i> Masuk
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] sm:text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
                          <i className="fa-solid fa-arrow-up mr-1"></i> Keluar
                        </span>
                      )}
                    </td>
                    <td
                      className={`py-3.5 px-3.5 font-bold whitespace-nowrap ${
                        item.type === "INCOME"
                          ? "text-emerald-600"
                          : "text-rose-600"
                      }`}
                    >
                      {item.type === "INCOME" ? "+" : "-"}{" "}
                      {formatRupiah(item.amount)}
                    </td>
                    <td className="py-3.5 px-3.5 font-bold text-zinc-700 whitespace-nowrap">
                      {formatRupiah(item.balance_after)}
                    </td>
                    <td className="py-3.5 px-3.5 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-2">
                        {item.proof_image && item.proof_image.trim() !== "" && (
                          <button
                            type="button"
                            onClick={() =>
                              window.open(
                                apiUrl(`/uploads/${item.proof_image}`),
                                "_blank",
                              )
                            }
                            className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                          >
                            <i className="fa-regular fa-image"></i> Nota
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() =>
                            setDeleteModal({
                              show: true,
                              id: item.id,
                              title: item.title,
                            })
                          }
                          className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-xl text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                        >
                          <i className="fa-solid fa-trash-can"></i> Hapus
                        </button>
                      </div>
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
