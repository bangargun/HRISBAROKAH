// Kelas bersama layar tablet absen (latar ink, satu aksen emas). Target sentuh minimal 56 px.
export const btnBig = 'btn min-h-14 px-6 text-lg font-semibold sm:min-h-14';
export const btnPrimary = `${btnBig} btn-primary`;
export const btnSecondary = `${btnBig} border border-ink-600 bg-ink-800 text-slate-100 hover:bg-ink-700 active:bg-ink-900`;
export const btnQuiet = `${btnBig} text-slate-300 hover:bg-ink-800 hover:text-white active:bg-ink-900`;
export const panel = 'rounded-lg border border-ink-700 bg-ink-800';

const TZ = 'Asia/Jakarta';
// Jam "08:57" (spec §4); id-ID akan memakai titik
export const timeFmt = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
export const dateFmt = new Intl.DateTimeFormat('id-ID', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

export const hhmm = (d: Date) => timeFmt.format(d);
