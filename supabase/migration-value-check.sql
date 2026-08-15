-- Confirms `value` exists and is seeded (it was added as a stub in
-- migration-apis.sql, this just re-confirms it's populated before the
-- dynamic value system in v9 starts adjusting it).
update artists set value = cost where value is null;
