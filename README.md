# DDNS Worker

一个简单的 Cloudflare Worker，用于返回访问者的 IP 地址。可用于 DDNS（动态 DNS）服务。

## 功能

- 直接返回访问者的 IP 地址
- 支持 IPv4 和 IPv6（取决于访问者的网络环境）
- 无需区分路径，直接返回当前 IP 地址

## 部署方法

1. 确保已安装 Node.js 和 npm
2. 安装依赖：
   ```
   npm install
   ```
3. 使用 Wrangler 登录 Cloudflare 账号：
   ```
   npx wrangler login
   ```
4. 部署项目：
   ```
   npm run deploy
   ```
   或者
   ```
   npx wrangler deploy
   ```

## 本地开发

```
npm run dev
```

## 使用方法

部署后，直接访问分配的 *.workers.dev 域名即可获取当前 IP 地址。