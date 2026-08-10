import { useEffect, useState } from "react";
import * as XLSX from "xlsx";
import { apiFetch } from "../../lib/api";

interface LoanItem {
  id: number;
  item_id: number;
  item_name: string;
  borrower_name: string;
  quantity_borrowed: number;
  event_name?: string;
  planned_borrow_date?: string;
  planned_return_date?: string;
  status: string; // PENDING, APPROVED, REJECTED, RETURNED
  borrow_date: string;
  return_date?: string;
}

interface ConfirmState {
  isOpen: boolean;
  type: "UPDATE" | "DELETE";
  id: number | null;
  status?: string;
  title: string;
  message: string;
}

export default function AdminPinjaman() {
  const [loans, setLoans] = useState<LoanItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const [actionMessage, setActionMessage] = useState<string>("");

  // State untuk Modal Konfirmasi
  const [confirmModal, setConfirmModal] = useState<ConfirmState>({
    isOpen: false,
    type: "UPDATE",
    id: null,
    title: "",
    message: "",
  });

  const fetchLoans = async () => {
    setErrorMessage(null);
    try {
      const res = await apiFetch("/barang/peminjam");
      if (!res.ok) {
        throw new Error(`Gagal memuat data dari server (${res.status})`);
      }

      let data: LoanItem[] = [];
      try {
        data = await res.json();
      } catch {
        throw new Error("Respon server tidak valid atau terjadi kesalahan backend.");
      }

      setLoans(Array.isArray(data) ? data : []);
    } catch (err: unknown) {
      console.error("Gagal mengambil data peminjam:", err);
      setErrorMessage(err instanceof Error ? err.message : "Gagal terhubung ke server.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;

    const loadLoans = async () => {
      if (isMounted) {
        setErrorMessage(null);
      }

      try {
        const res = await apiFetch("/barang/peminjam");
        if (!res.ok) {
          throw new Error(`Gagal memuat data dari server (${res.status})`);
        }

        const data: LoanItem[] | null = await res.json().catch(() => null);
        if (isMounted) {
          setLoans(Array.isArray(data) ? data : []);
        }
      } catch (error) {
        if (isMounted) {
          console.error("Gagal mengambil data peminjam:", error);
          setErrorMessage(error instanceof Error ? error.message : "Gagal terhubung ke server.");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadLoans();

    return () => {
      isMounted = false;
    };
  }, []);

  // Safe Format Date (Mencegah Layar Putih dari Invalid Date)
  const formatDate = (dateString?: string) => {
    if (!dateString) return "-";
    try {
      const parsedDate = new Date(dateString);
      if (isNaN(parsedDate.getTime())) return "-";
      return parsedDate.toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    } catch {
      return "-";
    }
  };

  // Fungsi Export ke Excel
  const handleExportExcel = () => {
    try {
      if (filteredLoans.length === 0) {
        alert("Tidak ada data untuk diunduh.");
        return;
      }

      const excelData = filteredLoans.map((loan, index) => ({
        No: index + 1,
        Peminjam: loan.borrower_name || "-",
        Barang: loan.item_name || "-",
        "Jumlah Pinjam": loan.quantity_borrowed || 0,
        "Nama Acara / Keperluan": loan.event_name || "-",
        "Rencana Pinjam": formatDate(loan.planned_borrow_date),
        "Rencana Kembali": formatDate(loan.planned_return_date),
        Status: loan.status || "PENDING",
        "Tanggal Pengajuan": formatDate(loan.borrow_date),
        "Tanggal Dikembalikan": formatDate(loan.return_date),
      }));

      const worksheet = XLSX.utils.json_to_sheet(excelData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Data Peminjaman");

      XLSX.writeFile(
        workbook,
        `Laporan_Peminjaman_Barang_${new Date().toISOString().slice(0, 10)}.xlsx`
      );
    } catch (err) {
      console.error("Export Excel Error:", err);
      alert("Gagal mengunduh file Excel.");
    }
  };

  // Buka Modal Konfirmasi
  const openConfirmModal = (
    type: "UPDATE" | "DELETE",
    id: number,
    borrowerName: string,
    status?: string
  ) => {
    if (type === "UPDATE") {
      let title = "Konfirmasi Perubahan Status";
      let message = `Apakah Anda yakin ingin mengubah status peminjaman milik "${borrowerName}" menjadi ${status}?`;

      if (status === "APPROVED") {
        title = "Setujui Peminjaman?";
        message = `Apakah Anda yakin ingin MENYETUJUI peminjaman atas nama "${borrowerName}"? Stok barang akan berkurang.`;
      } else if (status === "REJECTED") {
        title = "Tolak Peminjaman?";
        message = `Apakah Anda yakin ingin MENOLAK peminjaman atas nama "${borrowerName}"?`;
      } else if (status === "RETURNED") {
        title = "Konfirmasi Pengembalian?";
        message = `Apakah Anda yakin barang pinjaman milik "${borrowerName}" sudah DIKEMBALIKAN? Stok barang akan bertambah kembali.`;
      }

      setConfirmModal({
        isOpen: true,
        type: "UPDATE",
        id,
        status,
        title,
        message,
      });
    } else {
      setConfirmModal({
        isOpen: true,
        type: "DELETE",
        id,
        title: "Hapus Data Peminjaman?",
        message: `Apakah Anda yakin ingin menghapus data peminjaman milik "${borrowerName}"? Tindakan ini tidak dapat dibatalkan.`,
      });
    }
  };

  // Eksekusi aksi setelah user klik tombol "Ya, Lanjutkan" di Modal
  const handleConfirmAction = async () => {
    if (confirmModal.id === null) return;

    const { type, id, status } = confirmModal;
    setConfirmModal((prev) => ({ ...prev, isOpen: false })); // Tutup modal

    setActionLoadingId(id);

    try {
      if (type === "UPDATE" && status) {
        setActionMessage(`Memproses status ${status.toLowerCase()}...`);

        const res = await apiFetch("/barang/update", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, status }),
        });

        const result: { err?: string; details?: string } | null = await res.json().catch(() => null);
        if (!result) {
          throw new Error(`Server Error (${res.status}): Respon server tidak valid.`);
        }

        if (!res.ok) {
          throw new Error(result.err || result.details || "Gagal memperbarui status.");
        }

        setActionMessage("Memperbarui data peminjaman...");
        await fetchLoans();
      } else if (type === "DELETE") {
        setActionMessage("Menghapus data peminjaman...");

        const res = await apiFetch("/barang/peminjaman", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id }),
        });

        const result: { err?: string; details?: string } | null = await res.json().catch(() => null);
        if (!result) {
          throw new Error(`Server Error (${res.status}): Respon server tidak valid.`);
        }

        if (!res.ok) {
          throw new Error(result.err || result.details || "Gagal menghapus data.");
        }

        setActionMessage("Memperbarui data peminjaman...");
        await fetchLoans();
      }
    } catch (err: unknown) {
      console.error("Action error:", err);
      alert(err instanceof Error ? err.message : "Terjadi kesalahan koneksi ke server.");
    } finally {
      setActionLoadingId(null);
      setActionMessage("");
    }
  };

  const filteredLoans = loans.filter((loan) => {
    const borrower = loan?.borrower_name || "";
    const item = loan?.item_name || "";
    const event = loan?.event_name || "";
    const query = searchQuery.toLowerCase();

    return (
      borrower.toLowerCase().includes(query) ||
      item.toLowerCase().includes(query) ||
      event.toLowerCase().includes(query)
    );
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "APPROVED":
        return <span className="px-2.5 py-1 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-semibold">Disetujui</span>;
      case "REJECTED":
        return <span className="px-2.5 py-1 bg-rose-100 text-rose-700 rounded-full text-[10px] font-semibold">Ditolak</span>;
      case "RETURNED":
        return <span className="px-2.5 py-1 bg-blue-100 text-blue-700 rounded-full text-[10px] font-semibold">Dikembalikan</span>;
      default:
        return <span className="px-2.5 py-1 bg-amber-100 text-amber-700 rounded-full text-[10px] font-semibold">Pending</span>;
    }
  };

  return (
    <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6 font-sans">
      {/* MODAL KONFIRMASI (YAKIN / BATAL) */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex justify-center items-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-lg font-bold text-zinc-900">{confirmModal.title}</h3>
            <p className="text-sm text-zinc-600 leading-relaxed">{confirmModal.message}</p>
            <div className="flex justify-end gap-2.5 pt-2">
              <button
                onClick={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
                className="px-4 py-2 bg-zinc-100 text-zinc-700 rounded-xl text-xs font-semibold hover:bg-zinc-200 transition cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={handleConfirmAction}
                className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-semibold hover:bg-emerald-700 transition cursor-pointer shadow-xs"
              >
                Ya, Lanjutkan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FULL-SCREEN OVERLAY LOADING SAAT AKSI PERUBAHAN DATA */}
      {actionLoadingId !== null && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex flex-col justify-center items-center">
          <div className="bg-white p-6 rounded-2xl shadow-xl flex flex-col items-center space-y-3 min-w-[220px]">
            <div className="animate-spin rounded-full h-10 w-10 border-4 border-emerald-600 border-t-transparent"></div>
            <p className="text-zinc-700 text-xs font-semibold">{actionMessage || "Mohon tunggu..."}</p>
          </div>
        </div>
      )}

      {/* Header & Search & Download Excel */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-gradient-to-r from-teal-700 to-emerald-700 px-6 py-5 rounded-2xl text-white shadow-md">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">Kelola Peminjaman Barang</h1>
          <p className="text-emerald-100 text-xs md:text-sm">Verifikasi, ubah status, atau hapus pengajuan pinjaman inventaris.</p>
        </div>

        <div className="w-full md:w-auto flex flex-col sm:flex-row items-center gap-3">
          {/* Tombol Export Excel */}
          <button
            onClick={handleExportExcel}
            className="w-full sm:w-auto px-4 py-2 bg-emerald-800 hover:bg-emerald-900 border border-emerald-500/30 text-white text-xs font-medium rounded-xl transition flex items-center justify-center gap-2 cursor-pointer shadow-xs"
          >
            <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM6 20V4h7v5h5v11H6zm10-9-2.5 4 2.5 4h-2.1l-1.4-2.4L11.1 19H9l2.5-4L9 11h2.1l1.4 2.4 1.4-2.4H16z"/>
            </svg>
            Download Excel
          </button>

          {/* Search Box */}
          <div className="w-full sm:w-64 relative">
            <input
              type="text"
              placeholder="Cari peminjam / barang..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-3 pr-3 py-2 text-sm rounded-xl bg-white/10 border border-white/20 text-white placeholder-emerald-200 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* BANNER ERROR SEMENTARA BILA API BERMASALAH */}
      {errorMessage && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex justify-between items-center">
          <span>⚠️ {errorMessage}</span>
          <button
            onClick={fetchLoans}
            className="px-3 py-1 bg-rose-600 text-white rounded-lg font-medium hover:bg-rose-700 transition cursor-pointer"
          >
            Coba Lagi
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center items-center py-24">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-700"></div>
          <span className="ml-3 text-zinc-500 text-sm">Memuat data peminjaman...</span>
        </div>
      ) : filteredLoans.length === 0 ? (
        <div className="text-center py-16 text-zinc-400 text-sm bg-white rounded-2xl border border-zinc-200 shadow-xs">
          Belum ada data peminjaman.
        </div>
      ) : (
        <>
          {/* TAMPILAN DESKTOP (Tabel) */}
          <div className="hidden md:block bg-white rounded-2xl border border-zinc-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-zinc-50 border-b border-zinc-200 text-zinc-600">
                    <th className="p-4 font-semibold">Peminjam</th>
                    <th className="p-4 font-semibold">Barang & Jumlah</th>
                    <th className="p-4 font-semibold">Keperluan Acara</th>
                    <th className="p-4 font-semibold">Rencana Tanggal</th>
                    <th className="p-4 font-semibold">Status</th>
                    <th className="p-4 font-semibold text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {filteredLoans.map((loan) => {
                    return (
                      <tr key={loan.id} className="hover:bg-zinc-50/50 transition">
                        <td className="p-4 font-medium text-zinc-800">{loan.borrower_name || "-"}</td>
                        <td className="p-4 text-zinc-600">
                          <div className="font-semibold text-zinc-800">{loan.item_name || "-"}</div>
                          <div className="text-zinc-500 text-[11px]">Jumlah: {loan.quantity_borrowed || 0} unit</div>
                        </td>
                        <td className="p-4 text-zinc-600">{loan.event_name || "-"}</td>
                        <td className="p-4 text-zinc-600 text-[11px]">
                          <div>Pinjam: {formatDate(loan.planned_borrow_date)}</div>
                          <div>Kembali: {formatDate(loan.planned_return_date)}</div>
                        </td>
                        <td className="p-4">{getStatusBadge(loan.status)}</td>
                        <td className="p-4">
                          <div className="flex items-center justify-center gap-1.5">
                            {loan.status === "PENDING" && (
                              <>
                                <button
                                  onClick={() => openConfirmModal("UPDATE", loan.id, loan.borrower_name, "APPROVED")}
                                  disabled={actionLoadingId !== null}
                                  className="px-2.5 py-1 bg-emerald-600 text-white rounded-lg text-[11px] font-medium hover:bg-emerald-700 transition disabled:opacity-50 cursor-pointer"
                                >
                                  Approve
                                </button>
                                <button
                                  onClick={() => openConfirmModal("UPDATE", loan.id, loan.borrower_name, "REJECTED")}
                                  disabled={actionLoadingId !== null}
                                  className="px-2.5 py-1 bg-rose-600 text-white rounded-lg text-[11px] font-medium hover:bg-rose-700 transition disabled:opacity-50 cursor-pointer"
                                >
                                  Reject
                                </button>
                              </>
                            )}
                            {loan.status === "APPROVED" && (
                              <button
                                onClick={() => openConfirmModal("UPDATE", loan.id, loan.borrower_name, "RETURNED")}
                                disabled={actionLoadingId !== null}
                                className="px-2.5 py-1 bg-blue-600 text-white rounded-lg text-[11px] font-medium hover:bg-blue-700 transition disabled:opacity-50 cursor-pointer"
                              >
                                Selesai/Kembali
                              </button>
                            )}
                            <button
                              onClick={() => openConfirmModal("DELETE", loan.id, loan.borrower_name)}
                              disabled={actionLoadingId !== null}
                              className="px-2.5 py-1 border border-rose-300 text-rose-600 rounded-lg text-[11px] font-medium hover:bg-rose-50 transition disabled:opacity-50 cursor-pointer"
                            >
                              Hapus
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* TAMPILAN MOBILE (Card List) */}
          <div className="grid grid-cols-1 gap-4 md:hidden">
            {filteredLoans.map((loan) => {
              return (
                <div key={loan.id} className="bg-white rounded-xl border border-zinc-200 p-4 shadow-xs space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-bold text-zinc-800 text-sm">{loan.borrower_name || "-"}</h3>
                      <p className="text-zinc-500 text-xs">Acara: {loan.event_name || "-"}</p>
                    </div>
                    <div>{getStatusBadge(loan.status)}</div>
                  </div>

                  <div className="bg-zinc-50 p-2.5 rounded-lg text-xs space-y-1">
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Barang:</span>
                      <span className="font-medium text-zinc-800">{loan.item_name || "-"} ({loan.quantity_borrowed || 0} unit)</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Rencana Pinjam:</span>
                      <span className="text-zinc-700">{formatDate(loan.planned_borrow_date)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Rencana Kembali:</span>
                      <span className="text-zinc-700">{formatDate(loan.planned_return_date)}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-end gap-1.5 pt-1 border-t border-zinc-100">
                    {loan.status === "PENDING" && (
                      <>
                        <button
                          onClick={() => openConfirmModal("UPDATE", loan.id, loan.borrower_name, "APPROVED")}
                          disabled={actionLoadingId !== null}
                          className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-medium disabled:opacity-50 cursor-pointer"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => openConfirmModal("UPDATE", loan.id, loan.borrower_name, "REJECTED")}
                          disabled={actionLoadingId !== null}
                          className="px-3 py-1.5 bg-rose-600 text-white rounded-lg text-xs font-medium disabled:opacity-50 cursor-pointer"
                        >
                          Reject
                        </button>
                      </>
                    )}
                    {loan.status === "APPROVED" && (
                      <button
                        onClick={() => openConfirmModal("UPDATE", loan.id, loan.borrower_name, "RETURNED")}
                        disabled={actionLoadingId !== null}
                        className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium disabled:opacity-50 cursor-pointer"
                      >
                        Tandai Dikembalikan
                      </button>
                    )}
                    <button
                      onClick={() => openConfirmModal("DELETE", loan.id, loan.borrower_name)}
                      disabled={actionLoadingId !== null}
                      className="px-3 py-1.5 border border-rose-300 text-rose-600 rounded-lg text-xs font-medium disabled:opacity-50 cursor-pointer"
                    >
                      Hapus
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}