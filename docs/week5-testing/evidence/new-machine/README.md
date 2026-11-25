# Minh chứng máy mới — 25/11/2026

Timezone Asia/Saigon; source cf018aa, nhánh feat/week5-testing. Chỉ gồm dữ liệu thực thi mới. Minh chứng máy cũ ở thư mục cha được giữ riêng.

- `environment-audit.json`: Git, công cụ, dịch vụ, cổng, dung lượng đĩa tại thời điểm kiểm tra.
- `database-setup.log`, `database-final.log`: định danh DB test, seed90/90, V1_7 và collation còn thiếu trên PG17.
- `junit-summary.json`: 94 testcases với kết quả từng bài, 18 bài tích hợp PG thật; không chứa properties/stdout Surefire thô.
- `maven-test.log`: phần INFO của lượt Maven cuối, exit0.
- `suite-Auth-retry.log`, `suite-PasswordReset.log`: các suite API đã hoàn tất.
- `suite-Quiz.log`: API/SQL và restart hoàn tất, phần Web của lượt đầu lỗi môi trường; toàn lệnh exit1. Kết quả Web chạy lại ở `quiz-web-final.log`, exit0.
- `suite-MyVocabulary-retry.log`, `postgres17-collation-error.log`, `saved-web-final.log`: lỗi/blocker thực tế, không tính PASS.
- `additional-api.json`: 84 kiểm tra bổ sung, gồm các boundary và ownership không được bộ script cũ bao phủ đủ. `additional-api.log` là bản terminal tương ứng.
- `database-tests.log` và ba `test_*commit.sql.log`: bài SQL hợp lệ và lỗi COMMIT dự kiến; SQL âm đạt khi đúng thông báo, exit3 và rollback.
- `quiz-web-final.log`: Playwright với backend/DB thật, có fault injection mạng/audio ở các bước cụ thể.
- `review-web-final.log`: Playwright dùng API giả lập; JUnit PostgreSQL cung cấp bằng chứng persistence thật riêng.
- `web-startup.json`, `web-startup-evidence.log`, `web-login.png`, `web-home.png`: Login → Home thật, preflight CORS401; phần savedVocabulary ghi BLOCKED500.
- `saved-vocabulary-postgres17.png`: thông báo tải lỗi thật trên PG17. Các ảnh `flashcard-*-web.png` từ bài Web Quiz đã chạy đạt.
- `flashcard-sources-web.png` được script cũ chụp trong hiệu ứng fade. Đã chụp lại dialog sau 1500ms ở `flashcard-sources-stable-web.png`; `source-dialog-observation.json` ghi opacity1 và nền trắng. Ảnh ổn định đọc được nguồn, không kết luận lỗi giao diện từ ảnh đang chuyển cảnh. Script bổ sung nằm local tại `.artifacts/week5-environment/capture-source.cjs`.
- `case-results.json`: kết quả review coverage của 34 ca Automated, đối chiếu TEST_CASES.csv. PARTIAL không phải PASS; native chưa chạy.
- `exit-codes.json`: các exit code đã được lưu trong phiên, gồm cả lượt lỗi và bị dừng; cần đọc kèm báo cáo, không chọn bỏ lượt lỗi.
- `lint-final.log`, `typecheck-final.log`, `import-builder-final.log`: lint/typecheck exit0 và 5 bài import builder đạt.

Log đầy đủ, cluster/fixtures, build output và credentials DPAPI nằm ở `.artifacts/`, bị Git ignore. Một số log được chuyển encoding về UTF8, loại ANSI, thay đường dẫn workspace bằng `<project-root>` và che JWT/BCrypt. Không có token đăng nhập, OTP hoặc mật khẩu được đưa vào thư mục này.

[Báo cáo thực thi](../../TEST_EXECUTION_REPORT.md) · [Ghi nhận lỗi](../../BUG_REPORT.md) · [Tiến độ](../../PROGRESS.md)
