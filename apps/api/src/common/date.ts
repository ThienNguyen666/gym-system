const VN_OFFSET_MS = 7 * 3600 * 1000;

/** Ngày hiện tại theo giờ Việt Nam, dạng 'YYYY-MM-DD' (DB và server chạy UTC) */
export const todayVN = () => new Date(Date.now() + VN_OFFSET_MS).toISOString().slice(0, 10);

export function addDays(iso: string, n: number) {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Đổi một thời điểm (UTC) sang ngày, thứ, giờ treo tường theo giờ Việt Nam */
export function toVN(d: Date) {
  const v = new Date(d.getTime() + VN_OFFSET_MS);
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    date: v.toISOString().slice(0, 10),
    dow: v.getUTCDay(), // 0 = Chủ nhật ... 6 = Thứ bảy
    time: `${pad(v.getUTCHours())}:${pad(v.getUTCMinutes())}:00`,
  };
}