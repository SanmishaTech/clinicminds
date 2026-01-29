'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiGet } from '@/lib/api-client';
import { toast } from '@/lib/toast';
import PatientForm, { PatientFormInitialData } from '@/app/(dashboard)/patients/patient-form';
import { usePermissions } from '@/hooks/use-permissions';
import { ROLES } from '@/config/roles';

export default function EditPatientPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const router = useRouter();
  const { role } = usePermissions();
  const [loading, setLoading] = useState(true);
  const [initial, setInitial] = useState<PatientFormInitialData | null>(null);

  useEffect(() => {
    if (role === ROLES.ADMIN) router.replace('/patients');
  }, [role, router]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const data = await apiGet<{
          id: number;
          patientNo: string;
          franchiseId: number | null;
          teamId: number | null;
          firstName: string;
          middleName: string;
          lastName: string;
          dateOfBirth: string | null;
          age: number;
          gender: string;
          bloodGroup: string;
          height: string | null;
          weight: string | null;
          bmi: string | null;
          address: string;
          stateId: number | null;
          cityId: number | null;
          pincode: string | null;
          mobile: string;
          mobile2: string | null;
          email: string | null;
          aadharNo: string;
          occupation: string | null;
          maritalStatus: string | null;
          contactPersonName: string | null;
          contactPersonRelation: string | null;
          contactPersonAddress: string | null;
          contactPersonMobile: string | null;
          contactPersonEmail: string | null;
          medicalInsurance: boolean;
          primaryInsuranceName: string | null;
          primaryInsuranceHolderName: string | null;
          primaryInsuranceId: string | null;
          secondaryInsuranceName: string | null;
          secondaryInsuranceHolderName: string | null;
          secondaryInsuranceId: string | null;
          balanceAmount: number;
          labId: number | null;
          reports: {
            id: number;
            name: string | null;
            url: string | null;
            createdAt: string;
          }[];
        }>(`/api/patients/${id}`);

        setInitial({
          id: data.id,
          patientNo: data.patientNo,
          franchiseId: data.franchiseId,
          teamId: data.teamId,
          firstName: data.firstName,
          middleName: data.middleName,
          lastName: data.lastName,
          dateOfBirth: data.dateOfBirth,
          age: data.age,
          gender: data.gender,
          bloodGroup: data.bloodGroup,
          height: data.height,
          weight: data.weight,
          bmi: data.bmi,
          address: data.address,
          stateId: data.stateId,
          cityId: data.cityId,
          pincode: data.pincode,
          mobile: data.mobile,
          mobile2: data.mobile2,
          email: data.email,
          aadharNo: data.aadharNo,
          occupation: data.occupation,
          maritalStatus: data.maritalStatus,
          contactPersonName: data.contactPersonName,
          contactPersonRelation: data.contactPersonRelation,
          contactPersonAddress: data.contactPersonAddress,
          contactPersonMobile: data.contactPersonMobile,
          contactPersonEmail: data.contactPersonEmail,
          medicalInsurance: data.medicalInsurance,
          primaryInsuranceName: data.primaryInsuranceName,
          primaryInsuranceHolderName: data.primaryInsuranceHolderName,
          primaryInsuranceId: data.primaryInsuranceId,
          secondaryInsuranceName: data.secondaryInsuranceName,
          secondaryInsuranceHolderName: data.secondaryInsuranceHolderName,
          secondaryInsuranceId: data.secondaryInsuranceId,
          balanceAmount: data.balanceAmount,
          labId: data.labId,
          patientReports: data.reports,
        });
      } catch (e) {
        toast.error((e as Error).message || 'Failed to load patient');
        router.push('/patients');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [id, router]);

  if (role === ROLES.ADMIN) return null;

  if (loading) {
    return <div className='p-6'>Loading...</div>;
  }

  return (
    <PatientForm mode='edit' initial={initial} />
  );
}
