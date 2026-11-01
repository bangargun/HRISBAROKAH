# Aturan Mutlak Pengembangan HRIS Barokah Grup

## 1. Larangan Mutlak Data Mock / Dummy (Zero Mock Policy)
1. **Dilarang Keras Membuat Mock Data**: Agen TIDAK BOLEH membuat data dummy, mock array, sample palsu, atau hardcoded data tiruan dalam bentuk apa pun di komponen frontend (`web-admin`, `mobile_user`) maupun `backend`.
2. **Kondisi Data Kosong (Clean Empty State) yang Nyata**: Seluruh modul, tabel, dropdown, dan form harus dimulai dari kondisi data kosong yang bersih apabila belum ada data yang diinputkan pengguna, lengkap dengan tombol/form input nyata.
3. **Data Bersifat Nyata & Persisten**: Seluruh data operasional (karyawan, outlet, presensi, jadwal shift, pelanggaran, payroll, dan KPI) harus berasal dari:
   - Input langsung pengguna (Bang Argun / Pimpinan Cabang) melalui antarmuka sistem.
   - Penyimpanan riil (Database PostgreSQL / Prisma / backend REST API / persistent local state yang sinkron).
4. **Pembersihan Permanen**: Setiap ada mock data lama yang ditemukan di kode sumber, agen wajib menghapusnya secara permanen dan menggantinya dengan state interaktif yang siap diisi secara riil.
