<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Rules
- All backend access goes through the `CaseAdapter` in src/lib/api; the demo adapter is active until a JWT provider exists — never call real endpoints with invented credentials.
- Case data lives only in React memory (src/lib/case-store.tsx); never persist answers or attachments to localStorage (sensitive data).
- The front-end never computes eligibility, legal income or appeal deadlines; it only displays what the backend returns.
- The examples route owns its isolated, in-memory conversation → guided questions → panel demonstration; reuse existing demo analyses without changing the main case workflow.
- New investigations use a separate authenticated CloudCaseAdapter behind the CaseAdapter contract for private threads, messages, profiles, attachments, and model transport; keep the original demo adapter and case workflow unchanged.
- Legal modules must expose explicit release status and refuse complete analysis until executable rules, traceable sources, and legal validation exist; model-generated interview text is never a legal engine result.
- New private interviews persist a story-collection phase with explicit completion before question dispatch; legacy facts default to completed intake to preserve ongoing interviews.
- New document metadata and objects are written only by authenticated server handlers after ownership and byte-signature validation; old attachments remain separate to avoid overwriting existing data.
- Gemini REST calls stay in server-only helpers with runtime model discovery intersected with a server allowlist; provider privacy approval and owner consent gate all private generation.
- Extraction is administrative-only, append-once per document hash, and always unverified; legal rules stay versioned and unreleased without human approval and executable tests.
- Retention runs through managed authenticated scheduling and deletes only new documents with owner-selected expiry; no expiry is invented for legacy files, conversations or profiles.
- Payment integration must remain absent until managed payments are enabled; detailed legal results and PDF remain unavailable in the meantime.
- Interval union is a neutral deterministic server-side calculation primitive only; never expose it as contribution time, carência or eligibility before a versioned legal module is validated.
- Legal engine in src/lib/legal stays preliminary: results never claim eligibility while any cited source lacks hash verification and human review.
