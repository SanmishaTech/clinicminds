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
    { value: 'SEPARATED', label: 'Separated' },
    { value: 'LIVE_IN', label: 'Live In' },
  ],
} as const;

export type Gender = (typeof MASTER_CONFIG.gender)[number]['value'];
export type BloodGroup = (typeof MASTER_CONFIG.bloodGroup)[number]['value'];
export type MaritalStatus = (typeof MASTER_CONFIG.maritalStatus)[number]['value'];
