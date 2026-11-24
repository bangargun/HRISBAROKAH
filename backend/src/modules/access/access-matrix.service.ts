import { Injectable, OnModuleInit, RequestMethod } from '@nestjs/common';
import { DiscoveryService, MetadataScanner, Reflector } from '@nestjs/core';
import { GUARDS_METADATA, METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { UserRole } from '@prisma/client';
import { ROLES_KEY } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { DeviceAuthGuard } from '../kiosk/device-auth.guard';

/** Siapa yang boleh memanggil satu aksi: tablet cabang, publik, semua akun login, atau peran tertentu. */
export type AccessRule =
  | { kind: 'TABLET' }
  | { kind: 'PUBLIC' }
  | { kind: 'LOGGED_IN' }
  | { kind: 'ROLES'; roles: UserRole[] };

export interface AccessAction {
  method: string;
  path: string;
  write: boolean;
  rule: AccessRule;
}

export interface AccessModule {
  key: string;
  actions: AccessAction[];
}

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Matriks akses dibaca dari aturan yang benar-benar dipakai server
 * (@UseGuards dan @Roles di setiap controller), jadi tidak bisa berbeda dari kenyataan.
 * Super Admin selalu lolos RolesGuard, sehingga ikut di setiap aksi berperan.
 */
@Injectable()
export class AccessMatrixService implements OnModuleInit {
  private modules: AccessModule[] = [];

  constructor(
    private readonly discovery: DiscoveryService,
    private readonly scanner: MetadataScanner,
    private readonly reflector: Reflector,
  ) {}

  onModuleInit() {
    const byKey = new Map<string, AccessAction[]>();
    for (const wrapper of this.discovery.getControllers()) {
      const { instance, metatype } = wrapper;
      if (!instance || !metatype) continue;
      const base = paths(this.reflector.get<string | string[]>(PATH_METADATA, metatype))[0];
      const classGuards: unknown[] = this.reflector.get(GUARDS_METADATA, metatype) ?? [];
      const proto = Object.getPrototypeOf(instance);
      const actions = byKey.get(base) ?? [];
      for (const name of this.scanner.getAllMethodNames(proto)) {
        const handler = proto[name];
        const methodCode = this.reflector.get<RequestMethod>(METHOD_METADATA, handler);
        if (methodCode === undefined) continue;
        const method = RequestMethod[methodCode];
        const guards = [...classGuards, ...(this.reflector.get<unknown[]>(GUARDS_METADATA, handler) ?? [])];
        const roles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [handler, metatype]);
        // Satu handler bisa melayani beberapa path (@Post(['a', 'b']))
        for (const sub of paths(this.reflector.get<string | string[]>(PATH_METADATA, handler))) {
          actions.push({
            method,
            path: '/' + [base, sub].filter(Boolean).join('/'),
            write: WRITE_METHODS.has(method),
            rule: ruleFor(guards, roles),
          });
        }
      }
      byKey.set(base, actions);
    }
    this.modules = [...byKey.entries()]
      .map(([key, actions]) => ({ key, actions: actions.sort((a, b) => a.path.localeCompare(b.path)) }))
      .sort((a, b) => a.key.localeCompare(b.key));
  }

  matrix() {
    return { roles: Object.values(UserRole), modules: this.modules };
  }
}

function ruleFor(guards: unknown[], roles: UserRole[] | undefined): AccessRule {
  if (guards.includes(DeviceAuthGuard)) return { kind: 'TABLET' };
  if (!guards.includes(JwtAuthGuard)) return { kind: 'PUBLIC' };
  // @Roles tanpa RolesGuard tidak ditegakkan: tampilkan apa adanya, yaitu semua akun login
  if (!guards.includes(RolesGuard) || !roles || roles.length === 0) return { kind: 'LOGGED_IN' };
  return { kind: 'ROLES', roles: [...new Set([UserRole.SUPER_ADMIN, ...roles])] };
}

/** Path metadata Nest bisa berupa string atau daftar string; hasilnya tanpa garis miring di tepi. */
function paths(meta: string | string[] | undefined): string[] {
  const list = Array.isArray(meta) ? meta : [meta ?? ''];
  return list.map((p) => p.replace(/^\/+|\/+$/g, ''));
}
