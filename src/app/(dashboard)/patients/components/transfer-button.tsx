"use client";

import { useState } from 'react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { ArrowRightLeft, Check, Loader2 } from 'lucide-react';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils';
import { apiPatch, apiGet } from '@/lib/api-client';
import { usePermissions } from "@/hooks/use-permissions";
import { PERMISSIONS } from '@/config/roles';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import useSWR from 'swr';

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

interface TransferButtonProps {
  patient: Patient;
  onTransferComplete: () => void;
}

interface FranchisesResponse {
  data: Franchise[];
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
}

export function TransferButton({ patient, onTransferComplete }: TransferButtonProps) {
  const { can } = usePermissions();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [selectedFranchiseId, setSelectedFranchiseId] = useState<string>('');
  const [isTransferring, setIsTransferring] = useState(false);

  const currentFranchiseId = patient.franchise?.id?.toString() || '';

  const { data: franchisesData, error: franchisesError, isLoading: franchisesLoading } = useSWR<FranchisesResponse>('/api/franchises', apiGet);

  const franchises = franchisesData?.data || [];

  if (franchisesError) {
    console.error('Error loading franchises:', franchisesError);
  }

  const handleTransfer = async () => {
    if (!selectedFranchiseId || selectedFranchiseId === currentFranchiseId) return;

    const requestData = {
      id: patient.id,
      franchiseId: Number(selectedFranchiseId),
    };

    try {
      setIsTransferring(true);
      await apiPatch(`/api/patients`, requestData);

      toast.success('Patient transferred successfully');
      onTransferComplete();
      setIsDropdownOpen(false);
      setConfirmDialogOpen(false);
    } catch (error) {
      console.error('Error transferring patient:', error);
      toast.error('Failed to transfer patient');
    } finally {
      setIsTransferring(false);
    }
  };

  const handleSelectFranchise = (value: string) => {
    if (value === currentFranchiseId) return;
    setSelectedFranchiseId(value);
    setConfirmDialogOpen(true);
  };

  if (!can(PERMISSIONS.TRANSFER_PATIENTS)) {
    return null;
  }

  return (
    <>
      <DropdownMenu
        open={isDropdownOpen}
        onOpenChange={setIsDropdownOpen}
      >
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 p-0 hover:bg-accent"
            title="Transfer patient"
            disabled={isTransferring}
          >
            {isTransferring ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowRightLeft className="h-4 w-4" />
            )}
            <span className="sr-only">Transfer patient</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56" sideOffset={5}>
          <DropdownMenuLabel>Transfer to franchise</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={currentFranchiseId}
            onValueChange={handleSelectFranchise}
          >
            {franchisesLoading ? (
              <div className="px-4 py-2 text-sm text-gray-500 flex items-center justify-center">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Loading...
              </div>
            ) : (
              franchises.map((franchise) => (
                <DropdownMenuRadioItem
                  key={franchise.id}
                  value={franchise.id.toString()}
                  className={cn(
                    "cursor-pointer flex justify-between items-center",
                    franchise.id.toString() === currentFranchiseId && "font-medium"
                  )}
                >
                  <span>{franchise.name}</span>
                  {franchise.id.toString() === currentFranchiseId && (
                    <Check className="h-4 w-4 ml-2" />
                  )}
                </DropdownMenuRadioItem>
              ))
            )}
            {franchises.length === 0 && !franchisesLoading && (
              <div className="px-2 py-1.5 text-sm text-muted-foreground">
                No franchises available
              </div>
            )}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog
        open={confirmDialogOpen}
        onOpenChange={setConfirmDialogOpen}
        title="Confirm Transfer"
        description={`Are you sure you want to transfer patient "${`${patient.firstName} ${patient.middleName || ''} ${patient.lastName}`.trim()}" to ${franchises.find(f => f.id.toString() === selectedFranchiseId)?.name}?`}
        confirmText="Transfer"
        cancelText="Cancel"
        onConfirm={handleTransfer}
        disabled={isTransferring}
      />
    </>
  );
}
