'use client';

import React, { useEffect, useRef } from 'react';

/**
 * Dialog modal standar: judul berlabel, Escape dan klik latar menutup,
 * fokus ke kontrol pertama saat dibuka (tidak berpindah saat mengetik).
 */
export default function Dialog({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  /** Form panjang (mis. data cabang) memakai dialog lebih lebar */
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    ref.current
      ?.querySelector<HTMLElement>('textarea, input:not([disabled]), select:not([disabled]), button')
      ?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeRef.current();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" onClick={onClose}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className={`max-h-[90vh] w-full ${wide ? 'max-w-2xl' : 'max-w-md'} space-y-3 overflow-y-auto rounded-lg bg-white p-5 text-sm shadow-xl`}
      >
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        {children}
      </div>
    </div>
  );
}
