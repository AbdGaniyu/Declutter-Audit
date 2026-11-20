begin;
create extension if not exists pgtap with schema extensions;
select plan(3);
insert into auth.users (id, phone, phone_confirmed_at, aud, role) values
  ('00000000-0000-0000-0000-0000000000a1', '2348000000801', now(), 'authenticated', 'authenticated');
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
select lives_ok($$ insert into public.push_subscriptions (user_id, endpoint, keys)
                   values (auth.uid(), 'https://fcm.googleapis.com/fcm/send/abc', '{}') $$, 'FCM endpoint accepted');
select throws_ok($$ insert into public.push_subscriptions (user_id, endpoint, keys)
                    values (auth.uid(), 'http://169.254.169.254/latest', '{}') $$, '23514', null, 'internal URL rejected');
select throws_ok($$ insert into public.push_subscriptions (user_id, endpoint, keys)
                    values (auth.uid(), 'https://evil.example/fcm.googleapis.com/x', '{}') $$, '23514', null, 'lookalike host rejected');
select * from finish();
rollback;
