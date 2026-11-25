# Báo cáo tuần 5 — Kiểm thử và sửa lỗi ELA

Ngày 25/11/2026, nhánh feat/week 5-testing. Phạm vi vừa đủ báo cáo môn học, dùng môi trường test riêng.

## 1. Lập kế hoạch kiểm thử
Đã hoàn thành TEST_PLAN.md: phạm vi chức năng, môi trường, ưu tiên và phương pháp kiểm thử. Không phân tích/lập lại kế hoạch trong lượt cuối.

## 2. Viết Test Case
TEST_CASES.csv có 63 ca,15 cột,34 dự kiến tự động và 29 thủ công. Giữ nguyên thiết kế, cập nhật thực tế theo bằng chứng.

## 3. Thực hiện kiểm thử
Kết quả: **26 PASS, 0 FAIL, 14 PARTIAL, 2 BLOCKED, 21 NOT RUN**. 3B đã chạy API/SQL, JUnit và Web. 3C chọn 9 ca chưa hoàn tất để kiểm Web login/mạng/phục hồi/Home/Flashcard/điều hướng/Profile ba viewport 320×568,390×844,430×932; hồi quy thêm Quiz. Các ca có yêu cầu native hoặc còn biến thể giữ PARTIAL. Hai ca My Vocabulary bị PG17 chặn. Chưa kiểm trên điện thoại hoặc AVD; MANUAL_TEST_GUIDE.md hướng dẫn người dùng thực hiện. Không coi Web viewport là native.

## 4. Ghi nhận lỗi
BUG_REPORT.csv/.md tổng hợp 1 lỗi ứng dụng CORS,2 vấn đề môi trường và 2 vấn đề script. Không tạo lỗi cho đủ số lượng. Minh chứng trước sửa được giữ nguyên, dữ liệu nhạy cảm không đưa vào Git.

## 5. Sửa lỗi và kiểm thử lại
Đã sửa 1 lỗi ứng dụng CORS bằng origin allowlist cấu hình rõ ràng; mặc định đóng, không wildcard. Kiểm lại origin cho phép 200, origin lạ 403, thiếu JWT401 và browser khác origin truy cập được phản hồi. Maven 95/95 (19 tích hợp), lint/typecheck và Web Quiz regression đạt. Script Python đã sửa từ 3B được ghi riêng, không cộng thành lỗi ứng dụng sửa mới. Xem REGRESSION_REPORT.md.

Giới hạn: chưa có kết quả native/Gmail thật, các PARTIAL và BLOCKED còn lại không được nghiệm thu. Không nâng PostgreSQL hoặc thêm framework. Báo cáo hoàn tất trong phạm vi đã thống nhất, không khẳng định toàn bộ sản phẩm hết lỗi.
