'use client';

import React from 'react';
import { getSessionUser } from '@/lib/auth';
import ModulesTab from './ModulesTab';
import QuizzesTab from './QuizzesTab';
import CertificatesTab from './CertificatesTab';
import SessionsTab from './SessionsTab';
import { useMasterData } from './shared';

export type TrainingTab = 'training-lms' | 'weekly-quizzes' | 'certification-tracker' | 'training-schedules';

/** Menu Pelatihan: materi + kuis modul, kuis mingguan, sertifikasi, jadwal sesi. Data dari server. */
export default function TrainingModule({ tab }: { tab: TrainingTab }) {
  const role = getSessionUser()?.role;
  const canManage = role === 'SUPER_ADMIN' || role === 'HR_ADMIN';
  const { departments, outlets } = useMasterData();
  if (tab === 'weekly-quizzes') return <QuizzesTab canManage={canManage} departments={departments} />;
  if (tab === 'certification-tracker') return <CertificatesTab outlets={outlets} />;
  if (tab === 'training-schedules') return <SessionsTab canManage={canManage} outlets={outlets} />;
  return <ModulesTab canManage={canManage} departments={departments} />;
}
