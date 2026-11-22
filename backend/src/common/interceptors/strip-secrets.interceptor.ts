import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, map } from 'rxjs';

/**
 * Jaring pengaman: hash PIN absen tidak pernah boleh keluar ke klien, lewat endpoint mana pun
 * (banyak query mengembalikan seluruh baris EmployeeProfile). Hash diganti penanda
 * `hasAttendancePin` supaya admin tetap tahu kru sudah punya PIN atau belum.
 */
function scrub(value: unknown): unknown {
  if (Array.isArray(value)) {
    value.forEach(scrub);
  } else if (value && typeof value === 'object') {
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) return value; // Date, Decimal, Buffer, dll.
    const obj = value as Record<string, unknown>;
    if ('attendancePinHash' in obj) {
      obj.hasAttendancePin = !!obj.attendancePinHash;
      delete obj.attendancePinHash;
    }
    Object.values(obj).forEach(scrub);
  }
  return value;
}

@Injectable()
export class StripSecretsInterceptor implements NestInterceptor {
  intercept(_ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(map(scrub));
  }
}
