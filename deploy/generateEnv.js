// deploy/generateEnv.js
const fs = require("fs");
const path = require("path");
const os = require("os");

const prefix = "_CUSTOM_";
// process.argv[2...] 的格式是 ["KEY=value", "KEY2=value2"]
const args = process.argv.slice(2);


// get from env
const envVars = Object.fromEntries(Object.entries(process.env).filter(([k]) => k.startsWith(prefix)));

// get from argv
const customArgs = args.filter(arg => arg.startsWith(prefix));
customArgs.forEach(arg => { 
  const [key, ...rest] = arg.split("=");
  const value = rest.join("=");
  if (key && value !== undefined) {
    envVars[key] = value;
  }
});

// 写入 .env.local 到项目根目录
const envPath = path.join(process.cwd(), ".env.local");
const content = Object.entries(envVars)
  .map(([k, v]) => `${k.replace(prefix,"")}=${v}`)
  .join(os.EOL);

fs.writeFileSync(envPath, content, "utf8");

console.log(`✔ 已生成 .env.local`, envVars);
if (customArgs.length === 0) {
  console.warn("⚠️ 没有收到任何_CUSTOM_参数，.env.local 为空");
}