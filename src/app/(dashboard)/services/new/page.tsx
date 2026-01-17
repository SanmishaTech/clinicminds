'use client';

import { useProtectPage } from '@/hooks/use-protect-page';
import ServiceForm from '../services-form';

export default function NewServicePage() {
  useProtectPage();
  return <ServiceForm mode='create' redirectOnSuccess='/services' />;
}
