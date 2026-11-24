import { BadRequestException } from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { QuestionDto } from './training.dto';

/** Peran yang bukan kru lapangan: tidak dihitung sebagai peserta sasaran pelatihan. */
export const NON_CREW_ROLES: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.HR_ADMIN, UserRole.FINANCE_ADMIN];

/** Kru aktif yang menjadi sasaran (daftar jabatan kosong = semua jabatan), opsional dibatasi satu cabang. */
export function targetEmployeesWhere(positionIds: string[], outletId?: string): Prisma.EmployeeProfileWhereInput {
  return {
    user: { isActive: true, role: { notIn: NON_CREW_ROLES } },
    ...(positionIds.length > 0 && { positionId: { in: positionIds } }),
    ...(outletId && { outletId }),
  };
}

/** Apakah materi/kuis ini ditujukan untuk jabatan karyawan tersebut. */
export function isTargeted(positionIds: string[], positionId: string): boolean {
  return positionIds.length === 0 || positionIds.includes(positionId);
}

/** Validasi kunci jawaban dan bentuk baris soal untuk disimpan. */
export function questionRows(questions: QuestionDto[]) {
  return questions.map((q, i) => {
    const options = q.options.map((o) => o.trim());
    if (q.correctIndex >= options.length) {
      throw new BadRequestException(`Kunci jawaban soal ${i + 1} tidak ada di pilihannya`);
    }
    return { prompt: q.prompt, options, correctIndex: q.correctIndex, order: i };
  });
}

/** Nilai 0–100 dari jawaban kru; jumlah jawaban harus sama dengan jumlah soal. */
export function scoreAnswers(questions: { correctIndex: number }[], answers: number[]): number {
  if (questions.length === 0) throw new BadRequestException('Kuis ini belum punya soal');
  if (answers.length !== questions.length) throw new BadRequestException('Jawab semua soal sebelum mengirim');
  const correct = questions.filter((q, i) => answers[i] === q.correctIndex).length;
  return Math.round((correct / questions.length) * 100);
}

/** Soal untuk aplikasi kru: tanpa kunci jawaban. */
export function crewQuestions(questions: { id: string; prompt: string; options: string[]; order: number }[]) {
  return [...questions].sort((a, b) => a.order - b.order).map((q) => ({ id: q.id, prompt: q.prompt, options: q.options }));
}
