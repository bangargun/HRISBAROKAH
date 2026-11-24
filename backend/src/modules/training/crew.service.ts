import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, TrainingSessionStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { businessDateString, toDateOnly } from '../../common/utils/business-date.util';
import { SubmitAnswersDto } from './training.dto';
import { crewQuestions, isTargeted, scoreAnswers } from './training.shared';

const ymd = (d: Date) => d.toISOString().slice(0, 10);

/** Pelatihan dari sisi kru (aplikasi HP): hanya milik sendiri, kunci jawaban tidak pernah dikirim. */
@Injectable()
export class TrainingCrewService {
  constructor(private prisma: PrismaService) {}

  async modules(userId: string) {
    const me = await this.me(userId);
    const modules = await this.prisma.trainingModule.findMany({
      where: { isPublished: true },
      include: { _count: { select: { questions: true } }, results: { where: { employeeId: me.id } } },
      orderBy: [{ isOnboarding: 'desc' }, { createdAt: 'desc' }],
    });
    return modules
      .filter((m) => isTargeted(m.targetPositionIds, me.positionId) || m.results.length > 0)
      .map((m) => ({
        id: m.id,
        code: m.code,
        title: m.title,
        category: m.category,
        description: m.description,
        isOnboarding: m.isOnboarding,
        passingScore: m.passingScore,
        questionCount: m._count.questions,
        result: this.result(m.results[0]),
      }));
  }

  /** Isi modul; soal hanya dikirim selama belum lulus. */
  async module(userId: string, id: string) {
    const me = await this.me(userId);
    const m = await this.prisma.trainingModule.findUnique({
      where: { id },
      include: { questions: true, results: { where: { employeeId: me.id } } },
    });
    if (!m || !m.isPublished || !(isTargeted(m.targetPositionIds, me.positionId) || m.results.length > 0)) {
      throw new NotFoundException('Modul tidak ditemukan');
    }
    const result = this.result(m.results[0]);
    return {
      id: m.id,
      code: m.code,
      title: m.title,
      category: m.category,
      description: m.description,
      content: m.content,
      videoUrl: m.videoUrl,
      passingScore: m.passingScore,
      result,
      questions: result?.passed ? [] : crewQuestions(m.questions),
    };
  }

  /** Kirim jawaban kuis modul; boleh diulang sampai lulus. Lulus pertama kali memberi nomor sertifikat. */
  async submitModule(userId: string, id: string, dto: SubmitAnswersDto) {
    const me = await this.me(userId);
    const m = await this.prisma.trainingModule.findUnique({ where: { id }, include: { questions: { orderBy: { order: 'asc' } } } });
    if (!m || !m.isPublished || !isTargeted(m.targetPositionIds, me.positionId)) throw new NotFoundException('Modul tidak ditemukan');
    const score = scoreAnswers(m.questions, dto.answers);
    const passed = score >= m.passingScore;

    for (let attempt = 1; ; attempt++) {
      try {
        return await this.prisma.$transaction(async (tx) => {
          const existing = await tx.trainingResult.findUnique({ where: { moduleId_employeeId: { moduleId: id, employeeId: me.id } } });
          if (existing?.passedAt) throw new BadRequestException('Modul ini sudah lulus');
          let certificateNo: string | null = null;
          if (passed) {
            const seq = (await tx.trainingResult.count({ where: { moduleId: id, passedAt: { not: null } } })) + 1;
            certificateNo = `${m.code}-${String(seq).padStart(4, '0')}`;
          }
          const data = {
            attempts: (existing?.attempts ?? 0) + 1,
            bestScore: Math.max(existing?.bestScore ?? 0, score),
            lastScore: score,
            ...(passed && { passedAt: new Date(), certificateNo }),
          };
          const saved = existing
            ? // Klaim bersyarat: dua kiriman bersamaan tidak sama-sama menjadi "lulus pertama"
              await tx.trainingResult.update({ where: { id: existing.id, passedAt: null }, data })
            : await tx.trainingResult.create({ data: { moduleId: id, employeeId: me.id, ...data } });
          return { score, passed, passingScore: m.passingScore, result: this.result(saved) };
        });
      } catch (e) {
        // Nomor sertifikat bentrok dengan kru lain yang lulus bersamaan: ulangi dengan urutan baru
        if (attempt < 3 && e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') continue;
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') throw new ConflictException('Modul ini sudah lulus');
        throw e;
      }
    }
  }

  async quizzes(userId: string) {
    const me = await this.me(userId);
    const today = businessDateString();
    const quizzes = await this.prisma.weeklyQuiz.findMany({
      where: { isPublished: true },
      include: { _count: { select: { questions: true } }, attempts: { where: { employeeId: me.id } } },
      orderBy: { deadline: 'desc' },
      take: 50,
    });
    return quizzes
      .filter((q) => (isTargeted(q.targetPositionIds, me.positionId) && ymd(q.deadline) >= today) || q.attempts.length > 0)
      .map((q) => ({
        id: q.id,
        title: q.title,
        deadline: ymd(q.deadline),
        passingScore: q.passingScore,
        questionCount: q._count.questions,
        open: ymd(q.deadline) >= today && q.attempts.length === 0,
        attempt: q.attempts[0] ? { score: q.attempts[0].score, passed: q.attempts[0].passed, submittedAt: q.attempts[0].submittedAt } : null,
      }));
  }

  async quiz(userId: string, id: string) {
    const { q } = await this.openQuiz(userId, id);
    return { id: q.id, title: q.title, deadline: ymd(q.deadline), passingScore: q.passingScore, questions: crewQuestions(q.questions) };
  }

  /** Kuis mingguan hanya sekali, sampai akhir hari tenggat. */
  async submitQuiz(userId: string, id: string, dto: SubmitAnswersDto) {
    const { me, q } = await this.openQuiz(userId, id);
    const questions = [...q.questions].sort((a, b) => a.order - b.order);
    const score = scoreAnswers(questions, dto.answers);
    const passed = score >= q.passingScore;
    try {
      await this.prisma.weeklyQuizAttempt.create({ data: { quizId: id, employeeId: me.id, answers: dto.answers, score, passed } });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw new ConflictException('Kuis ini sudah dikerjakan');
      throw e;
    }
    return { score, passed, passingScore: q.passingScore };
  }

  /** Sesi pelatihan yang diikuti: 30 hari terakhir dan yang akan datang. */
  async sessions(userId: string) {
    const me = await this.me(userId);
    const from = new Date(toDateOnly(businessDateString()).getTime() - 30 * 86400_000);
    const rows = await this.prisma.trainingSessionParticipant.findMany({
      where: { employeeId: me.id, session: { date: { gte: from }, status: { not: TrainingSessionStatus.CANCELLED } } },
      include: { session: { include: { module: { select: { title: true } } } } },
      orderBy: { session: { date: 'asc' } },
    });
    return rows.map(({ session: s, attended }) => ({
      id: s.id,
      title: s.title,
      moduleTitle: s.module?.title ?? null,
      date: ymd(s.date),
      startTime: s.startTime,
      endTime: s.endTime,
      mode: s.mode,
      location: s.location,
      meetingUrl: s.meetingUrl,
      trainerName: s.trainerName,
      status: s.status,
      attended,
    }));
  }

  private async openQuiz(userId: string, id: string) {
    const me = await this.me(userId);
    const q = await this.prisma.weeklyQuiz.findUnique({ where: { id }, include: { questions: true, attempts: { where: { employeeId: me.id } } } });
    if (!q || !q.isPublished || !isTargeted(q.targetPositionIds, me.positionId)) throw new NotFoundException('Kuis tidak ditemukan');
    if (q.attempts.length > 0) throw new ConflictException('Kuis ini sudah dikerjakan');
    if (ymd(q.deadline) < businessDateString()) throw new BadRequestException('Tenggat kuis sudah lewat');
    return { me, q };
  }

  private async me(userId: string) {
    const me = await this.prisma.employeeProfile.findUnique({ where: { userId }, select: { id: true, positionId: true } });
    if (!me) throw new NotFoundException('Profil karyawan tidak ditemukan');
    return me;
  }

  private result(r?: { attempts: number; bestScore: number; lastScore: number; passedAt: Date | null; certificateNo: string | null } | null) {
    if (!r) return null;
    return { attempts: r.attempts, bestScore: r.bestScore, lastScore: r.lastScore, passed: !!r.passedAt, passedAt: r.passedAt, certificateNo: r.certificateNo };
  }
}
