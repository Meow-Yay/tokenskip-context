---
name: tokenskip-context
description: TokenSkip-derived context compression - drop narration aggressively while pinning load-bearing tokens verbatim (paths with line numbers, signatures, exact error strings, exact numbers, decisions plus rationale, user intent quotes). Use when asked to save tokens, when a long or bulk-reading task threatens the context budget, when compressing or pruning context, or when choosing a lean/light versus deep compression level. Complements token-smart: that skill governs what to read, this one governs what survives.
---

# TokenSkip Context

Port TokenSkip's compression rule from chain-of-thought generation to agent context. Source of the rule: `TokenSkip: Controllable Chain-of-Thought Compression in LLMs` (EMNLP 2025, arXiv 2502.12067), whose compression call is:

```python
llm_lingua.compress_prompt(cot_output, rate=compression_ratio,
                           force_tokens=['Step', ':'],
                           force_reserve_digit=True,
                           drop_consecutive=True)
```

Compress hard on narrative; never compress on the units that carry the load. That single asymmetry is the whole pack.

## The force-token list — these survive verbatim

1. File paths with line numbers, e.g. `lib/hooks.ts:347` — never a bare filename.
2. Function, class, and type signatures, plus the one critical line that encodes the logic.
3. Exact error strings and stack-trace lines (the literal text, so they stay greppable).
4. Exact numbers: versions, config keys, thresholds, sizes, timings, counts.
5. Decisions **and their rationale** — "chose X over Y because Z"; the "because" is load-bearing.
6. User intent: short quotes only with their message ref (`m00132`), otherwise paraphrase. Never present a remembered phrase as a verbatim quote.

Also keep open objectives carried forward, one line each, naming each still-open request with its ref.

## What is droppable

- Thinking narration, routine progress reports, re-stated conclusions.
- Exploration output: search hits, tool dumps, dead-ends. Keep one line of the lesson ("tried X, failed because Y").
- Repeated reads of the same file or image once the fact is captured.
- Verbose command output. Keep the exit code and the error line; drop the rest.
- Status checks (`git status`, `ls`) once state is known.

## Selectable intensity (选装)

| Level | Use when | Effect |
|---|---|---|
| `light` | short turns, sensitive or correctness-critical work | drop narration only; keep all evidence |
| `balanced` | default | drop narration, duplicate reads, and verbose logs |
| `deep` | bulk research, long multi-step runs | also collapse exploration to one-line lessons; push bulk reading to a subagent and keep only its conclusion |

Take the level from the user's wording. When none is named, use `balanced`. Never raise the level silently, and never lower the quality of a required deliverable to save tokens.

## Ingestion discipline — where the real cost usually is

TokenSkip compresses tokens the model writes. In an agent loop the bill is often dominated by tokens *read*. Apply the same force-token rule upstream:

- grep or search before reading; never read a whole file to find one fact.
- Carry `offset`/`limit` on large reads and stop once the fact is found.
- An image already transcribed by a vision tool is not opened again.
- Large fetches spill to a file — grep the spill instead of re-reading it.
- Delegate multi-file or multi-page reading to a subagent; only its conclusion returns to the main context.

## Limits — state these honestly

- This is a prompt-side rule. It changes behavior, not weights. TokenSkip's headline figure (40% fewer reasoning tokens at under 0.4% accuracy loss on GSM8K) came from LoRA fine-tuning and **cannot** be promised here. No token-saving percentage is established by these instructions.
- This pack is opt-in. A `SKILL.md` is discoverable, not auto-loaded; it runs when explicitly invoked or when the host injects it. Setting `allow_implicit_invocation: false` in `agents/openai.yaml` keeps it off until asked for.
- Required deliverables, requested artifacts, citations, and verification steps are never trimmed. Trim commentary, not the result.
