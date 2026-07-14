const fs = require("fs");
const { execSync } = require("child_process");

const API_BASE = "https://api.xcloudphone.com";
const RENEW_THRESHOLD_HOURS = 4; // Gia hạn nếu dưới 4h
const TARGET_TIME_AFTER_RENEW_HOURS = 5; // Gia hạn lên 5h

async function apiCall(path, method, body, tokens) {
  const headers = {
    "Content-Type": "application/json",
    "Cookie": `renterAccessToken=${tokens.renterAccessToken}; renterRefreshToken=${tokens.renterRefreshToken}`,
    "Origin": "https://app.xcloudphone.com",
  };

  try {
    // Sử dụng fetch có sẵn trong Node.js 18+
    const response = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : null,
    });

    if (response.status === 401) {
      return { status: 401, data: { message: "Token hết hạn hoặc không hợp lệ." } };
    }
    const data = await response.json();
    return { status: response.status, data };
  } catch (error) {
    console.error(`Lỗi khi gọi API ${path}:`, error);
    return { status: 500, data: { message: error.message } };
  }
}

async function checkAndRenewForAccount(account) {
  const { username, renterAccessToken, renterRefreshToken } = account;
  const tokens = { renterAccessToken, renterRefreshToken };
  let accountStatus = { username, timeRemaining: "N/A", status: "Không xác định" };

  console.log(`\nĐang kiểm tra tài khoản: ${username}`);

  try {
    // 1. Lấy danh sách phiên thuê
    const res = await apiCall("/renters/rental-sessions?page=1&limit=50", "GET", null, tokens);

    if (res.status === 401) {
      accountStatus.status = "Token hết hạn hoặc không hợp lệ";
      console.log(`❌ ${username}: ${accountStatus.status}`);
      return accountStatus;
    }

    if (res.status !== 200 || !res.data || !res.data.data) {
      accountStatus.status = `Lỗi API: ${res.data?.message || res.status}`;
      console.log(`❌ ${username}: ${accountStatus.status}`);
      return accountStatus;
    }

    const sessions = res.data.data;
    if (sessions.length === 0) {
      accountStatus.status = "Không có máy nào đang thuê";
      console.log(`ℹ️ ${username}: ${accountStatus.status}`);
      return accountStatus;
    }

    let minTimeRemaining = Infinity;
    let needsRenew = false;

    for (const session of sessions) {
      const remainingMs = new Date(session.endTime) - new Date();
      const remainingHours = remainingMs / (1000 * 60 * 60);

      if (remainingHours < minTimeRemaining) {
        minTimeRemaining = remainingHours;
      }

      if (remainingHours < RENEW_THRESHOLD_HOURS) {
        needsRenew = true;
        console.log(`  - Máy ${session.id} sắp hết hạn (${remainingHours.toFixed(2)}h). Đang gia hạn...`);
        
        // Gọi API gia hạn
        const renewRes = await apiCall(`/renters/rental-sessions/${session.id}/renew`, "POST", { hours: TARGET_TIME_AFTER_RENEW_HOURS }, tokens);
        if (renewRes.status === 200) {
          console.log(`    ✅ Gia hạn thành công thêm ${TARGET_TIME_AFTER_RENEW_HOURS}h.`);
        } else {
          console.log(`    ❌ Gia hạn thất bại: ${renewRes.data?.message || renewRes.status}`);
        }
      }
    }

    accountStatus.timeRemaining = minTimeRemaining === Infinity ? "N/A" : `${minTimeRemaining.toFixed(2)}h`;
    accountStatus.status = needsRenew ? "Đã thực hiện gia hạn" : "Thời gian còn đủ";
    console.log(`✅ ${username}: Thời gian còn lại ít nhất ${accountStatus.timeRemaining}.`);

  } catch (err) {
    accountStatus.status = `Lỗi hệ thống: ${err.message}`;
    console.log(`❌ ${username}: ${accountStatus.status}`);
  }

  return accountStatus;
}

async function main() {
  const tokensRaw = process.env.XCLOUD_TOKENS;
  if (!tokensRaw) {
    console.error("Lỗi: Không tìm thấy biến môi trường XCLOUD_TOKENS.");
    process.exit(1);
  }

  let accounts = [];
  try {
    accounts = JSON.parse(tokensRaw);
  } catch (e) {
    console.error("Lỗi: Định dạng JSON trong XCLOUD_TOKENS không hợp lệ.");
    process.exit(1);
  }

  const results = [];
  for (const account of accounts) {
    const status = await checkAndRenewForAccount(account);
    results.push(status);
  }

  // Ghi file status.json
  fs.writeFileSync("status.json", JSON.stringify(results, null, 2));
  console.log("\nĐã cập nhật file status.json.");

  // Tự động push lên GitHub
  try {
    execSync('git config --global user.name "GitHub Actions"');
    execSync('git config --global user.email "actions@github.com"');
    execSync('git add status.json');
    execSync('git commit -m "Update account status [skip ci]" || echo "No changes to commit"');
    execSync('git push');
    console.log("Đã đẩy dữ liệu mới lên GitHub.");
  } catch (pushError) {
    console.error("Lỗi khi push lên GitHub:", pushError.message);
  }
}

main();
