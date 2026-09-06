// src/components/account/ZenithProfileForm.tsx
'use client';

import { apiClient } from '@/lib/apiClient';
import React, { useState, useEffect, FormEvent } from 'react';
import { Loader2, Phone, Briefcase, Settings, Palette, TrendingUp as FocusIcon, BarChart3 as ProficiencyIcon, AlertTriangle, User as UserIcon } from 'lucide-react';
import { User } from '@/lib/data'; // Your User type

type UserPreferences = User['preferences'];

interface ZenithProfileFormData {
  firstName?: string;
  lastName?: string;
  phone?: string;
  role_title?: string;
  preferences?: UserPreferences;
}

interface ZenithProfileFormProps {
  sectionType: 'additional_info' | 'preferences';
  initialData: ZenithProfileFormData;
  onUpdateSuccess: () => void; // Callback to re-fetch data on parent page
  onDirtyChange: (isDirty: boolean) => void;
}

export default function ZenithProfileForm({ sectionType, initialData, onUpdateSuccess, onDirtyChange }: ZenithProfileFormProps) {
  // Initialize state with default empty strings to ensure controlled inputs
  const [firstName, setFirstName] = useState<string>(initialData.firstName || '');
  const [lastName, setLastName] = useState<string>(initialData.lastName || '');
  const [phone, setPhone] = useState<string>(initialData.phone || '');
  const [roleTitle, setRoleTitle] = useState<string>(initialData.role_title || '');
  const [preferences, setPreferences] = useState<UserPreferences>(
    initialData.preferences || {
      theme: 'midnight', // Default theme from User interface
      strategic_focus: 'growth', // Default from User interface
      proficiency_level: 'beginner', // Default from User interface
    }
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<Partial<ZenithProfileFormData>>({});

  // Initialize form fields from props only once when component mounts
  useEffect(() => {
    setFirstName(initialData.firstName || '');
    setLastName(initialData.lastName || '');
    setPhone(initialData.phone || '');
    setRoleTitle(initialData.role_title || '');
    setPreferences(initialData.preferences || { theme: 'midnight', strategic_focus: 'growth', proficiency_level: 'beginner' });
  }, []);

  // Effect to check if form is "dirty" AND report it to the parent
  const [isDirty, setIsDirty] = useState(false);
  
  useEffect(() => {
    const dirty = (firstName || '') !== (initialData.firstName || '') ||
                  (lastName || '') !== (initialData.lastName || '') ||
                  (phone || '') !== (initialData.phone || '') ||
                  (roleTitle || '') !== (initialData.role_title || '');
    setIsDirty(dirty);
    onDirtyChange(dirty);
  }, [firstName, lastName, phone, roleTitle, initialData.firstName, initialData.lastName, initialData.phone, initialData.role_title, onDirtyChange]);


  const validate = async (): Promise<boolean> => {
    const newErrors: Partial<ZenithProfileFormData> = {};
    if (sectionType === 'additional_info') {
      if (!firstName || firstName.length < 2 || firstName.length > 50) {
        newErrors.firstName = 'First name must be between 2 and 50 characters.';
      }
      if (!lastName || lastName.length < 2 || lastName.length > 50) {
        newErrors.lastName = 'Last name must be between 2 and 50 characters.';
      }
      if (phone && !/^\+?[1-9]\d{1,14}$/.test(phone)) {
        newErrors.phone = 'Please enter a valid phone number (e.g., +12223334444).';
      }
      if (roleTitle && roleTitle.length > 60) {
        newErrors.role_title = 'Role/Title must be 60 characters or less.';
      }
      
      // Check for duplicate email if email is being changed
      // Note: Email is typically managed by Clerk, but if your app allows changing emails,
      // you would add validation here
    }
    // Add validation for preferences if needed
    setFormErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    if (!await validate()) {
      return;
    }

    setIsLoading(true);
    try {
      const payload: Partial<User> = {};
      if (sectionType === 'additional_info') {
        payload.first_name = firstName.trim();
        payload.last_name = lastName.trim();
        payload.phone = phone.trim() || undefined;
        payload.role_title = roleTitle.trim() || undefined;
      }

      if (sectionType === 'preferences') {
        let prefsChanged = false;
        if (!initialData.preferences || 
            preferences.theme !== initialData.preferences.theme ||
            preferences.strategic_focus !== initialData.preferences.strategic_focus ||
            preferences.proficiency_level !== initialData.preferences.proficiency_level) {
          prefsChanged = true;
        }
        if(prefsChanged) payload.preferences = preferences;
      }
      
      // Always proceed with the update even if no visible changes
      // This ensures the form state is properly reset
      
      const response = await apiClient('/api/users/me/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to update profile.');
      }
      setSuccessMessage('Profile updated successfully!');
      // Reset form state by re-fetching the latest data
      onUpdateSuccess();
      // Reset dirty state
      setIsDirty(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred.');
    } finally {
      setIsLoading(false);
      setTimeout(() => setSuccessMessage(null), 3000);
    }
  };

  const handlePreferenceChange = <K extends keyof UserPreferences>(
    key: K,
    value: UserPreferences[K]
  ) => {
    setPreferences((prev) => ({ ...prev, [key]: value }));
  };

  // Render the appropriate form fields based on section type
  // Check if form has any changes
  
  const renderFormFields = () => {
    if (sectionType === 'additional_info') {
      return (
        <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="zenith-form-group">
                  <label htmlFor="firstName" className="zenith-label required">First Name</label>
                  <div className="relative">
                      <UserIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 theme-text-secondary pointer-events-none" />
                      <input 
                          id="firstName" 
                          type="text" 
                          value={firstName || ''} 
                          onChange={(e) => setFirstName(e.target.value)}
                          className={`zenith-input zenith-input-with-icon-left ${formErrors.firstName ? 'border-red-500' : ''}`}
                          placeholder="e.g., Sarah" 
                          disabled={isLoading} 
                          autoComplete="given-name"
                      />
                  </div>
                  {formErrors.firstName && <p className="text-xs text-red-400 mt-1">{formErrors.firstName}</p>}
                </div>
                <div className="zenith-form-group">
                  <label htmlFor="lastName" className="zenith-label required">Last Name</label>
                  <div className="relative">
                      <UserIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 theme-text-secondary pointer-events-none" />
                      <input 
                          id="lastName" 
                          type="text" 
                          value={lastName || ''} 
                          onChange={(e) => setLastName(e.target.value)}
                          className={`zenith-input zenith-input-with-icon-left ${formErrors.lastName ? 'border-red-500' : ''}`}
                          placeholder="e.g., Chen" 
                          disabled={isLoading} 
                          autoComplete="family-name"
                      />
                  </div>
                  {formErrors.lastName && <p className="text-xs text-red-400 mt-1">{formErrors.lastName}</p>}
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="zenith-form-group">
                <label htmlFor="phone" className="zenith-label">Phone Number</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 theme-text-secondary pointer-events-none" />
                  <input 
                    id="phone" 
                    type="tel" 
                    value={phone || ''} 
                    onChange={(e) => setPhone(e.target.value)}
                    className={`zenith-input zenith-input-with-icon-left ${formErrors.phone ? 'border-red-500' : ''}`}
                    placeholder="e.g., +1 555 123 4567" 
                    disabled={isLoading} 
                    autoComplete="tel"
                  />
                </div>
                {formErrors.phone && <p className="text-xs text-red-400 mt-1">{formErrors.phone}</p>}
              </div>
              <div className="zenith-form-group">
                <label htmlFor="roleTitle" className="zenith-label">Role / Title</label>
                <div className="relative">
                  <Briefcase className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 theme-text-secondary pointer-events-none" />
                  <input 
                    id="roleTitle" 
                    type="text" 
                    value={roleTitle || ''} 
                    onChange={(e) => setRoleTitle(e.target.value)}
                    className={`zenith-input zenith-input-with-icon-left ${formErrors.role_title ? 'border-red-500' : ''}`}
                    placeholder="e.g., CEO, Founder, Finance Manager" 
                    disabled={isLoading} 
                    autoComplete="organization-title"
                  />
                </div>
                {formErrors.role_title && <p className="text-xs text-red-400 mt-1">{formErrors.role_title}</p>}
              </div>
            </div>
        </div>
      );
    }
    // ... logic for other sectionTypes if needed
    return null;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {error && (
        <div className="p-3 bg-red-500/10 text-red-400 rounded-md text-sm border border-red-500/30 flex items-center gap-2">
          <AlertTriangle size={18} /> {error}
        </div>
      )}
      {successMessage && !isLoading && (
        <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-md text-sm border border-emerald-500/30">
          {successMessage}
        </div>
      )}

      {renderFormFields()}

      <div className="pt-4 flex justify-end">
        <button
          type="submit"
          disabled={isLoading || !isDirty}
          className={`py-2.5 px-6 rounded-lg text-sm flex items-center min-w-[120px] justify-center ${
            isDirty 
              ? 'btn-get-started' 
              : 'btn-get-started opacity-50 cursor-not-allowed'
          }`}
        >
          {isLoading ? (<Loader2 className="h-4 w-4 animate-spin" />) : ('Save Changes')}
        </button>
      </div>
    </form>
  );
}