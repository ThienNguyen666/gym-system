import { ConflictException } from '@nestjs/common';

/** Lỗi nghiệp vụ: 409 kèm `type` để giao diện biết làm gì tiếp (ví dụ class_full -> đề xuất vào danh sách chờ) */
export const ruleError = (type: string, message: string) => new ConflictException({ message, type });