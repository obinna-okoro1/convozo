export const environment = {
  production: true,
  supabase: {
    url: 'https://pfmscnpmpwxpdlrbeokb.supabase.co',
    anonKey: 'sb_publishable_wZx16RmR-KBGpS-ro4DXpg_mvw7OVX-',
  },
  stripe: {
    publishableKey: 'pk_test_51T07tc1goEV72lO64Tlj9nAOCsOEeFH4N94ZOtH8fLhUnVRwy1N85DxlGkxXA8twVQBAY7QYKYksY037qmmCAx1p00xIU0qziX',
  },
  platformFeePercentage: 35, // 35% platform fee (Option A: Stripe fees come out of platform's cut, creator gets 65% flat)
  vapidPublicKey:
    'BMUmrPyd-C_NfHyTfq2PzEiTFTYdRtx1tSFQM7eknpvNHmYdU3-i9AiEQzVVie3T8bh4iVO8L9zEivHsibsv3pc',
};
