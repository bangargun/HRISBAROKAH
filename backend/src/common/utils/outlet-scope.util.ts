import { ForbiddenException } from '@nestjs/common';
import { User, UserRole } from '@prisma/client';

/** User hasil JwtStrategy.validate (beserta profil karyawannya, bila ada). */
export type AuthUser = User & { profile?: { outletId: string } | null };

function ownOutletId(actor: AuthUser): string {
  const outletId = actor.profile?.outletId;
  if (!outletId) {
    throw new ForbiddenException('Akun Store Manager belum terhubung ke outlet');
  }
  return outletId;
}

/**
 * Outlet yang boleh dibaca: Store Manager selalu dikunci ke outletnya sendiri,
 * peran lain memakai filter yang diminta (atau semua outlet).
 */
export function scopedOutletId(actor: AuthUser, requested?: string): string | undefined {
  return actor.role === UserRole.STORE_MANAGER ? ownOutletId(actor) : requested;
}

/** Menolak Store Manager yang mengakses data milik outlet lain. */
export function assertOutletAccess(actor: AuthUser, outletId: string, message: string) {
  if (actor.role === UserRole.STORE_MANAGER && ownOutletId(actor) !== outletId) {
    throw new ForbiddenException(message);
  }
}
