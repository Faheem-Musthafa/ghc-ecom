update public.categories
set name = 'Oil Bottles'
where lower(trim(name)) = 'oil bottilie';

update public.categories
set name = 'Tea Sets'
where lower(trim(name)) = 'teaset';

update public.categories
set name = 'Cutlery Sets'
where lower(trim(name)) = 'cutlery set';

update public.categories
set name = 'Canister Sets'
where lower(trim(name)) = 'canister set';

update public.categories
set name = 'Canister Sets — 7 Pieces'
where lower(trim(name)) = 'canisters set 7 pcs';

update public.categories
set is_published = false
where lower(trim(name)) in ('test', 'testing', 'demo', 'sample', 'untitled');
