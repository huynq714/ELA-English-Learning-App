# Báo cáo sửa lỗi và hồi quy

BUG-W5-001: trước sửa preflight login 401, thiếu allow-origin (evidence/new-machine/web-startup.json). Backend thiếu xử lý CORS trước xác thực. Đã cấu hình qua ela.web.allowed-origins/ELA_WEB_ALLOWED_ORIGINS, mặc định rỗng; origin chính xác, không wildcard, allowCredentials=false. Script local khai báo localhost:58126, 127.0.0.1:58126 và 127.0.0.1:58127. Môi trường khác phải khai báo allowlist riêng.

Sau sửa: preflight origin cho phép 200/allow-origin đúng; origin lạ và tên miền giả mạo 403; API protected thiếu JWT vẫn 401; POST khác origin trong browser nhận được 401 từ API thay vì CORS error. Chi tiết evidence/representative/cors-after.json. Lỗi ứng dụng FIXED, không mở CORS tất cả origin.

Maven package cuối 95/95, 0 failure/error/skip, gồm 19 bài tích hợp; lint và typecheck đạt. Web Quiz/Flashcard smoke exit 0: sinh/chấm Quiz, retry mất phản hồi, ôn lại sau FAIL và 401 đóng màn bảo vệ. Log tại evidence/representative/. Không chạy lại các suite không liên quan PG18/Gmail/native.

Build đầu bị khóa JAR do backend đang chạy; dừng đúng backend test và build lại thành công. Không tác động service PostgreSQL5432. Lỗi ENV-W5-001 vẫn BLOCKED; ENV-W5-002 đã giảm ảnh hưởng bằng limits/TEMP trên D. Không cài phần mềm, không sửa kiến trúc/UI. Native regression chưa chạy.
