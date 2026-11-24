'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Printer, Search } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { getSessionUser } from '@/lib/auth';
import { CATEGORY_LABEL, OutletOption, longDate } from './shared';

interface Certificate {
  id: string;
  certificateNo: string;
  passedAt: string;
  bestScore: number;
  module: { id: string; code: string; title: string; category: string };
  employee: { id: string; fullName: string; nik: string; outlet: { name: string }; position: { title: string } };
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function printCertificate(c: Certificate) {
  const w = window.open('', '_blank');
  if (!w) return;
  w.document.write(`<!doctype html><html lang="id"><head><meta charset="utf-8"><title>${esc(c.certificateNo)}</title>
<style>
@page { size: A4 landscape; margin: 14mm; }
body { font-family: 'Times New Roman', serif; color: #15181e; margin: 0; }
.frame { border: 3px solid #cfa04a; padding: 18mm 20mm; min-height: 150mm; box-sizing: border-box; text-align: center; }
img { height: 70px; }
h1 { font-size: 30pt; letter-spacing: 3px; margin: 12px 0 4px; }
.no { font-size: 11pt; color: #555; }
.name { font-size: 26pt; font-weight: bold; margin: 18px 0 4px; }
.mod { font-size: 15pt; margin: 8px 0; }
.meta { font-size: 11pt; color: #444; margin-top: 18px; }
</style></head><body><div class="frame">
<img src="${window.location.origin}/logo-barokah-group.jpg" alt="Barokah Grup">
<h1>SERTIFIKAT</h1>
<div class="no">Nomor ${esc(c.certificateNo)}</div>
<p>diberikan kepada</p>
<div class="name">${esc(c.employee.fullName)}</div>
<div>${esc(c.employee.position.title)} · ${esc(c.employee.outlet.name)}</div>
<p>telah lulus modul pelatihan</p>
<div class="mod"><b>${esc(c.module.code)} · ${esc(c.module.title)}</b></div>
<div class="meta">Nilai ${c.bestScore} · Lulus ${esc(longDate(c.passedAt))}</div>
</div></body></html>`);
  w.document.close();
  w.addEventListener('load', () => w.print());
}

/** Sertifikat = modul yang kuisnya lulus (dihitung server, bukan input manual). */
export default function CertificatesTab({ outlets }: { outlets: OutletOption[] }) {
  const isStoreManager = getSessionUser()?.role === 'STORE_MANAGER';
  const [rows, setRows] = useState<Certificate[] | null>(null);
  const [outletId, setOutletId] = useState('');
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setRows(null);
    apiFetch<Certificate[]>(`/training/certificates${outletId ? `?outletId=${outletId}` : ''}`)
      .then(setRows)
      .catch((e) => setError((e as Error).message));
  }, [outletId]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (rows ?? []).filter(
      (c) => !q || [c.employee.fullName, c.employee.nik, c.module.code, c.module.title, c.certificateNo].some((v) => v.toLowerCase().includes(q)),
    );
  }, [rows, query]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
          <label htmlFor="cert-search" className="sr-only">Cari sertifikat</label>
          <input id="cert-search" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari nama, NIK, modul, nomor" className="input pl-9" />
        </div>
        {!isStoreManager && (
          <>
            <label htmlFor="cert-outlet" className="sr-only">Cabang</label>
            <select id="cert-outlet" value={outletId} onChange={(e) => setOutletId(e.target.value)} className="input w-auto">
              <option value="">Semua cabang</option>
              {outlets.map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
          </>
        )}
      </div>
      {error && <p role="alert" className="alert-error">{error}</p>}
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="table-head">
            <tr>
              <th scope="col" className="px-4 py-3">Kru</th>
              <th scope="col" className="px-4 py-3">Modul</th>
              <th scope="col" className="px-4 py-3">Nilai</th>
              <th scope="col" className="px-4 py-3">Lulus</th>
              <th scope="col" className="px-4 py-3 text-right">Sertifikat</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows === null ? (
              <tr><td colSpan={5} className="px-4 py-6 text-slate-500">Memuat…</td></tr>
            ) : shown.length === 0 ? (
              <tr><td colSpan={5} className="empty-state">{rows.length === 0 ? 'Belum ada kru yang lulus modul.' : 'Tidak ada yang cocok.'}</td></tr>
            ) : (
              shown.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{c.employee.fullName}</div>
                    <div className="text-xs text-slate-500">{c.employee.position.title} · {c.employee.outlet.name}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-slate-900">{c.module.code} · {c.module.title}</div>
                    <div className="text-xs text-slate-500">{CATEGORY_LABEL[c.module.category] ?? c.module.category}</div>
                  </td>
                  <td className="px-4 py-3 tabular-nums">{c.bestScore}</td>
                  <td className="whitespace-nowrap px-4 py-3">{longDate(c.passedAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <span className="mr-2 font-mono text-xs text-slate-500">{c.certificateNo}</span>
                    <button type="button" onClick={() => printCertificate(c)} className="btn btn-sm btn-secondary">
                      <Printer className="h-4 w-4" aria-hidden /> Cetak
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
