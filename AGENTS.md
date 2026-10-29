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

- This remix starts with an empty PostgreSQL migration journal and the unchanged blank Drizzle schema placeholder; create future schema changes through the migration tool rather than replaying the source project's copied history.

- Store free-form machine specifications and avatar storage paths on profiles; the catalog remains independent so personal setups do not require catalog entries.
- Keep profile photos in a private bucket with public signed-read access and owner-scoped writes; shareable profiles need photos without allowing others to change them.
