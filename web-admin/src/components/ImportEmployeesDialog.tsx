'use client';

import React, { useRef, useState } from 'react';
import { Download, FileSpreadsheet, Loader2 } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { getSessionUser } from '@/lib/auth';
import { cellText, downloadWorkbook, newWorkbook, styleHeader } from '@/lib/excel';
import Dialog from '@/components/Dialog';

interface OutletOption {
  id: string;
  code: string;
  name: string;
}
interface PositionOption {
  id: string;
  title: string;
  department: { name: string };
}
type ColumnKey =
  | 'fullName' | 'nik' | 'phone' | 'outlet' | 'position' | 'joinDate' | 'role' | 'status'
  | 'birthDate' | 'gender' | 'address' | 'email' | 'bankName' | 'bankAccountNumber' | 'bankAccountHolder'
  | 'username' | 'password';
type ImportRow = Record<ColumnKey, string> & { excelRow: number };
interface ResultRow {
  row: number;
  mode: 'create' | 'update';
  fullName: string;
  nik: string;
  username: string;
  changed: string[];
  errors: string[];
  generatedPassword?: string | null;
}
interface ImportResult {
  saved: boolean;
  invalid: number;
  summary: { created: number; updated: number; unchanged: number };
  rows: ResultRow[];
}

/**
 * Kolom template. Saat membaca file, kolom dicocokkan lewat judulnya (bukan urutan),
 * jadi template lama dan kolom yang dihapus atau dipindah tetap terbaca.
 */
const COLUMNS: { key: ColumnKey; header: string; width: number; text?: boolean }[] = [
  { key: 'nik', header: 'NIK *', width: 20, text: true },
  { key: 'fullName', header: 'Nama lengkap', width: 28 },
  { key: 'phone', header: 'No HP', width: 16, text: true },
  { key: 'outlet', header: 'Cabang (kode atau nama)', width: 24 },
  { key: 'position', header: 'Jabatan', width: 22 },
  { key: 'joinDate', header: 'Tanggal masuk (YYYY-MM-DD)', width: 24, text: true },
  { key: 'role', header: 'Peran', width: 16 },
  { key: 'status', header: 'Status kerja', width: 16 },
  { key: 'birthDate', header: 'Tanggal lahir (YYYY-MM-DD)', width: 24, text: true },
  { key: 'gender', header: 'Jenis kelamin', width: 15 },
  { key: 'address', header: 'Alamat', width: 36 },
  { key: 'email', header: 'Email', width: 26 },
  { key: 'bankName', header: 'Nama bank', width: 14 },
  { key: 'bankAccountNumber', header: 'Nomor rekening', width: 20, text: true },
  { key: 'bankAccountHolder', header: 'Nama pemilik rekening', width: 26 },
  { key: 'username', header: 'Username', width: 16 },
  { key: 'password', header: 'Password awal', width: 16 },
];
const colOf = (key: ColumnKey) => COLUMNS.findIndex((c) => c.key === key) + 1;
/** Judul tanpa tanda * dan keterangan dalam kurung, huruf kecil: "Nama lengkap *" → "nama lengkap". */
const headerKey = (h: string) => h.replace(/\(.*?\)/g, '').replace(/\*/g, '').trim().toLowerCase();
const HEADER_TO_KEY = new Map(COLUMNS.map((c) => [headerKey(c.header), c.key]));
const ROLE_LABELS = ['Kru', 'Kepala Cabang', 'Area Manager', 'Admin HR', 'Admin Keuangan', 'Super Admin'];
const ROLE_OF: Record<string, string> = {
  EMPLOYEE: 'Kru', STORE_MANAGER: 'Kepala Cabang', AREA_MANAGER: 'Area Manager',
  HR_ADMIN: 'Admin HR', FINANCE_ADMIN: 'Admin Keuangan', SUPER_ADMIN: 'Super Admin',
};
const STATUS_LABELS = ['Masa percobaan', 'Kontrak', 'Tetap', 'Harian', 'Magang'];
const STATUS_OF: Record<string, string> = {
  PROBATION: 'Masa percobaan', CONTRACT: 'Kontrak', PERMANENT: 'Tetap', DAILY_WORKER: 'Harian', INTERN: 'Magang',
};
const GENDER_LABELS = ['Laki-laki', 'Perempuan'];

/** Karyawan sebagaimana dikirim GET /employees (yang dipakai untuk mengisi template). */
interface CurrentEmployee {
  nik: string;
  fullName: string;
  phone: string;
  joinDate: string;
  status: string;
  birthDate: string | null;
  gender: string | null;
  address: string | null;
  bankName: string | null;
  bankAccountNumber: string | null;
  bankAccountHolder: string | null;
  user: { username: string; email: string | null; role: string; isActive: boolean };
  outlet: { code: string; name: string };
  position: { title: string };
}

/** Impor / perbarui karyawan dari Excel: unduh template, isi, unggah, periksa, lalu simpan. */
export default function ImportEmployeesDialog({ onClose, onImported }: { onClose: () => void; onImported: (count: number) => void }) {
  const isSuperAdmin = getSessionUser()?.role === 'SUPER_ADMIN';
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<ImportRow[] | null>(null);
  const [fileName, setFileName] = useState('');
  const [result, setResult] = useState<ImportResult | null>(null);
  const [busy, setBusy] = useState<'template' | 'filled' | 'check' | 'save' | null>(null);
  const [error, setError] = useState<string | null>(null);

  /** Template kosong, atau (filled) berisi semua karyawan aktif untuk diperbarui lalu diunggah lagi. */
  async function downloadTemplate(filled: boolean) {
    setBusy(filled ? 'filled' : 'template');
    setError(null);
    try {
      const [outlets, positions, current] = await Promise.all([
        apiFetch<OutletOption[]>('/outlets'),
        apiFetch<PositionOption[]>('/employees/positions'),
        filled ? apiFetch<CurrentEmployee[]>('/employees') : Promise.resolve([] as CurrentEmployee[]),
      ]);
      const wb = await newWorkbook();
      const ws = wb.addWorksheet('Karyawan');
      ws.addRow(COLUMNS.map((c) => c.header));
      styleHeader(ws, COLUMNS.map((c) => c.width));
      // NIK, No HP, tanggal & rekening sebagai teks agar angka panjang dan 0 di depan tidak berubah
      COLUMNS.forEach((c, i) => c.text && (ws.getColumn(i + 1).numFmt = '@'));
      const day = (iso: string | null) => (iso ? iso.slice(0, 10) : '');
      for (const e of current.filter((x) => x.user.isActive)) {
        const values: Record<ColumnKey, string> = {
          nik: e.nik,
          fullName: e.fullName,
          phone: e.phone,
          outlet: e.outlet.code,
          position: e.position.title,
          joinDate: day(e.joinDate),
          role: ROLE_OF[e.user.role] ?? '',
          status: STATUS_OF[e.status] ?? '',
          birthDate: day(e.birthDate),
          gender: e.gender ?? '',
          address: e.address ?? '',
          email: e.user.email ?? '',
          bankName: e.bankName ?? '',
          bankAccountNumber: e.bankAccountNumber ?? '',
          bankAccountHolder: e.bankAccountHolder ?? '',
          username: '',
          password: '',
        };
        ws.addRow(COLUMNS.map((c) => values[c.key]));
      }
      const roles = isSuperAdmin ? ROLE_LABELS : ROLE_LABELS.slice(0, 3);
      const lists: [ColumnKey, string[]][] = [['role', roles], ['status', STATUS_LABELS], ['gender', GENDER_LABELS]];
      const lastRow = Math.max(501, current.length + 200);
      for (let r = 2; r <= lastRow; r++) {
        for (const [key, options] of lists) {
          ws.getCell(r, colOf(key)).dataValidation = { type: 'list', allowBlank: true, formulae: [`"${options.join(',')}"`] };
        }
      }

      const help = wb.addWorksheet('Petunjuk');
      help.columns = [{ width: 28 }, { width: 44 }];
      const lines: string[][] = [
        ['Cara mengisi', ''],
        ['NIK', 'Wajib. Satu baris = satu karyawan, mulai baris 2.'],
        ['NIK belum terdaftar', 'Karyawan baru. Wajib: nama lengkap, no HP, cabang, jabatan, tanggal masuk.'],
        ['NIK sudah terdaftar', 'Data karyawan itu diperbarui. Hanya sel yang diisi yang mengubah data; sel kosong dibiarkan.'],
        ['Cabang', 'Isi kode atau nama cabang dari daftar di bawah.'],
        ['Jabatan', 'Isi nama jabatan persis seperti daftar di bawah.'],
        ['Tanggal', 'Format YYYY-MM-DD, misalnya 2026-01-15.'],
        ['Peran', `Kosong = Kru (karyawan baru) atau tidak diubah. Pilihan: ${roles.join(', ')}.`],
        ['Status kerja', `Kosong = Masa percobaan (karyawan baru) atau tidak diubah. Pilihan: ${STATUS_LABELS.join(', ')}.`],
        ['Jenis kelamin', 'Laki-laki atau Perempuan.'],
        ['Rekening', 'Nomor rekening angka saja. Rekening yang diisi di sini langsung dipakai untuk gaji.'],
        ['Username', 'Hanya untuk karyawan baru. Kosong = memakai NIK.'],
        ['Password awal', 'Hanya untuk karyawan baru. Kosong = dibuat acak; daftarnya bisa diunduh setelah impor.'],
        ['', ''],
        ['Kode cabang', 'Nama cabang'],
        ...outlets.map((o) => [o.code, o.name]),
        ['', ''],
        ['Jabatan', 'Departemen'],
        ...positions.map((p) => [p.title, p.department.name]),
      ];
      lines.forEach((l) => help.addRow(l));
      [1, 15, 17 + outlets.length].forEach((r) => (help.getRow(r).font = { bold: true }));
      await downloadWorkbook(wb, filled ? 'data-karyawan-untuk-diperbarui.xlsx' : 'template-impor-karyawan.xlsx');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function readFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError(null);
    setResult(null);
    setRows(null);
    try {
      const wb = await newWorkbook();
      await wb.xlsx.load(await file.arrayBuffer());
      const ws = wb.worksheets[0];
      if (!ws) throw new Error('File tidak berisi lembar kerja');
      // Kolom dikenali dari judul di baris 1
      const columnOf = new Map<ColumnKey, number>();
      ws.getRow(1).eachCell((cell, col) => {
        const key = HEADER_TO_KEY.get(headerKey(cellText(cell.value)));
        if (key && !columnOf.has(key)) columnOf.set(key, col);
      });
      if (!columnOf.has('nik')) throw new Error('kolom "NIK" tidak ditemukan di baris 1');
      const parsed: ImportRow[] = [];
      ws.eachRow({ includeEmpty: false }, (row, n) => {
        if (n === 1) return;
        const values = Object.fromEntries(
          COLUMNS.map((c) => [c.key, columnOf.has(c.key) ? cellText(row.getCell(columnOf.get(c.key)!).value) : '']),
        ) as Record<ColumnKey, string>;
        if (Object.values(values).every((v) => !v)) return;
        // No HP yang tersimpan sebagai angka kehilangan 0 di depan (812... → 0812...)
        if (/^8\d{7,12}$/.test(values.phone)) values.phone = `0${values.phone}`;
        parsed.push({ ...values, excelRow: n });
      });
      if (parsed.length === 0) throw new Error('Tidak ada data karyawan di file ini (baris 2 dan seterusnya).');
      setRows(parsed);
      setFileName(file.name);
      await submit(parsed, true);
    } catch (err) {
      setError(`File tidak bisa dibaca: ${(err as Error).message}. Pakai template .xlsx dari tombol di atas.`);
    }
  }

  async function submit(data: ImportRow[], dryRun: boolean) {
    setBusy(dryRun ? 'check' : 'save');
    setError(null);
    try {
      const res = await apiFetch<ImportResult>('/employees/import', { method: 'POST', body: JSON.stringify({ rows: data, dryRun }) });
      setResult(res);
      if (res.saved) onImported(res.summary.created + res.summary.updated);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function downloadCredentials() {
    if (!result?.saved) return;
    const wb = await newWorkbook();
    const ws = wb.addWorksheet('Akun login');
    ws.addRow(['Nama', 'NIK', 'Username', 'Password awal']);
    styleHeader(ws, [28, 20, 18, 18]);
    result.rows
      .filter((r) => r.mode === 'create')
      .forEach((r) => ws.addRow([r.fullName, r.nik, r.username, r.generatedPassword ?? '(diisi di file impor)']));
    await downloadWorkbook(wb, 'akun-karyawan-baru.xlsx');
  }

  const invalidRows = result?.rows.filter((r) => r.errors.length) ?? [];
  const updatedRows = result?.rows.filter((r) => r.mode === 'update' && r.changed.length) ?? [];
  const counts = result
    ? [
        result.summary.created && `${result.summary.created} karyawan baru`,
        result.summary.updated && `${result.summary.updated} diperbarui`,
        result.summary.unchanged && `${result.summary.unchanged} tidak berubah`,
      ].filter(Boolean).join(', ')
    : '';
  const willSave = result ? result.summary.created + result.summary.updated : 0;

  return (
    <Dialog wide title="Impor / perbarui karyawan dari Excel" onClose={() => !busy && onClose()}>
      <ol className="list-decimal space-y-1 pl-5 text-slate-700">
        <li>
          Unduh template kosong untuk karyawan baru, atau unduh data karyawan yang sudah ada untuk dilengkapi. NIK menjadi
          kunci: NIK baru ditambahkan, NIK yang sudah terdaftar diperbarui.
        </li>
        <li>Unggah file. Semua baris diperiksa dulu; belum ada yang disimpan.</li>
        <li>Bila semua baris benar, tekan Simpan. Bila ada yang salah, perbaiki di Excel lalu unggah lagi.</li>
      </ol>

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => downloadTemplate(false)} disabled={!!busy} className="btn btn-secondary">
          {busy === 'template' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Download className="h-4 w-4" aria-hidden />}
          Template kosong
        </button>
        <button type="button" onClick={() => downloadTemplate(true)} disabled={!!busy} className="btn btn-secondary">
          {busy === 'filled' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Download className="h-4 w-4" aria-hidden />}
          Data karyawan sekarang
        </button>
        <input ref={fileRef} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={readFile} className="sr-only" />
        <button type="button" onClick={() => fileRef.current?.click()} disabled={!!busy} className="btn btn-secondary">
          {busy === 'check' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <FileSpreadsheet className="h-4 w-4" aria-hidden />}
          {rows ? 'Unggah file lain' : 'Unggah file Excel'}
        </button>
      </div>

      {error && <p role="alert" className="alert-error">{error}</p>}

      {result && rows && (
        <div className="space-y-2">
          {result.saved ? (
            <p role="status" className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-800">
              Tersimpan dari {fileName}: {counts}.
              {result.summary.created > 0 && ' Unduh daftar akun untuk dibagikan; password acak hanya ditampilkan sekarang.'}
            </p>
          ) : result.invalid ? (
            <p role="alert" className="alert-error">
              {result.invalid} dari {rows.length} baris perlu diperbaiki. Belum ada yang disimpan.
            </p>
          ) : (
            <p role="status" className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-800">
              Semua {rows.length} baris di {fileName} benar: {counts}.{willSave === 0 && ' Tidak ada yang perlu disimpan.'}
            </p>
          )}

          {!result.invalid && updatedRows.length > 0 && (
            <div className="max-h-64 overflow-auto rounded-md border border-slate-200">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="table-head">
                    <th scope="col" className="px-3 py-2">Baris</th>
                    <th scope="col" className="px-3 py-2">Karyawan</th>
                    <th scope="col" className="px-3 py-2">{result.saved ? 'Yang diperbarui' : 'Yang akan diperbarui'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {updatedRows.map((r) => (
                    <tr key={r.row} className="align-top">
                      <td className="px-3 py-2 tabular-nums text-slate-700">{r.row}</td>
                      <td className="px-3 py-2 text-slate-800">{r.fullName}<p className="text-xs text-slate-500">{r.nik}</p></td>
                      <td className="px-3 py-2 text-slate-700">{r.changed.join(', ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {invalidRows.length > 0 && (
            <div className="max-h-64 overflow-auto rounded-md border border-slate-200">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="table-head">
                    <th scope="col" className="px-3 py-2">Baris</th>
                    <th scope="col" className="px-3 py-2">Karyawan</th>
                    <th scope="col" className="px-3 py-2">Yang perlu diperbaiki</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {invalidRows.map((r) => (
                    <tr key={r.row} className="align-top">
                      <td className="px-3 py-2 tabular-nums text-slate-700">{r.row}</td>
                      <td className="px-3 py-2 text-slate-800">{r.fullName || '–'}<p className="text-xs text-slate-500">{r.nik}</p></td>
                      <td className="px-3 py-2 text-rose-700">
                        <ul className="list-disc pl-4">
                          {r.errors.map((e) => (
                            <li key={e}>{e}</li>
                          ))}
                        </ul>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
        {result?.saved ? (
          <>
            {result.summary.created > 0 && (
              <button type="button" onClick={downloadCredentials} className="btn btn-secondary">
                <Download className="h-4 w-4" aria-hidden /> Unduh daftar akun
              </button>
            )}
            <button type="button" onClick={onClose} className="btn btn-dark">Selesai</button>
          </>
        ) : (
          <>
            <button type="button" disabled={!!busy} onClick={onClose} className="btn btn-ghost">Batal</button>
            <button
              type="button"
              disabled={!!busy || !rows || !result || result.invalid > 0 || willSave === 0}
              onClick={() => rows && submit(rows, false)}
              className="btn btn-primary"
            >
              {busy === 'save' && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
              Simpan {result && !result.invalid && willSave ? `${willSave} karyawan` : ''}
            </button>
          </>
        )}
      </div>
    </Dialog>
  );
}
