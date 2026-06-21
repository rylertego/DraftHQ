## Known Lint Issues

- `react-hooks/set-state-in-effect` currently fails in `src/app/draft/page.tsx` and `src/app/teams/page.tsx`.
- Cause: localStorage hydration uses synchronous state updates inside `useEffect`.
- Plan: resolve during Supabase migration by replacing localStorage hydration with backend-backed loading state.