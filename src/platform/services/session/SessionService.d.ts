import { Session, SessionAttribute } from '@/platform/services/model/session/session';

/**
 * Service for managing the current user's session context
 */
export interface SessionService {
  /**
   * Get the current session context
   */
  getCurrent(): Promise<Session | undefined>;

  /**
   * Get the current session context
   */
  getById(id: string): Promise<Session | undefined>;

  /**
   * Set the language for the current session context
   */
  setLanguage(language: string): Promise<void>;

  /**
   * Set the currency for the current session context
   */
  setCurrency(currency: string): Promise<void>;

  /**
   * Set the country for the current session context
   */
  setCountry(country: string): Promise<void>;

  /**
   * Set the site for the current session context
   */
  setSite(site: string): Promise<void>;

  /**
   * Set the region for the current session context
   */
  setRegion(region: string): Promise<void>;

  /**
   * Set the cart for the current session context
   */
  setCart(cartId: string): Promise<void>;
}
