# GitHub Environments / Secrets 模板

## 1. Environments

- `staging`
- `production`

建议：

- `production` 开启 Required reviewers
- `main` 分支开启 required status checks

## 2. Staging Secrets

- `STAGING_SSH_HOST`
- `STAGING_SSH_USER`
- `STAGING_SSH_KEY`
- `STAGING_SSH_PORT`，默认 `22`
- `STAGING_DEPLOY_PATH`，默认 `/opt/aikepu/releases`
- `STAGING_API_BASE_URL`，示例 `https://staging-api.example.com`
- `STAGING_DEPLOY_COMMAND`，可选，自定义覆盖标准部署
- `STAGING_ROLLBACK_COMMAND`，可选，自定义覆盖标准回滚

## 3. Production Secrets

- `PROD_SSH_HOST`
- `PROD_SSH_USER`
- `PROD_SSH_KEY`
- `PROD_SSH_PORT`，默认 `22`
- `PROD_DEPLOY_PATH`，默认 `/opt/aikepu/releases`
- `PROD_API_BASE_URL`，示例 `https://api.example.com`
- `PROD_DEPLOY_COMMAND`，可选，自定义覆盖标准部署
- `PROD_ROLLBACK_COMMAND`，可选，自定义覆盖标准回滚

## 4. 服务器目录约定

- `${DEPLOY_PATH}/<tag-or-sha>/`
- `${DEPLOY_PATH}/current`
- `${DEPLOY_PATH}/hooks/before-deploy.sh`
- `${DEPLOY_PATH}/hooks/after-deploy.sh`
- `${DEPLOY_PATH}/hooks/before-rollback.sh`
- `${DEPLOY_PATH}/hooks/after-rollback.sh`

## 5. 推荐最小配置

- staging：
  - `STAGING_SSH_HOST`
  - `STAGING_SSH_USER`
  - `STAGING_SSH_KEY`
  - `STAGING_API_BASE_URL`
- production：
  - `PROD_SSH_HOST`
  - `PROD_SSH_USER`
  - `PROD_SSH_KEY`
  - `PROD_API_BASE_URL`

## 6. Branch Protection 建议

- 保护分支：`main`
- 必需 checks：
  - `checks`
  - `api-regression`
- 建议：
  - Require pull request reviews
  - Require branches to be up to date before merging
