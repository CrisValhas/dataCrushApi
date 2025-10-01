import { Injectable } from '@nestjs/common';

@Injectable()
export class GtmService {
  async connectOAuth() {
    return { connected: true, provider: 'GTM' };
  }
  async listContainers() {
    return [
      { id: 'gtm-123', name: 'Web Main', publicId: 'GTM-XXXX' },
      { id: 'gtm-456', name: 'Web Staging', publicId: 'GTM-YYYY' },
    ];
  }
  async exportWorkspace(_projectId: string) {
    return {
      tags: [{ name: 'ga4_event_purchase', type: 'ga4' }],
      triggers: [{ name: 'click_cta' }],
      variables: [{ name: 'ENV' }],
    };
  }
}
