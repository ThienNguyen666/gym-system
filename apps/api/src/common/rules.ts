/** Tham số nghiệp vụ mặc định. Sẽ đọc từ bảng Settings (FR-35) ở bước cấu hình. */
export const RULES = {
  cancelCutoffMinutes: 120, // BR4: hội viên hủy chậm nhất 2 giờ trước giờ học
  checkinOpenBeforeMin: 30, // BR6 (dùng ở bước check-in)
  checkinCloseAfterMin: 15, // BR6
} as const;

export const QR_PREFIX = 'GYM-BK:'; // nội dung mã QR = QR_PREFIX + bookingId