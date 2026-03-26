/**
 * Expert Professional Categories & Subcategories
 *
 * Used during onboarding and in profile settings so experts can declare
 * their field of practice. The taxonomy mirrors how clients think when
 * looking for professional advice — not how academic bodies classify roles.
 *
 * Future use: directory / search so clients can browse by category.
 *
 * Design rules:
 *  - 12 top-level categories, broad enough to be mutually exclusive
 *  - Each category has 5–10 subcategories covering the most common specialisms
 *  - IDs are snake_case strings — stored verbatim in the DB (never translate them)
 *  - Labels are user-facing and can be updated freely without a migration
 */

export interface ExpertSubcategory {
  id: string;
  label: string;
}

export interface ExpertCategory {
  id: string;
  label: string;
  emoji: string;
  /** One-line description shown under the category card during selection. */
  description: string;
  subcategories: ExpertSubcategory[];
}

export const EXPERT_CATEGORIES: ExpertCategory[] = [
  {
    id: 'legal',
    label: 'Legal & Law',
    emoji: '⚖️',
    description: 'Lawyers, attorneys & legal advisors',
    subcategories: [
      { id: 'corporate_law',    label: 'Corporate & Business Law' },
      { id: 'family_law',       label: 'Family & Divorce Law' },
      { id: 'criminal_defense', label: 'Criminal Defence' },
      { id: 'immigration_law',  label: 'Immigration Law' },
      { id: 'ip_law',           label: 'Intellectual Property' },
      { id: 'real_estate_law',  label: 'Real Estate Law' },
      { id: 'tax_law',          label: 'Tax Law' },
      { id: 'employment_law',   label: 'Employment & Labour' },
      { id: 'human_rights',     label: 'Human Rights Law' },
      { id: 'general_law',      label: 'General Legal Practice' },
    ],
  },
  {
    id: 'medicine',
    label: 'Medicine & Health',
    emoji: '🏥',
    description: 'Doctors, physicians & medical specialists',
    subcategories: [
      { id: 'general_practice',  label: 'General Practice (GP)' },
      { id: 'cardiology',        label: 'Cardiology' },
      { id: 'dermatology',       label: 'Dermatology' },
      { id: 'psychiatry',        label: 'Psychiatry' },
      { id: 'pediatrics',        label: 'Pediatrics' },
      { id: 'gynecology',        label: 'Gynecology & Obstetrics' },
      { id: 'orthopedics',       label: 'Orthopedics' },
      { id: 'oncology',          label: 'Oncology' },
      { id: 'neurology',         label: 'Neurology' },
      { id: 'internal_medicine', label: 'Internal Medicine' },
    ],
  },
  {
    id: 'mental_health',
    label: 'Mental Health',
    emoji: '🧠',
    description: 'Therapists, psychologists & counselors',
    subcategories: [
      { id: 'clinical_psychologist', label: 'Clinical Psychologist' },
      { id: 'therapist',             label: 'Licensed Therapist' },
      { id: 'marriage_counselor',    label: 'Marriage & Couples Counselor' },
      { id: 'grief_counselor',       label: 'Grief Counselor' },
      { id: 'trauma_therapist',      label: 'Trauma Therapist' },
      { id: 'addiction_counselor',   label: 'Addiction Counselor' },
      { id: 'family_therapist',      label: 'Family Therapist' },
      { id: 'life_coach',            label: 'Life Coach' },
      { id: 'cbt_therapist',         label: 'CBT Therapist' },
    ],
  },
  {
    id: 'faith',
    label: 'Faith & Spirituality',
    emoji: '🙏',
    description: 'Pastors, chaplains & spiritual advisors',
    subcategories: [
      { id: 'pastor',                   label: 'Pastor / Minister' },
      { id: 'premarital_counselor',     label: 'Premarital Counselor' },
      { id: 'marriage_counselor_faith', label: 'Marriage Counselor (Faith-based)' },
      { id: 'chaplain',                 label: 'Chaplain' },
      { id: 'spiritual_director',       label: 'Spiritual Director' },
      { id: 'islamic_scholar',          label: 'Islamic Scholar / Imam' },
      { id: 'life_coach_faith',         label: 'Faith-based Life Coach' },
    ],
  },
  {
    id: 'finance',
    label: 'Finance & Investment',
    emoji: '💰',
    description: 'Financial advisors, accountants & investment experts',
    subcategories: [
      { id: 'financial_advisor',   label: 'Financial Advisor' },
      { id: 'investment_analyst',  label: 'Investment Analyst' },
      { id: 'tax_consultant',      label: 'Tax Consultant / CPA' },
      { id: 'accountant',          label: 'Accountant' },
      { id: 'insurance_advisor',   label: 'Insurance Advisor' },
      { id: 'crypto_advisor',      label: 'Crypto & Digital Assets' },
      { id: 'mortgage_advisor',    label: 'Mortgage Advisor' },
      { id: 'wealth_manager',      label: 'Wealth Manager' },
    ],
  },
  {
    id: 'business',
    label: 'Business & Entrepreneurship',
    emoji: '🚀',
    description: 'Business coaches, consultants & startup mentors',
    subcategories: [
      { id: 'business_coach',        label: 'Business Coach' },
      { id: 'startup_mentor',        label: 'Startup Mentor' },
      { id: 'marketing_strategist',  label: 'Marketing Strategist' },
      { id: 'operations_consultant', label: 'Operations Consultant' },
      { id: 'hr_consultant',         label: 'HR Consultant' },
      { id: 'sales_coach',           label: 'Sales Coach' },
      { id: 'brand_strategist',      label: 'Brand Strategist' },
      { id: 'supply_chain',          label: 'Supply Chain Consultant' },
    ],
  },
  {
    id: 'career',
    label: 'Career & Education',
    emoji: '🎓',
    description: 'Career coaches, educators & academic advisors',
    subcategories: [
      { id: 'career_coach',          label: 'Career Coach' },
      { id: 'resume_expert',         label: 'Resume & CV Expert' },
      { id: 'interview_coach',       label: 'Interview Coach' },
      { id: 'scholarship_advisor',   label: 'Scholarship Advisor' },
      { id: 'study_abroad',          label: 'Study Abroad Advisor' },
      { id: 'academic_tutor',        label: 'Academic Tutor' },
      { id: 'university_admissions', label: 'University Admissions Consultant' },
    ],
  },
  {
    id: 'technology',
    label: 'Technology & Engineering',
    emoji: '💻',
    description: 'Software engineers, data scientists & tech leaders',
    subcategories: [
      { id: 'software_engineer', label: 'Software Engineer' },
      { id: 'data_scientist',    label: 'Data Scientist' },
      { id: 'cybersecurity',     label: 'Cybersecurity Expert' },
      { id: 'product_manager',   label: 'Product Manager' },
      { id: 'ux_designer',       label: 'UX / Product Designer' },
      { id: 'ai_ml',             label: 'AI & Machine Learning' },
      { id: 'devops',            label: 'DevOps & Cloud Engineer' },
      { id: 'blockchain',        label: 'Blockchain Developer' },
      { id: 'cto',               label: 'CTO / Tech Leadership' },
    ],
  },
  {
    id: 'entertainment',
    label: 'Entertainment & Arts',
    emoji: '🎬',
    description: 'Artists, musicians, filmmakers & content creators',
    subcategories: [
      { id: 'music_producer',   label: 'Music Producer' },
      { id: 'musician',         label: 'Musician / Songwriter' },
      { id: 'actor',            label: 'Actor / Filmmaker' },
      { id: 'content_creator',  label: 'Content Creator / Influencer' },
      { id: 'photographer',     label: 'Photographer / Videographer' },
      { id: 'graphic_designer', label: 'Graphic Designer' },
      { id: 'fashion',          label: 'Fashion Designer / Stylist' },
      { id: 'comedian',         label: 'Comedian / Entertainer' },
    ],
  },
  {
    id: 'fitness',
    label: 'Fitness & Wellness',
    emoji: '💪',
    description: 'Personal trainers, coaches & wellness experts',
    subcategories: [
      { id: 'personal_trainer',  label: 'Personal Trainer' },
      { id: 'yoga_instructor',   label: 'Yoga Instructor' },
      { id: 'sports_coach',      label: 'Sports Coach / Athlete' },
      { id: 'nutritionist',      label: 'Nutritionist / Dietitian' },
      { id: 'wellness_coach',    label: 'Wellness Coach' },
      { id: 'physiotherapist',   label: 'Physiotherapist' },
    ],
  },
  {
    id: 'real_estate',
    label: 'Real Estate',
    emoji: '🏠',
    description: 'Property consultants, agents & developers',
    subcategories: [
      { id: 'property_agent',      label: 'Property Agent / Realtor' },
      { id: 'property_manager',    label: 'Property Manager' },
      { id: 'real_estate_investor',label: 'Real Estate Investor' },
      { id: 'property_developer',  label: 'Property Developer' },
      { id: 'interior_designer',   label: 'Interior Designer / Architect' },
    ],
  },
  {
    id: 'parenting',
    label: 'Parenting & Family',
    emoji: '👶',
    description: 'Parenting coaches, child experts & family consultants',
    subcategories: [
      { id: 'parenting_coach',    label: 'Parenting Coach' },
      { id: 'child_development',  label: 'Child Development Specialist' },
      { id: 'family_mediator',    label: 'Family Mediator' },
      { id: 'special_needs',      label: 'Special Needs Specialist' },
    ],
  },
];

/** Look up a category by its ID. */
export function getCategoryById(id: string): ExpertCategory | undefined {
  return EXPERT_CATEGORIES.find((c) => c.id === id);
}

/** Look up a subcategory label — returns null when the IDs don't match any entry. */
export function getSubcategoryLabel(categoryId: string, subcategoryId: string): string | null {
  const cat = getCategoryById(categoryId);
  if (!cat) return null;
  return cat.subcategories.find((s) => s.id === subcategoryId)?.label ?? null;
}
