-- Migration script: Copy state and city data from related tables to patient string columns
-- This script should be run after adding state and city string columns to patients table
-- but before removing stateId and cityId columns

-- Update patients table with state names from states table
UPDATE patients p
INNER JOIN states s ON p.stateId = s.id
SET p.state = s.state
WHERE p.stateId IS NOT NULL;

-- Update patients table with city names from cities table
UPDATE patients p
INNER JOIN cities c ON p.cityId = c.id
SET p.city = c.city
WHERE p.cityId IS NOT NULL;

-- Optional: Set state and city to match franchise if they are null
-- This ensures patients have the same state/city as their franchise
UPDATE patients p
INNER JOIN franchises f ON p.franchiseId = f.id
SET p.state = f.state, p.city = f.city
WHERE p.franchiseId IS NOT NULL 
  AND (p.state IS NULL OR p.city IS NULL);

-- Verify the migration
SELECT 
    COUNT(*) as total_patients,
    COUNT(stateId) as patients_with_stateId,
    COUNT(cityId) as patients_with_cityId,
    COUNT(state) as patients_with_state_string,
    COUNT(city) as patients_with_city_string,
    COUNT(CASE WHEN stateId IS NOT NULL AND state IS NULL THEN 1 END) as missing_state_migration,
    COUNT(CASE WHEN cityId IS NOT NULL AND city IS NULL THEN 1 END) as missing_city_migration
FROM patients;
