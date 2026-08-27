-- Admins with the shared pool already allowed were stuck on ai_mode=off,
-- so the in-app agent looked broken until they toggled it in Settings.
update hub_users
set ai_mode = 'shared'
where allow_global_ai = true
  and ai_mode = 'off'
  and byok_key_hint is null;
