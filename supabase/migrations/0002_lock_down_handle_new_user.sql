-- The signup trigger runs as table owner; no API role ever calls it directly.
-- Without this, PostgREST exposes it at /rest/v1/rpc/handle_new_user.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
