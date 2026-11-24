# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0] — 2026-11-24

First public release.

### Added

- `SKILL.md` — the `tokenskip-context` skill: the six force-token categories that survive verbatim, the droppable set, the `light` / `balanced` / `deep` intensities, and the ingestion discipline for the read side of the bill.
- `agents/openai.yaml` — host interface metadata with `policy.allow_implicit_invocation: false`, so the pack runs only when asked for.
- `install.mjs` — portable install / `--status` / `--uninstall` against a dsh-codex-skills plugin root, overridable with `DSH_CODEX_SKILLS_PLUGIN`. It edits the plugin's `catalog.json` surgically instead of rebuilding the skills tree, and mirrors `allow_implicit_invocation` into the catalog's `modelInvocable` flag.
- `docs/measurement.md` + `docs/assets/token-savings-measurement.xlsx` — method, numbers and reproduction for the reference session (178 requests, 19.07M input tokens): −20.5% raw content, −15.0% token bill, 73.7% untouchable.
- `bench/` — the sanitized analysis scripts: transcript decoding, per-category before/after replay, estimator calibration against `shadowedTokenCount`, ingestion concentration, and bill conversion.
- `test/` — 11 tests over the installer and the pack's own invariants (identity, opt-in switch, documented figures). Zero runtime dependencies.
- CI: syntax check, tests on Node 18/20/22/24, an installer smoke test against a throwaway plugin root, and a relative-link check for the docs.

### Notes

- The measured reduction is a **counterfactual replay** over one real transcript, not a controlled on/off experiment. See the caveats in `docs/measurement.md`.
- This project ports the retention principle of TokenSkip (EMNLP 2025, arXiv:2502.12067). It contains no code or data from that work and makes no claim about its fine-tuning-based reduction figures.
