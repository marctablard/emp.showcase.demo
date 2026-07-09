import { AssistedBuyingTokens, Credentials, Registration, Session } from '../model/auth';

/**
 * Service for authentication-related operations
 */
export interface AuthService {
  /**
   * Login a customer with credentials
   * @param credentials User credentials containing username and password (optional for SSO)
   * @returns Promise with the authentication session
   */
  login(credentials: Credentials): Promise<Session>;

  /**
   * Establish a customer session from assisted buying URL tokens.
   * @param tokens Customer token payload from Management Dashboard
   */
  loginWithAssistedBuying(tokens: AssistedBuyingTokens): Promise<Session>;

  /**
   * Logout the current customer
   * Clears the current session
   * @returns Promise that resolves when logout is complete
   */
  logout(): Promise<void>;

  /**
   * Register a new customer
   * @param register Registration data containing credentials and customer details
   * @returns Promise with the authentication session
   */
  register(register: Registration): Promise<Session>;

  /**
   * Get the current session information
   * @returns Promise with the current session or null if not logged in
   */
  getCurrentSession(): Promise<Session | null>;
}
