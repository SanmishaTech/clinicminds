'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useFieldArray, useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { AppCard } from '@/components/common/app-card';
import { AppButton } from '@/components/common/app-button';
import { FormRow, FormSection } from '@/components/common/app-form';
import { TextInput } from '@/components/common/text-input';
import TextareaInput from '@/components/common/textarea-input';
import { MultiSelectInput } from '@/components/common/multi-select-input';
import { IconButton } from '@/components/common/icon-button';
import { apiGet, apiPost } from '@/lib/api-client';
import { toast } from '@/lib/toast';
import { MASTER_CONFIG } from '@/config/master';
import { formatDate } from '@/lib/locales';

type PatientInfo = {
  id: number;
  patientNo: string;
  firstName: string;
  middleName: string;
  lastName: string;
  dateOfBirth: string | null;
  gender: string;
  mobile: string;
};

type MedicalHistoryDto = {
  id: number;
  patientId: number;
  reasonForVisit: string | null;
  heardAboutUs: string | null;
  pharmacyName: string | null;
  pharmacyLocation: string | null;
  diet: string | null;
  smokes: boolean;
  smokingUnitsPerDay: string | null;
  drinksAlcohol: boolean;
  alcoholHowMuch: string | null;
  alcoholFrequency: string | null;
  hasCurrentMedications: boolean;
  currentMedications: Array<{ drug?: string | null; dosage?: string | null; frequency?: string | null }>;
  hasMedicationAllergies: boolean;
  otherAllergies: string | null;
  hadAllergyTest: boolean;
  allergyTestDetails: string | null;
  medicalHistory: string[];
  medicalHistoryOther: string | null;
  hasSurgicalHistory: boolean;
  surgicalHistory: Array<{ type?: string | null; year?: string | null }>;
  familyHistory: string[];
  familyHistoryOther: string | null;
};

const MEDICAL_HISTORY_OPTIONS = MASTER_CONFIG.medicalHistory.map((o) => ({ value: o.value, label: o.label }));
const FAMILY_HISTORY_OPTIONS = MASTER_CONFIG.familyHistory.map((o) => ({ value: o.value, label: o.label }));

function fullName(p: PatientInfo) {
  return [p.firstName, p.middleName, p.lastName].filter(Boolean).join(' ');
}

export default function PatientMedicalHistoryPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [patient, setPatient] = useState<PatientInfo | null>(null);

  const medicationRowSchema = z.object({
    drug: z.string().optional().transform((v) => (v === '' ? undefined : v)),
    dosage: z.string().optional().transform((v) => (v === '' ? undefined : v)),
    frequency: z.string().optional().transform((v) => (v === '' ? undefined : v)),
  });

  const surgicalRowSchema = z.object({
    type: z.string().optional().transform((v) => (v === '' ? undefined : v)),
    year: z.string().optional().transform((v) => (v === '' ? undefined : v)),
  });

  const schema = z.object({
    reasonForVisit: z.string().optional().transform((v) => (v === '' ? undefined : v)),
    heardAboutUs: z.string().optional().transform((v) => (v === '' ? undefined : v)),
    pharmacyName: z.string().optional().transform((v) => (v === '' ? undefined : v)),
    pharmacyLocation: z.string().optional().transform((v) => (v === '' ? undefined : v)),

    diet: z.string().optional().transform((v) => (v === '' ? undefined : v)),
    smokes: z.boolean(),
    smokingUnitsPerDay: z.string().optional().transform((v) => (v === '' ? undefined : v)),
    drinksAlcohol: z.boolean(),
    alcoholHowMuch: z.string().optional().transform((v) => (v === '' ? undefined : v)),
    alcoholFrequency: z.string().optional().transform((v) => (v === '' ? undefined : v)),

    hasCurrentMedications: z.boolean(),
    currentMedications: z.array(medicationRowSchema).optional(),
    hasMedicationAllergies: z.boolean(),
    otherAllergies: z.string().optional().transform((v) => (v === '' ? undefined : v)),

    hadAllergyTest: z.boolean(),
    allergyTestDetails: z.string().optional().transform((v) => (v === '' ? undefined : v)),

    medicalHistory: z.array(z.string()).optional(),
    medicalHistoryOther: z.string().optional().transform((v) => (v === '' ? undefined : v)),

    hasSurgicalHistory: z.boolean(),
    surgicalHistory: z.array(surgicalRowSchema).optional(),

    familyHistory: z.array(z.string()).optional(),
    familyHistoryOther: z.string().optional().transform((v) => (v === '' ? undefined : v)),
  });

  type RawFormValues = z.infer<typeof schema>;

  const form = useForm<RawFormValues>({
    resolver: zodResolver(schema),
    mode: 'onChange',
    reValidateMode: 'onChange',
    defaultValues: {
      reasonForVisit: '',
      heardAboutUs: '',
      pharmacyName: '',
      pharmacyLocation: '',

      diet: '',
      smokes: false,
      smokingUnitsPerDay: '',
      drinksAlcohol: false,
      alcoholHowMuch: '',
      alcoholFrequency: '',

      hasCurrentMedications: false,
      currentMedications: [],
      hasMedicationAllergies: false,
      otherAllergies: '',

      hadAllergyTest: false,
      allergyTestDetails: '',

      medicalHistory: [],
      medicalHistoryOther: '',

      hasSurgicalHistory: false,
      surgicalHistory: [],

      familyHistory: [],
      familyHistoryOther: '',
    },
  });

  const { control, handleSubmit } = form;

  const {
    fields: currentMedFields,
    append: appendCurrentMed,
    remove: removeCurrentMed,
    replace: replaceCurrentMed,
  } = useFieldArray({
    control,
    name: 'currentMedications' as any,
  });

  const {
    fields: surgicalFields,
    append: appendSurgical,
    remove: removeSurgical,
    replace: replaceSurgical,
  } = useFieldArray({
    control,
    name: 'surgicalHistory' as any,
  });

  const hasCurrentMedications = form.watch('hasCurrentMedications');
  const hasMedicationAllergies = form.watch('hasMedicationAllergies');
  const hadAllergyTest = form.watch('hadAllergyTest');
  const hasSurgicalHistory = form.watch('hasSurgicalHistory');
  const smokes = form.watch('smokes');
  const drinksAlcohol = form.watch('drinksAlcohol');
  const medicalHistory = form.watch('medicalHistory') || [];
  const familyHistory = form.watch('familyHistory') || [];

  const showMedicalHistoryOther = medicalHistory.includes('OTHER');
  const showFamilyHistoryOther = familyHistory.includes('OTHER');

  useEffect(() => {
    if (!hasCurrentMedications) {
      replaceCurrentMed([]);
      return;
    }
    if (currentMedFields.length === 0) {
      appendCurrentMed({ drug: '', dosage: '', frequency: '' } as any);
    }
  }, [hasCurrentMedications, currentMedFields.length, appendCurrentMed, replaceCurrentMed]);

  useEffect(() => {
    if (!hasSurgicalHistory) {
      replaceSurgical([]);
      return;
    }
    if (surgicalFields.length === 0) {
      appendSurgical({ type: '', year: '' } as any);
    }
  }, [hasSurgicalHistory, surgicalFields.length, appendSurgical, replaceSurgical]);

  useEffect(() => {
    if (!hasMedicationAllergies) {
      form.setValue('otherAllergies', '', { shouldDirty: true, shouldValidate: true });
    }
  }, [hasMedicationAllergies, form]);

  useEffect(() => {
    if (!smokes) {
      form.setValue('smokingUnitsPerDay', '', { shouldDirty: true, shouldValidate: true });
    }
  }, [smokes, form]);

  useEffect(() => {
    if (!drinksAlcohol) {
      form.setValue('alcoholHowMuch', '', { shouldDirty: true, shouldValidate: true });
      form.setValue('alcoholFrequency', '', { shouldDirty: true, shouldValidate: true });
    }
  }, [drinksAlcohol, form]);

  useEffect(() => {
    if (!hadAllergyTest) {
      form.setValue('allergyTestDetails', '', { shouldDirty: true, shouldValidate: true });
    }
  }, [hadAllergyTest, form]);

  useEffect(() => {
    if (!showMedicalHistoryOther) {
      form.setValue('medicalHistoryOther', '', { shouldDirty: true, shouldValidate: true });
    }
  }, [showMedicalHistoryOther, form]);

  useEffect(() => {
    if (!showFamilyHistoryOther) {
      form.setValue('familyHistoryOther', '', { shouldDirty: true, shouldValidate: true });
    }
  }, [showFamilyHistoryOther, form]);

  useEffect(() => {
    if (familyHistory.includes('NONE') && familyHistory.length > 1) {
      form.setValue('familyHistory', ['NONE'], { shouldDirty: true, shouldValidate: true });
    }
  }, [familyHistory, form]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const data = await apiGet<{ patient: PatientInfo; medicalHistory: MedicalHistoryDto | null }>(
          `/api/patients/${id}/medical-history`
        );
        if (!mounted) return;

        setPatient(data.patient);
        const mh = data.medicalHistory;

        form.reset({
          reasonForVisit: mh?.reasonForVisit ?? '',
          heardAboutUs: mh?.heardAboutUs ?? '',
          pharmacyName: mh?.pharmacyName ?? '',
          pharmacyLocation: mh?.pharmacyLocation ?? '',

          diet: mh?.diet ?? '',
          smokes: mh?.smokes ?? false,
          smokingUnitsPerDay: mh?.smokingUnitsPerDay ?? '',
          drinksAlcohol: mh?.drinksAlcohol ?? false,
          alcoholHowMuch: mh?.alcoholHowMuch ?? '',
          alcoholFrequency: mh?.alcoholFrequency ?? '',

          hasCurrentMedications: mh?.hasCurrentMedications ?? false,
          currentMedications: (mh?.currentMedications || []).map((r) => ({
            drug: r?.drug ?? '',
            dosage: r?.dosage ?? '',
            frequency: r?.frequency ?? '',
          })),
          hasMedicationAllergies: mh?.hasMedicationAllergies ?? false,
          otherAllergies: mh?.otherAllergies ?? '',

          hadAllergyTest: mh?.hadAllergyTest ?? false,
          allergyTestDetails: mh?.allergyTestDetails ?? '',

          medicalHistory: mh?.medicalHistory ?? [],
          medicalHistoryOther: mh?.medicalHistoryOther ?? '',

          hasSurgicalHistory: mh?.hasSurgicalHistory ?? false,
          surgicalHistory: (mh?.surgicalHistory || []).map((r) => ({
            type: r?.type ?? '',
            year: r?.year ?? '',
          })),

          familyHistory: mh?.familyHistory ?? [],
          familyHistoryOther: mh?.familyHistoryOther ?? '',
        });
      } catch (e) {
        toast.error((e as Error).message || 'Failed to load medical history');
        router.push('/patients');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [id, router, form]);

  const patientMeta = useMemo(() => {
    if (!patient) return null;
    return {
      name: fullName(patient),
      dob: patient.dateOfBirth ? formatDate(patient.dateOfBirth) : '—',
      gender: patient.gender || '—',
      mobile: patient.mobile || '—',
    };
  }, [patient]);

  function YesNoField({ name, label, yesLabel = 'Yes', noLabel = 'No' }: { name: keyof RawFormValues; label: string; yesLabel?: string; noLabel?: string }) {
    return (
      <FormField
        control={control}
        name={name as any}
        render={({ field }) => (
          <FormItem className='w-full min-w-0'>
            <div className='flex items-center gap-4'>
              <FormLabel className='mb-0'>{label}:</FormLabel>
              <div className='flex items-center gap-6'>
                <div className='flex items-center space-x-2'>
                  <FormControl>
                    <Checkbox
                      checked={field.value === true}
                      onCheckedChange={(checked) => {
                        if (checked) field.onChange(true);
                      }}
                    />
                  </FormControl>
                  <FormLabel className='text-sm font-normal cursor-pointer'>{yesLabel}</FormLabel>
                </div>
                <div className='flex items-center space-x-2'>
                  <FormControl>
                    <Checkbox
                      checked={field.value === false}
                      onCheckedChange={(checked) => {
                        if (checked) field.onChange(false);
                      }}
                    />
                  </FormControl>
                  <FormLabel className='text-sm font-normal cursor-pointer'>{noLabel}</FormLabel>
                </div>
              </div>
            </div>
            <FormMessage />
          </FormItem>
        )}
      />
    );
  }

  async function onSubmit(values: RawFormValues) {
    setSaving(true);
    try {
      const payload = {
        reasonForVisit: values.reasonForVisit || null,
        heardAboutUs: values.heardAboutUs || null,
        pharmacyName: values.pharmacyName || null,
        pharmacyLocation: values.pharmacyLocation || null,

        diet: values.diet || null,
        smokes: values.smokes,
        smokingUnitsPerDay: values.smokes ? values.smokingUnitsPerDay || null : null,
        drinksAlcohol: values.drinksAlcohol,
        alcoholHowMuch: values.drinksAlcohol ? values.alcoholHowMuch || null : null,
        alcoholFrequency: values.drinksAlcohol ? values.alcoholFrequency || null : null,

        hasCurrentMedications: values.hasCurrentMedications,
        currentMedications: values.hasCurrentMedications ? (values.currentMedications || []) : [],
        hasMedicationAllergies: values.hasMedicationAllergies,
        otherAllergies: values.hasMedicationAllergies ? values.otherAllergies || null : null,

        hadAllergyTest: values.hadAllergyTest,
        allergyTestDetails: values.hadAllergyTest ? values.allergyTestDetails || null : null,

        medicalHistory: values.medicalHistory || [],
        medicalHistoryOther: (values.medicalHistory || []).includes('OTHER') ? values.medicalHistoryOther || null : null,

        hasSurgicalHistory: values.hasSurgicalHistory,
        surgicalHistory: values.hasSurgicalHistory ? (values.surgicalHistory || []) : [],

        familyHistory: values.familyHistory || [],
        familyHistoryOther: (values.familyHistory || []).includes('OTHER') ? values.familyHistoryOther || null : null,
      };

      await apiPost(`/api/patients/${id}/medical-history`, payload);
      toast.success('Medical history saved');
      router.push('/patients');
    } catch (e) {
      toast.error((e as Error).message || 'Failed to save medical history');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className='p-6'>Loading...</div>;

  return (
    <Form {...form}>
      <AppCard>
        <AppCard.Header>
          <AppCard.Title>Medical History</AppCard.Title>
        </AppCard.Header>

        <form noValidate onSubmit={handleSubmit(onSubmit)}>
          <AppCard.Content>
            <FormSection legend='Patient Details'>
              {patientMeta ? (
                <div className='text-sm space-y-1'>
                  <div className='flex items-center gap-1 min-w-0'>
                    <span className='text-muted-foreground'>Patient:</span>
                    <span className='font-medium truncate' title={patientMeta.name}>
                      {patientMeta.name}
                    </span>
                  </div>
                  <div className='flex items-center gap-1 min-w-0'>
                    <span className='text-muted-foreground'>DOB:</span>
                    <span className='font-medium truncate' title={patientMeta.dob}>
                      {patientMeta.dob}
                    </span>
                  </div>
                  <div className='flex items-center gap-1 min-w-0'>
                    <span className='text-muted-foreground'>Gender:</span>
                    <span className='font-medium truncate' title={patientMeta.gender}>
                      {patientMeta.gender}
                    </span>
                  </div>
                  <div className='flex items-center gap-1 min-w-0'>
                    <span className='text-muted-foreground'>Mobile:</span>
                    <span className='font-medium truncate' title={patientMeta.mobile}>
                      {patientMeta.mobile}
                    </span>
                  </div>
                </div>
              ) : null}
            </FormSection>

            <FormSection legend='Visit Details'>
              <FormRow cols={1}>
                <TextareaInput control={control} name='reasonForVisit' label='Reason for Visit' placeholder='Reason for visit' rows={3} />
              </FormRow>
              <FormRow cols={1}>
                <TextareaInput control={control} name='heardAboutUs' label='How did you hear about this?' placeholder='How did you hear about this?' rows={3} />
              </FormRow>
              <FormRow cols={2}>
                <TextInput control={control} name='pharmacyName' label='Which pharmacy do you use?' placeholder='Pharmacy name' />
                <TextInput control={control} name='pharmacyLocation' label='Location?' placeholder='Location' />
              </FormRow>
            </FormSection>

            <FormSection legend='Social History'>
              <FormRow cols={1}>
                <FormField
                  control={control}
                  name={'diet' as any}
                  render={({ field }) => (
                    <FormItem className='w-full min-w-0'>
                      <div className='flex items-center gap-4'>
                        <FormLabel className='mb-0'>Diet:</FormLabel>
                        <div className='flex items-center gap-6'>
                          <div className='flex items-center space-x-2'>
                            <FormControl>
                              <Checkbox
                                checked={field.value === 'VEG'}
                                onCheckedChange={(checked) => {
                                  if (checked) field.onChange('VEG');
                                  else if (field.value === 'VEG') field.onChange('');
                                }}
                              />
                            </FormControl>
                            <FormLabel className='text-sm font-normal cursor-pointer'>Veg</FormLabel>
                          </div>
                          <div className='flex items-center space-x-2'>
                            <FormControl>
                              <Checkbox
                                checked={field.value === 'NON_VEG'}
                                onCheckedChange={(checked) => {
                                  if (checked) field.onChange('NON_VEG');
                                  else if (field.value === 'NON_VEG') field.onChange('');
                                }}
                              />
                            </FormControl>
                            <FormLabel className='text-sm font-normal cursor-pointer'>Non-veg</FormLabel>
                          </div>
                        </div>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </FormRow>

              <FormRow cols={1}>
                <YesNoField name='smokes' label='Smoking' yesLabel='Yes' noLabel='No' />
              </FormRow>
              {smokes ? (
                <FormRow cols={1}>
                  <TextInput control={control} name='smokingUnitsPerDay' label='Units per day?' placeholder='Units per day' />
                </FormRow>
              ) : null}

              <FormRow cols={1}>
                <YesNoField name='drinksAlcohol' label='Alcohol' yesLabel='Yes' noLabel='No' />
              </FormRow>
              {drinksAlcohol ? (
                <FormRow cols={2}>
                  <TextInput control={control} name='alcoholHowMuch' label='How much?' placeholder='How much' />
                  <TextInput control={control} name='alcoholFrequency' label='Frequency of use?' placeholder='Frequency of use' />
                </FormRow>
              ) : null}
            </FormSection>

            <FormSection legend='Medications & Allergies'>
              <FormRow cols={1}>
                <YesNoField name='hasCurrentMedications' label='Current medications' yesLabel='Yes' noLabel='None' />
              </FormRow>
              {hasCurrentMedications ? (
                <div className='space-y-3'>
                  <div className='text-sm font-medium'>If yes:</div>
                  <div className='max-h-72 overflow-auto rounded-md border border-border'>
                    <table className='w-full text-sm'>
                      <thead className='sticky top-0 z-10 bg-muted/50'>
                        <tr>
                          <th className='text-left px-3 py-2 font-medium'>Drug</th>
                          <th className='text-left px-3 py-2 font-medium'>Dosage</th>
                          <th className='text-left px-3 py-2 font-medium'>Frequency</th>
                          <th className='px-3 py-2 w-10' />
                        </tr>
                      </thead>
                      <tbody>
                        {currentMedFields.map((row, idx) => (
                          <tr key={row.id} className='border-t'>
                            <td className='px-3 py-2'>
                              <FormField
                                control={control}
                                name={`currentMedications.${idx}.drug` as any}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormControl>
                                      <Input placeholder='Drug' {...field} value={field.value ?? ''} />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </td>
                            <td className='px-3 py-2'>
                              <FormField
                                control={control}
                                name={`currentMedications.${idx}.dosage` as any}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormControl>
                                      <Input placeholder='Dosage' {...field} value={field.value ?? ''} />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </td>
                            <td className='px-3 py-2'>
                              <FormField
                                control={control}
                                name={`currentMedications.${idx}.frequency` as any}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormControl>
                                      <Input placeholder='Frequency' {...field} value={field.value ?? ''} />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </td>
                            <td className='px-3 py-2 align-top'>
                              <IconButton
                                iconName='Trash2'
                                tooltip='Remove'
                                className='text-destructive hover:text-destructive'
                                onClick={() => removeCurrentMed(idx)}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className='flex justify-end'>
                    <AppButton
                      type='button'
                      variant='secondary'
                      size='sm'
                      iconName='Plus'
                      onClick={() => appendCurrentMed({ drug: '', dosage: '', frequency: '' } as any)}
                    >
                      Add
                    </AppButton>
                  </div>
                </div>
              ) : null}
              <FormRow cols={1}>
                <YesNoField name='hasMedicationAllergies' label='Medication allergies' yesLabel='Yes' noLabel='None' />
              </FormRow>
              {hasMedicationAllergies ? (
                <FormRow cols={1}>
                  <TextareaInput control={control} name='otherAllergies' label='Other allergies' placeholder='Describe other allergies' rows={3} />
                </FormRow>
              ) : null}
              <FormRow cols={1}>
                <YesNoField name='hadAllergyTest' label='Have you ever had an allergy test?' yesLabel='Yes' noLabel='No' />
              </FormRow>
              {hadAllergyTest ? (
                <FormRow cols={1}>
                  <TextareaInput control={control} name='allergyTestDetails' label='Allergy test details' placeholder='Allergy test details' rows={3} />
                </FormRow>
              ) : null}
            </FormSection>

            <FormSection legend='Medical History'>
              <FormRow cols={1}>
                <MultiSelectInput
                  control={control as any}
                  name={'medicalHistory' as any}
                  label='Medical history'
                  placeholder='Select medical history'
                  options={MEDICAL_HISTORY_OPTIONS}
                />
              </FormRow>
              {showMedicalHistoryOther ? (
                <FormRow cols={1}>
                  <TextInput control={control} name='medicalHistoryOther' label='Other explain' placeholder='Explain other medical history' />
                </FormRow>
              ) : null}
            </FormSection>

            <FormSection legend='Surgical History'>
              <FormRow cols={1}>
                <YesNoField name='hasSurgicalHistory' label='Surgical history' yesLabel='Yes' noLabel='None' />
              </FormRow>
              {hasSurgicalHistory ? (
                <div className='space-y-3'>
                  <div className='text-sm font-medium'>If yes:</div>
                  <div className='max-h-72 overflow-auto rounded-md border border-border'>
                    <table className='w-full text-sm'>
                      <thead className='sticky top-0 z-10 bg-muted/50'>
                        <tr>
                          <th className='text-left px-3 py-2 font-medium'>Type</th>
                          <th className='text-left px-3 py-2 font-medium'>Year</th>
                          <th className='px-3 py-2 w-10' />
                        </tr>
                      </thead>
                      <tbody>
                        {surgicalFields.map((row, idx) => (
                          <tr key={row.id} className='border-t'>
                            <td className='px-3 py-2'>
                              <FormField
                                control={control}
                                name={`surgicalHistory.${idx}.type` as any}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormControl>
                                      <Input placeholder='Type' {...field} value={field.value ?? ''} />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </td>
                            <td className='px-3 py-2'>
                              <FormField
                                control={control}
                                name={`surgicalHistory.${idx}.year` as any}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormControl>
                                      <Input placeholder='Year' {...field} value={field.value ?? ''} />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </td>
                            <td className='px-3 py-2 align-top'>
                              <IconButton
                                iconName='Trash2'
                                tooltip='Remove'
                                className='text-destructive hover:text-destructive'
                                onClick={() => removeSurgical(idx)}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className='flex justify-end'>
                    <AppButton
                      type='button'
                      variant='secondary'
                      size='sm'
                      iconName='Plus'
                      onClick={() => appendSurgical({ type: '', year: '' } as any)}
                    >
                      Add
                    </AppButton>
                  </div>
                </div>
              ) : null}
            </FormSection>

            <FormSection legend='Family History'>
              <FormRow cols={1}>
                <MultiSelectInput
                  control={control as any}
                  name={'familyHistory' as any}
                  label='Family history'
                  placeholder='Select family history'
                  options={FAMILY_HISTORY_OPTIONS}
                />
              </FormRow>
              {showFamilyHistoryOther ? (
                <FormRow cols={1}>
                  <TextareaInput control={control} name='familyHistoryOther' label='Other' placeholder='Describe other family history' rows={3} />
                </FormRow>
              ) : null}
            </FormSection>
          </AppCard.Content>

          <AppCard.Footer className='justify-end'>
            <AppButton
              type='button'
              variant='secondary'
              onClick={() => router.push('/patients')}
              disabled={saving}
              iconName='X'
            >
              Cancel
            </AppButton>
            <AppButton type='submit' isLoading={saving} disabled={saving || !form.formState.isValid} iconName='Save'>
              Save
            </AppButton>
          </AppCard.Footer>
        </form>
      </AppCard>
    </Form>
  );
}
