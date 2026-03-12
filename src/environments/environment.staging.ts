// Staging environment — points to the Convozo STAGING Supabase project.
// Used when building with: ng build --configuration=staging
// Deployed automatically by CI when pushing to the `develop` branch.
//
// To get these values:
//   1. Create a new Supabase project at supabase.com (free — you can have 2)
//   2. Copy the project URL and anon key from Project Settings → API
export const environment = {
  production: false,
  supabase: {
    url: 'https://fzltvpbyhnvviuzanyha.supabase.co',
    anonKey:
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ6bHR2cGJ5aG52dml1emFueWhhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxNTU3NDgsImV4cCI6MjA4ODczMTc0OH0.PXa7DPsSkb8XN7D4CHK1G7fko0XoIMgmaI2B0DB4W2A',
  },
  platformFeePercentage: 22,
  vapidPublicKey:
    'BNHIas9VtDE6pey_L3jtM_VHXKyxq4IHIMgi3JJx-BTHTVSbMGptvEt0kRe_NLTtXzUIbelYlOa3yd5xgj0yew',
};
