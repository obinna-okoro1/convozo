export const environment = {
  production: false,
  supabase: {
    url: 'http://127.0.0.1:54321',
    anonKey: 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH',
  },
  flutterwave: {
    publicKey: 'FLWPUBK_TEST-59b8e970316ea0e268a6b2208343cd52-X',
  },
  platformFeePercentage: 22, // 22% platform fee (processing fees come out of platform's cut, creator gets 78% flat)
  // VAPID key for push notifications (generate with: npx web-push generate-vapid-keys)
  vapidPublicKey:
    'BMUmrPyd-C_NfHyTfq2PzEiTFTYdRtx1tSFQM7eknpvNHmYdU3-i9AiEQzVVie3T8bh4iVO8L9zEivHsibsv3pc',
};
