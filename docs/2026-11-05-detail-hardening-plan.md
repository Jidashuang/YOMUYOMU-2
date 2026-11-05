# Genbun 建设方案：从「功能齐」到「细节稳」

> 日期：2026-11-05
> 盘点对象：`yomuyomu/`（当前分支 `feat/positioning-validation-pivot`，HEAD `b2f24f0`）
> 性质：现状盘点 + 分阶段建设方案。本文只做判断与排期，不代表任何任务已完成。

---

## 0. 结论

框架和主链路已经成型：导入 → 阅读 → 点词查义 → 划句 AI 拆解 → 生词本 → 到期复习 → 使用统计，前后端和 NLP 三层都跑得起来。当前的主要矛盾不是「缺功能」，而是三件事：

1. **有价值的半成品散落在未合并分支上**。计费、限流、隐私页、认证增强这一整条线（85 个文件）停在 `codex/security-hardening`，主线里根本没有，定价页目前是一个 `mailto:` 链接。
2. **一批细节还卡在「未提交」状态**。工作区有 31 个文件、+823/−106 的改动没落盘，跨 api / web / nlp 三层，其中含 3 个新文件。
3. **缺工程护栏**。没有 CI，测试入口分散在 4 个地方，契约文档和实际类型已经不一致，移动端没有回归手段。

所以下一阶段的关键词是「收口 + 护栏 + 细节」，不是「加功能」。

---

## 1. 现状盘点

### 1.1 已完成（已提交，可运行）

**后端 API**（FastAPI，8 组路由）

- `auth`：注册 / 登录 / me，JWT 鉴权。
- `articles`：创建（text / epub base64）、分页详情、删除、重试标注、后台处理 worker。
- `reader-data`：查词代理、划线高亮与笔记、阅读进度、快捷加词。
- `vocab`：生词增删改、状态切换、复习、CSV / JSON 导出。
- `ai-explanations`：生成、历史、缓存。
- `analytics`：产品事件、今日统计、快照。

**NLP 服务**（`services/nlp`，独立 FastAPI）

- Sudachi 分词 + 归一化回原形；JMDict sqlite 词典；JLPT 与词频映射；难度分级。
- 依赖注入式懒加载，词典库缺失时可降级到 seed fallback。

**Web**（Next.js App Router，7 个页面）

- 首页（Genbun 工作台叙事）、书架、阅读器、生词、定价、设置、登录。
- 阅读器已具备：按 18 个 block 分页拉取、scroll / swipe 两种翻页、`N3+ / N2+ / N1` 难度标注、furigana、点词弹窗、划句 AI 中文拆解、划线高亮与笔记、加入生词本、阅读进度保存与恢复、排版面板、主题面板、文内搜索面板、移动端底部工具栏。
- 品牌定位已从「中文母语 N4-N2」切到「N2-N1 主力 + N3 过渡」，公共领域书架内置 4 本青空文庫作品。

**运维**

- 单机 GCP VM 方案：`docker-compose.gcp-vm.yml` + Caddy + 5 个运维脚本（preflight / bootstrap / create-and-deploy / manage / budget-alert）。

**已通过验证（2026-11-05 实测）**

| 检查 | 结果 |
| --- | --- |
| Web 单测 `vitest run` | 21 项通过 |
| Web 类型检查 `tsc --noEmit` | 无错误 |
| API 测试 `pytest apps/api/tests` | 56 项通过 |
| NLP 测试 `pytest services/nlp/tests` | 12 项通过 + 1 个文件收集失败（见 P0-2） |
| E2E `playwright test` | 未运行（需要 Postgres / Redis / NLP / API 全栈） |

### 1.2 进行中（工作区未提交，31 文件 +823/−106）

集中在「阅读器细节」和「中文释义」两条线：

- Web：`TokenPopup` 改为优先展示中文释义与译文，来源标注（中文维基词典 CC BY-SA 4.0）；`ExplanationPanel` 增加生成中状态与「已收录」抑制；新增 `lib/reading-position.ts`（阅读位置记忆）；`ui-settings-store` 持久化标注档位与 furigana，测量宽度上限 60→84，并带 v1 迁移；`top-nav` 增加到期复习角标。
- API：新增 `services/word_explanation_service.py`（抓取中文维基词典释义 + HTML 解析 + Redis 缓存）；`ai_provider` 新增无 Key 兜底 provider（Wikimedia 机器翻译 + 规则化词义）；`articles.py` 新增正文搜索接口 `GET /articles/{id}/search`；`reader_data` 在查词链路里合并中文释义。
- NLP：JMDict 导入增强；词典库改只读 URI 连接（`mode=ro&immutable=1`）；去掉「Common xx usage.」这类占位式用法说明。

### 1.3 已做但未合入主线（本次盘点最重要的发现）

四条并行分支，全部从 `main`（`7de0825`，2026-03-18）分出，而当前主线已经在这之上走了 80 个提交：

| 分支 | 最新提交 | 日期 | 规模 | 内容 |
| --- | --- | --- | --- | --- |
| `codex/security-hardening` | `af9d252` | 2026-04-15 | 85 文件 / +4465 −652 | Stripe 计费、限流、认证增强（含 382 行 auth 测试）、隐私页、定价升级按钮、api-contract 大幅补全、4 份计划文档 |
| `codex/ui-polish` | `f9cd287` | 2026-03-25 | 4 提交 | 公共页与导入面打磨、认证错误诊断、生词流程 |
| `codex/query-cache-optimization` | `7de0825` | — | 0 提交独有 | 内容已被主线覆盖，可删 |
| 主线 `feat/positioning-validation-pivot` | `b2f24f0` | 2026-06-05 | 80 提交 | Genbun 改名、公共书架、阅读器工作台、EPUB 修复 |

直接后果：当前主线**没有** `billing.py`、`stripe_billing.py`、`rate_limit.py`、`privacy` 页，认证只有 register / login / me。定价页写的是 Pro ¥39，但 CTA 是 `mailto:hello@genbun.app`——没有任何真实购买或额度约束。

### 1.4 未开始

计费与配额、账号完整性（邮箱验证 / 找回密码 / 注销）、CI 与监控、内容管线、移动端回归。

---

## 2. 细节问题清单

### P0 — 阻断与回归风险

1. **分支分叉未决策（最高优先）**：`codex/security-hardening` 的 85 个文件既没合并也没声明废弃。放着不管，后续每做一次认证或定价改动都会撞车。
2. **NLP 测试收集失败**：`pytest -q services/nlp/tests` 报 `ModuleNotFoundError: No module named 'scripts'`（`services/nlp/tests/test_import_jmdict.py:7` 导入 `scripts.import_jmdict.import_jmdict`）。加 `PYTHONPATH=.` 即可通过，说明缺 pytest 的 `pythonpath` 或根级 `conftest.py`。
3. **未提交 WIP 体量大且跨层**：31 文件同时改 api / web / nlp，长时间悬空会导致冲突和「测过的到底是不是线上那份」的问题。

### P1 — 用户可见的粗糙处

4. **调试信息泄漏到界面**：`ExplanationPanel.tsx` 的 `ProviderFooter` 对终端用户展示 `provider / model / prompt version / 命中缓存 / 错误类型`。定位验证计划里已明确要求去掉这类开发者文案。
5. **定价页没有真实购买路径**：Pro 卡片只有 `mailto:`，没有结账、没有额度限制、没有订阅状态。
6. **查词弹窗定位方式脆弱**：`TokenPopup` 用点击坐标 + `fixed` + 固定 340px 宽，靠近视口边缘或窄屏时会溢出；`ReaderShell` 顶部注释也记着这条约束（祖先元素不能有 transform）。
7. **来源许可只在单条弹窗标注**：中文维基词典（CC BY-SA 4.0）与青空文庫的来源说明，缺站点级「内容来源与许可」页面。
8. **账号体系不完整**：没有邮箱验证、找回密码、注销账号。
9. **长文导入仍是最大体验风险**：历史提交里大量 `fix: speed up epub annotation batches`、`reduce epub processing load`、`paginate reader and retry heavy annotation chunks`，说明大文件标注是已知痛点；`public/books/kokoro.txt` 就有 473KB。

### P2 — 工程护栏

10. **没有 CI**：`.github/` 不存在；`codex/ui-polish` 上还留着一条 `chore: defer GitHub Actions workflow due token scope`。
11. **测试入口分散**：`package.json` 只有 `test:e2e` 和 `typecheck:web`；API / NLP 测试要手动激活各自 venv；`scripts/test_phase45.sh` 只管两个目录。
12. **契约漂移**：`packages/shared-types/src/contracts.ts` 的 `LookupEntry` 已增加 `meaning_zh / usage_zh / example_ja / example_zh / source_name / source_url`，`docs/api-contract.md` 仍是 Phase 6 版本，且标题还写 `Yomuyomu`。
13. **README 与产品定位不一致**：仍是「Yomuyomu MVP Monorepo (Phase 6)」和 N4-N2 叙事。
14. **根目录残留无关模板**：仓库根 `CLAUDE.md` 写的是 React Native / Blitz / Teenybase 指南，还有 `teenybase.ts`、`wrangler.toml`、`src-backend/worker.ts`，与实际 Next.js + FastAPI 工程完全不符；根 `.git` 没有任何提交。后续 agent 会被误导。
15. **worktree 位置分散**：本地 `.worktrees/` 和 `~/.config/superpowers/worktrees/` 各有一个，容易漏掉。

### P3 — 体验与增长

16. **E2E 没有移动端覆盖**：4 个 spec 共 1111 行，全部在桌面视口，无截图基线、无移动端 viewport。
17. **无 AI 成本上限**：只有 `OPENAI_MODEL` 配置，没有用户级 quota 或费用熔断。
18. **复习闭环偏薄**：只有 `new / learning / known` 与到期时间，没有复习历史、连续天数、每日目标。
19. **内容只有 4 本**：全量 `.txt` 手工内置，没有可重复的入库管线。

---

## 3. 建设方案

### 阶段 0：收口（0.5–1 天）

目标：让「当前主干」成为唯一事实来源。

| 任务 | 动作 | 验收 |
| --- | --- | --- |
| T0.1 落盘当前 WIP | 拆成 2–3 个提交：① 中文释义与来源（api + web）② 阅读器细节（位置记忆 / furigana / 标注持久化）③ JMDict 导入与只读连接 | `git status` 干净；4 项测试复跑全绿 |
| T0.2 修 NLP 测试收集 | 根级 `conftest.py` 或 `pytest` 的 `pythonpath = ["."]` | 不带 `PYTHONPATH` 直接跑 `pytest -q services/nlp/tests` 全绿 |
| T0.3 决策 billing 分支 | 二选一：把 `af9d252` 中计费 / 限流 / 隐私拆成补丁合回主线；或写一页说明明确废弃并归档分支 | 有一条明确结论落在文档里，不再悬空 |
| T0.4 清干净仓库根 | 删除或移走 `CLAUDE.md` / `teenybase.ts` / `wrangler.toml` / `src-backend/worker.ts`，补一份贴合本工程的根级指引 | 新 agent 读完不会以为这是 React Native 项目 |

### 阶段 1：工程护栏（1–2 天）

目标：任何改动都能在 10 分钟内自证没坏。

| 任务 | 动作 | 验收 |
| --- | --- | --- |
| T1.1 统一测试入口 | 加 `scripts/check.sh`：web 单测 + typecheck + api pytest + nlp pytest，一条命令跑完 | 冷启动跑通，失败时有明确输出 |
| T1.2 加 CI | GitHub Actions：Node 20 + Python 3.13，跑 T1.1 的四个目标；E2E 作为可选 job（需 Postgres / Redis service） | PR 上自动出结果 |
| T1.3 契约对账 | 补全 `docs/api-contract.md`（含全部 `LookupEntry` 字段与新搜索接口），并加一个最小校验脚本比对 pydantic schema 与 TS 类型 | 文档与类型一致，漂移可被脚本发现 |
| T1.4 文档对账 | README 改成 Genbun 定位，去掉 Phase 6 / N4-N2 / Yomuyomu 表述 | 对外文案与产品定位一致 |

### 阶段 2：产品细节（约 1 周）

目标：把「读完一段」这条动作在真实设备上做顺。

| 任务 | 动作 | 验收 |
| --- | --- | --- |
| T2.1 阅读器打磨 | 去掉 `ExplanationPanel` 调试信息（或收进隐藏开关）；弹窗改为按视口夹取的定位；长文导入显示进度与预计剩余；标注失败可重试且不阻塞正文 | 桌面与手机各走通一遍导入 → 阅读 → 查词 → AI → 加词 |
| T2.2 复习闭环加强 | 到期区置顶、显示复习历史与连续天数、复习后立刻给出下一次到期时间 | 加词后第二天能看到它出现在到期区 |
| T2.3 账号体系 | 邮箱验证、找回密码、注销账号（含数据删除） | 三个流程各自端到端可用 |
| T2.4 成本与配额 | 用户级 AI 调用计数 + 超限降级到无 Key 兜底 provider | 达到阈值后仍可用，不再触发付费调用 |
| T2.5 来源与合规页 | 站点级「内容来源与许可」页，列出青空文庫与中文维基词典（CC BY-SA 4.0） | 页面可从页脚与弹窗进入 |

### 阶段 3：上线与增长（2–4 周）

| 任务 | 动作 | 验收 |
| --- | --- | --- |
| T3.1 计费落地 | 把 `codex/security-hardening` 的 Stripe 方案合回主线，替换 `mailto:` CTA | 可完成一次真实订阅，额度随方案变化 |
| T3.2 监控告警 | 结构化日志 + 错误上报 + 关键路径（导入成功率、AI 失败率）看板 | 线上异常可在当天发现 |
| T3.3 内容管线 | 青空文庫可重复入库脚本，带来源与许可元数据 | 新增一本书不需要手改代码 |
| T3.4 种子用户闭环 | 按 `docs/validation/first-10-customers.md` 跑 10 场，采集行为数据而非好评 | 产出 10 份可用结论，决定继续或转向 |

---

## 4. 执行顺序与边界

顺序：T0.1 → T0.2 → T0.3 → T1.1 → T1.2 → T2.1 → T2.2 → 其余按反馈排。

判断依据很简单：**先让「导入一段真实日文并读完」在手机上稳定、快速、无错，再谈新功能**。在这条链路没跑顺之前，扩功能只会放大问题。

这段时间不做的事：

- 不重写后端架构，不引入新框架。
- 不做聊天式 AI 老师、语法课程、社交、游戏化。
- 不做 Anki 深度集成（等用户明确提第二次再说）。
- 不做移动原生 App。
- 不在验证期结束前扩大内容库。
