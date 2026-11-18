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
    const opener = document.activeElement as HTMLElement | null;
    ref.current
      ?.querySelector<HTMLElement>('textarea, input:not([disabled]), select:not([disabled]), button')
      ?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeRef.current();
        return;
      }
      // Tab berputar di dalam dialog, tidak lari ke halaman di belakangnya
      if (e.key !== 'Tab' || !ref.current) return;
      const items = Array.prototype.slice.call(
        ref.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ) as HTMLElement[];
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      opener?.focus?.();
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4" onClick={onClose}>
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
