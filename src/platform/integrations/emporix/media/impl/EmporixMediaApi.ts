import { inject } from 'inversify';
import 'server-only';
import { injectable } from '@/platform/core/di/injectable';
import type EmporixApiClient from '../../common/impl/EmporixApiInvoker';
import type { EmporixConfig } from '../../config';
import type { EmporixMediaAsset, EmporixMediaApi as IEmporixMediaApi } from '../EmporixMediaApi';

@injectable('EmporixMediaApi', 'Singleton')
class EmporixMediaApi implements IEmporixMediaApi {
  constructor(
    @inject('EmporixApiInvoker') private apiClient: EmporixApiClient,
    @inject('EmporixConfig') private config: EmporixConfig,
  ) {}

  async getAsset(assetId: string): Promise<EmporixMediaAsset | null> {
    const response = await this.apiClient.authenticatedFetch(
      `/media/${this.config.tenant}/assets/${assetId}`,
      { method: 'GET' },
      'service',
    );

    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error(`Failed to get media asset: ${response.statusText}`);
    }

    const data = await response.json();
    return this.mapAsset(assetId, data);
  }

  async uploadAsset(file: Blob, fileName: string, contentType: string): Promise<EmporixMediaAsset> {
    const formData = new FormData();
    formData.append('file', file, fileName);
    formData.append('fileName', fileName);
    formData.append('contentType', contentType);

    const response = await this.apiClient.authenticatedFetch(
      `/media/${this.config.tenant}/assets`,
      {
        method: 'POST',
        body: formData,
      },
      'service',
    );

    if (!response.ok) {
      const errorDetails = await response.text();
      throw new Error(`Failed to upload media asset: ${response.statusText} ${errorDetails}`);
    }

    const data = await response.json();
    return this.mapAsset(data.id ?? data.assetId, data, fileName, contentType);
  }

  async deleteAsset(assetId: string): Promise<void> {
    const response = await this.apiClient.authenticatedFetch(
      `/media/${this.config.tenant}/assets/${assetId}`,
      { method: 'DELETE' },
      'service',
    );

    if (!response.ok) {
      const errorDetails = await response.text();
      throw new Error(`Failed to delete media asset: ${response.statusText} ${errorDetails}`);
    }
  }

  private mapAsset(id: string, data: Record<string, any>, fileName?: string, contentType?: string): EmporixMediaAsset {
    return {
      id,
      url: data.url ?? data.link ?? data.downloadUrl ?? '',
      fileName: data.details?.filename ?? data.fileName ?? data.name ?? fileName ?? id,
      contentType:
        data.details?.mimeType ?? data.contentType ?? data.mimeType ?? contentType ?? 'application/octet-stream',
      bytes: data.details?.bytes,
      createdAt: data.createdAt ?? data.metadata?.createdAt,
    };
  }
}

export default EmporixMediaApi;
