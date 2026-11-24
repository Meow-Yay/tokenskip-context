# tokenskip-context

[English](README.en.md) · 中文

[![CI](https://github.com/Meow-Yay/tokenskip-context/actions/workflows/ci.yml/badge.svg)](https://github.com/Meow-Yay/tokenskip-context/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](package.json)

把 **TokenSkip** 的压缩规则从 chain-of-thought 生成搬到 **agent 上下文管理**：叙述狠砍，承重单元逐字留。

一句话版本——**压缩的不对称性就是全部**：可以 aggressively 丢掉叙述、进度播报、重复读取，但六类东西一个字符都不许动，因为上下文一旦丢掉它们，后面的每一轮都在假装知道。

---

## 来源

规则来自论文 **TokenSkip: Controllable Chain-of-Thought Compression in LLMs**（EMNLP 2025 Long Paper，arXiv:2502.12067）。

论文里的压缩调用是这一行：

```python
llm_lingua.compress_prompt(cot_output, rate=compression_ratio,
                           force_tokens=['Step', ':'],
                           force_reserve_digit=True,
                           drop_consecutive=True)
```

其中 `force_tokens` / `force_reserve_digit` 的含义是：**有些单元不能剪**。本项目把这层含义翻译成 agent 上下文的可执行规则。

论文的方法依赖 LoRA 微调压缩 CoT；**本项目只移植它的"保留清单"原则，不涉及任何训练**，所以论文的 token 削减比例在这里不成立——我们自己在真实会话上量了一遍，口径与结果见 [docs/measurement.md](docs/measurement.md)。

## 六类逐字保留（force tokens）

1. **带行号的文件路径**，如 `lib/hooks.ts:347` —— 不要出现裸文件名。
2. **函数 / 类 / 类型签名**，以及承载逻辑的那一行关键代码。
3. **错误原文与堆栈行**（逐字保留，保证还能 grep）。
4. **精确数值**：版本号、配置键、阈值、尺寸、耗时、计数。
5. **决策及其理由**——"选 X 不选 Y，因为 Z"，那个"因为"是承重的。
6. **用户意图**：只留带消息 ref 的短引用（如 `m00132`）；没有 ref 就改写，绝不把记忆里的话伪装成原文引用。

另外保留：仍处于打开状态的待办，一行一条，各自带 ref。

## 可丢弃

- 思考叙述、例行进度播报、重复的结论。
- 探索输出：搜索命中、工具倾倒、死路。只留一行教训（"试过 X，失败因为 Y"）。
- 同一文件 / 同一图片的重复读取（事实已经拿到之后）。
- 冗长命令输出：留退出码和错误行，其余丢掉。
- 状态已知之后的 `git status` / `ls`。

## 三档强度（默认 balanced）

| 档位 | 用在 | 效果 |
|---|---|---|
| `light` | 短回合、敏感或正确性关键的工作 | 只砍叙述，证据全留 |
| `balanced` | 默认 | 砍叙述 + 重复读取 + 冗长日志 |
| `deep` | 批量调研、长多步任务 | 探索也压成一行教训；批量阅读外派 subagent，只回收结论 |

档位从用户的措辞里取；没点名就用 `balanced`。**不得擅自升档，也不得为了省 token 降低交付质量。**

## 摄入纪律：真正的账单通常在"读"而不是"写"

TokenSkip 压缩的是模型*写*的 token。在 agent 循环里，开销常常由*读*主导。同一套 force-token 规则向上游用一遍：

- 先 grep 再 read，绝不为了找一个事实读整个文件。
- 大文件带 `offset` / `limit`，找到就停。
- 已经被视觉工具转写过的图片不再打开。
- 抓取结果溢出到文件后，grep 那个文件，不要重读。
- 多文件 / 多页阅读外派 subagent，主上下文只回收它的结论。

## 实测（反事实重放，不是 A/B）

在一份真实的 harness 会话记录（178 次请求 / 19.07M 输入 token / 94.2% 缓存命中）上，把上面这套保留规则套回去，逐类统计"哪些 token 会被留下"：

| 口径 | 削减 | 依据 |
|---|---|---|
| 原始内容 | −20.5% | 719,532 → 571,949 tok |
| 　└ 工具输出 | −78.2% | 167,310 → 36,487 |
| 　└ assistant 叙述 | −77.6% | 21,604 → 4,842 |
| Token 账单 | −15.0% | 19.07M → 16.20M（省 2.87M） |
| 不可触及部分 | 73.7% | 交付写入 + 工具 schema + 用户话语 |

三条必须一起读的限定：

- 这是**同一份真实 transcript 上套规则的重放**，不是"开着 skill 和关着 skill 跑同一任务"的 A/B 实验。
- 账单从 −20.5% 缩到 −15.0%，差额是**每请求固定开销**（工具 schema 24,294 tok + 系统提示 4,190 tok），任何保留规则都碰不到。
- 估算器（ASCII ≈ 4 字符/token，CJK ≈ 1 字符/token）经 harness 的 `shadowedTokenCount` 校准，18 样本上偏差 1.024×。

方法与复现命令见 [docs/measurement.md](docs/measurement.md)；原始表见 [docs/assets/token-savings-measurement.xlsx](docs/assets/token-savings-measurement.xlsx)。

## 安装

### 作为 dsh-codex-skills 插件的 skill

```bash
git clone https://github.com/Meow-Yay/tokenskip-context.git
cd tokenskip-context
node install.mjs              # 安装 / 刷新
node install.mjs --status     # 只看状态，不改动
node install.mjs --uninstall  # 卸载（源文件保留）
```

- 技能源目录 = 本仓库根目录（`SKILL.md` + `agents/openai.yaml`）。
- 目标插件根 = `<DSH_HOME>/plugins/dsh-codex-skills`，可用 `DSH_CODEX_SKILLS_PLUGIN` 覆盖。
- 安装只做两件事：复制 bundle、在 `catalog.json` 里插入/更新条目。插件的 watcher 监听 `catalog.json`，**无需重启**即生效。

### 作为任意宿主的 skill

只有 `SKILL.md` 是内容本体。把它（连同 `agents/openai.yaml`，如果你的宿主认这个文件）放进宿主的 skills 目录即可；`install.mjs` 只针对 dsh-codex-skills 的 catalog 机制，别的宿主用不上它。

## 选装的三层实现

| 层 | 机制 | 说明 |
|---|---|---|
| 不自动触发 | `agents/openai.yaml` → `policy.allow_implicit_invocation: false` | 只在点名调用时跑。`install.mjs` 会把这个值同步成 catalog 的 `modelInvocable` |
| 可整体装卸 | `install.mjs --uninstall` | 一条命令移除，仓库源文件保留 |
| 档位可选 | `light` / `balanced` / `deep` | 不指定默认 `balanced`，skill 正文写明不得擅自升档 |

## 诚实边界

- **这是提示词侧规则，不改权重。** 它改变行为，不改变模型。任何"省 X%"的数字都必须带场景，本项目只给上面那一份会话的实测。
- **skill 不会自动生效。** `allow_implicit_invocation: false` 意味着不点它就不跑。要每回合强制生效，得把它写进宿主的常驻指令（如 `AGENTS.md`）——那是另一件事。
- **交付物、引用、验证步骤永不裁剪。** 压的是叙述，不是结果。
- **省下的可能是"读"而不是"写"。** 如果宿主本来就会截断工具输出，本 skill 的增量收益会小于上表。

## 仓库结构

```
tokenskip-context/
├── SKILL.md                     # skill 正文（改这里即生效，无需重装）
├── agents/openai.yaml           # 宿主界面元数据 + 选装开关
├── install.mjs                  # 便携安装 / 卸载 / 状态
├── docs/
│   ├── measurement.md           # 测量口径、方法、复现
│   └── assets/token-savings-measurement.xlsx
├── bench/                       # 实测用的分析脚本（脱敏，输入是任意 transcript）
├── test/install.test.mjs        # 安装器测试（node --test，零依赖）
└── .github/workflows/ci.yml     # 语法检查 + 安装冒烟测试
```

## 开发

```bash
node --test                               # 12 项测试，无需 DSH 环境
node bench/bench.mjs <transcript.jsonl>   # 在任意 transcript 上重放保留规则
```

`bench/` 下的脚本读的都是"每行一条 JSON 记录"的 transcript，不绑定具体产品；字段缺失时会退化成更粗的分类，不会崩。

## 许可

[MIT](LICENSE) © 2026 Meow-Yay。

本仓库不包含论文作者的任何代码或数据；规则是对公开方法的原则性移植，表述与实现均为独立完成。若你在学术工作中使用本项目的思路，请引用原论文：

> TokenSkip: Controllable Chain-of-Thought Compression in LLMs. EMNLP 2025. arXiv:2502.12067.
