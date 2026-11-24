# Contributing

Thanks for looking. This pack is deliberately small: one skill, one installer, one measurement. Keep it that way.

## What is welcome

- **Rule improvements to `SKILL.md`** — a force-token category that is missing, a droppable category that is too aggressive, a phrasing that makes a model misread the rule. Say which failure you observed, not just what you would add.
- **Measurement corrections** — if you can reproduce the numbers on a different transcript and they land materially elsewhere, that is worth an issue even without a patch.
- **Installer portability** — other hosts, other layouts. Please keep `install.mjs` zero-dependency and side-effect free apart from the plugin root it is pointed at.
- **Translations** of `README.md` / `README.en.md`.

## What is not welcome

- Anything that adds a runtime dependency, a build step, or a network call.
- Claims of a token-saving percentage without a scenario attached. This repo publishes exactly one measurement and labels it as a replay; please do not add a headline number.
- Trimming the "honest limits" sections. They are the point.

## Ground rules for a patch

1. `node --test` must pass (12 tests today, zero dependencies).
2. `node --check install.mjs` and `node --check` on everything in `bench/` and `test/` must pass.
3. If you touch `install.mjs`, run the installer against a throwaway root and confirm both directions:
   ```bash
   tmp="$(mktemp -d)"; printf '{"skills":[],"stats":{}}\n' > "$tmp/catalog.json"
   DSH_CODEX_SKILLS_PLUGIN="$tmp" node install.mjs
   DSH_CODEX_SKILLS_PLUGIN="$tmp" node install.mjs --uninstall
   ```
4. If you touch the numbers, update all four places that carry them: `README.md`, `README.en.md`, `docs/measurement.md`, `bench/make_xlsx.py` — plus `docs/assets/token-savings-measurement.xlsx` (regenerate with `python bench/make_xlsx.py`). The test suite checks the docs against the sheet.
5. Keep the skill opt-in. `allow_implicit_invocation: false` is a design decision, not an oversight.
6. No personal data. Never commit a transcript, a session file, or a path that identifies someone's machine.

## Commit messages

Short imperative subject, then a body that says what failure the change prevents. "Fix X" is fine; "improve docs" is not.

## License

By contributing you agree that your contribution is licensed under the [MIT License](LICENSE).
