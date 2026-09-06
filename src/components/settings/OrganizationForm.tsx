// src/components/settings/OrganizationForm.tsx
'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { Loader2, Building, Globe, Calendar, TrendingUp, AlertTriangle, CheckCircle } from 'lucide-react';
import { Organization } from '@/lib/data';

interface OrganizationFormProps {
  initialData: Organization;
  orgId: string;
  onUpdateSuccess?: (message: string) => void;
}

interface FormData {
  name: string;
  jurisdiction: string;
  incorporationDate: string;
  revenueModel: string;
}

// Jurisdiction options
const jurisdictionOptions = [
  { value: '', label: 'Select Jurisdiction' },
  { value: 'US-DE', label: 'United States - Delaware' },
  { value: 'US-CA', label: 'United States - California' },
  { value: 'US-NY', label: 'United States - New York' },
  { value: 'US-TX', label: 'United States - Texas' },
  { value: 'GB', label: 'United Kingdom' },
  { value: 'AE-DU', label: 'UAE - Dubai (Mainland)' },
  { value: 'AE-AZA', label: 'UAE - Abu Dhabi Global Market (ADGM)' },
  { value: 'SG', label: 'Singapore' },
  { value: 'CA', label: 'Canada' },
  { value: 'AU', label: 'Australia' },
  { value: 'DE', label: 'Germany' },
  { value: 'FR', label: 'France' },
  { value: 'NL', label: 'Netherlands' },
  { value: 'CH', label: 'Switzerland' },
  { value: 'HK', label: 'Hong Kong' },
];

// Revenue model options
const revenueModelOptions = [
  { value: '', label: 'Select Revenue Model' },
  { value: 'SaaS', label: 'SaaS (Software as a Service)' },
  { value: 'Retail', label: 'Retail / E-commerce' },
  { value: 'Services', label: 'Professional Services / Consulting' },
  { value: 'Marketplace', label: 'Marketplace / Platform' },
  { value: 'Subscription', label: 'Subscription (Non-SaaS)' },
  { value: 'Hardware', label: 'Hardware / Physical Products' },
  { value: 'Freemium', label: 'Freemium Model' },
  { value: 'Advertising', label: 'Advertising Revenue' },
  { value: 'Commission', label: 'Commission Based' },
  { value: 'Licensing', label: 'Licensing / IP' },
  { value: 'Other', label: 'Other' },
];

export default function OrganizationForm({ initialData, orgId, onUpdateSuccess }: OrganizationFormProps) {
  // Form state
  const [formData, setFormData] = useState<FormData>({
    name: initialData.name || '',
    jurisdiction: initialData.jurisdiction || '',
    incorporationDate: initialData.incorporation_date || '',
    revenueModel: initialData.revenue_model || '',
  });

  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<FormData>>({});

  // Sync form when initialData changes (proper dependency)
  useEffect(() => {
    setFormData({
      name: initialData.name || '',
      jurisdiction: initialData.jurisdiction || '',
      incorporationDate: initialData.incorporation_date || '',
      revenueModel: initialData.revenue_model || '',
    });
  }, [initialData]);

  // Check if form is dirty (has unsaved changes)
  const isDirty =
    formData.name !== (initialData.name || '') ||
    formData.jurisdiction !== (initialData.jurisdiction || '') ||
    formData.incorporationDate !== (initialData.incorporation_date || '') ||
    formData.revenueModel !== (initialData.revenue_model || '');

  // Validation
  const validate = useCallback(async (): Promise<boolean> => {
    const errors: Partial<FormData> = {};

    // Basic validation
    if (!formData.name.trim() || formData.name.length < 2 || formData.name.length > 140) {
      errors.name = 'Organization name must be between 2 and 140 characters.';
    }
    if (!formData.jurisdiction) {
      errors.jurisdiction = 'Please select a jurisdiction.';
    }
    if (formData.incorporationDate) {
      const today = new Date().toISOString().split('T')[0];
      if (formData.incorporationDate > today) {
        errors.incorporationDate = 'Incorporation date cannot be in the future.';
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(formData.incorporationDate)) {
        errors.incorporationDate = 'Date must be in YYYY-MM-DD format.';
      }
    }

    // Anti-duplicate check for organization name (only if name changed)
    if (formData.name.trim() !== initialData.name?.trim() && formData.name.trim()) {
      try {
        const response = await fetch(`/api/validate/organization?name=${encodeURIComponent(formData.name.trim())}&orgId=${orgId}`);
        const data = await response.json();
        if (!response.ok) {
          if (data.error === 'duplicate_name') {
            errors.name = 'This organization name is already in use.';
          }
        }
      } catch (err) {
        console.error('Error validating organization name:', err);
        // Don't block submission for validation API errors
      }
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }, [formData, initialData.name, orgId]);

  // Handle form submission
  const handleSubmit = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (!await validate()) {
      return;
    }

    setIsLoading(true);
    try {
      const organizationData = {
        name: formData.name.trim(),
        jurisdiction: formData.jurisdiction,
        incorporation_date: formData.incorporationDate || undefined,
        revenue_model: formData.revenueModel || undefined,
      };

      const response = await fetch(`/api/organizations/${orgId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationData }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to update organization details.');
      }

      const responseData = await response.json();
      const updatedOrg = responseData.organization;

      // Update form state with saved data to reset dirty state
      if (updatedOrg) {
        setFormData({
          name: updatedOrg.name || '',
          jurisdiction: updatedOrg.jurisdiction || '',
          incorporationDate: updatedOrg.incorporation_date || '',
          revenueModel: updatedOrg.revenue_model || '',
        });
      }

      setSuccessMessage('Organization details updated successfully!');

      // Call parent callback if provided
      if (onUpdateSuccess) {
        onUpdateSuccess('Organization details updated successfully.');
      }

      // Clear success message after 4 seconds
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred.');
    } finally {
      setIsLoading(false);
    }
  }, [formData, validate, orgId, onUpdateSuccess]);

  // Handle input changes
  const handleChange = useCallback((field: keyof FormData, value: string) => {
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
      {successMessage && (
        <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-md text-xs border border-emerald-500/30 flex items-center gap-2">
          <CheckCircle size={16} /> {successMessage}
        </div>
      )}

      {/* Form Fields */}
      <div className="space-y-4">
        {/* Organization Name */}
        <div className="zenith-form-group">
          <label htmlFor="orgName" className="zenith-label">
            Organization Name <span className="text-red-400">*</span>
          </label>
          <div className="relative">
            <Building className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 theme-text-secondary" />
            <input
              id="orgName"
              type="text"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              className={`zenith-input pl-10 ${fieldErrors.name ? 'border-red-500' : ''}`}
              placeholder="e.g., Acme Innovations Inc."
              disabled={isLoading}
            />
          </div>
          {fieldErrors.name && <p className="text-xs text-red-400 mt-1">{fieldErrors.name}</p>}
        </div>

        {/* Jurisdiction and Incorporation Date */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Jurisdiction */}
          <div className="zenith-form-group">
            <label htmlFor="jurisdiction" className="zenith-label">
              Jurisdiction <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <Globe className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 theme-text-secondary" />
              <select
                id="jurisdiction"
                value={formData.jurisdiction}
                onChange={(e) => handleChange('jurisdiction', e.target.value)}
                className={`zenith-select pl-10 ${fieldErrors.jurisdiction ? 'border-red-500' : ''}`}
                disabled={isLoading}
              >
                {jurisdictionOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            {fieldErrors.jurisdiction && (
              <p className="text-xs text-red-400 mt-1">{fieldErrors.jurisdiction}</p>
            )}
          </div>

          {/* Incorporation Date */}
          <div className="zenith-form-group">
            <label htmlFor="incorporationDate" className="zenith-label">
              Incorporation Date
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 theme-text-secondary" />
              <input
                id="incorporationDate"
                type="date"
                value={formData.incorporationDate}
                onChange={(e) => handleChange('incorporationDate', e.target.value)}
                onClick={(e) => e.currentTarget.showPicker?.()}
                className={`zenith-input pl-10 appearance-none
                  [&::-webkit-calendar-picker-indicator]:opacity-0
                  [&::-webkit-calendar-picker-indicator]:absolute
                  [&::-webkit-calendar-picker-indicator]:right-0
                  [&::-webkit-calendar-picker-indicator]:cursor-pointer
                  -moz-appearance-none ${fieldErrors.incorporationDate ? 'border-red-500' : ''}`}
                disabled={isLoading}
                max={new Date().toISOString().split('T')[0]}
              />
            </div>
            {fieldErrors.incorporationDate && (
              <p className="text-xs text-red-400 mt-1">{fieldErrors.incorporationDate}</p>
            )}
          </div>
        </div>

        {/* Revenue Model */}
        <div className="zenith-form-group">
          <label htmlFor="revenueModel" className="zenith-label">
            Primary Revenue Model
          </label>
          <div className="relative">
            <TrendingUp className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 theme-text-secondary" />
            <select
              id="revenueModel"
              value={formData.revenueModel}
              onChange={(e) => handleChange('revenueModel', e.target.value)}
              className="zenith-select pl-10"
              disabled={isLoading}
            >
              {revenueModelOptions.map(opt => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
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
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            'Save Changes'
          )}
        </button>
      </div>
    </form>
  );
}
