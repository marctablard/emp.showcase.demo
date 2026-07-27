export interface LocalAuthSyncBootstrapResult {
  authenticated: true;
  siteCode?: string;
  currency?: string;
}

export interface LocalAuthSyncBootstrapServiceContract {
  bootstrap(): Promise<LocalAuthSyncBootstrapResult>;
}
