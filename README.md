# TikTok Saver — bản web

Đây là phiên bản chạy trên website, không cần cài ứng dụng Windows. Dán liên kết video hoặc trang cá nhân TikTok, xem ảnh trước, chọn video ở nhiều trang và theo dõi tiến độ tải.

## Đưa lên Netlify

1. Mở Netlify, chọn **Add new site → Import an existing project**.
2. Kết nối GitHub và chọn repo `khanfaun/toptopdownload`, nhánh `main`.
3. Netlify sẽ tự dùng cấu hình trong `netlify.toml`: Node.js 22, lệnh `node scripts/build.mjs`, thư mục xuất bản `dist` và API tải video tại `/api/*`.
4. Bấm **Deploy**. Không cần thêm khóa bí mật. Các lần cập nhật nhánh `main` sẽ tự triển khai lại.

## Tải video và tìm nơi lưu

- Mặc định, file được gửi vào mục Tải xuống theo cài đặt trình duyệt. Trên Chrome/Edge, nhấn **Ctrl+J** để xem file và mở thư mục chứa file.
- Nếu muốn chọn nơi khác, bấm **Chọn thư mục khác**. Video được lưu thẳng vào thư mục vừa chọn, không tạo thêm thư mục con.
- Nếu bạn không cấp quyền cho thư mục riêng, ứng dụng tự chuyển về mục Tải xuống của trình duyệt.
- Khi tải nhiều video, trình duyệt có thể hỏi cho phép tải nhiều file. Chọn **Cho phép**; đây là xác nhận của trình duyệt cho trang web.
- Giữ trang mở đến khi lượt tải hoàn tất. Trạng thái **Đã gửi vào mục Tải xuống** nghĩa là trình duyệt đã nhận file; xem kết quả trong danh sách Tải xuống bằng Ctrl+J.

## Chạy thử trên máy

Cần Node.js 22 trở lên.

```powershell
node scripts/build.mjs
node scripts/dev.mjs
```

Mở `http://127.0.0.1:8787`. Website lấy bản HD khi dịch vụ cung cấp và không tự đổi sang bản chất lượng thấp.

## Giới hạn của trình duyệt

Website không thể tự mở thư mục trên máy hoặc ghi file vào đó nếu chưa được người dùng cho phép. Mặc định dùng mục Tải xuống của trình duyệt để tránh yêu cầu quyền truy cập thư mục. Kết nối Netlify được bảo vệ bằng HTTPS.
