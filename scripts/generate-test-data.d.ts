export interface StressVaultOptions {
  siteCount?: number;
  folderCount?: number;
  bookmarksPerSite?: number;
  credentialsPerEntry?: number;
}

export interface StressVaultFixture {
  exportedAt: string;
  sites: unknown[];
}

export function createStressVault(options?: StressVaultOptions): StressVaultFixture;
