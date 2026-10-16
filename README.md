# Bản 2.4.3 — 16/10/2026

- Bật hỗ trợ tự điền, chọn phím F6–F10 và một trong hai cách: **bấm một lần để điền cả câu** hoặc **giữ để nhập từng ký tự** (120 ms/ký tự). Nhả phím để dừng chế độ giữ.
- Giữ nguyên cách bấm một lần của bản cũ; đây cũng là lựa chọn mặc định khi khôi phục cấu hình cũ. Lựa chọn mới được lưu trên thiết bị và áp dụng vào file xuất.
- Tự chuyển sang ô câu tiếp theo nếu bài gốc chuyển ô sau khi nhập đúng. Dừng khi rời cửa sổ, ẩn tab, bắt đầu nhập bằng IME, hoặc nội dung đã gõ không khớp đầu câu.
- Đây là tự điền ký tự qua sự kiện `input`, không phải tín hiệu bàn phím phần cứng hay quá trình ghép jamo của bộ gõ Hàn.

# Bản 2.4.2 — 16/10/2026

- Bỏ thông báo chế độ tự chèn ở đầu file HTML xuất và trong màn hình hoàn thành.
- Khi xuất lại file tương thích từ bản cũ, xóa hai thông báo do ứng dụng đã thêm.
- Cập nhật hướng dẫn trong phần chỉnh file và cache PWA.

# Kiểm tra và sửa bản 2.4.1 — 15/10/2026

- Sửa test so sánh mảng qua VM context, khai báo TL/$ trong context test, và tình huống hoàn thành bài của test xuất HTML.
- Bỏ qua từng bản ghi lịch sử null hoặc có ngày không hợp lệ, tránh lỗi khi mở lịch sử hoặc kết thúc bài.
- Đặt lại chỉ số trên điện thoại khi bắt đầu lại bài luyện.
- File xuất dùng khai báo UTF-8, bỏ khai báo mã hóa EUC-KR cũ để tránh vỡ tiếng Hàn.
- Cập nhật cache PWA cho bản sửa.
- Đã chạy đạt: npm test; npm run build. Chưa xác nhận Chromium/IME phần cứng: trình duyệt kiểm thử không tải được trong môi trường này.
- Chưa triển khai: kết nối Vercel trả 403 với dự án typing-lab-kien; CLI không có đăng nhập.

# Typing Lab 2.4.3 — mã nguồn

Web đã dùng: https://typing-lab-kien.vercel.app (chưa xác minh được phiên bản trực tuyến trong lần sửa này).

Ứng dụng luyện gõ tiếng Hàn chạy hoàn toàn trên trình duyệt (local-first): không backend, không API key, không tài khoản. Dữ liệu lịch sử và cấu hình lưu trên chính máy bạn.

## Có gì mới ở 2.4

**Sửa lỗi luyện gõ thật**
- Gõ hết câu rồi nhấn **phím cách / Enter** để sang câu: không còn bị tính lỗi và không còn dính ký tự thừa sang câu sau (lỗi lớn nhất của 2.3).
- Ô nhập chuyển sang một dòng; Enter cũng dùng để qua câu.
- Nhập bài có **ký tự vô hình** (NBSP, zero-width khi copy từ web) không còn bị kẹt.
- Bài tự nhập được **lưu lại**, mở trang lần sau vẫn còn.

**Nhập bài từ file HTML (soạn bài cho lớp)**
- Đọc được file mã hóa **EUC-KR** (tự nhận và chuyển sang UTF-8), thay vì hiện chữ vỡ.
- Bài lấy từ phần tử `.source` được cắt khoảng trắng thừa nên gõ được.
- File xuất giữ bố cục bài gốc, áp dụng cấu hình đã chọn và không chèn thêm thông báo chế độ.

**Tính năng học**
- **Bàn phím 두벌식 trên màn hình**, tô sáng phím cần gõ tiếp theo.
- **Tổng kết sau bài**: câu chậm nhất, các ký tự hay gõ sai.
- **Biểu đồ tiến bộ** theo ngày trong tab Lịch sử.

**Chất lượng**
- Trợ năng: nhãn cho mọi ô nhập, tab có ARIA + điều hướng bằng phím mũi tên, chữ Hàn gắn `lang="ko"`, biểu đồ có mô tả, chữ gợi ý rõ hơn.
- Giao diện điện thoại: thanh chỉ số gọn hiện ngay trên ô gõ khi luyện.
- Acorn (~240 KB) chỉ tải khi mở tab "Chỉnh file HTML" → trang vào nhanh hơn nhiều.
- Có thể cài như ứng dụng (PWA) và dùng offline.
- Header bảo mật (CSP, nosniff, referrer-policy) khai báo trong `vercel.json`.
- Hết biến toàn cục rò rỉ (2.3 có `history()` đè lên `window.history`); mã tách thành module trong `src/`.

## Cấu trúc

- `index.html`, `styles.css`: markup và style.
- `src/`: mã nguồn tách module (`core`, `hangul`, `keyboard`, `practice`, `history`, `lesson`, `ui`, `pwa`). Tất cả gắn vào một namespace `window.TL`.
- `vendor/`: Acorn 8.15.0 (MIT) + giấy phép. **Không sửa, không đọc toàn bộ file này vào ngữ cảnh.**
- `scripts/build.cjs`: gộp `src/*` + CSS vào `dist/index.html`, copy acorn và tài nguyên PWA.
- `scripts/test.cjs`: kiểm tra DOM bằng linkedom (không phải trình duyệt thật).
- `tests/e2e.mjs`: kiểm tra trên Chromium thật, có mô phỏng bộ gõ (tùy chọn, cần Playwright).
- `dist/`: bản build để Vercel phục vụ. **Không sửa tay file trong `dist/`.**
- `manifest.webmanifest`, `sw.js`, `icon*.png/svg`: PWA.

## Chạy và kiểm tra

Cần Node.js và npm:

```bash
npm ci        # cài linkedom (theo lockfile)
npm test      # kiểm tra logic + DOM
npm run build # tạo dist/
```

Mở `index.html` ở thư mục gốc để phát triển, hoặc `dist/index.html` cho bản đã gộp.

`npm test` kiểm tra logic và DOM, **chưa thay** cho kiểm tra trên trình duyệt thật và bộ gõ tiếng Hàn phần cứng. Để kiểm tra bộ gõ gần với thực tế:

```bash
npm i -D playwright && npx playwright install chromium
node tests/e2e.mjs
```

> Lưu ý thật: các kịch bản trên mô phỏng chuỗi sự kiện của bộ gõ. Hãy thử tay một lần bằng bàn phím tiếng Hàn trên Windows/macOS và trên điện thoại để xác nhận trước khi công bố.

## Triển khai (bạn tự làm)

Gói **không chứa** tài khoản, token hay khóa API. `vercel.json` khai báo lệnh build, thư mục `dist` và header bảo mật.

Cách nhanh nhất bằng Vercel CLI (đã đăng nhập đúng tài khoản `typing-lab-kien`):

```bash
npm ci
npm run build          # kiểm tra build chạy được
npx vercel deploy --prod
```

Xác nhận đúng dự án `typing-lab-kien` trước khi deploy; không tạo dự án trùng để né lỗi quyền.

Nếu dùng GitHub + Vercel: đẩy toàn bộ thư mục này lên repo, nối repo với dự án Vercel; mỗi lần push Vercel sẽ tự chạy `npm run build`. Khi đó không cần chuyển file ZIP qua lại nữa.

Tài liệu:
- https://code.claude.com/docs/en/quickstart
- https://vercel.com/docs/cli
