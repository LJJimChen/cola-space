// deploy/generateEnv.js
const fs = require("fs");
const path = require("path");
const os = require("os");

// process.argv[2...] 的格式是 ["KEY=value", "KEY2=value2"]
const args = process.argv.slice(2);

if (args.length === 0) {
  console.log("没有收到任何参数，跳过生成 .env.local");
  process.exit(0);
}

const envVars = {};

args.forEach(arg => {
  const [key, ...rest] = arg.split("=");
  const value = rest.join("=");
  if (key && value !== undefined) {
    envVars[key] = value;
  }
});

// 写入 .env.local 到项目根目录
const envPath = path.join(process.cwd(), ".env.local");
const content = Object.entries(envVars)
  .map(([k, v]) => `${k}=${v}`)
  .join(os.EOL);

fs.writeFileSync(envPath, content, "utf8");

console.log(`✔ 已生成 .env.local`);
console.log(envVars);