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
interface ImportRow {
  fullName: string;
  nik: string;
  phone: string;
  outlet: string;
  position: string;
  joinDate: string;
  role: string;
  status: string;
  username: string;
  password: string;
  excelRow: number;
}
interface ImportResult {
  saved: boolean;
  invalid: number;
  rows: { row: number; fullName: string; nik: string; username: string; errors: string[]; generatedPassword?: string | null }[];
}

// Urutan kolom template; header dicocokkan berdasarkan urutan ini
const COLUMNS: { key: keyof ImportRow; header: string; width: number }[] = [
  { key: 'fullName', header: 'Nama lengkap *', width: 28 },
  { key: 'nik', header: 'NIK *', width: 20 },
  { key: 'phone', header: 'No HP *', width: 16 },
  { key: 'outlet', header: 'Cabang * (kode atau nama)', width: 24 },
  { key: 'position', header: 'Jabatan *', width: 22 },
  { key: 'joinDate', header: 'Tanggal masuk * (YYYY-MM-DD)', width: 26 },
  { key: 'role', header: 'Peran', width: 16 },
  { key: 'status', header: 'Status kerja', width: 16 },
  { key: 'username', header: 'Username', width: 16 },
  { key: 'password', header: 'Password awal', width: 16 },
];
const ROLE_LABELS = ['Kru', 'Kepala Cabang', 'Area Manager', 'Admin HR', 'Admin Keuangan', 'Super Admin'];
const STATUS_LABELS = ['Masa percobaan', 'Kontrak', 'Tetap', 'Harian', 'Magang'];

/** Impor karyawan dari Excel: unduh template, isi, unggah, periksa, lalu simpan. */
export default function ImportEmployeesDialog({ onClose, onImported }: { onClose: () => void; onImported: (count: number) => void }) {
  const isSuperAdmin = getSessionUser()?.role === 'SUPER_ADMIN';
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<ImportRow[] | null>(null);
  const [fileName, setFileName] = useState('');
  const [result, setResult] = useState<ImportResult | null>(null);
  const [busy, setBusy] = useState<'template' | 'check' | 'save' | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function downloadTemplate() {
    setBusy('template');
    setError(null);
    try {
      const [outlets, positions] = await Promise.all([
        apiFetch<OutletOption[]>('/outlets'),
        apiFetch<PositionOption[]>('/employees/positions'),
      ]);
      const wb = await newWorkbook();
      const ws = wb.addWorksheet('Karyawan');
      ws.addRow(COLUMNS.map((c) => c.header));
      styleHeader(ws, COLUMNS.map((c) => c.width));
      // NIK & No HP sebagai teks agar angka panjang tidak berubah
      ws.getColumn(2).numFmt = '@';
      ws.getColumn(3).numFmt = '@';
      ws.getColumn(6).numFmt = '@';
      const roles = isSuperAdmin ? ROLE_LABELS : ROLE_LABELS.slice(0, 3);
      for (let r = 2; r <= 501; r++) {
        ws.getCell(r, 7).dataValidation = { type: 'list', allowBlank: true, formulae: [`"${roles.join(',')}"`] };
        ws.getCell(r, 8).dataValidation = { type: 'list', allowBlank: true, formulae: [`"${STATUS_LABELS.join(',')}"`] };
      }

      const help = wb.addWorksheet('Petunjuk');
      help.columns = [{ width: 28 }, { width: 44 }];
      const lines: string[][] = [
        ['Cara mengisi', ''],
        ['Kolom bertanda *', 'Wajib diisi. Satu baris = satu karyawan, mulai baris 2.'],
        ['Cabang', 'Isi kode atau nama cabang dari daftar di bawah.'],
        ['Jabatan', 'Isi nama jabatan persis seperti daftar di bawah.'],
        ['Tanggal masuk', 'Format YYYY-MM-DD, misalnya 2026-01-15.'],
        ['Peran', `Kosong = Kru. Pilihan: ${roles.join(', ')}.`],
        ['Status kerja', `Kosong = Masa percobaan. Pilihan: ${STATUS_LABELS.join(', ')}.`],
        ['Username', 'Kosong = memakai NIK. Huruf kecil, angka, titik, - atau _ (3-30 karakter).'],
        ['Password awal', 'Kosong = dibuat acak; daftarnya bisa diunduh setelah impor.'],
        ['', ''],
        ['Kode cabang', 'Nama cabang'],
        ...outlets.map((o) => [o.code, o.name]),
        ['', ''],
        ['Jabatan', 'Departemen'],
        ...positions.map((p) => [p.title, p.department.name]),
      ];
      lines.forEach((l) => help.addRow(l));
      [1, 11, 13 + outlets.length].forEach((r) => (help.getRow(r).font = { bold: true }));
      await downloadWorkbook(wb, 'template-impor-karyawan.xlsx');
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
      const parsed: ImportRow[] = [];
      ws.eachRow({ includeEmpty: false }, (row, n) => {
        if (n === 1) return;
        const values = COLUMNS.map((_, i) => cellText(row.getCell(i + 1).value));
        if (values.every((v) => !v)) return;
        // No HP yang tersimpan sebagai angka kehilangan 0 di depan (812... → 0812...)
        const phone = COLUMNS.findIndex((c) => c.key === 'phone');
        if (/^8\d{7,12}$/.test(values[phone])) values[phone] = `0${values[phone]}`;
        parsed.push({ ...(Object.fromEntries(COLUMNS.map((c, i) => [c.key, values[i]])) as Omit<ImportRow, 'excelRow'>), excelRow: n });
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
      if (res.saved) onImported(res.rows.length);
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
    result.rows.forEach((r) => ws.addRow([r.fullName, r.nik, r.username, r.generatedPassword ?? '(diisi di file impor)']));
    await downloadWorkbook(wb, 'akun-karyawan-baru.xlsx');
  }

  const invalidRows = result?.rows.filter((r) => r.errors.length) ?? [];

  return (
    <Dialog wide title="Impor karyawan dari Excel" onClose={() => !busy && onClose()}>
      <ol className="list-decimal space-y-1 pl-5 text-slate-700">
        <li>Unduh template, isi satu karyawan per baris (petunjuk ada di lembar &quot;Petunjuk&quot;).</li>
        <li>Unggah file. Semua baris diperiksa dulu; belum ada yang disimpan.</li>
        <li>Bila semua baris benar, tekan Simpan. Bila ada yang salah, perbaiki di Excel lalu unggah lagi.</li>
      </ol>

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={downloadTemplate} disabled={!!busy} className="btn btn-secondary">
          {busy === 'template' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Download className="h-4 w-4" aria-hidden />}
          Unduh template
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
              {result.rows.length} karyawan dari {fileName} tersimpan. Unduh daftar akun untuk dibagikan; password acak hanya
              ditampilkan sekarang.
            </p>
          ) : result.invalid ? (
            <p role="alert" className="alert-error">
              {result.invalid} dari {rows.length} baris perlu diperbaiki. Belum ada yang disimpan.
            </p>
          ) : (
            <p role="status" className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-800">
              Semua {rows.length} baris di {fileName} benar dan siap disimpan.
            </p>
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
            <button type="button" onClick={downloadCredentials} className="btn btn-secondary">
              <Download className="h-4 w-4" aria-hidden /> Unduh daftar akun
            </button>
            <button type="button" onClick={onClose} className="btn btn-dark">Selesai</button>
          </>
        ) : (
          <>
            <button type="button" disabled={!!busy} onClick={onClose} className="btn btn-ghost">Batal</button>
            <button
              type="button"
              disabled={!!busy || !rows || !result || result.invalid > 0}
              onClick={() => rows && submit(rows, false)}
              className="btn btn-primary"
            >
              {busy === 'save' && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
              Simpan {rows && result && !result.invalid ? `${rows.length} karyawan` : ''}
            </button>
          </>
        )}
      </div>
    </Dialog>
  );
}
