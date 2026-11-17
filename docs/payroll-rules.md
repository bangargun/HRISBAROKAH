# Aturan Perhitungan Gaji (Tahap 1)

Dokumen ini menjelaskan cara sistem menghitung gaji. Angka-angka di bawah adalah nilai awal dan bisa diubah HR di menu **Penggajian → Aturan Gaji** tanpa mengubah kode.

Keputusan pemilik (15 November 2026):

- Gaji pokok mengikuti rumus masa kerja SOP-HR-007.
- Tahap pertama hanya komponen inti. Denda pelanggaran libur, insentif libur tidak diambil, BPJS dan PPh 21 belum dihitung.
- Periode gaji mengikuti tanggal tutup buku masing-masing cabang.
- Menit terlambat memotong gaji per menit dengan tarif yang diisi HR.
- Hari izin dan hari mangkir memotong gaji pokok.
- Karyawan yang mulai bekerja di tengah periode mendapat gaji pokok prorata.

Keputusan pemilik (17 November 2026), karyawan keluar:

- **Mengundurkan diri**: gaji periode yang memuat hari terakhir kerja tidak dibayar, sesuai kesepakatan kerja. Karyawan itu tidak dimasukkan ke perhitungan gaji periode tersebut.
- **PHK**: gaji periode terakhir dibayar prorata sampai hari terakhir kerja.

## Periode gaji

Setiap cabang punya **tanggal tutup buku** (1–31). Periode bulan M berjalan dari sehari setelah tanggal tutup buku bulan sebelumnya sampai tanggal tutup buku bulan M.

| Tutup buku | Periode November 2026 |
|---|---|
| 31 (akhir bulan) | 1 Nov – 30 Nov |
| 25 | 26 Okt – 25 Nov |

Bila tanggal tutup buku melebihi jumlah hari dalam bulan (misalnya 31 di bulan Februari), dipakai hari terakhir bulan tersebut.

## Komponen

Semua nominal dibulatkan ke rupiah terdekat.

### Pendapatan

1. **Gaji pokok**: Rp 1.000.000 bila masa kerja di akhir periode kurang dari 3 bulan penuh, Rp 1.200.000 bila 3 bulan atau lebih.
   - Bila karyawan mulai bekerja setelah awal periode, gaji pokok = gaji pokok ÷ 30 × jumlah hari sejak tanggal masuk sampai akhir periode (maksimal gaji pokok penuh).
   - Karyawan yang di-PHK sebelum akhir periode: gaji pokok **dan tunjangan masa kerja** = nominal ÷ 30 × jumlah hari kerja sampai hari terakhir kerja (maksimal nominal penuh). Hari setelah hari terakhir kerja tidak dihitung hadir, izin, maupun mangkir. Masa kerja dihitung sampai hari terakhir kerja.
2. **Uang makan**: Rp 20.000 × jumlah hari karyawan absen masuk di periode itu.
3. **Tunjangan masa kerja** (berdasarkan bulan kerja ke-n di akhir periode):

   | Bulan kerja | Tunjangan |
   |---|---|
   | 1–6 | Rp 0 |
   | 7–12 | Rp 100.000 |
   | 13–18 | Rp 200.000 |
   | 19–24 | Rp 250.000 |
   | 25 dst. | Rp 250.000 + Rp 50.000 per 6 bulan berikutnya |

### Potongan

1. **Hari tanpa gaji** = gaji pokok ÷ 30 × (hari izin + hari mangkir).
   - *Hari izin*: tanggal di periode itu yang tercakup pengajuan **Izin** yang sudah disetujui HR.
   - *Hari mangkir*: tanggal yang dijadwalkan masuk (Jadwal Kerja), sudah lewat, tidak ada absen masuk, dan tidak tercakup pengajuan apa pun yang disetujui (cuti, sakit, izin, dan sebagainya).
   - Cuti tahunan, cuti khusus dan sakit yang disetujui **tidak** memotong gaji.
   - Potongan ini tidak melebihi gaji pokok yang diterima.
2. **Potongan terlambat** = tarif per menit × total menit terlambat di periode itu. Menit terlambat dihitung dari jam mulai shift (lihat Jadwal Kerja). Tarif awal Rp 0 sampai HR mengisinya.
3. **Cicilan kasbon** = cicilan bulanan setiap kasbon yang sudah dicairkan dan belum lunas (maksimal sisa pinjamannya).
   - Total cicilan maksimal 50% gaji pokok (SOP-HR-002/004).
   - Cicilan tidak membuat gaji bersih minus; sisa yang belum terpotong tetap tercatat sebagai sisa kasbon.

### Gaji bersih

Gaji bersih = (gaji pokok + uang makan + tunjangan masa kerja) − (hari tanpa gaji + terlambat) − cicilan kasbon, minimal Rp 0.

## Alur kerja

1. **Hitung**: HR/Finance memilih cabang dan bulan, lalu sistem membuat draf gaji untuk semua karyawan aktif cabang itu. Draf boleh dihitung ulang kapan saja, misalnya setelah memperbaiki absen atau jadwal.
2. **Finalkan**: draf dikunci. Saat itu juga cicilan kasbon dicatat dan sisa kasbon berkurang. Gaji yang sudah final tidak bisa dihitung ulang.
3. **Tandai dibayar**: Finance menandai gaji periode itu sudah ditransfer.

Yang bisa melihat dan menjalankan penggajian: Super Admin, Admin HR dan Admin Keuangan. Kepala Cabang dan Area Manager tidak.

## Belum termasuk

- Denda pelanggaran libur dan insentif libur tidak diambil (SOP-HR-003, SOP-001/006).
- Lembur, service charge, BPJS, PPh 21.
- Slip gaji PDF.
- Ketentuan resign di tengah periode. Aturan "gaji berjalan hangus" di SOP lama sengaja **tidak** diotomatiskan karena berpotensi bertentangan dengan aturan pengupahan; mohon dikonfirmasi ke HR atau konsultan ketenagakerjaan.
- Tunjangan masa kerja saat ini dibayar penuh walau karyawan tidak hadir sama sekali di periode itu, karena SOP tidak mengaitkannya dengan kehadiran. Mohon dikonfirmasi apakah ini memang dikehendaki.
- Catatan: gaji pokok Rp 1–1,2 juta per bulan berada jauh di bawah UMK di sebagian besar daerah. Pastikan angka ini memang hanya sebagian dari total upah, atau sesuaikan di Aturan Gaji.
