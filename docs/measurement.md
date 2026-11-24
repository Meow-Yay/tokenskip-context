# 测量口径与方法

这份文档说明 README 里那张表是怎么来的、能信到什么程度、以及怎么在别的会话上重跑一遍。

## 结论表

| 口径 | 削减 | 依据 |
|---|---|---|
| 原始内容 | −20.5% | 719,532 → 571,949 tok |
| 　└ 工具输出 | −78.2% | 167,310 → 36,487 tok |
| 　└ assistant 叙述 | −77.6% | 21,604 → 4,842 tok |
| Token 账单 | −15.0% | 19.07M → 16.20M（省 2.87M） |
| 不可触及部分 | 73.7% | 交付写入 + 工具 schema + 用户话语 |

基线：**178 次请求 / 19.07M 输入 token / 94.2% 缓存命中**。估计器校准偏差 **1.024×**（18 个样本）。

## 这是什么，不是什么

这是**反事实重放**：拿一份已经跑完的真实 transcript，把 `SKILL.md` 的保留规则逐行套上去，统计"如果当时就按这套规则裁剪，哪些 token 会留下"。

它不是 A/B 实验。A/B 需要"同一任务，一次开着 skill、一次关着"的两组真实运行；本测量没有做这件事，因为那需要重新跑完整任务且任务不可重复到逐 token 一致。

因此正确的读法是：**这是一份"规则作用面"的上界测量，不是"开启本 skill 后账单必然下降 15%"的因果结论。** 实际收益取决于 skill 是否被真正点名调用、宿主是否已经做过工具输出截断、以及会话的读写比例。

## 流程

```
transcript (zstd 或 jsonl)
   ↓ decode_session.mjs / probe_session.mjs      看清记录形状
   ↓ bench.mjs                                   逐类统计 before / after
   ↓ calibrate.mjs                               用 harness 自己的计数校准估计器
   ↓ billing.mjs                                 把内容削减折算成账单
   ↓ make_xlsx.py                                出表
```

### 1. 解码

harness 的会话文件是 zstd 帧拼接，`decode_session.mjs` 按 magic 切帧后逐帧解压，落成 `每行一条 JSON` 的 jsonl。`probe_session.mjs` 用来先看记录类型分布和字段形状。

### 2. 逐类统计

`bench.mjs` 按记录类型分桶，对每个可压缩的桶做两件事：

- `before` = 原文本的估计 token 数；
- `after` = 套用保留规则后的估计 token 数。

保留规则就是 `SKILL.md` 六类 force token 的正则化版本（`bench.mjs` 顶部的 `KEEP_PATTERNS`）：带 `path:line` 的行、含 error/exception/traceback 的行、堆栈帧、签名行、含"因为/决定/而不是/rather than/because"的行、`exit code`、以及未完成的 checklist 项。命中即整行保留；未命中的行按 `ratio` 参数（0.15–0.2）留一小段"上下文胶水"，模拟人在裁剪时不会只留电报表。

重复读取单独成桶：同一 `read` 结果的前 200 字符相同即判为重复，重复读取的 `after = 0`。

### 3. 估计器校准

`estTok()` 是个便宜的近似（ASCII ≈ 4 字符/token，CJK ≈ 1 字符/token）。它不能直接用来报绝对值，所以用 harness 自己在 compaction 记录里写下的 `shadowedTokenCount` 做校准：

```bash
node bench/calibrate.mjs transcript.jsonl
```

在 18 个 compaction/prune 样本上，`est(visible)` 相对真实值的比值稳定在 **1.024×**。**两边用同一个估计器算比值，所以削减比例对估计器误差不敏感**——这是这份测量能用的原因。

### 4. 账单折算

内容削减 ≠ 账单削减，因为上下文每请求都重发，而其中一大块是固定开销。`billing.mjs` 把两者分开：

```
F = 每次请求固定开销 = 工具 schema 24,294 + 系统提示 4,190 = 28,484 tok
F × 178 次请求 = 5.07M tok（占账单 26.6%，任何保留规则都碰不到）
可变部分 = 19.07M − 5.07M = 14.00M
可变部分 ×（1 − 20.5%）= 11.13M
账单 = 5.07M + 11.13M = 16.20M   → 省 2.87M = 15.0%
```

所以 README 里同时给 **−20.5%（内容）** 和 **−15.0%（账单）**：差额就是固定开销。只报前者会高估收益，只报后者会掩盖规则本身的作用面。

### 5. 出表

```bash
python bench/make_xlsx.py   # 需要 openpyxl；输出到 docs/assets/
```

## 复现你自己的一份

```bash
# 1. 拿到一份 transcript（jsonl：每行一条记录，至少含 type / data.message.content）
# 2. 直接跑
node bench/bench.mjs your-transcript.jsonl

# 3. 想校准估计器（需要记录里有 compaction/prune 与 shadowedTokenCount）
node bench/calibrate.mjs your-transcript.jsonl

# 4. 看工具输出集中在哪（决定该优先外派什么）
node bench/ingestion.mjs your-transcript.jsonl
```

脚本对字段缺失是宽容的：缺 `meta.operation` 就退化成 `output` 桶，缺 `toolCallId` 就放弃关联，不会崩。

## 已知偏差

- **估计器误差**：CJK 按 1 字符/token 估，实际在中文与英文混排下会偏 ±5%；比值场景可忽略。
- **单会话**：178 次请求、单一任务类型（长会话 + 大量工具输出）。工具输出占 23% 的会话收益会高于此，纯对话会话会低于此。
- **保留规则的实现是近似的**：`KEEP_PATTERNS` 是 `SKILL.md` 的自然语言规则的正则化近似；真实执行时由模型判断，边界行（比如不含"因为"但语义上是决策依据的行）可能比脚本表现更好。
- **没有算上游截断**：如果宿主已经对工具输出做了截断，本 skill 的增量收益会小于上表。
