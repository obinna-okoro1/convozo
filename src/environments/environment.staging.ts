// Staging environment — points to the Convozo STAGING Supabase project.
// Used when building with: ng build --configuration=staging
// Deployed automatically by CI when pushing to the `develop` branch.
//
// To get these values:
//   1. Create a new Supabase project at supabase.com (free — you can have 2)
//   2. Copy the project URL and anon key from Project Settings → API
//   3. Use the Flutterwave TEST keys (not live) for staging
export const environment = {
  production: false,
  supabase: {
    url: 'https://fzltvpbyhnvviuzanyha.supabase.co',
    anonKey:
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ6bHR2cGJ5aG52dml1emFueWhhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxNTU3NDgsImV4cCI6MjA4ODczMTc0OH0.PXa7DPsSkb8XN7D4CHK1G7fko0XoIMgmaI2B0DB4W2A',
  },
  flutterwave: {
    // Use TEST keys for staging so no real money moves
    publicKey: 'FLWPUBK_TEST-59b8e970316ea0e268a6b2208343cd52-X',
  },
  platformFeePercentage: 22,
  vapidPublicKey:
    'BMUmrPyd-C_NfHyTfq2PzEiTFTYdRtx1tSFQM7eknpvNHmYdU3-i9AiEQzVVie3T8bh4iVO8L9zEivHsibsv3pc',
};
