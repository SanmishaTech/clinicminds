export const MASTER_CONFIG = {
  gender: [
    { value: 'MALE', label: 'Male' },
    { value: 'FEMALE', label: 'Female' },
  ],
  bloodGroup: [
    { value: 'A+', label: 'A+' },
    { value: 'A-', label: 'A-' },
    { value: 'B+', label: 'B+' },
    { value: 'B-', label: 'B-' },
    { value: 'AB+', label: 'AB+' },
    { value: 'AB-', label: 'AB-' },
    { value: 'O+', label: 'O+' },
    { value: 'O-', label: 'O-' },
  ],
  maritalStatus: [
    { value: 'SINGLE', label: 'Single' },
    { value: 'MARRIED', label: 'Married' },
  ],
  medicalHistory: [
    { value: 'DEPRESSION', label: 'Depression' },
    { value: 'KIDNEY_DISEASE', label: 'Kidney Disease' },
    { value: 'HEART_DISEASE', label: 'Heart Disease' },
    { value: 'ANEMIA', label: 'Anemia' },
    { value: 'SEIZURES', label: 'Seizures' },
    { value: 'DIABETES', label: 'Diabetes' },
    { value: 'OTHER', label: 'Other' },
  ],
  familyHistory: [
    { value: 'NONE', label: 'None' },
    { value: 'DEPRESSION', label: 'Depression' },
    { value: 'KIDNEY_DISEASE', label: 'Kidney Disease' },
    { value: 'HEART_DISEASE', label: 'Heart Disease' },
    { value: 'ANEMIA', label: 'Anemia' },
    { value: 'SEIZURES', label: 'Seizures' },
    { value: 'DIABETES', label: 'Diabetes' },
    { value: 'HIGH_BLOOD_PRESSURE', label: 'High Blood Pressure' },
    { value: 'THYROID_DISORDER', label: 'Thyroid Disorder' },
    { value: 'HIGH_CHOLESTEROL', label: 'High Cholesterol' },
    { value: 'OTHER', label: 'Other' },
  ],
} as const;

export type Gender = (typeof MASTER_CONFIG.gender)[number]['value'];
export type BloodGroup = (typeof MASTER_CONFIG.bloodGroup)[number]['value'];
export type MaritalStatus = (typeof MASTER_CONFIG.maritalStatus)[number]['value'];
export type MedicalHistoryItem = (typeof MASTER_CONFIG.medicalHistory)[number]['value'];
export type FamilyHistoryItem = (typeof MASTER_CONFIG.familyHistory)[number]['value'];
