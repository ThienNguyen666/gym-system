const VN_OFFSET_MS = 7 * 3600 * 1000;

/** Ngày hiện tại theo giờ Việt Nam, dạng 'YYYY-MM-DD' (DB và server chạy UTC) */
export const todayVN = () => new Date(Date.now() + VN_OFFSET_MS).toISOString().slice(0, 10);

export function addDays(iso: string, n: number) {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}