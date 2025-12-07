const { execSync } = require("child_process");
const os = require("os");
const path = require("path");
const fs = require("fs");

function run(cmd) {
  console.log("▶", cmd);
  execSync(cmd, { stdio: "inherit" });
}

function tryRun(cmd) {
  try {
    execSync(cmd, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

//
// 1. 读取 ecosystem.config.js
//
const ecosysPath = path.join(process.cwd(), "deploy", "ecosystem.config.js");
if (!fs.existsSync(ecosysPath)) {
  console.error("❌ 找不到 ecosystem.config.js:", ecosysPath);
  process.exit(1);
}

//
// 2. 动态加载 ecosystem.config.js（Node 原生 require）
//
let ecosystem;
try {
  ecosystem = require(ecosysPath);
} catch (err) {
  console.error("❌ ecosystem.config.js 加载失败:", err);
  process.exit(1);
}

if (!ecosystem.apps || ecosystem.apps.length === 0) {
  console.error("❌ ecosystem.config.js 中没有 apps 配置");
  process.exit(1);
}

const appName = ecosystem.apps[0].name;
console.log("✔ 自动检测到 PM2 app 名称:", appName);

console.log("\n===== 1. 拉取最新代码 =====");
run("git pull");

console.log("\n===== 2. 安装依赖 =====");
run("pnpm install --frozen-lockfile");

console.log("\n===== 3. 构建项目 =====");
run("pnpm run build");

console.log("\n===== 4. 使用 PM2 部署 =====");

//
// 检查 PM2 是否存在 appName
//
const exists = tryRun(`pm2 describe ${appName}`);

if (exists) {
  console.log(`✔ PM2 已存在 ${appName}，重启...`);
  run(`npx pm2 restart ${appName}`);
} else {
  console.log(`⚠ PM2 未检测到 ${appName}，使用 ecosystem.config.js 启动...`);
  run(`npx pm2 start ${ecosysPath}`);
}

console.log("\n===== 5. 保存 PM2 状态 =====");
run("npx pm2 save");

console.log("\n===== 部署完成 =====");
console.log("Platform:", os.platform());