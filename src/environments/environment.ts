export const environment = {
  production: false,
  supabase: {
    url: 'http://127.0.0.1:54321',
    anonKey: 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH',
  },
  platformFeePercentage: 22, // 22% platform fee (processing fees come out of platform's cut, creator gets 78% flat)
  // VAPID key for push notifications (generate with: npx web-push generate-vapid-keys)
  vapidPublicKey:
    'BNHIas9VtDE6pey_L3jtM_VHXKyxq4IHIMgi3JJx-BTHTVSbMGptvEt0kRe_NLTtXzUIbelYlOa3yd5xgj0yew',
};
