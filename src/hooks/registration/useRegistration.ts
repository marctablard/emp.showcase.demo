import { useState } from 'react';
import { register as apiRegister } from '@/lib/client/auth';
import type { Registration } from '@/platform/services/model/auth/auth';

interface RegistrationResult {
  success: boolean;
  userId?: string;
  error?: string;
}

interface RegistrationHook {
  loading: boolean;
  register: (data: Registration) => Promise<RegistrationResult>;
  error: string | null;
  isSuccess: boolean;
}

/**
 * Hook for user registration functionality
 * @returns Registration state and functions
 */
export const useRegistration = (): RegistrationHook => {
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);

  /**
   * Mock registration function
   * @param data Registration data from form
   * @returns Promise resolving to registration result
   */
  const register = async (data: Registration): Promise<RegistrationResult> => {
    // Reset states at the beginning
    setLoading(true);
    setError(null);
    setIsSuccess(false);

    try {
      // Call the registration API
      const session = await apiRegister(data);

      setIsSuccess(true);
      setLoading(false);

      return {
        success: true,
        userId: session.customerId,
      };
    } catch (error) {
      setLoading(false);
      setError(error instanceof Error ? error.message : 'Unknown error');

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  };

  return {
    loading,
    register,
    error,
    isSuccess,
  };
};

export default useRegistration;
