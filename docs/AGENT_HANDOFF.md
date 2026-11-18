# Genbun / YOMUYOMU 项目交接

> 更新日期：2026-11-07（日本时间）。面向接手开发的 agent。
> 代码基线：`1158f815615d4d9009c3e60d31d76525b02ef895`。
> 本文介绍源码位置、实现情况、验证证据、运行方式与后续工作；不包含完整源码、密钥或生产数据。

## 1. 先读这段

Genbun 是面向中文使用者的日文原文精读 Web 应用，主要定位为 N2–N1 学习者，兼容 N3 过渡。内部仓库名、包名和部分文档仍叫 YOMUYOMU。

核心流程是：导入日文文本 / EPUB → 分页阅读 → 难词标注和点词查义 → 选句中文解释 → 收藏生词 → 到期复习。

当前处于“核心功能已有，需要改善细节和稳定性”的阶段。用户的重点是查看现有 App、改善各个细节，避免扩功能和重写架构。现有代码具备上述功能，不等于所有流程都已通过真实环境验收。

虽然本机父目录叫「YOMUYOMU APP（iOS）」，本次交接的实际工程是 **Next.js + Python 后端的 Web 应用**。不要按目录名将其当成原生 iOS / Swift / React Native 工程。

## 2. 源码、GitHub 与分支

| 项目 | 当前事实 |
| --- | --- |
| 真正的本地 Git 仓库 | `/Users/jidashuang/Documents/YOMUYOMU APP（iOS）/yomuyomu` |
| GitHub 仓库 | https://github.com/Jidashuang/YOMUYOMU-2 |
| 主版本 | `main`，2026-11-07 远端核验为 `1158f81` |
| 当前本地工作分支 | `feat/positioning-validation-pivot`，同为 `1158f81` |
| 两个远端分支关系 | `main` 与 `feat/positioning-validation-pivot` 的完整提交 SHA 相同 |
| 本文写入前的工作区 | 干净，无未提交代码变更 |
| 本文件 | 本轮新建；没有为此文件执行提交或推送，不要假定 GitHub 已包含它 |

最近整理完成的提交：

- `a6d9910`：阅读位置保存 / 恢复、阅读进度与导航。
- `a0f7683`：词典、中文解释、导入处理及相关测试。
- `5285488`：阅读器标注、偏好与操作细节，以及此前建设方案。
- `1158f81`：合并远端已有的 20 个后续提交，保留 Gemini 接入和响应字段归一化等工作。

### 已经明确的分支决策

**用户明确废弃 `codex/security-hardening`，不要合入。** 该分支包含旧计费 / 认证增强等内容，目前仍保留在本地及 GitHub 以供追溯，未删除。保留分支不代表功能已经启用，也不代表允许重新启用方案。

另有两个历史 worktree，不属于本次运行的主版本：

- `codex/ui-polish`：`f9cd287`，位于仓库内 `.worktrees/codex/ui-polish`。
- `codex/query-cache-optimization`：`7de0825`，位于 `~/.config/superpowers/worktrees/yomuyomu/codex/query-cache-optimization`。

父目录曾有一个没有提交、没有远端的空 `.git`，已改名保留为 `/Users/jidashuang/Documents/YOMUYOMU APP（iOS）/.git-parent-backup-20261105`。真正工程的 `.git` 没有被移走。父目录还可能有 Blitz / Teenybase / Cloudflare 模板残留，不要拿它们作为本工程架构依据。

## 3. 架构与源码导览

```text
浏览器（Next.js / React）
  ├─ API :8000（FastAPI）
  │    ├─ PostgreSQL（常规部署；当前本地预览使用 SQLite）
  │    ├─ Redis :6379（解释 / 词义缓存）
  │    ├─ NLP :8001（FastAPI / Sudachi / JMdict）
  │    └─ 模型服务、中文维基词典 / Wikimedia MinT 等外部来源
  └─ 部分功能直接连接 NLP :8001
```

技术栈：Next.js 16.1.6、React 18、TypeScript、Tailwind CSS、TanStack Query、Zustand；Python FastAPI、SQLAlchemy、Alembic、JWT；Sudachi 分词、JMdict SQLite 词典、JLPT / 词频映射。Node 使用 npm workspaces。

以下路径均相对于真正的仓库根目录：

| 路径 | 用途 / 接手时关注点 |
| --- | --- |
| `apps/web/app/page.tsx` | 首页与产品定位 |
| `apps/web/app/library/page.tsx` | 我的书架、四本公共领域作品、文本 / EPUB 导入 |
| `apps/web/app/reader/[id]/page.tsx` | 阅读器主状态与数据请求，较集中，修改时注意回归 |
| `apps/web/app/reader/[id]/components/` | 正文、查词弹窗、AI 面板、进度、搜索、排版、主题、划线笔记 |
| `apps/web/lib/api.ts`、`env.ts` | 前端请求封装、API / NLP 地址 |
| `apps/web/lib/reading-position.ts`、`reader-paging.ts`、`reader-annotation.ts` | 阅读位置、分页和标注逻辑 |
| `apps/web/lib/auth-store.ts`、`ui-settings-store.ts` | 登录状态、阅读偏好 |
| `apps/web/app/vocab/page.tsx` | 生词管理与到期复习 |
| `apps/web/app/login/page.tsx` | 邮箱 / 密码登录注册；还存在开发阶段文案 |
| `apps/web/app/settings/page.tsx`、`pricing/page.tsx` | 设置、定价展示 |
| `apps/web/public/books/` | 《羅生門》《山月記》《檸檬》《こころ》全文资源 |
| `apps/api/app/api/routes/` | auth、articles、reader-data、vocab、ai-explanations、analytics、health |
| `apps/api/app/services/article_processing.py`、`epub_parser.py` | 正文解析、后台处理、标注与失败重试 |
| `apps/api/app/services/word_explanation_service.py` | 中文词义与用法、外部来源和缓存 |
| `apps/api/app/services/ai_provider.py`、`ai_explanation_service.py` | 模型调用、无 key 降级、结构化输出归一化、缓存与建议生词 |
| `apps/api/app/services/vocab_service.py` | 生词保存和复习相关逻辑 |
| `apps/api/app/models/entities.py` | 用户、文章、段落、token、划线、生词、解释、进度、产品事件模型 |
| `apps/api/app/core/config.py`、`db/session.py` | 环境配置与数据库连接 |
| `apps/api/alembic/versions/` | 数据库迁移，当前最新文件为 `20260605_0009_annotation_status.py` |
| `services/nlp/app/` | 分词、归一化、难度与查词；入口 `main.py` |
| `services/nlp/data/` | JLPT / 词频表和本机词典数据；`jmdict.sqlite` 不进 Git |
| `packages/shared-types/src/contracts.ts` | 前后端 TypeScript 契约；改接口时一起检查 Python schema |
| `packages/ui/` | 共用 UI 组件 |
| `apps/web/e2e/`、`apps/api/tests/`、`services/nlp/tests/` | 浏览器、API、NLP 测试 |
| `docker-compose.yml`、`docker-compose.gcp-vm.yml`、`infra/` | 容器与部署配置 |
| `scripts/gcp-vm-*.sh`、`docs/deploy-gcp-vm.md` | GCP 单机部署与管理说明 |

## 4. 已经实现了什么

| 功能 | 代码中的能力 | 当前验证边界 |
| --- | --- | --- |
| 账号 | 邮箱注册 / 登录、JWT、当前用户查询 | 11 月 7 日本地注册后进入书架成功；不是生产账号验证 |
| 内容导入 | 粘贴文本、base64 EPUB、后台处理、分页、删除、重试标注 | 本地从公共书架导入《羅生門》并打开成功；未在本轮完整复测任意 EPUB |
| 阅读器 | 每页请求 18 个 block；滚动 / 左右翻页；进度保存恢复 | 本地实际显示全文分页、正文和分词；本轮未逐项验收所有手势与恢复场景 |
| 难词辅助 | N3+ / N2+ / N1 标注、振假名与偏好持久化 | 本地正文显示标注；等级准确率未做系统评测 |
| 点词查义 | JMdict、中文释义、用法、来源、词频 / JLPT 等字段 | 实点「下人」返回中文释义；NLP 查询「日本語」返回真实词条 |
| 选句解释 | 翻译、直译、语法、逐词拆解、省略、语气、例句、替代表达、建议生词 | 代码与自动测试存在；当前本地未验收正式模型生成效果 |
| 划线与搜索 | 划线、笔记、正文搜索、文章内查找 | 实现存在，本轮未逐项 UI 回归 |
| 生词学习 | 加词、状态 new / learning / known、到期复习、CSV / JSON 导出 | 实现及相关测试存在，本轮未实测跨日复习 |
| 阅读外观 | 明暗主题、字体大小、行距、宽度、移动端底部工具栏 | 实现存在，尚未完成多设备视觉验收 |
| 统计 | 今日查询 / 加词 / AI 次数、产品事件与统计接口 | 不能据此声称已有真实用户增长或营收 |

**商业化尚未完成**：定价页虽然写着 Pro ¥39 / 月，但按钮为 `mailto:`，不是结账。当前主版本没有可用的 Stripe 订阅闭环；不要把付费文案、额度文案当成已实现行为。

## 5. 本地运行现状：这是交接重点

> **2026-11-07 更新（环境已迁移）**：旧目录依赖读取卡住的原因已查明——`~/Documents` 开了 iCloud 同步，大量文件被换出到云端（`node_modules` 抽样 3000 个文件中 2251 个为 dataless），读取时要先下载。工程已复制到 `~/Developer/yomuyomu`（不在同步目录），**此后以该目录为准**。服务统一用 `scripts/dev-local.sh start|stop|status|restart` 启停，数据库与日志在 `~/.genbun/`。下文第 5 节关于 `/tmp` 运行快照的描述已过时。旧目录 `~/Documents/YOMUYOMU APP（iOS）/yomuyomu` 未删除，仅作备份，不要再在里面开发。

2026-11-07 为了让用户查看 App，建立了一套独立的本地预览。目前检查结果：

| 服务 | 地址 | 当前结果 |
| --- | --- | --- |
| Web | http://localhost:3001/ | 首页与 `/library` HTTP 200，浏览器实际可见 |
| API | http://127.0.0.1:8000/health | `status=ok`，database / redis 均 ok |
| NLP | http://127.0.0.1:8001/health | `status=ok`，真实查词可用 |
| Redis | `127.0.0.1:6379` | 本轮安装并启动；仅监听本机，当前不保存缓存到磁盘 |

### 源码与运行副本不同

- **应修改和提交的源码**：`/Users/jidashuang/Documents/YOMUYOMU APP（iOS）/yomuyomu`。
- **当前正在运行的代码快照**：`/tmp/yomuyomu-runtime.XXyjOa`，由 `git archive HEAD` 导出，同一基线提交，再运行 `npm ci` 和安装 Python 依赖。
- **新 Python 环境**：`/tmp/yomuyomu-runtime.XXyjOa/.venv-local`，由 `uv` 建立。
- **当前 API 数据库**：`/tmp/yomuyomu-preview.PPNzWk/preview-local.db`。
- **原本本机数据库的备份**：`/tmp/yomuyomu-preview.PPNzWk/preview.db`；这份没有作为当前 API 数据库运行。
- **当前使用的真实词典**：`/Users/jidashuang/Documents/YOMUYOMU APP（iOS）/yomuyomu/services/nlp/data/jmdict.sqlite`，约 257 MB，Git 不包含它。

修改原仓库不会自动更新 `/tmp` 副本。下一位 agent 开始改 UI 时，必须明确当前服务器使用哪个目录，并同步相关改动或重新从正式源码启动，避免“代码改了，页面没变化”。不要把修改只留在临时副本里。

`/tmp` 不是长期存储位置；系统清理或重启后可能消失。运行进程也没有注册成开机服务。用户若开始导入自己的重要内容，应先安排持久保存，不要把临时库当成正式数据。

### 为什么重新建立环境

旧仓库的 `node_modules` 和 Python 虚拟环境在启动时长时间停留于读取依赖文件；进程采样显示文件读取等待。重新安装到临时目录后，网页与 NLP 可以启动。**已确认重建环境解决了此次启动问题；旧目录读取异常的操作系统层原因尚未查明**，不要擅自认定为 iCloud、硬盘故障或应用业务代码错误。

原数据库 `apps/api/dev_api.db` 有旧数据，但 schema 缺少当前文章字段；没有直接修改它。当前预览库按最新模型单独建表，初始化时使用了仅对该本地建表过程生效的 JSONB → SQLite JSON 编译适配，未修改仓库模型，也未把 SQLite 宣称为已验收的正式部署方案。

本地新环境通过 requirements 的版本范围安装依赖，未实现 Python 精确版本锁定。本轮能跑通，不代表与此前部署服务器的每个依赖版本相同。

### 本地数据与模型边界

- 当前库使用本地预览账号，已导入《羅生門》。它不是以前线上账号 / 阅读记录的恢复结果。
- 用户表示原网站“到期后无法打开”；本轮没有核实到期具体原因、恢复云端服务或执行新部署。
- 代码默认 `LLM_PROVIDER=gemini`，含 GCP 身份调用与字段归一化；配置中的模型名称字符串不证明账号有权限或模型当前可调用。
- **当前本地启动覆盖为 `LLM_PROVIDER=openai`，未配置付费 API key，走无 key 的翻译 / 规则降级路径。** 中文词义和降级解释仍可能依赖外网，不是完全离线 AI。
- 当前未验证正式 Gemini / OpenAI 解释效果、生产计费、账号云同步或旧线上数据恢复。
- 不要把任何真实密钥、访问令牌或账户密码写入本文、提交记录或前端代码。

### 接手时如何恢复当前预览

先访问以上 health 地址；服务仍在时直接使用，避免再起一套占用相同端口。

如果临时目录仍在、服务已停，可按下列方式在不同终端启动。以下是当前成功环境的复现说明，不是已经提交的统一启动脚本。

每个需要用到路径的终端先设置：

```bash
GENBUN_REPO='/Users/jidashuang/Documents/YOMUYOMU APP（iOS）/yomuyomu'
GENBUN_RUNTIME='/tmp/yomuyomu-runtime.XXyjOa'
```

1. 缓存服务：

```bash
redis-server --bind 127.0.0.1 --port 6379 --save '' --appendonly no
```

2. NLP：

```bash
cd "$GENBUN_RUNTIME"
JMDICT_DB_PATH="$GENBUN_REPO/services/nlp/data/jmdict.sqlite" \
API_CORS_ORIGINS=http://localhost:3001 \
.venv-local/bin/uvicorn app.main:app --app-dir services/nlp \
  --host 127.0.0.1 --port 8001 --ws none --loop asyncio --http h11
```

3. API（前提：当前预览数据库还存在，且 schema 与代码一致）：

```bash
cd "$GENBUN_RUNTIME/apps/api"
export DATABASE_URL='sqlite:////tmp/yomuyomu-preview.PPNzWk/preview-local.db'
export REDIS_URL='redis://127.0.0.1:6379/0'
export NLP_SERVICE_URL='http://localhost:8001'
export API_CORS_ORIGINS='http://localhost:3001'
export LLM_PROVIDER='openai'
export JWT_SECRET="$(openssl rand -hex 32)"
../../.venv-local/bin/uvicorn app.main:app \
  --host 127.0.0.1 --port 8000 --ws none --loop asyncio --http h11
```

重新生成 JWT secret 会使已有浏览器登录令牌失效，需要重新登录。本段不复用旧密钥。临时数据库丢失时不要直接执行此命令并认为它会建表；需重新建立本地数据，或按正式 PostgreSQL + Alembic 流程初始化。

4. Web：

```bash
cd "$GENBUN_RUNTIME"
npm run dev --workspace @yomuyomu/web -- \
  --hostname 127.0.0.1 --port 3001 --disable-source-maps
```

若临时目录已不存在，应从正式源码重新建立依赖和数据环境。常规 PostgreSQL 部署参考 README 和 `docs/deploy-gcp-vm.md`，但这些文档仍有旧内容，需对照代码检查。不要为了照搬 README 覆盖现有环境文件或数据库。

## 6. 验证证据

下表于 **2026-11-07** 在上述运行快照和新依赖环境中实际重跑：

| 检查 | 结果 |
| --- | --- |
| `npm run typecheck:web` | 通过 |
| `npm run test --workspace @yomuyomu/web` | 4 个测试文件，21 项通过 |
| `PYTHONPATH=. .venv-local/bin/pytest -q apps/api/tests` | 58 项通过，1 个依赖弃用警告 |
| `PYTHONPATH=. .venv-local/bin/pytest -q services/nlp/tests` | 13 项通过，6 个 Sudachi 接口弃用警告 |
| 浏览器手工操作 | 首页 → 注册 → 书架 → 导入《羅生門》→ 阅读器 → 点词得到中文释义 |
| 全栈 health | Web HTTP 200；API database / redis ok；NLP ok |

没有在本轮执行完整 Playwright 回归、生产构建、生产部署、真实付费模型端到端测试、真实 iPhone 验收或跨日复习验收。不要将上表描述为“全部功能通过端到端测试”。

测试提示：

- 从仓库根目录运行 Python 测试时保留 `PYTHONPATH=.`；导入脚本测试依赖根目录的 `scripts` 包路径。
- API 与 NLP 都使用名为 `app` 的 Python 包，分别启动、分别运行 pytest，避免合并到同一 Python 进程造成导入冲突。
- `playwright.config.ts` 使用 `127.0.0.1:3100`，会尝试启动另一份 Web，不能以为它直接使用当前 3001 页面。
- 当前没有 `.github/` CI。`next.config.ts` 设置了 `ignoreBuildErrors: true`，因此单独构建成功不能代替类型检查。
- Python 依赖范围较宽，新环境出现 FastAPI / Starlette 与 Sudachi 弃用警告，本轮没有扩范围修复。

## 7. 待完善与建议顺序

以下是建议，不是已经完成或获准自动扩展的功能清单。

1. **先把本地开发固定下来**：可重复启动、长期数据位置、依赖版本和明确日志；保证修改的是实际运行代码，避免继续依赖 `/tmp` 快照。
2. **打磨核心阅读流程**：窄屏查词弹窗、正文与工具区布局、加载 / 错误 / 重试反馈、长 EPUB 导入和标注失败恢复、阅读位置保存与跨次恢复。先复现再改，不要只凭旧方案判断。
3. **清理面向用户的开发文案**：解释面板仍显示 provider / model / prompt / 缓存等调试信息；登录页仍写 Phase 1 / JWT；设置页中英文混用。
4. **补工程护栏和文档一致性**：统一检查入口、CI、移动端回归、契约文档与 README。接口变化优先对照实际 Python schema 和 `contracts.ts`。
5. **之后再讨论账号与商业化**：邮箱验证、找回密码、账号删除、AI 额度 / 成本控制、真实支付、内容许可说明，均不能以现有 UI 或废弃分支代替验收。旧 billing 分支的废弃决定继续有效。

用户尚未授权本轮实现以上完整建设计划。交接后先确认下一项具体工作，避免把文档建议自动变成全量开发任务。

## 8. 历史文档怎么用

- `docs/2026-11-05-detail-hardening-plan.md` 是整理前的盘点：其中“31 / 41 个文件未提交”“main 落后”“billing 未决策”“父目录空 .git”等结论已被本次会话后续工作更新。**其中建议合入 billing 的部分已经被用户废弃决定覆盖。** 不要按旧文档重新执行收口或合并。
- `docs/site-improvement-plan.md`、`docs/superpowers/plans/2026-05-19-positioning-validation-pivot.md` 提供历史设计意图，不是当前完成度证明。
- `docs/api-contract.md`、README 有旧产品名 / 阶段信息，不能优先于实际代码。
- `docs/validation/first-10-customers.md` 是验证计划，不证明已获得 10 位用户或付款。

事实冲突时，先检查最新代码、Git 状态与运行结果，再结合用户在本交接中明确的决策；不要把历史计划写成完成事项。

## 9. 用户的协作要求

- 中文、简洁、用普通语言解释每一步的目的和对用户的影响；用户明确要求按开发初学者来沟通。
- 用户要求执行时直接完成必要工作，不要反复询问已经授权的事情。
- “如无必要，勿增实体”：最小必要修改，不顺手重构、不新增未要求的功能，不写一套新的架构。
- 开始非简单工作前，阅读 `/Users/jidashuang/.codex/rules/codex-experience-playbook.md`；并遵守适用的 AGENTS 规则和 `/Users/jidashuang/.codex/RTK.md`。
- 保留既有改动。Git 提交说明包含问题描述、复现路径或修复思路；不得因为交接文档建议就自动推送、部署、删除历史分支或修改生产数据。
- 网页任务需实际打开和操作，以用户可感知结果验收；明确说明未验证项，不能用模拟结果冒充真实能力。

## 10. 给接手 agent 的第一条任务说明

> 请先读完本文件，以正式源码仓库为修改对象。核对 Git 与本地 Web / API / NLP / Redis 状态，注意运行代码目前是临时快照。项目已有导入、阅读、词典、解释、生词和复习框架，当前目标是逐项改善细节。不要重做架构，不要合并已废弃的 `codex/security-hardening`。先向用户简要说明你确认的现状，然后根据用户指定的细节任务继续实现和验证。源码、自动测试、手工验证、线上状态和历史计划必须分开陈述。
