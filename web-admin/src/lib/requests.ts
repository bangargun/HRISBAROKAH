import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from './api';

export type RequestType = 'KASBON' | 'CUTI_TAHUNAN' | 'CUTI_KHUSUS' | 'IZIN' | 'SAKIT' | 'LEMBUR' | 'TUKAR_SHIFT';
export type RequestStatus =
  | 'PENDING_STORE_MANAGER'
  | 'PENDING_HR'
  | 'APPROVED'
  | 'REJECTED'
  | 'DISBURSED'
  | 'CANCELLED';

/** Bentuk data dari GET /requests/admin */
export interface AdminRequest {
  id: string;
  type: RequestType;
  status: RequestStatus;
  startDate: string | null;
  endDate: string | null;
  totalDays: number | null;
  reason: string;
  attachmentUrl: string | null;
  managerNotes: string | null;
  approvedAtSm: string | null;
  hrNotes: string | null;
  approvedAtHr: string | null;
  createdAt: string;
  employee: {
    id: string;
    nik: string;
    fullName: string;
    leaveBalance: number;
    outlet: { id: string; name: string };
    position: { title: string };
  };
  kasbonLoan: {
    amount: string;
    tenorMonths: number;
    monthlyDeduction: string;
    disbursedAt: string | null;
  } | null;
}

export const REQUEST_TYPE_LABEL: Record<RequestType, string> = {
  KASBON: 'Kasbon',
  CUTI_TAHUNAN: 'Cuti Tahunan',
  CUTI_KHUSUS: 'Cuti Khusus',
  IZIN: 'Izin',
  SAKIT: 'Sakit',
  LEMBUR: 'Lembur',
  TUKAR_SHIFT: 'Tukar Shift',
};

export const REQUEST_STATUS_LABEL: Record<RequestStatus, string> = {
  PENDING_STORE_MANAGER: 'Menunggu Kepala Cabang',
  PENDING_HR: 'Menunggu HR',
  APPROVED: 'Disetujui',
  REJECTED: 'Ditolak',
  DISBURSED: 'Sudah Dicairkan',
  CANCELLED: 'Dibatalkan',
};

export const LEAVE_TYPES: RequestType[] = ['CUTI_TAHUNAN', 'CUTI_KHUSUS', 'IZIN', 'SAKIT', 'LEMBUR', 'TUKAR_SHIFT'];

// Peran yang boleh memproses tiap tahap; sama dengan @Roles di requests.controller.ts
const SM_REVIEWERS = ['SUPER_ADMIN', 'STORE_MANAGER', 'AREA_MANAGER'];
const HR_REVIEWERS = ['SUPER_ADMIN', 'HR_ADMIN', 'FINANCE_ADMIN'];
const DISBURSERS = ['SUPER_ADMIN', 'FINANCE_ADMIN'];

export type RequestAction = 'sm-review' | 'hr-review' | 'disburse';

/** Tindakan yang tersedia untuk peran ini pada pengajuan tersebut, atau null jika tidak ada. */
export function actionFor(req: AdminRequest, role: string | undefined): RequestAction | null {
  if (!role) return null;
  if (req.status === 'PENDING_STORE_MANAGER' && SM_REVIEWERS.includes(role)) return 'sm-review';
  if (req.status === 'PENDING_HR' && HR_REVIEWERS.includes(role)) return 'hr-review';
  if (req.status === 'APPROVED' && req.type === 'KASBON' && DISBURSERS.includes(role)) return 'disburse';
  return null;
}

export function isPending(status: RequestStatus) {
  return status === 'PENDING_STORE_MANAGER' || status === 'PENDING_HR';
}

export interface AdminRequestsStore {
  requests: AdminRequest[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  review: (id: string, stage: 'sm-review' | 'hr-review', action: 'APPROVE' | 'REJECT', notes?: string) => Promise<void>;
  disburse: (id: string) => Promise<void>;
}

/** Satu sumber data pengajuan untuk seluruh halaman admin. */
export function useAdminRequests(): AdminRequestsStore {
  const [requests, setRequests] = useState<AdminRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setRequests(await apiFetch<AdminRequest[]>('/requests/admin'));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const review = useCallback(
    async (id: string, stage: 'sm-review' | 'hr-review', action: 'APPROVE' | 'REJECT', notes?: string) => {
      const path = stage === 'sm-review' ? 'store-manager-review' : 'hr-review';
      try {
        await apiFetch(`/requests/${id}/${path}`, {
          method: 'PATCH',
          body: JSON.stringify({ action, ...(notes ? { notes } : {}) }),
        });
      } finally {
        // Selalu muat ulang: jika admin lain sudah memproses, daftar ikut terbarui
        await reload();
      }
    },
    [reload],
  );

  const disburse = useCallback(
    async (id: string) => {
      try {
        await apiFetch(`/requests/${id}/disburse-kasbon`, { method: 'PATCH' });
      } finally {
        await reload();
      }
    },
    [reload],
  );

  return { requests, loading, error, reload, review, disburse };
}
