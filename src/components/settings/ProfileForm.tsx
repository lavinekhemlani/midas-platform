// src/components/settings/ProfileForm.tsx
'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { Loader2, Briefcase, AlertTriangle, User as UserIcon, CheckCircle } from 'lucide-react';
import { apiClient } from '@/lib/apiClient';

interface ProfileFormData {
  firstName: string;
  lastName: string;
  role_title: string;
}

interface ProfileFormProps {
  initialData: {
    firstName?: string;
    lastName?: string;
    role_title?: string;
  };
  onUpdateSuccess?: () => void;
}

export default function ProfileForm({ initialData, onUpdateSuccess }: ProfileFormProps) {
  // Form state
  const [formData, setFormData] = useState<ProfileFormData>({
    firstName: initialData.firstName || '',
    lastName: initialData.lastName || '',
    role_title: initialData.role_title || '',
  });

  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<ProfileFormData>>({});

  // Sync form when initialData changes (proper dependency)
  useEffect(() => {
    setFormData({
      firstName: initialData.firstName || '',
      lastName: initialData.lastName || '',
      role_title: initialData.role_title || '',
    });
  }, [initialData]);

  // Check if form is dirty (has unsaved changes)
  const isDirty =
    formData.firstName !== (initialData.firstName || '') ||
    formData.lastName !== (initialData.lastName || '') ||
    formData.role_title !== (initialData.role_title || '');

  // Validation
  const validate = useCallback((): boolean => {
    const errors: Partial<ProfileFormData> = {};

    if (!formData.firstName.trim() || formData.firstName.length < 2 || formData.firstName.length > 50) {
      errors.firstName = 'First name must be between 2 and 50 characters.';
    }
    if (!formData.lastName.trim() || formData.lastName.length < 2 || formData.lastName.length > 50) {
      errors.lastName = 'Last name must be between 2 and 50 characters.';
    }
    if (formData.role_title && formData.role_title.length > 60) {
      errors.role_title = 'Role/Title must be 60 characters or less.';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }, [formData]);

  // Handle form submission
  const handleSubmit = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (!validate()) {
      return;
    }

    setIsLoading(true);
    try {
      const response = await apiClient('/api/users/me/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: formData.firstName.trim(),
          last_name: formData.lastName.trim(),
          role_title: formData.role_title.trim() || undefined,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to update profile.');
      }

      setSuccessMessage('Profile updated successfully!');

      // Call parent callback if provided
      if (onUpdateSuccess) {
        onUpdateSuccess();
      }

      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred.');
    } finally {
      setIsLoading(false);
    }
  }, [formData, validate, onUpdateSuccess]);

  // Handle input changes
  const handleChange = useCallback((field: keyof ProfileFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear field error when user starts typing
    if (fieldErrors[field]) {
      setFieldErrors(prev => ({ ...prev, [field]: undefined }));
    }
  }, [fieldErrors]);

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Error Message */}
      {error && (
        <div className="p-2.5 bg-red-500/10 text-red-400 rounded-md text-xs border border-red-500/30 flex items-center gap-2">
          <AlertTriangle size={16} /> {error}
        </div>
      )}

      {/* Success Message */}
      {successMessage && !isLoading && (
        <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-md text-xs border border-emerald-500/30 flex items-center gap-2">
          <CheckCircle size={16} /> {successMessage}
        </div>
      )}

      {/* Form Fields */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* First Name */}
        <div className="zenith-form-group">
          <label htmlFor="firstName" className="zenith-label required">
            First Name
          </label>
          <div className="relative">
            <UserIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 theme-text-secondary pointer-events-none" />
            <input
              id="firstName"
              type="text"
              value={formData.firstName}
              onChange={(e) => handleChange('firstName', e.target.value)}
              className={`zenith-input zenith-input-with-icon-left ${fieldErrors.firstName ? 'border-red-500' : ''}`}
              placeholder="e.g., Sarah"
              disabled={isLoading}
              autoComplete="given-name"
            />
          </div>
          {fieldErrors.firstName && (
            <p className="text-xs text-red-400 mt-1">{fieldErrors.firstName}</p>
          )}
        </div>

        {/* Last Name */}
        <div className="zenith-form-group">
          <label htmlFor="lastName" className="zenith-label required">
            Last Name
          </label>
          <div className="relative">
            <UserIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 theme-text-secondary pointer-events-none" />
            <input
              id="lastName"
              type="text"
              value={formData.lastName}
              onChange={(e) => handleChange('lastName', e.target.value)}
              className={`zenith-input zenith-input-with-icon-left ${fieldErrors.lastName ? 'border-red-500' : ''}`}
              placeholder="e.g., Chen"
              disabled={isLoading}
              autoComplete="family-name"
            />
          </div>
          {fieldErrors.lastName && (
            <p className="text-xs text-red-400 mt-1">{fieldErrors.lastName}</p>
          )}
        </div>
      </div>

      {/* Role/Title */}
      <div className="zenith-form-group">
        <label htmlFor="roleTitle" className="zenith-label">
          Role / Title
        </label>
        <div className="relative">
          <Briefcase className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 theme-text-secondary pointer-events-none" />
          <input
            id="roleTitle"
            type="text"
            value={formData.role_title}
            onChange={(e) => handleChange('role_title', e.target.value)}
            className={`zenith-input zenith-input-with-icon-left ${fieldErrors.role_title ? 'border-red-500' : ''}`}
            placeholder="e.g., CEO, Founder, Finance Manager"
            disabled={isLoading}
            autoComplete="organization-title"
          />
        </div>
        {fieldErrors.role_title && (
          <p className="text-xs text-red-400 mt-1">{fieldErrors.role_title}</p>
        )}
      </div>

      {/* Submit Button */}
      <div className="pt-2 flex justify-end">
        <button
          type="submit"
          disabled={isLoading || !isDirty}
          className={`py-2 px-5 rounded-lg text-sm flex items-center min-w-[110px] justify-center ${
            isDirty
              ? 'btn-get-started'
              : 'btn-get-started opacity-50 cursor-not-allowed'
          }`}
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            'Save Changes'
          )}
        </button>
      </div>
    </form>
  );
}
