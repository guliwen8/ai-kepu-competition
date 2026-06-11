#!/usr/bin/env bash
set -euo pipefail

# 用法：
# 1) 拷贝到 ${DEPLOY_PATH}/hooks/after-deploy.sh
# 2) 按实际 PM2 应用名修改下面两个变量

API_PM2_NAME="${API_PM2_NAME:-aikepu-api}"
ADMIN_PM2_NAME="${ADMIN_PM2_NAME:-aikepu-admin-web}"

pm2 restart "$API_PM2_NAME"
pm2 restart "$ADMIN_PM2_NAME"
pm2 save

echo "ok: pm2 apps restarted"

