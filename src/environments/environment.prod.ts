export const environment = {
  production: true,
  supabase: {
    url: 'https://pfmscnpmpwxpdlrbeokb.supabase.co',
    anonKey:
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBmbXNjbnBtcHd4cGRscmJlb2tiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxMzQyODcsImV4cCI6MjA4NzcxMDI4N30.tb4sFRVGfGvQOzuDQFK_GTKhJODWfQKrzc5zbLtCy9k',
  },
  stripe: {
    publishableKey:
      'pk_test_51T07tc1goEV72lO64Tlj9nAOCsOEeFH4N94ZOtH8fLhUnVRwy1N85DxlGkxXA8twVQBAY7QYKYksY037qmmCAx1p00xIU0qziX',
  },
  platformFeePercentage: 35, // 35% platform fee (Option A: Stripe fees come out of platform's cut, creator gets 65% flat)
  vapidPublicKey:
    'BMUmrPyd-C_NfHyTfq2PzEiTFTYdRtx1tSFQM7eknpvNHmYdU3-i9AiEQzVVie3T8bh4iVO8L9zEivHsibsv3pc',
};
