'use client';

import { useProtectPage } from '@/hooks/use-protect-page';
import { SalesForm } from '../sales-form';

export default function NewSalePage() {
  useProtectPage();

  return <SalesForm />;
}
