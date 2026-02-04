import { useState } from 'react';

export interface BookingData {
  // Contact Information
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
}

export interface BookingState {
  data: BookingData;
  error: string | null;
}

// Calendly configuration - actual Calendly link
const CALENDLY_BASE_URL = 'https://calendly.com/austyneguale/30min';

export function useBooking() {
  const [state, setState] = useState<BookingState>({
    data: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
    },
    error: null,
  });

  const updateData = (updates: Partial<BookingData>) => {
    setState((prev) => ({
      ...prev,
      data: { ...prev.data, ...updates },
    }));
  };

  const setError = (error: string | null) => {
    setState((prev) => ({ ...prev, error }));
  };

  const reset = () => {
    setState({
      data: {
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
      },
      error: null,
    });
  };

  // Submit contact details to backend, then redirect to Calendly
  const redirectToCalendly = async () => {
    const { firstName, lastName, email, phone } = state.data;

    try {
      // First, submit contact details to backend
      const response = await fetch('/api/contact-lead', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          firstName,
          lastName,
          email,
          phone,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to submit contact details');
      }

      // Success! Now build Calendly URL with pre-filled parameters
      const params = new URLSearchParams();
      params.append('name', `${firstName} ${lastName}`);
      params.append('email', email);
      if (phone) {
        params.append('a1', phone); // a1 is the custom field parameter for phone
      }

      const calendlyUrl = `${CALENDLY_BASE_URL}?${params.toString()}`;

      // Open Calendly in new tab
      window.open(calendlyUrl, '_blank');
    } catch (error) {
      console.error('Error submitting contact details:', error);
      setError(error instanceof Error ? error.message : 'Failed to submit contact details');
      throw error; // Re-throw so the modal can handle it
    }
  };

  return {
    data: state.data,
    error: state.error,
    updateData,
    setError,
    redirectToCalendly,
    reset,
  };
}
