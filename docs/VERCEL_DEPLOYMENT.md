# Vercel Deployment Guide / Vercel 部署指南

## English

### Quick Deploy
Click the button below to deploy Narratium.ai to Vercel with one click:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/YOUR_USERNAME/Narratium.ai)

### Manual Deployment Steps

1. **Fork the Repository**
   - Fork this repository to your GitHub account

2. **Import to Vercel**
   - Go to [vercel.com](https://vercel.com)
   - Click "New Project"
   - Import your forked repository

3. **Configure Build Settings**
   - Framework Preset: `Next.js`
   - Build Command: `pnpm build` (or leave default)
   - Output Directory: `.next` (default)

4. **Environment Variables** (if needed)
   - Add any required environment variables in Vercel dashboard
   - Common variables: API keys, database URLs, etc.

5. **Deploy**
   - Click "Deploy"
   - Your app will be available at `your-project.vercel.app`

### Auto-Deploy
Once connected, Vercel will automatically deploy when you push to your main branch.

**Please make sure to review the LICENSE file for fork permissions and restrictions, especially regarding brand elements and generated content.**

### Support

For deployment issues, check [Vercel Documentation](https://vercel.com/docs)

---

## 中文

### 快速部署
点击下方按钮一键部署 Narratium.ai 到 Vercel：

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/YOUR_USERNAME/Narratium.ai)

### 手动部署步骤

1. **Fork 仓库**
   - 将此仓库 Fork 到您的 GitHub 账户

2. **导入到 Vercel**
   - 访问 [vercel.com](https://vercel.com)
   - 点击 "New Project"
   - 导入您 Fork 的仓库

3. **配置构建设置**
   - 框架预设：`Next.js`
   - 构建命令：`pnpm build`（或保持默认）
   - 输出目录：`.next`（默认）

4. **环境变量**（如需要）
   - 在 Vercel 控制台添加所需的环境变量
   - 常见变量：API 密钥、数据库 URL 等

5. **部署**
   - 点击 "Deploy"
   - 您的应用将在 `your-project.vercel.app` 可用

### 自动部署
连接后，每当您推送到主分支时，Vercel 将自动部署。

**请务必查阅 LICENSE 文件，了解 fork 权限和限制，特别是关于品牌元素和生成内容的相关规定。**

### 支持

部署问题请查看 [Vercel 文档](https://vercel.com/docs) 