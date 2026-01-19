'use client';

import ServiceForm from '../services-form';

export default function NewServicePage() {
  return <ServiceForm mode='create' redirectOnSuccess='/services' />;
}
