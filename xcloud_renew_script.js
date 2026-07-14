const fs = require("fs");
const { execSync } = require("child_process");

/**
 * CẤU HÌNH HỆ THỐNG
 */
const API_BASE = "https://api.xcloudphone.com";
const RENEW_THRESHOLD_HOURS = 4; // Gia hạn nếu thời gian còn lại dưới 4 tiếng
const TARGET_TIME_AFTER_RENEW_HOURS = 5; // Gia hạn thêm 5 tiếng mỗi lần

/**
 * Hàm gọi API dùng fetch (built-in trong Node.js 18+)
 */
async function apiCall(path, method, body, tokens) {
  const headers = {
    "Content-Type": "application/json",
    "Cookie": `renterAccessToken=${tokens.renterAccessToken}; renterRefreshToken=${tokens.renterRefreshToken}`,
    "Origin": "https://app.xcloudphone.com",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
  };

  try {
    const response = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : null,
    });

    const status = response.status;
    let data = null;
    
    try {
      data = await response.json();
    } catch (e) {
      // Một số API có thể không trả về JSON hợp lệ khi lỗi
    }

    return { status, data };
  } catch (error) {
    console.error(`  [!] Lỗi kết nối API ${path}:`, error.message);
    return { status: 500, data: { message: error.message } };
  }
}

/**
 * Kiểm tra và gia hạn cho từng tài khoản
 */
async function checkAndRenewForAccount(account) {
  const { username, renterAccessToken, renterRefreshToken } = account;
  const tokens = { renterAccessToken, renterRefreshToken };
  let accountStatus = { 
    username: username || "Ẩn danh", 
    timeRemaining: "N/A", 
    status: "Chưa kiểm tra",
    lastCheck: new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })
  };

  console.log(`\n>>> Đang xử lý: ${username}`);

  try {
    // 1. Lấy danh sách máy đang thuê
    const res = await apiCall("/renters/rental-sessions?page=1&limit=50", "GET", null, tokens);

    if (res.status === 401) {
      accountStatus.status = "❌ Token hết hạn/Sai";
      console.log(`  [!] ${accountStatus.status}`);
      return accountStatus;
    }

    if (res.status !== 200 || !res.data || !res.data.data) {
      accountStatus.status = `❌ Lỗi API (${res.status})`;
      console.log(`  [!] ${accountStatus.status}`);
      return accountStatus;
    }

    const sessions = res.data.data;
    if (sessions.length === 0) {
      accountStatus.status = "ℹ️ Không có máy";
      console.log(`  [i] ${accountStatus.status}`);
      return accountStatus;
    }

    let minRemaining = Infinity;
    let renewCount = 0;

    for (const session of sessions) {
      const remainingMs = new Date(session.endTime) - new Date();
      const remainingHours = remainingMs / (1000 * 60 * 60);

      if (remainingHours < minRemaining) minRemaining = remainingHours;

      if (remainingHours < RENEW_THRESHOLD_HOURS) {
        console.log(`  [*] Máy ${session.id.substring(0,8)}... còn ${remainingHours.toFixed(2)}h. Đang gia hạn...`);
        // API gia hạn chính xác: /renters/rental-sessions/{id}/renew
        const renewRes = await apiCall(`/renters/rental-sessions/${session.id}/renew`, "POST", { hours: TARGET_TIME_AFTER_RENEW_HOURS }, tokens);
        
        if (renewRes.status === 200) {
          renewCount++;
          console.log(`    ✅ Thành công +${TARGET_TIME_AFTER_RENEW_HOURS}h`);
        } else {
          console.log(`    ❌ Thất bại: ${renewRes.data?.message || renewRes.status}`);
        }
      }
    }

    accountStatus.timeRemaining = minRemaining === Infinity ? "N/A" : `${minRemaining.toFixed(2)}h`;
    accountStatus.status = renewCount > 0 ? `✅ Đã gia hạn ${renewCount} máy` : "🟢 Ổn định";
    console.log(`  [OK] Còn lại: ${accountStatus.timeRemaining}. Trạng thái: ${accountStatus.status}`);

  } catch (err) {
    accountStatus.status = "⚠️ Lỗi hệ thống";
    console.error(`  [!] Lỗi:`, err.message);
  }

  return accountStatus;
}

/**
 * HÀM CHÍNH
 */
async function main() {
  const tokensRaw = process.env.XCLOUD_TOKENS;
  if (!tokensRaw) {
    console.error("CRITICAL: Không tìm thấy XCLOUD_TOKENS trong môi trường.");
    process.exit(1);
  }

  let accounts = [];
  try {
    accounts = JSON.parse(tokensRaw);
  } catch (e) {
    console.error("CRITICAL: Định dạng JSON trong XCLOUD_TOKENS bị lỗi.");
    console.error("Chi tiết lỗi:", e.message);
    process.exit(1);
  }

  console.log(`=== BẮT ĐẦU GIA HẠN CHO ${accounts.length} TÀI KHOẢN ===`);
  
  const results = [];
  for (const account of accounts) {
    const status = await checkAndRenewForAccount(account);
    results.push(status);
  }

  // Ghi file kết quả để hiển thị lên Web
  fs.writeFileSync("status.json", JSON.stringify(results, null, 2));
  console.log("\n=== HOÀN TẤT. Đã lưu status.json ===");

  // Tự động đẩy lên GitHub
  try {
    console.log("Đang đẩy dữ liệu lên GitHub...");
    execSync('git config --global user.name "GitHub Actions"');
    execSync('git config --global user.email "actions@github.com"');
    execSync('git add status.json');
    // Chỉ commit nếu có thay đổi
    try {
      execSync('git commit -m "Auto-update status [skip ci]"');
      execSync('git push');
      console.log("✅ Đã push thành công.");
    } catch (e) {
      console.log("ℹ️ Không có thay đổi nào để push.");
    }
  } catch (err) {
    console.error("❌ Lỗi khi push GitHub:", err.message);
  }
}

main();
