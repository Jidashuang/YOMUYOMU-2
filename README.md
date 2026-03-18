# Yomuyomu MVP Monorepo (Phase 6)

Yomuyomu 是面向日语学习者的 Web SaaS 阅读器 MVP。

本阶段目标：把产品从“阅读工具”推进到“学习闭环”。

## Phase 6 已完成

1. 词汇增强
- NLP lookup 返回稳定字段：`lemma`、`reading`、`pos`、`meanings`、`primary_meaning`、`jlpt_level`、`frequency_band`、`example_sentence`、`usage_note`。
- lookup 排序优化：`lemma > surface > reading`，并结合常用度、sense 优先级、读音匹配进行排序。
- 支持常见动词/形容词变形后的回原形命中（Sudachi 归一化 + 规则回退）。
- 支持 JLPT / 词频导入脚本（`scripts/import_jlpt`、`scripts/import_frequency`）生成标准映射文件。

2. AI explanation 升级
- 结构化输出新增：`why_this_expression`、`alternative_expressions`。
- 语法点稳定化：在模型结果后做 deterministic grammar merge。
- 保留 Redis 缓存；provider 异常时支持 parse/schema 修复与安全兜底。

3. 句子到 vocab 自动提取
- AI explanation 返回 `suggested_vocab`（content words）。
- Reader explanation 面板支持“一键加入生词本”。

4. 生词本复习闭环
- `vocab_items` 增加 `status`：`new | learning | known`。
- `GET /vocab?bucket=today_new`：今日新增。
- `GET /vocab?bucket=unmastered`：未掌握（new/learning）。
- `GET /vocab?bucket=review_due`：到期复习（new/learning 且到期）。
- `PATCH /vocab/{id}/status`：切换掌握状态。
- `PATCH /vocab/{id}/review`：按复习结果推进调度（`fail|pass`）。

5. 学习统计展示
- 新增 `GET /analytics/today`。
- 前端 Vocab 页展示：今日 lookup 数、vocab 添加数、AI 使用数。

## 目录结构

```text
yomuyomu/
  apps/
    web/
    api/
  services/
    nlp/
  packages/
    shared-types/
    ui/
  scripts/
    import_jmdict/
    eval_ai/
    analytics_snapshots/
  docs/
    api-contract.md
  docker-compose.yml
```

## 环境要求

- Node.js 20+
- Python 3.11+
- PostgreSQL 15+
- Redis 7+

## 本地启动（推荐）

1. 复制环境变量

```bash
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp services/nlp/.env.example services/nlp/.env
```

2. 准备数据库与缓存

```bash
docker compose up -d postgres redis
```

3. 初始化 API 数据库（迁移）

```bash
source .venv-api313/bin/activate
cd apps/api
alembic upgrade head
cd ../..
```

4. 启动 NLP 服务（8001）

```bash
source .venv-nlp313/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload --app-dir services/nlp
```

5. 启动 API 服务（8000）

```bash
source .venv-api313/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload --app-dir apps/api
```

6. 启动 Web（3001）

```bash
npm run dev --workspace @yomuyomu/web -- --port 3001
```

7. 首次登录
- 打开 `http://localhost:3001/login`
- 切换到“注册”，使用任意 email/password 注册（默认表单：`demo@example.com / password123`）
- 注册成功后自动跳转 Library

如果你本机 `3000` 已被其他项目占用，请保持 `--port 3001`。

## EPUB 导入说明

- 创建文章时可使用 `source_type=epub`。
- `raw_content` 传入 base64 EPUB 内容，支持：
  - `base64:<payload>`
  - `data:application/epub+zip;base64,<payload>`

## JMDict 导入（生产路径）

```bash
python scripts/import_jmdict/import_jmdict.py \
  --input /path/to/JMdict_e.xml \
  --output services/nlp/data/jmdict.sqlite
```

说明：
- 默认查询路径是 JMDict sqlite。
- seed lookup 仅用于开发 fallback（`ALLOW_SEED_FALLBACK=true` 时启用）。
- AI provider 默认是 `openai`；若未配置 `OPENAI_API_KEY`，服务会自动降级为 `mock`。

## 测试与校验

```bash
source .venv-nlp313/bin/activate && pytest -q services/nlp/tests
source .venv-api313/bin/activate && pytest -q apps/api/tests
npm run typecheck:web
npm run build:web
```

## 真实 OpenAI 评测（可选）

配置 `.env`：
- `LLM_PROVIDER=openai`
- `OPENAI_API_KEY=<your-key>`

执行：

```bash
python scripts/eval_ai/run_eval.py \
  --mode api \
  --api-base-url http://localhost:8000 \
  --email eval@example.com \
  --password password123 \
  --expect-provider openai \
  --input scripts/eval_ai/samples.jsonl \
  --output scripts/eval_ai/results/eval_results_openai.json
```

## 关键接口文档

详见 [docs/api-contract.md](docs/api-contract.md)。
