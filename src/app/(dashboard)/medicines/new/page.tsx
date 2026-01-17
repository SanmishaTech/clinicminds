'use client';

import MedicineForm from '../medicines-form';

export default function NewMedicinePage() {
  return <MedicineForm mode='create' redirectOnSuccess='/medicines' />;
}
