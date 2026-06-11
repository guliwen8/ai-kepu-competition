#!/usr/bin/env bash
set -euo pipefail

# 用法：
# 1) 拷贝到 ${DEPLOY_PATH}/hooks/after-deploy.sh
# 2) 按实际服务名修改下面两个变量

API_SERVICE_NAME="${API_SERVICE_NAME:-aikepu-api}"
ADMIN_SERVICE_NAME="${ADMIN_SERVICE_NAME:-aikepu-admin-web}"

sudo systemctl restart "$API_SERVICE_NAME"
sudo systemctl restart "$ADMIN_SERVICE_NAME"

sudo systemctl is-active --quiet "$API_SERVICE_NAME"
sudo systemctl is-active --quiet "$ADMIN_SERVICE_NAME"

echo "ok: systemd services restarted"

