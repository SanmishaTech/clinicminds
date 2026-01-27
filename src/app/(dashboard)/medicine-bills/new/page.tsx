'use client';

import MedicineBillForm from '../medicine-bill-form';

export default function NewMedicineBillPage() {
  return <MedicineBillForm mode='create' redirectOnSuccess='/medicine-bills' />;
}
