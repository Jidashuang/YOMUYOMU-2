#!/usr/bin/env bash
# 本地开发一键启停：Redis + NLP + API + Web，全部直接运行仓库源码。
# 用法：scripts/dev-local.sh start|stop|status|restart
# 数据与日志放在 ~/.genbun，不在仓库内，也不在 iCloud 同步目录里。
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HOME_DIR="${GENBUN_HOME:-$HOME/.genbun}"
DATA_DIR="$HOME_DIR/data"
LOG_DIR="$HOME_DIR/logs"
RUN_DIR="$HOME_DIR/run"
PY="$REPO/.venv/bin"
DB_FILE="$DATA_DIR/genbun-local.db"
WEB_PORT=3001

mkdir -p "$DATA_DIR" "$LOG_DIR" "$RUN_DIR"

# JWT 密钥只生成一次并保存，重启后浏览器登录状态不会失效
if [ ! -f "$HOME_DIR/jwt_secret" ]; then
  openssl rand -hex 32 > "$HOME_DIR/jwt_secret"
  chmod 600 "$HOME_DIR/jwt_secret"
fi

port_pid() { lsof -nP -iTCP:"$1" -sTCP:LISTEN -t 2>/dev/null | head -1 || true; }

wait_http() { # url name
  for _ in $(seq 1 60); do
    curl -fs -o /dev/null "$1" && return 0
    sleep 1
  done
  echo "  ✗ $2 未能在 60 秒内就绪，查看日志：$LOG_DIR" >&2
  return 1
}

start_one() { # name port cmd...
  local name="$1" port="$2"; shift 2
  if [ -n "$(port_pid "$port")" ]; then
    echo "  - $name 已在端口 $port 运行，跳过"
    return 0
  fi
  nohup "$@" > "$LOG_DIR/$name.log" 2>&1 &
  echo $! > "$RUN_DIR/$name.pid"
  echo "  + $name 启动中（端口 $port）"
}

do_start() {
  [ -d "$REPO/node_modules" ] || { echo "缺少 node_modules，请先在仓库根目录运行 npm ci" >&2; exit 1; }
  [ -x "$PY/uvicorn" ] || { echo "缺少 .venv，请先 uv venv --python 3.13 .venv 并安装依赖" >&2; exit 1; }
  [ -f "$REPO/services/nlp/data/jmdict.sqlite" ] || echo "  ! 没找到 jmdict.sqlite，查词将不可用"
  [ -f "$DB_FILE" ] || echo "  ! 数据库 $DB_FILE 不存在，API 将无法使用已有数据"

  echo "启动服务（仓库：$REPO）"
  start_one redis 6379 redis-server --bind 127.0.0.1 --port 6379 --save '' --appendonly no

  start_one nlp 8001 env \
    JMDICT_DB_PATH="$REPO/services/nlp/data/jmdict.sqlite" \
    API_CORS_ORIGINS="http://localhost:$WEB_PORT" \
    "$PY/uvicorn" app.main:app --app-dir "$REPO/services/nlp" \
    --host 127.0.0.1 --port 8001 --ws none --loop asyncio --http h11

  start_one api 8000 env \
    DATABASE_URL="sqlite:///$DB_FILE" \
    REDIS_URL="redis://127.0.0.1:6379/0" \
    NLP_SERVICE_URL="http://localhost:8001" \
    API_CORS_ORIGINS="http://localhost:$WEB_PORT" \
    LLM_PROVIDER="${LLM_PROVIDER:-openai}" \
    JWT_SECRET="$(cat "$HOME_DIR/jwt_secret")" \
    "$PY/uvicorn" app.main:app --app-dir "$REPO/apps/api" \
    --host 127.0.0.1 --port 8000 --ws none --loop asyncio --http h11

  start_one web "$WEB_PORT" bash -c \
    "cd '$REPO' && exec npm run dev --workspace @yomuyomu/web -- --hostname 127.0.0.1 --port $WEB_PORT --disable-source-maps"

  wait_http http://127.0.0.1:8001/health "NLP"
  wait_http http://127.0.0.1:8000/health "API"
  wait_http "http://127.0.0.1:$WEB_PORT/" "Web"
  echo "全部就绪： http://localhost:$WEB_PORT/"
}

do_stop() {
  for pair in web:$WEB_PORT api:8000 nlp:8001 redis:6379; do
    local name="${pair%%:*}" port="${pair##*:}" pid
    pid="$(port_pid "$port")"
    if [ -n "$pid" ]; then
      kill "$pid" 2>/dev/null || true
      echo "  - 已停止 $name（pid $pid）"
    fi
    rm -f "$RUN_DIR/$name.pid"
  done
}

do_status() {
  for pair in web:$WEB_PORT api:8000 nlp:8001 redis:6379; do
    local name="${pair%%:*}" port="${pair##*:}" pid
    pid="$(port_pid "$port")"
    if [ -n "$pid" ]; then
      # 显示进程所在目录，便于确认运行的是仓库源码
      echo "  ✓ $name  端口 $port  pid $pid  目录 $(lsof -a -p "$pid" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p')"
    else
      echo "  ✗ $name  端口 $port  未运行"
    fi
  done
}

case "${1:-}" in
  start) do_start ;;
  stop) do_stop ;;
  restart) do_stop; sleep 2; do_start ;;
  status) do_status ;;
  *) echo "用法：$0 start|stop|status|restart"; exit 1 ;;
esac
