# Prototype Gear Override Procedure

Prototype work is locked to `/prototype/gear/**`. In rare cases we may need to touch files outside that scope. Follow this "break-glass" checklist to keep the audit trail tight.

1. **Discuss the change** with an OWNER (`@cxchajon`) and capture the approval in the PR description.
2. **Add a temporary rule** to `/.guard/prototype-allowlist.txt` that precisely matches the additional file(s) you must touch. Keep the pattern as narrow as possible.
3. **Include an audit tag** in the commit message that lands the non-prototype change:
   ```
   [ALLOW-NON-PROTOTYPE:<reason>]
   ```
   Replace `<reason>` with a short justification (e.g., `[ALLOW-NON-PROTOTYPE:fixing deploy pipeline]`).
4. **Run the full guardrail suite** locally (pre-commit, pre-push) to confirm only the intended files are permitted.
5. **Submit the PR** and request OWNER review. Mention the override in the PR summary and link back to this file.
6. **Immediately revert** the temporary allowlist entry in a follow-up commit once the change has merged.

> ⚠️ Overrides are for urgent fixes only. If your work can wait, keep it inside the prototype directory until the guardrail phase is lifted.
