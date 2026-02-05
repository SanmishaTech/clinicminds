'client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, Loader2 } from 'lucide-react';
import { toast } from '@/lib/toast';
import { usePermissions } from '@/hooks/use-permissions';
import { PERMISSIONS } from '@/config/roles';

interface Franchise {
  id: number;
  name: string;
}

interface Patient {
  id: number;
  patientNo: string;
  firstName: string;
  franchise: {
    id: number;
    name: string;
  } | null;
  lastName: string;
  middleName?: string;
}

interface TransferDropdownProps {
  patient: Patient;
  onTransferComplete: () => void;
}

export function TransferDropdown({ patient, onTransferComplete }: TransferDropdownProps) {
  const { can } = usePermissions();
  const [isOpen, setIsOpen] = useState(false);
  const [isTransferring, setIsTransferring] = useState(false);
  const [franchises, setFranchises] = useState<Franchise[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const currentFranchiseId = patient.franchise?.id?.toString() || '';

  const fetchFranchises = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/franchises');
      const data = await response.json();
      console.log(data);
      setFranchises(data.data);
    } catch (error) {
      console.error('Error fetching franchises:', error);
      toast.error('Failed to load franchises');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleDropdown = () => {
    if (!isOpen) {
      fetchFranchises();
    }
    setIsOpen(!isOpen);
  };

  const handleTransfer = async (franchiseId: string) => {
    if (franchiseId === currentFranchiseId || isTransferring) return;

    setIsTransferring(true);
    try {
      const response = await fetch(`/api/patients`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          patientId: patient.id,
          franchiseId: Number(franchiseId),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to transfer patient');
      }

      toast.success('Patient transferred successfully');
      onTransferComplete();
      setIsOpen(false);
    } catch (error) {
      console.error('Error transferring patient:', error);
      toast.error('Failed to transfer patient');
    } finally {
      setIsTransferring(false);
    }
  };

  if (!can(PERMISSIONS.TRANSFER_PATIENTS)) {
    return null;
  }

  return (
    <div className="relative inline-block text-left">
      <div>
        <button
          type="button"
          onClick={toggleDropdown}
          className="inline-flex items-center justify-center rounded-md p-1.5 focus:outline-none"
          aria-expanded="true"
          aria-haspopup="true"
        >
          <ChevronDown className="h-4 w-4" />
        </button>
      </div>

      {isOpen && (
        <div className="absolute right-0 z-10 mt-2 w-56 origin-top-right rounded-md shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
          <div className="py-1">
            {isLoading ? (
              <div className="px-4 py-2 text-sm flex items-center justify-center">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Loading...
              </div>
            ) : (
              (Array.isArray(franchises) ? franchises : [])
                .filter((f) => f && f.id && f.id.toString() !== currentFranchiseId)
                .map((franchise) => (
                  <button
                    key={franchise.id}
                    onClick={() => handleTransfer(franchise.id.toString())}
                    disabled={isTransferring}
                    className={cn(
                      'w-full text-left px-4 py-2 text-sm',
                      isTransferring && 'opacity-50 cursor-not-allowed'
                    )}
                  >
                    {franchise.name}
                  </button>
                ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
