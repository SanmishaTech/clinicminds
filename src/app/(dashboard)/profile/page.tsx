'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { apiGet, apiPatch } from '@/lib/api-client';
import { toast } from '@/lib/toast';
import { useRouter } from 'next/navigation';
import { AppCard } from '@/components/common/app-card';
import { AppButton } from '@/components/common/app-button';
import { FormSection, FormRow } from '@/components/common/app-form';
import { Form } from '@/components/ui/form';
import { TextInput } from '@/components/common/text-input';
import { EmailInput } from '@/components/common';
import { PasswordInput } from '@/components/common';

type ProfileData = {
  id: number;
  name: string | null;
  email: string;
  role: string;
  profilePhoto: string | null;
  status: boolean;
  lastLogin: string | null;
};

const schema = z.object({
  name: z.string().min(1, 'Name is required').max(255, 'Name must be less than 255 characters'),
  email: z.string().min(1,"Email is required").email('Invalid email format').max(255, 'Email must be less than 255 characters'),
  password: z.preprocess(
    (v) => (v === "" || v === null ? undefined : v),
    z.string().min(8, 'Password must be at least 8 characters long').max(255, 'Password must be less than 255 characters').optional()
  ).nullable().optional(),
  confirmPassword: z.preprocess(
    (v) => (v === "" || v === null ? undefined : v),
    z.string().optional()
  ).nullable().optional(),
}).refine(
  (data) => {
    // If either password field is provided, both must be provided
    if (data.password || data.confirmPassword) {
      return !!(data.password && data.confirmPassword);
    }
    return true;
  },
  {
    message: "Both password fields are required to change password",
    path: ["confirmPassword"],
  }
).refine(
  (data) => {
    // Password and confirm password must match
    if (data.password && data.confirmPassword) {
      return data.password === data.confirmPassword;
    }
    return true;
  },
  {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  }
);

type FormValues = z.infer<typeof schema>;

export default function ProfilePage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [profileData, setProfileData] = useState<ProfileData | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: 'onChange',
    reValidateMode: 'onChange',
    defaultValues: {
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  });

  const { control, handleSubmit, reset } = form;

  useEffect(() => {
    async function fetchProfile() {
      try {
        const response = await apiGet('/api/users/me');
        const data = response as ProfileData;
        setProfileData(data);
        reset({
          name: data.name || '',
          email: data.email || '',
          password: '',
          confirmPassword: '',
        });
      } catch (error) {
        toast.error('Failed to load profile data');
        console.error('Profile fetch error:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchProfile();
  }, [reset]);

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    try {
      const updateData: any = {
        name: values.name.trim(),
        email: values.email.trim().toLowerCase(),
      };

      if (values.password && values.password.trim().length > 0) {
        updateData.password = values.password;
      }

      const response = await apiPatch('/api/users/me', updateData);
      toast.success('Profile updated successfully');
      router.back();
    } catch (err) {
      toast.error((err as Error).message || 'Failed to update profile');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading profile...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AppCard>
        <AppCard.Header>
          <AppCard.Title>Profile Settings</AppCard.Title>
          <AppCard.Description>
            Update your personal information and password.
          </AppCard.Description>
        </AppCard.Header>
        <Form {...form}>
          <form onSubmit={handleSubmit(onSubmit)}>
            <AppCard.Content>
              <FormSection legend="Personal Information">
                <FormRow cols={2}>
                  <TextInput control={control} name="name" label="Full Name" required placeholder="Enter your full name" />
                  <EmailInput control={control} name="email" label="Email Address" required placeholder="Enter your email address" />
                </FormRow>
              </FormSection>

              <FormSection legend="Change Password">
                <FormRow cols={2}>
                  <PasswordInput control={control} name="password" label="New Password" placeholder="Leave blank to keep current password" autoComplete="new-password" />
                  <PasswordInput control={control} name="confirmPassword" label="Confirm New Password" placeholder="Confirm new password" autoComplete="new-password" />
                </FormRow>
              </FormSection>
            </AppCard.Content>

            <AppCard.Footer className="justify-end">
              <AppButton
                type="submit"
                iconName="Save"
                isLoading={submitting}
                disabled={submitting || !form.formState.isValid}
              >
                Update Profile
              </AppButton>
            </AppCard.Footer>
          </form>
        </Form>
      </AppCard>
    </div>
  );
}