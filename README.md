# AI 科普大赛平台（Monorepo）

## 目录结构

- `apps/api`：后端（NestJS + Prisma + PostgreSQL + Redis）
- `apps/admin-web`：协会管理后台（Next.js）
- `apps/miniapp`：参赛端小程序（Taro）
- `packages/shared`：共享类型/常量

## 本地启动（推荐）

1. 安装依赖（由于前端依赖存在 peer 冲突，建议使用 legacy 模式）

```bash
npm install --legacy-peer-deps
```

2. 启动基础设施（需要安装 Docker）

```bash
docker compose up -d
```

3. 初始化环境变量

```bash
cp .env.example .env
```

4. 数据库迁移 & Prisma Client

```bash
npm run -w api prisma:generate
npm run -w api prisma:migrate
```

5. 启动服务

```bash
API_PORT=3001 npm run -w api dev
npm run -w admin-web dev
```

Swagger：`http://localhost:3001/docs`

## 自动化冒烟测试（替代手动 Swagger 点击）

保持后端已启动（默认 `http://localhost:3001`），在项目根目录执行：

```bash
npm run smoke
```

可通过环境变量指定：

```bash
API_BASE_URL=http://localhost:3001 SMOKE_PHONE=13900000000 npm run smoke
```

## 参赛端小程序

可用云预览调试；如需本地编译请使用 Taro 的 `dev:weapp` 等脚本。
