# bench

实测脚本。全部**只读输入**，不做任何网络请求，不写除显式指定之外的文件。

输入统一为「每行一条 JSON 记录」的 transcript（jsonl，或先用 `decode_session.mjs` 从 zstd 会话文件解出来）。

```bash
node bench/bench.mjs        <transcript.jsonl>   # 逐类统计 before/after（主脚本）
node bench/calibrate.mjs    <transcript.jsonl>   # 用 shadowedTokenCount 校准估计器
node bench/ingestion.mjs    <transcript.jsonl>   # 工具输出集中在哪几个调用上
node bench/billing.mjs                            # 把内容削减折算成账单（无参数，读内置实测值）
node bench/decode_session.mjs <session> [out.jsonl]  # zstd 会话 → jsonl
node bench/probe_session.mjs  <session>           # 记录形状/字段频率
node bench/probe_header.mjs   <transcript.jsonl>  # 固定开销（request/header、system prompt）
node bench/profile.mjs        <transcript.jsonl>  # 各类记录的字节占比
python bench/make_xlsx.py                         # 出 docs/assets 里的表（需 openpyxl）
python bench/readback_xlsx.py                     # 回读表，核对内容
```

## 字段约定

脚本认这些字段，缺了会退化而不是崩：

| 字段 | 用途 | 缺省行为 |
|---|---|---|
| `type` | 记录分类（`assistant/message` 等） | 归入 `harness bookkeeping (other)` |
| `data.message.content[].type` | `text` / `tool-call` | 跳过该 part |
| `data.meta.operation` | 区分 `read` 与普通命令 | 当普通 `output` |
| `data.message.toolCallId` | 关联 call 与 result | 放弃关联，记 `?` |
| `data.shadowedTokenCount` + `shadowedSeqs` | 估计器校准 | `calibrate.mjs` 无样本时直接报 0 |

## 这些数字的边界

`bench.mjs` 的 `KEEP_PATTERNS` 是 `SKILL.md` 自然语言规则的正则化近似，不是规则本身。它测的是**规则的作用面上界**；真实执行时由模型判断，边界情况可能比脚本更好或更差。详见 [docs/measurement.md](../docs/measurement.md)。
