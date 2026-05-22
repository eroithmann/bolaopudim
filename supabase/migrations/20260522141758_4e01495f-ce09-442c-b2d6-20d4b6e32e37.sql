-- Remove test user "Teste Edu" entirely and zero Eduardo Roithmann's predictions
DELETE FROM public.predictions WHERE user_id IN ('1d95485d-fe57-4be5-b1a3-90fa7d294c13','dd213666-7945-4ecd-9b40-67e6aaa6ddaa');
DELETE FROM public.user_roles WHERE user_id = '1d95485d-fe57-4be5-b1a3-90fa7d294c13';
DELETE FROM public.profiles WHERE user_id = '1d95485d-fe57-4be5-b1a3-90fa7d294c13';
DELETE FROM auth.users WHERE id = '1d95485d-fe57-4be5-b1a3-90fa7d294c13';