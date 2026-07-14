
const fetch = require("node-fetch");
const fs = require("fs");
const { execSync } = require("child_process");

const API_BASE = "https://api.xcloudphone.com";
const RENEW_THRESHOLD_HOURS = 4; // Gia hạn nếu dưới 4h

const fetch = require("node-fetch");
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

    const devices = res.data.data;
    const now = new Date();
    const renewGroups = {};
    let anyDeviceRenewed = false;

    if (devices.length === 0) {
      accountStatus.status = "Không có thiết bị";
      accountStatus.timeRemaining = "0";
      return accountStatus;
    }

    devices.forEach((d) => {
      const endTime = new Date(d.endTime);
      const diffHours = (endTime - now) / (1000 * 60 * 60);

      if (diffHours < RENEW_THRESHOLD_HOURS) {
        const hoursToAdd = Math.ceil(TARGET_TIME_AFTER_RENEW_HOURS - diffHours);
        if (hoursToAdd > 0) {
          if (!renewGroups[hoursToAdd]) renewGroups[hoursToAdd] = [];
          renewGroups[hoursToAdd].push(d.id);
        }
      }
    });

    if (Object.keys(renewGroups).length === 0) {
      accountStatus.status = "Ổn định";
    } else {
      for (const [hours, ids] of Object.entries(renewGroups)) {
        const extendRes = await apiCall("/rentals/extend", "POST", { 
          listSessionId: ids, 
          rentalHours: Number(hours) 
        }, tokens);

        if (extendRes.status >= 200 && extendRes.status < 300) {
          anyDeviceRenewed = true;
        }
      }
      accountStatus.status = anyDeviceRenewed ? "Đã gia hạn" : "Gia hạn lỗi";
    }

    const minEndTime = Math.min(...devices.map(d => new Date(d.endTime).getTime()));
    const minDiffHours = (minEndTime - now) / (1000 * 60 * 60);
    accountStatus.timeRemaining = `${minDiffHours.toFixed(1)}h`;

  } catch (err) {
    accountStatus.status = `Lỗi hệ thống`;
  }
  return accountStatus;
}

async function main() {
  const xcloudTokensEnv = process.env.XCLOUD_TOKENS;
  if (!xcloudTokensEnv) {
    console.error("Thiếu XCLOUD_TOKENS");
    process.exit(1);
  }

  let accounts = JSON.parse(xcloudTokensEnv);
  const allAccountsStatus = [];
  
  for (const account of accounts) {
    const status = await checkAndRenewForAccount(account);
    allAccountsStatus.push(status);
  }

  fs.writeFileSync("./status.json", JSON.stringify(allAccountsStatus, null, 2));

  try {
    execSync("git config user.name 'github-actions[bot]'");
    execSync("git config user.email 'github-actions[bot]@users.noreply.github.com'");
    execSync("git add status.json");
    execSync("git commit -m 'Update status' || true");
    execSync("git push");
  } catch (e) {
    console.error("Git push error");
  }
}

main();


async function apiCall(path, method, body, tokens) {
  const headers = {
    "Content-Type": "application/json",
    "Cookie": `renterAccessToken=${tokens.accessToken}; renterRefreshToken=${tokens.refreshToken}`,
    "Origin": "https://app.xcloudphone.com",
  };

  try {
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
  const { username, accessToken, refreshToken } = account;
  const tokens = { accessToken, refreshToken };
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
      accountStatus.status = `Lỗi khi lấy danh sách phiên thuê: ${res.data?.message || res.status}`; 
      console.log(`❌ ${username}: ${accountStatus.status}`);
      return accountStatus;
    }

    const devices = res.data.data;
    const now = new Date();
    const renewGroups = {};
    let anyDeviceRenewed = false;

    devices.forEach((d) => {
      const endTime = new Date(d.endTime);
      const diffHours = (endTime - now) / (1000 * 60 * 60);

      if (diffHours < RENEW_THRESHOLD_HOURS) {
        const hoursToAdd = Math.ceil(TARGET_TIME_AFTER_RENEW_HOURS - diffHours); // Làm tròn lên để đảm bảo đủ 5h
        if (hoursToAdd > 0) {
          if (!renewGroups[hoursToAdd]) renewGroups[hoursToAdd] = [];
          renewGroups[hoursToAdd].push(d.id);
          console.log(`  Thiết bị ${d.id} cần gia hạn: còn ${diffHours.toFixed(2)}h, sẽ gia hạn thêm ${hoursToAdd}h.`);
        }
      }
    });

    if (Object.keys(renewGroups).length === 0) {
      accountStatus.status = "Không có thiết bị nào cần gia hạn";
      console.log(`✅ ${username}: ${accountStatus.status}`);
    } else {
      for (const [hours, ids] of Object.entries(renewGroups)) {
        console.log(`  Đang gia hạn ${ids.length} thiết bị thêm ${hours}h...`);
        const extendRes = await apiCall("/rentals/extend", "POST", { 
          listSessionId: ids, 
          rentalHours: Number(hours) 
        }, tokens);

        if (extendRes.status >= 200 && extendRes.status < 300) {
          console.log(`  🎉 Đã gia hạn thành công +${hours}h cho ${ids.length} máy.`);
          anyDeviceRenewed = true;
        } else {
          console.log(`  ❌ Lỗi khi gia hạn +${hours}h cho ${ids.length} máy: ${extendRes.data?.message || extendRes.status}`);
          accountStatus.status = `Lỗi gia hạn một số thiết bị: ${extendRes.data?.message || extendRes.status}`;
        }
      }
      if (anyDeviceRenewed) {
        accountStatus.status = "Đã gia hạn thành công";
      } else if (accountStatus.status === "Không xác định") {
        accountStatus.status = "Không có thiết bị nào cần gia hạn"; // Nếu không có lỗi nhưng cũng không gia hạn được
      }
    }

    // Cập nhật thời gian còn lại của thiết bị có thời gian ngắn nhất (hoặc trung bình) để hiển thị
    if (devices.length > 0) {
      const minEndTime = Math.min(...devices.map(d => new Date(d.endTime).getTime()));
      const minDiffHours = (minEndTime - now) / (1000 * 60 * 60);
      accountStatus.timeRemaining = `${minDiffHours.toFixed(2)}h`;
    } else {
      accountStatus.timeRemaining = "Không có thiết bị";
    }

  } catch (err) {
    console.error(`❌ Lỗi tổng quát cho tài khoản ${username}:`, err);
    accountStatus.status = `Lỗi tổng quát: ${err.message}`;
  }
  return accountStatus;
}

async function main() {
  const xcloudTokensEnv = process.env.XCLOUD_TOKENS;
  if (!xcloudTokensEnv) {
    console.error("Biến môi trường XCLOUD_TOKENS không được thiết lập.");
    process.exit(1);
  }

  let accounts;
  try {
    accounts = JSON.parse(xcloudTokensEnv);
    if (!Array.isArray(accounts) || accounts.length === 0) {
      throw new Error("XCLOUD_TOKENS phải là một mảng JSON không rỗng.");
    }
  } catch (e) {
    console.error("Lỗi phân tích cú pháp JSON từ XCLOUD_TOKENS:", e);
    process.exit(1);
  }

  const allAccountsStatus = [];
  for (const account of accounts) {
    const status = await checkAndRenewForAccount(account);
    allAccountsStatus.push(status);
  }

  // Ghi file status.json
  const statusFilePath = "./status.json";
  fs.writeFileSync(statusFilePath, JSON.stringify(allAccountsStatus, null, 2));
  console.log(`\nĐã ghi trạng thái vào ${statusFilePath}`);

  // Cấu hình Git và đẩy file
  try {
    console.log("\nĐang cấu hình Git...");
    execSync("git config user.name 'github-actions[bot]'");
    execSync("git config user.email 'github-actions[bot]@users.noreply.github.com'");
    execSync("git add status.json");
    execSync("git commit -m 'Update XCloudPhone renewal status' || true"); // '|| true' để tránh lỗi nếu không có gì thay đổi
    execSync("git push");
    console.log("🎉 Đã đẩy file status.json lên repository thành công.");
  } catch (e) {
    console.error("❌ Lỗi khi thực hiện các lệnh Git:", e.message);
    // Không thoát process để vẫn hoàn thành việc ghi status.json
  }
}

main();
