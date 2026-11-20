# Nguồn học liệu và phát âm

Trong **Từ vựng** và trên từng Flashcard, bấm **ⓘ** ở góc trên bên phải để mở hộp thoại **Nguồn học liệu**. Chi tiết từng thẻ chỉ ghi nguồn cho các trường có dẫn chứng trong `sourceMetadata`.

- Danh mục và cấp độ A1/A2 lấy từ **CEFR-J Wordlist v1.6**, do Yukio Tono ở Tokyo University of Foreign Studies biên soạn. Nhãn chủ đề tự chọn của ứng dụng vẫn được lưu riêng. [CEFR-J Wordlist](https://cefr-j.org/download_eng)
- Nguồn định nghĩa tiếng Anh và phiên âm IPA hiển thị theo từng trường. Hai nguồn của các mục nhập là Free Dictionary API và Wiktionary tiếng Anh. [Free Dictionary API](https://dictionaryapi.dev/) · [Wiktionary tiếng Anh](https://en.wiktionary.org/)
- Nghĩa tiếng Việt được ghi công theo mục từ đã dùng để đối chiếu. Phần lớn đến từ Wiktionary tiếng Việt. Một số nghĩa đến từ bảng dịch ở Wiktionary tiếng Anh. [Wiktionary tiếng Việt](https://vi.wiktionary.org/)
- Bản ghi lấy từ `phonetics[].audio` của Free Dictionary API theo từ, từ loại và phiên âm. Với các bản ghi có dẫn chứng Wikimedia Commons, ứng dụng dùng bản MP3 tương thích iOS của chính bản ghi đó. Nguồn, tác giả, giấy phép, giọng nếu xác định được và URL gốc của API được lưu riêng khỏi nguồn IPA. [Định dạng audio iOS](https://developer.apple.com/library/archive/documentation/MusicAudio/Conceptual/CoreAudioOverview/CoreAudioEssentials/CoreAudioEssentials.html) · [Wikimedia TimedMediaHandler](https://www.mediawiki.org/wiki/Extension:TimedMediaHandler/API)

## Cập nhật dữ liệu đang có

Mở [apply_pronunciations.sql](../../database/week4/import/data/apply_pronunciations.sql) bằng Query Tool của database `english_learning_db` trong pgAdmin rồi chạy. Script dùng `import_key` và từ để tìm hàng hiện có, thêm provenance IPA khi khớp nguồn cũ và chỉ ghi audio vào hàng còn thiếu. Chạy lại được. Docker tự chạy script này khi tạo volume mới. Với volume hiện có, dùng Query Tool kết nối cổng PostgreSQL của Docker.

Để tái tạo SQL với dữ liệu mới từ các trang công khai, chạy tại thư mục gốc:

```powershell
python database/week4/import/enrich_pronunciations.py --cache-dir .artifacts/pronunciations-cache
```

Ứng dụng phát URL đã lưu trực tiếp bằng Expo Audio. Với từ chưa có bản ghi và với câu ví dụ, nút loa dùng giọng máy (TTS). Bạn có thể xem loại giọng và thông tin bản ghi trong hộp thoại **Nguồn học liệu**. Nếu tải bản ghi bị lỗi, thẻ hiển thị lỗi và cho phép thử lại.

Lần rà soát ngày 20/11/2026 xác minh được 4/115 mục có bản MP3 hợp lệ gồm `add`, `angry`, `animal` và `athlete`. Trong 90 mục của sáu bộ theo chủ đề, có 2 bản ghi gồm `angry` và `athlete`. Các mục còn lại thiếu bản ghi khớp, thiếu dẫn chứng về giấy phép, hoặc máy kiểm tra chưa tải được tệp từ máy chủ nguồn. Những mục này tiếp tục dùng **Giọng máy**.

## Kiểm tra trên iPhone

Kết nối iPhone và laptop cùng Wi-Fi. Xác nhận Safari mở được `http://IP-LAPTOP:8080/api/v1/health`, rồi mở Expo Go với URL API dùng cùng địa chỉ IP. Trong bộ **Giao tiếp và cảm xúc**, mở thẻ **angry**. Bấm **ⓘ** để xem bản ghi `en-US`, đóng hộp thoại rồi bấm loa của từ. Thử nhấn loa liên tục rồi đổi thẻ hoặc rời màn Flashcards.
