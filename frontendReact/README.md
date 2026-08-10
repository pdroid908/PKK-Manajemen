# 💻 Frontend - MultiRole Scheduler

Repitori ini adalah bagian **Frontend (Antarmuka Pengguna)** dari proyek **MultiRole Scheduler**. Aplikasi ini dirancang sebagai jembatan visual dan interaktif bagi pengguna untuk mengakses sistem penjadwalan dan booking online yang dikelola oleh backend Go (Golang)[cite: 1].

---

## 🔗 Hubungan dengan Backend

Frontend ini bekerja secara berdampingan dengan RESTful API dari backend **MultiRole Scheduler Go**[cite: 1]. Seluruh aksi yang dilakukan pengguna pada antarmuka ini (seperti login admin, manajemen jadwal, hingga proses booking oleh pelanggan) akan dikirim dan divalidasi langsung oleh backend guna memastikan keamanan data serta mencegah terjadinya *double booking*[cite: 1].

---

## 👥 Hak Akses & Fitur Antarmuka Frontend

Frontend ini membagi tampilan berdasarkan 3 hak akses utama yang disesuaikan dengan aturan sistem backend:

### 1. 👨‍💼 Dashboard Administrator
Antarmuka kontrol penuh untuk admin mengelola sistem:
- **Halaman Login Admin**: Gerbang autentikasi aman menggunakan token dari backend.
- **Manajemen Member**: Tampilan untuk mendaftarkan dan mengelola data akun member[cite: 1].
- **Manajemen Jadwal (CRUD)**: Menu interaktif untuk mengatur tanggal, waktu, dan ketersediaan jadwal[cite: 1].
- **Monitoring & Validasi Booking**: Daftar masuk reservasi pelanggan untuk disetujui atau ditolak[cite: 1].
- **Generator Tautan Publik**: Tombol salin cepat untuk membagikan *link booking* ke pelanggan[cite: 1].

### 2. 👤 Dashboard Member
Halaman khusus bagi member untuk memantau jadwal mereka:
- **Jadwal Terverifikasi**: Menampilkan daftar tanggal, waktu, dan keperluan acara yang **sudah divalidasi dan resmi diterima oleh administrator**[cite: 1].

### 3. 🌐 Halaman Publik Pelanggan (Public Booking Link)
Halaman luar yang bersih dan ramah pengguna (tanpa perlu login/buat akun)[cite: 1]:
- **Katalog Jadwal Kosong**: Menampilkan slot waktu yang masih tersedia untuk dipilih[cite: 1].
- **Formulir Pemesanan**: Tempat pelanggan memasukkan data diri dan keperluan booking[cite: 1].
- **Pemberitahuan Real-time**: Menampilkan pesan sukses atau peringatan otomatis jika jadwal yang dipilih keburu habis dipesan orang lain (sinkron dengan validasi anti-bentrok backend)[cite: 1].

---

## 🚀 Poin Utama Pengalaman Pengguna (UX)

- **Tampilan Bersih & Responsif**: Nyaman diakses lewat berbagai perangkat (Desktop, Tablet, Mobile).
- **Penanganan Error Pintar**: Menampilkan notifikasi yang jelas jika terjadi kesalahan koneksi atau penolakan dari sistem backend.
- **Navigasi Berbasis Peran**: Menu otomatis menyesuaikan siapa yang sedang login (Admin atau Member) demi menjaga keamanan alur aplikasi.