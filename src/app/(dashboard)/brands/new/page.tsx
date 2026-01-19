'use client';

import { useEffect, useState } from 'react';
import { BrandForm, BrandFormInitialData } from '@/app/(dashboard)/brands/brand-form';
import { apiGet } from '@/lib/api-client';
import { toast } from '@/lib/toast';
import { useRouter } from 'next/navigation';

export default function NewBrandPage() {
  const router = useRouter();

  return (
    <BrandForm
      mode="create"
      redirectOnSuccess="/brands"
    />
  );
}
