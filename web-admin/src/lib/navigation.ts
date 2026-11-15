import {
  BadgeCheck,
  Briefcase,
  ClipboardCheck,
  Clock,
  FileCheck2,
  FileText,
  GraduationCap,
  LayoutGrid,
  MapPin,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Smartphone,
  TrendingUp,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  /** Id menu di halaman utama (activeMenu), atau penanda untuk halaman terpisah. */
  id: string;
  label: string;
  icon: LucideIcon;
  /** Diisi bila menu ini halaman tersendiri, bukan bagian dari halaman utama. */
  href?: string;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

/** Satu-satunya daftar menu samping, dipakai semua halaman admin. */
export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Utama',
    items: [
      { id: 'hub', label: 'Dasbor', icon: LayoutGrid },
      { id: 'requests', label: 'Persetujuan', icon: ClipboardCheck },
    ],
  },
  {
    label: 'Karyawan',
    items: [
      { id: 'employees', label: 'Data Karyawan', icon: Users },
      { id: 'outlets', label: 'Cabang', icon: MapPin },
      { id: 'legal-docs', label: 'Surat & Kontrak', icon: FileText },
    ],
  },
  {
    label: 'Operasional',
    items: [
      { id: 'attendance', label: 'Presensi & Shift', icon: Clock },
      { id: 'sanctions', label: 'Kedisiplinan & SP', icon: ShieldAlert },
      { id: 'sops', label: 'SOP', icon: FileCheck2 },
      { id: 'payroll', label: 'Penggajian', icon: Wallet },
    ],
  },
  {
    label: 'Pengembangan',
    items: [
      { id: 'performance', label: 'Penilaian Kinerja', icon: TrendingUp },
      { id: 'development', label: 'Pelatihan', icon: GraduationCap },
      { id: 'career', label: 'Jenjang Karier', icon: Briefcase },
      { id: 'coaching', label: 'Pendampingan', icon: BadgeCheck },
    ],
  },
  {
    label: 'Pengaturan',
    items: [
      { id: 'kru-portal', label: 'Aplikasi Kru', icon: Smartphone },
      { id: 'master-data', label: 'Master Data', icon: SlidersHorizontal, href: '/master-data' },
      { id: 'permissions', label: 'Hak Akses', icon: ShieldCheck },
    ],
  },
];

export const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  HR_ADMIN: 'Admin HR',
  FINANCE_ADMIN: 'Admin Keuangan',
  AREA_MANAGER: 'Area Manager',
  STORE_MANAGER: 'Kepala Cabang',
};
