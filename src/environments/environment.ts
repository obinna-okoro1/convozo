export const environment = {
  production: false,
  supabase: {
    url: 'http://127.0.0.1:54321',
    anonKey: 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH',
  },
  stripe: {
    publishableKey: 'YOUR_STRIPE_PUBLISHABLE_KEY', // Add your Stripe test key here
  },
  platformFeePercentage: 10, // 10% platform fee
  // VAPID key for push notifications (generate with: npx web-push generate-vapid-keys)
  vapidPublicKey: 'BMUmrPyd-C_NfHyTfq2PzEiTFTYdRtx1tSFQM7eknpvNHmYdU3-i9AiEQzVVie3T8bh4iVO8L9zEivHsibsv3pc',
};
