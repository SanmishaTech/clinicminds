'use client';

import { useState, useEffect } from 'react';
import * as AlertDialog from '@radix-ui/react-alert-dialog';
import useSWR from 'swr';
import { apiGet } from '@/lib/api-client';
import { AppButton } from '@/components/common/app-button';
import { AppSelect } from '@/components/common/app-select';
import { usePermissions } from '@/hooks/use-permissions';
import { PERMISSIONS } from '@/config/roles';
import { cn } from '@/lib/utils';

interface Franchise {
  id: number;
  name: string;
}

interface Patient {
  id: number;
  patientNo: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  franchise?: {
    id: number;
    name: string;
  };
}

interface TransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  patient: Patient | null;
  onSuccess: () => void;
}

export function TransferModal({ isOpen, onClose, patient, onSuccess }: TransferModalProps) {
  const { can } = usePermissions();
  const [selectedFranchiseId, setSelectedFranchiseId] = useState<string>('');
  const [isTransferring, setIsTransferring] = useState(false);

  const { data: franchises } = useSWR<Franchise[]>('/api/franchises', apiGet);

  const currentFranchiseId = patient?.franchise?.id?.toString() || '';

  useEffect(() => {
    if (!isOpen || !patient) return;

    setSelectedFranchiseId('');
  }, [isOpen, patient]);

  const handleTransfer = async () => {
    if (!isOpen || !patient) return null;

    const patientFullName = `${patient.firstName}${patient.middleName ? ` ${patient.middleName} ` : ' '}${patient.lastName}`.trim();

    if (!selectedFranchiseId || selectedFranchiseId === currentFranchiseId) {
      return;
    }

    setIsTransferring(true);
    try {
      const response = await fetch(`/api/patients`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: patient.id,
          franchiseId: selectedFranchiseId,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Transfer failed');
      }

      onSuccess();
      onClose();
    } catch (error) {
      console.error('Transfer error:', error);
      // TODO: Add proper error handling/toast
    } finally {
      setIsTransferring(false);
    }
  };

  const franchiseOptions = franchises?.map(f => ({
    value: f.id.toString(),
    label: f.name,
  })) || [];

  return (
    <AlertDialog.Root open={isOpen} onOpenChange={onClose}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <AlertDialog.Content className="fixed left-[50%] top-[50%] translate-x-[-50%] translate-y-[-50%] bg-white rounded-lg shadow-lg p-6 w-full max-w-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0">
          <AlertDialog.Title className="text-lg font-semibold mb-4">
            Transfer Patient
          </AlertDialog.Title>
          
          <div className="space-y-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-medium text-gray-900 mb-2">Patient Details</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Patient No:</span>
                  <p className="font-medium">{patient?.patientNo || 'N/A'}</p>
                </div>
                <div>
                  <span className="text-gray-600">Name:</span>
                  <p className="font-medium">
                    {patient?.firstName} {patient?.middleName} {patient?.lastName}
                  </p>
                </div>
                <div>
                  <span className="text-gray-600">Current Franchise:</span>
                  <p className="font-medium">{patient?.franchise?.name || 'None'}</p>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select New Franchise
              </label>
              <AppSelect
                value={selectedFranchiseId}
                onValueChange={setSelectedFranchiseId}
                placeholder="Choose a franchise..."
                className="w-full"
              >
                {franchiseOptions.map(option => (
                  <AppSelect.Item key={option.value} value={option.value}>
                    {option.label}
                  </AppSelect.Item>
                ))}
              </AppSelect>
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t mt-4">
            <AlertDialog.Cancel asChild>
              <AppButton
                variant="secondary"
                disabled={isTransferring}
              >
                Cancel
              </AppButton>
            </AlertDialog.Cancel>
            <AppButton
              onClick={handleTransfer}
              disabled={!selectedFranchiseId || 
                       selectedFranchiseId === currentFranchiseId || 
                       isTransferring ||
                       !can(PERMISSIONS.TRANSFER_PATIENTS)}
              isLoading={isTransferring}
            >
              Transfer Patient
            </AppButton>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
