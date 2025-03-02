# DDNS Worker

一个简单的 Cloudflare Worker，用于返回访问者的 IP 地址，并支持自动更新 DNS 记录。

## 功能

- 直接返回访问者的 IP 地址
- 支持 IPv4 地址验证和更新(对A类的域名)
- 支持多域名配置
- 通过 API 自动更新 Cloudflare DNS 记录
- 使用访问密钥保护更新操作

## 使用方法

部署后，可以通过以下方式使用：

- **查询当前 IP**：直接访问 `https://your-worker-domain.workers.dev/`
- **更新 DNS 记录**：访问 `https://your-worker-domain.workers.dev/update?name=your_dns_record_name&key=your_access_key`
  - `name`：需要更新的 DNS 记录名称，使用完整域名（如 `subdomain.example.com`）
  - `key`：访问密钥，用于验证更新请求

## 配置说明

Worker 使用环境变量进行配置，支持多域名。每个域名需要配置以下三个环境变量：

```
{your_dns_record_name}__zone_id - 域名所在的 Cloudflare 区域 ID（应设置为加密变量，否则部署时会覆盖）
{your_dns_record_name}__api_token - 用于 Cloudflare API 认证的令牌（应设置为加密变量）
{your_dns_record_name}__access_key - 用于客户端访问验证的密钥（应设置为加密变量）
```

例如，要为 `home.example.com` 配置 DDNS 更新：

```
home.example.com__zone_id
home.example.com__api_token
home.example.com__access_key
```

### 配置环境变量的方法

**在 Cloudflare Dashboard 中配置**：
- 进入 Workers & Pages > your-worker-name > Settings > Variables
- 添加相应的变量或加密变量

## 部署方法

### 通过 GitHub 集成自动部署

1. 在 Cloudflare Dashboard 中创建一个新的 Worker 项目
2. 进入 Workers & Pages > 创建应用程序 > 连接到 Git
3. 连接到您的 GitHub 账户并选择包含 DDNS Worker 代码的仓库
4. 配置构建设置：
   - **Build command**: 留空（None）
   - **Deploy command**: `npx wrangler deploy`
   - **Root directory**: `/`
5. 设置生产分支（默认为 `main`）
6. 配置必要的环境变量（见上文的配置说明）
7. 点击"保存并部署"

完成上述步骤后，每当您推送代码到指定的分支，Cloudflare 将自动构建和部署您的 Worker。

## 手动部署方法

如需手动部署：

1. 确保已安装 Node.js 和 npm
2. 安装依赖：
   ```bash
   npm install
   ```
3. 使用 Wrangler 登录 Cloudflare 账号：
   ```bash
   npx wrangler login
   ```
4. 配置环境变量（见上文）
5. 部署项目：
   ```bash
   npm run deploy
   ```
   或
   ```bash
   npx wrangler deploy
   ```

## 本地开发

启动本地开发服务器：
```bash
npm run dev
```

## 技术实现

- 使用 Cloudflare Workers 平台
- 通过 `CF-Connecting-IP` 头获取访问者 IP
- 使用 Cloudflare API 进行 DNS 记录更新
- 支持 IPv4 地址验证

## 许可证

MIT 许可证