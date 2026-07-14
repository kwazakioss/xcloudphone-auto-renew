# Hướng dẫn thiết lập hệ thống XCloudPhone Auto Renew

Chào mừng bạn đến với hệ thống tự động gia hạn XCloudPhone! Hướng dẫn này sẽ giúp bạn thiết lập repository GitHub của mình để script gia hạn có thể hoạt động và giao diện web hiển thị trạng thái.

## 1. Tạo Repository GitHub

Nếu bạn chưa có, hãy tạo một repository mới trên GitHub với tên `xcloudphone-auto-renew` (hoặc tên bất kỳ bạn muốn). Sau đó, tải các file sau lên repository của bạn:

- `xcloud_renew_script.js`
- `package.json`
- `index.html`
- `.github/workflows/renew.yml`

## 2. Cấu hình GitHub Secrets (XCLOUD_TOKENS)

Để script gia hạn có thể truy cập vào tài khoản XCloudPhone của bạn, bạn cần cung cấp các token truy cập dưới dạng GitHub Secret. Đây là cách an toàn để lưu trữ thông tin nhạy cảm.

1.  Trên repository của bạn, điều hướng đến **Settings**.
2.  Trong thanh điều hướng bên trái, chọn **Secrets and variables** > **Actions**.
3.  Nhấp vào nút **New repository secret**.
4.  Đặt tên cho Secret là `XCLOUD_TOKENS`.
5.  Trong trường **Secret value**, bạn cần dán một mảng JSON chứa thông tin tài khoản của bạn. Mỗi đối tượng trong mảng sẽ đại diện cho một tài khoản XCloudPhone, bao gồm `username`, `accessToken` và `refreshToken`.

    **Cấu trúc JSON mẫu:**
    ```json
    [
      {
        "username": "tai_khoan_1",
        "accessToken": "YOUR_ACCESS_TOKEN_1",
        "refreshToken": "YOUR_REFRESH_TOKEN_1"
      },
      {
        "username": "tai_khoan_2",
        "accessToken": "YOUR_ACCESS_TOKEN_2",
        "refreshToken": "YOUR_REFRESH_TOKEN_2"
      }
    ]
    ```

    **Lưu ý quan trọng:**
    -   Bạn cần lấy `accessToken` và `refreshToken` từ cookie của trình duyệt khi bạn đã đăng nhập vào XCloudPhone. Thông thường, bạn có thể sử dụng công cụ phát triển của trình duyệt (F12) để kiểm tra cookie trên trang `app.xcloudphone.com`.
    -   Đảm bảo rằng giá trị JSON của bạn là hợp lệ. Bạn có thể sử dụng các công cụ kiểm tra JSON trực tuyến để xác minh.
    -   Nếu bạn có 50+ tài khoản, hãy dán toàn bộ cấu trúc JSON của 50 tài khoản vào đây.

6.  Nhấp vào **Add secret** để lưu.

## 3. Kích hoạt GitHub Pages

GitHub Pages sẽ host file `index.html` của bạn, tạo ra một trang web đơn giản để bạn có thể theo dõi trạng thái gia hạn.

1.  Trên repository của bạn, điều hướng đến **Settings**.
2.  Trong thanh điều hướng bên trái, chọn **Pages**.
3.  Trong phần **Build and deployment**, chọn **Deploy from a branch**.
4.  Trong phần **Branch**, chọn nhánh mà bạn đã tải các file lên (thường là `main` hoặc `master`). Chọn thư mục `/ (root)`.
5.  Nhấp vào **Save**.

    Sau vài phút, GitHub Pages sẽ triển khai trang web của bạn. Bạn sẽ thấy một liên kết (ví dụ: `https://your-username.github.io/xcloudphone-auto-renew/`) hiển thị trên trang cài đặt Pages. Đây là liên kết để bạn truy cập giao diện trạng thái.

## 4. Chạy GitHub Actions Workflow

Workflow `renew.yml` đã được cấu hình để chạy tự động mỗi 4 giờ. Tuy nhiên, bạn có thể chạy thủ công để kiểm tra ngay lập tức:

1.  Trên repository của bạn, điều hướng đến **Actions**.
2.  Trong thanh bên trái, chọn workflow **XCloudPhone Auto Renew**.
3.  Nhấp vào nút **Run workflow** ở góc trên bên phải và chọn nhánh bạn muốn chạy (thường là `main`).
4.  Theo dõi quá trình chạy. Sau khi hoàn tất, file `status.json` sẽ được cập nhật và đẩy lên repository, và giao diện GitHub Pages của bạn sẽ hiển thị trạng thái mới nhất.

## 5. Lưu ý quan trọng

-   **Tắt Tampermonkey cũ:** Nếu bạn đang sử dụng script Tampermonkey cũ để gia hạn, hãy tắt nó đi sau khi hệ thống GitHub này hoạt động ổn định. Việc chạy song song có thể gây ra vấn đề và có thể khiến tài khoản của bạn bị khóa.
-   **Kiểm tra thường xuyên:** Thường xuyên kiểm tra log của GitHub Actions để đảm bảo script đang chạy mà không có lỗi. Nếu có lỗi về token, bạn cần cập nhật `XCLOUD_TOKENS` trong GitHub Secrets.

Chúc bạn thành công!
