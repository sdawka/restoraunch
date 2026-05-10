-- Add restaurant_type column to locations for personalized onboarding
ALTER TABLE locations ADD COLUMN restaurant_type TEXT;
