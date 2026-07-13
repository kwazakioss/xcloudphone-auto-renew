const API_BASE = 'https://api.xcloudphone.com';
const RENEW_THRESHOLD_HOURS = 4; // Gia hạn nếu thời gian còn lại dưới 4 giờ
const EXTEND_HOURS = 5; // Số giờ gia hạn thêm

// Lấy danh sách tài khoản từ biến môi trường XCLOUD_TOKENS dưới dạng JSON
const XCLOUD_TOKENS_JSON = process.env.XCLOUD_TOKENS;

async function apiCall(path, method, body, tokens) {
  const headers = {
    'Content-Type': 'application/json',
    'Cookie': `renterAccessToken=${tokens.accessToken}; renterRefreshToken=${tokens.refreshToken}`,
    'Origin': 'https://app.xcloudphone.com'
  };

  try {
    const response = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : null
    });

    if (response.status === 401) {
      console.error(`[${tokens.username || 'Unknown Account'}] Lỗi: Token hết hạn hoặc không hợp lệ. Vui lòng cập nhật AccessToken và RefreshToken.`);
      return { status: 401 };
    }
    
    const data = await response.json();
    return { status: response.status, data };
  } catch (error) {
    console.error(`[${tokens.username || 'Unknown Account'}] Lỗi khi gọi API ${path}:`, error);
    return { status: 500, error: error.message };
  }
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function processAccount(account) {
  const { username, accessToken, refreshToken } = account;
  const tokens = { username, accessToken, refreshToken };

  console.log(`\n--- Đang xử lý tài khoản: ${username} ---`);

  if (!accessToken || !refreshToken) {
    console.error(`[${username}] ❌ Vui lòng cung cấp AccessToken và RefreshToken cho tài khoản này.`);
    return;
  }

  try {
    console.log(`[${username}] Đang kiểm tra các máy ảo XCloudPhone...`);
    const res = await apiCall('/renters/rental-sessions?page=1&limit=50', 'GET', null, tokens);

    if (res.status === 401) {
      return; // Lỗi đã được xử lý trong apiCall
    }

    if (res.status !== 200 || !res.data || !res.data.data) {
      console.error(`[${username}] Lỗi khi lấy danh sách máy ảo:`, res.data);
      return;
    }

    const devices = res.data.data;
    const now = new Date();
    const renewCandidates = [];

    devices.forEach(d => {
      const endTime = new Date(d.endTime);
      const diffHours = (endTime - now) / (1000 * 60 * 60);

      if (diffHours < RENEW_THRESHOLD_HOURS) {
        renewCandidates.push(d);
      }
    });

    if (renewCandidates.length === 0) {
      console.log(`[${username}] ✅ Không có máy ảo nào cần gia hạn vào lúc này.`);
      return;
    }

    console.log(`[${username}] Tìm thấy ${renewCandidates.length} máy ảo cần gia hạn.`);

    const sessionIdsToRenew = renewCandidates.map(d => d.id);

    const extendRes = await apiCall('/rentals/extend', 'POST', {
      listSessionId: sessionIdsToRenew,
      rentalHours: EXTEND_HOURS
    }, tokens);

    if (extendRes.status >= 200 && extendRes.status < 300) {
      console.log(`[${username}] 🎉 Đã gia hạn thành công +${EXTEND_HOURS} giờ cho ${sessionIdsToRenew.length} máy ảo.`);
    } else {
      console.error(`[${username}] Lỗi khi gửi lệnh gia hạn:`, extendRes.data);
    }

  } catch (err) {
    console.error(`[${username}] Lỗi trong quá trình xử lý tài khoản:`, err);
  }
}

async function main() {
  if (!XCLOUD_TOKENS_JSON) {
    console.error("❌ Biến môi trường XCLOUD_TOKENS không được tìm thấy hoặc trống. Vui lòng cung cấp danh sách tài khoản dưới dạng JSON.");
    return;
  }

  let accounts;
  try {
    accounts = JSON.parse(XCLOUD_TOKENS_JSON);
    if (!Array.isArray(accounts)) {
      throw new Error("XCLOUD_TOKENS phải là một mảng JSON.");
    }
  } catch (e) {
    console.error("❌ Lỗi phân tích cú pháp JSON từ XCLOUD_TOKENS:", e.message);
    return;
  }

  if (accounts.length === 0) {
    console.log("Không có tài khoản nào được cung cấp trong XCLOUD_TOKENS.");
    return;
  }

  console.log(`Bắt đầu xử lý ${accounts.length} tài khoản...`);

  for (let i = 0; i < accounts.length; i++) {
    await processAccount(accounts[i]);
    if (i < accounts.length - 1) {
      console.log(`Chờ 3 giây trước khi xử lý tài khoản tiếp theo...`);
      await delay(3000);
    }
  }
  console.log("\n--- Hoàn tất xử lý tất cả tài khoản ---");
}

main();
