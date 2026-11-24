# tokenskip-context

English · [中文](README.md)

[![CI](https://github.com/Meow-Yay/tokenskip-context/actions/workflows/ci.yml/badge.svg)](https://github.com/Meow-Yay/tokenskip-context/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](package.json)

A port of **TokenSkip**'s compression rule from chain-of-thought generation to **agent context management**: drop narration hard, keep every load-bearing unit verbatim.

The short version — the asymmetry *is* the whole thing. Throw away narration, progress reports and duplicate reads aggressively; never touch the six categories below, because once context loses them every later turn is quietly pretending to know.

---

## Where this comes from

The rule is taken from **TokenSkip: Controllable Chain-of-Thought Compression in LLMs** (EMNLP 2025 Long Paper, arXiv:2502.12067).

The compression call in that work is one line:

```python
llm_lingua.compress_prompt(cot_output, rate=compression_ratio,
                           force_tokens=['Step', ':'],
                           force_reserve_digit=True,
                           drop_consecutive=True)
```

`force_tokens` / `force_reserve_digit` mean one thing: **some units cannot be cut.** This project translates that into executable rules for an agent's context.

TokenSkip compresses with a LoRA-tuned model. **This project ports only the retention principle — no training involved** — so its headline reduction does not transfer. We measured our own on a real session; see [docs/measurement.md](docs/measurement.md).

## The six force tokens — these survive verbatim

1. **File paths with line numbers**, e.g. `lib/hooks.ts:347` — never a bare filename.
2. **Function, class and type signatures**, plus the one critical line that encodes the logic.
3. **Exact error strings and stack-trace lines** (literal text, so they stay greppable).
4. **Exact numbers**: versions, config keys, thresholds, sizes, timings, counts.
5. **Decisions and their rationale** — "chose X over Y because Z"; the *because* is load-bearing.
6. **User intent**: short quotes only with their message ref (e.g. `m00132`), otherwise paraphrase. Never present a remembered phrase as a verbatim quote.

Also kept: still-open objectives, one line each, naming each open request with its ref.

## What is droppable

- Thinking narration, routine progress reports, re-stated conclusions.
- Exploration output: search hits, tool dumps, dead ends. Keep one line of the lesson ("tried X, failed because Y").
- Repeated reads of the same file or image once the fact is captured.
- Verbose command output: keep the exit code and the error line, drop the rest.
- Status checks (`git status`, `ls`) once the state is known.

## Three intensities (default `balanced`)

| Level | Use when | Effect |
|---|---|---|
| `light` | short turns, sensitive or correctness-critical work | drop narration only; keep all evidence |
| `balanced` | default | drop narration, duplicate reads and verbose logs |
| `deep` | bulk research, long multi-step runs | also collapse exploration to one-line lessons; push bulk reading to a subagent and keep only its conclusion |

Take the level from the user's wording. When none is named, use `balanced`. Never raise the level silently, and never lower the quality of a required deliverable to save tokens.

## Ingestion discipline — the bill is usually in what you read

TokenSkip compresses tokens the model *writes*. In an agent loop the cost is often dominated by tokens *read*. Apply the same force-token rule upstream:

- grep before read; never read a whole file to find one fact.
- Carry `offset` / `limit` on large reads and stop once the fact is found.
- An image already transcribed by a vision tool is not opened again.
- Large fetches spill to a file — grep the spill instead of re-reading it.
- Delegate multi-file or multi-page reading to a subagent; only its conclusion returns.

## Measured (counterfactual replay, not an A/B)

On one real harness transcript (178 requests, 19.07M input tokens, 94.2% cache hit rate) the retention rules were replayed line by line to count what would survive:

| Surface | Reduction | Basis |
|---|---|---|
| Raw content | −20.5% | 719,532 → 571,949 tok |
| 　└ tool output | −78.2% | 167,310 → 36,487 |
| 　└ assistant narration | −77.6% | 21,604 → 4,842 |
| Token bill | −15.0% | 19.07M → 16.20M (2.87M saved) |
| Untouchable | 73.7% | deliverable writes + tool schemas + user turns |

Three caveats that must be read together with that table:

- It is a **replay of the rules over an existing transcript**, not a controlled run with the skill on versus off.
- The bill shrinks less than the content because of **fixed per-request overhead** (tool schemas 24,294 tok + system prompt 4,190 tok) that no retention rule can touch.
- The estimator (ASCII ≈ 4 chars/token, CJK ≈ 1 char/token) was calibrated against the harness's own `shadowedTokenCount`: 1.024× deviation over 18 samples.

Method and reproduction commands: [docs/measurement.md](docs/measurement.md). Raw sheet: [docs/assets/token-savings-measurement.xlsx](docs/assets/token-savings-measurement.xlsx).

## Install

### As a dsh-codex-skills plugin skill

```bash
git clone https://github.com/Meow-Yay/tokenskip-context.git
cd tokenskip-context
node install.mjs              # install (or refresh)
node install.mjs --status     # report only
node install.mjs --uninstall  # remove (source kept)
```

- Skill source = this repository root (`SKILL.md` + `agents/openai.yaml`).
- Target plugin root = `<DSH_HOME>/plugins/dsh-codex-skills`, override with `DSH_CODEX_SKILLS_PLUGIN`.
- Install does exactly two things: copy the bundle and insert/update its `catalog.json` entry. The plugin's watcher reloads on change — **no restart needed**.

### As a skill for any other host

`SKILL.md` is the whole content. Copy it (and `agents/openai.yaml` if your host reads it) into that host's skills directory. `install.mjs` is specific to the dsh-codex-skills catalog and is not needed elsewhere.

## How "opt-in" is implemented

| Layer | Mechanism | Note |
|---|---|---|
| Never fires on its own | `agents/openai.yaml` → `policy.allow_implicit_invocation: false` | Runs only when asked for. `install.mjs` mirrors that value into the catalog's `modelInvocable` |
| Removable as a unit | `install.mjs --uninstall` | One command; the repo copy stays |
| Selectable intensity | `light` / `balanced` / `deep` | Unnamed means `balanced`; the skill forbids silent escalation |

## Honest limits

- **This is a prompt-side rule. It does not change weights.** It changes behavior, not the model. Any "saves X%" figure needs a scenario attached; this repo publishes exactly one session's measurement.
- **The skill does not switch itself on.** `allow_implicit_invocation: false` means nothing happens until it is invoked. Forcing it on every turn is a host-level instruction (e.g. `AGENTS.md`) — a different thing.
- **Deliverables, citations and verification steps are never trimmed.** Trim commentary, not the result.
- **The savings may land on reading, not writing.** If your host already truncates tool output, this skill's marginal gain will be smaller than the table above.

## Layout

```
tokenskip-context/
├── SKILL.md                     # the skill itself — edit here, no reinstall needed
├── agents/openai.yaml           # host metadata + the opt-in switch
├── install.mjs                  # portable install / uninstall / status
├── docs/
│   ├── measurement.md           # method, numbers, reproduction
│   └── assets/token-savings-measurement.xlsx
├── bench/                       # analysis scripts (sanitized; input is any transcript)
├── test/install.test.mjs        # installer tests (node --test, no deps)
└── .github/workflows/ci.yml     # syntax check + install smoke test
```

## Develop

```bash
node --test                               # 11 tests, no DSH install required
node bench/bench.mjs <transcript.jsonl>   # replay the retention rules on any transcript
```

Everything under `bench/` reads "one JSON record per line" transcripts and is not tied to a specific product; missing fields degrade to coarser buckets instead of crashing.

## License

[MIT](LICENSE) © 2026 Meow-Yay.

No code or data from the paper's authors is included here; the rules are an independent restatement of a published principle. If you use the idea in academic work, cite the original paper:

> TokenSkip: Controllable Chain-of-Thought Compression in LLMs. EMNLP 2025. arXiv:2502.12067.
