# 如何添加新的环境变量 (Environment Variables)

本项目的部署流程使用了 GitHub Actions，并通过 `deploy/generateEnv.js` 脚本在服务器端生成 `.env.local` 文件。

如果你需要为项目添加新的环境变量（例如：新的配置项、API Key 等），请遵循以下步骤。

## 1. 在 GitHub 仓库中配置变量

根据变量的敏感程度，选择添加为 **Secrets** 或 **Variables**：

- **GitHub Secrets** (用于敏感信息，如密码、Token):
  - 路径: `Settings` -> `Secrets and variables` -> `Actions` -> `Secrets`
  - 点击 `New repository secret`
  
- **GitHub Variables** (用于公开配置，如端口号、非敏感开关):
  - 路径: `Settings` -> `Secrets and variables` -> `Actions` -> `Variables`
  - 点击 `New repository variable`

## 2. 修改部署流程 (`deploy.yml`)

你需要修改 `.github/workflows/deploy.yml` 文件，将新添加的 GitHub 变量传递给部署脚本。

1. 打开 `.github/workflows/deploy.yml`。
2. 找到 `Deploy to server` 步骤下的 `script` 部分。
3. 在 `node deploy\generateEnv.js` 命令的参数列表中追加新的变量。

### 格式规则

必须使用 `_CUSTOM_` 前缀，这样 `generateEnv.js` 才能识别并写入 `.env.local`。

```bash
_CUSTOM_你的变量名="${{ secrets.你的变量名 }}"
# 或者
_CUSTOM_你的变量名="${{ vars.你的变量名 }}"
```

### 修改示例

假设你要添加一个名为 `MY_NEW_CONFIG` 的变量（已在 GitHub Secrets 中配置）。

**修改前：**
```yaml
script: |
  cd ${{ vars.PROJECT_DIR }} & node deploy\generateEnv.js _CUSTOM_CRON_EXPR="${{ secrets.CRON_EXPR }}" ... & node deploy\deploy.js
```

**修改后：**
```yaml
script: |
  cd ${{ vars.PROJECT_DIR }} & node deploy\generateEnv.js _CUSTOM_CRON_EXPR="${{ secrets.CRON_EXPR }}" ... _CUSTOM_MY_NEW_CONFIG="${{ secrets.MY_NEW_CONFIG }}" & node deploy\deploy.js
```

> **注意**：Windows CMD/PowerShell 对参数长度有限制，如果参数过多，建议换行书写（但在 YAML 的 `script` 块中需要注意转义和连接符）。

## 3. 验证

部署成功后，服务器端的项目根目录下 `.env.local` 文件中将会自动生成：

```properties
MY_NEW_CONFIG=你的配置值
```

## 4. (可选) 本地开发

如果本地开发也需要该变量，请手动将其添加到你本地的 `.env` 或 `.env.local` 文件中。
