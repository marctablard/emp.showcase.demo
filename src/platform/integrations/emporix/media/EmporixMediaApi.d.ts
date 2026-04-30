export interface EmporixMediaAsset {
  id: string;
  url: string;
  fileName?: string;
  contentType?: string;
  bytes?: number;
  createdAt?: string;
}

export interface EmporixMediaApi {
  getAsset(assetId: string): Promise<EmporixMediaAsset | null>;
  uploadAsset(file: Blob, fileName: string, contentType: string): Promise<EmporixMediaAsset>;
  deleteAsset(assetId: string): Promise<void>;
}
