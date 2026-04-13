import { getLogger } from '@/lib/logger/use-logger-client';
import { Session } from '@/platform/services/model/session/session';

/**
 * Fetch the current session information
 * @returns {Promise<Session|null>} The session or null if not available
 */
export async function fetchCurrentSession(throwOnError: boolean = false): Promise<Session | null> {
  try {
    const response = await fetch('/api/session', {
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch session: ${response.statusText}`);
    }

    const session = await response.json();
    return session;
  } catch (error) {
    getLogger().error({ err: error }, 'Error fetching session');
    if (throwOnError) {
      throw error;
    }
    return null;
  }
}

/**
 * Update the session language
 * @param {string} language - The language code to set
 * @returns {Promise<boolean>} Success status
 */
export async function updateSessionLanguage(language: string): Promise<boolean> {
  try {
    const response = await fetch('/api/session/language', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ language }),
    });

    if (!response.ok) {
      throw new Error(`Failed to update language: ${response.statusText}`);
    }

    return true;
  } catch (error) {
    getLogger().error({ err: error, language }, 'Error updating language');
    return false;
  }
}

/**
 * Update the session currency
 * @param {string} currency - The currency code to set
 * @returns {Promise<boolean>} Success status
 */
export async function updateSessionCurrency(currency: string): Promise<boolean> {
  try {
    const response = await fetch('/api/session/currency', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currency }),
    });

    if (!response.ok) {
      throw new Error(`Failed to update currency: ${response.statusText}`);
    }

    return true;
  } catch (error) {
    getLogger().error({ err: error, currency }, 'Error updating currency');
    return false;
  }
}

/**
 * Update the session country
 * @param {string} country - The country code to set
 * @returns {Promise<boolean>} Success status
 */
export async function updateSessionCountry(country: string): Promise<boolean> {
  try {
    const response = await fetch('/api/session/country', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ country }),
    });

    if (!response.ok) {
      throw new Error(`Failed to update country: ${response.statusText}`);
    }

    return true;
  } catch (error) {
    getLogger().error({ err: error, country }, 'Error updating country');
    return false;
  }
}

/**
 * Update the session site
 * @param {string} site - The site code to set
 * @returns {Promise<boolean>} Success status
 */
export async function updateSessionSite(site: string): Promise<boolean> {
  try {
    const response = await fetch('/api/session/site', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ site }),
    });

    if (!response.ok) {
      throw new Error(`Failed to update site: ${response.statusText}`);
    }

    return true;
  } catch (error) {
    getLogger().error({ err: error, site }, 'Error updating site');
    return false;
  }
}

/**
 * Update the session company (legal entity)
 * @param {string} legalEntityId - The legal entity ID to set
 * @returns {Promise<boolean>} Success status
 */
export async function updateSessionCompany(legalEntityId: string): Promise<boolean> {
  try {
    const response = await fetch('/api/session/company', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ legalEntityId }),
    });

    if (!response.ok) {
      throw new Error(`Failed to update company: ${response.statusText}`);
    }

    return true;
  } catch (error) {
    getLogger().error({ err: error, legalEntityId }, 'Error updating company');
    return false;
  }
}

export async function updateSessionRegion(region: string): Promise<boolean> {
  try {
    const response = await fetch('/api/session/region', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ region }),
    });

    if (!response.ok) {
      throw new Error(`Failed to update region: ${response.statusText}`);
    }

    return true;
  } catch (error) {
    getLogger().error({ err: error, region }, 'Error updating region');
    return false;
  }
}
