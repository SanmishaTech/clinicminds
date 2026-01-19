export const MASTER_CONFIG = {
  gender: [
    { value: 'MALE', label: 'Male' },
    { value: 'FEMALE', label: 'Female' },
  ],
} as const;

export type Gender = (typeof MASTER_CONFIG.gender)[number]['value'];
