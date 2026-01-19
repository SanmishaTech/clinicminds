'use client';

import PackageForm from '../packages-form';

export default function NewPackagePage() {
  return <PackageForm mode='create' redirectOnSuccess='/packages' />;
}
