import { Injectable } from '@nestjs/common';

type EventLike = {
  _id: string;
  name: string;
  category: string;
  actionType: string;
  component: string;
};

@Injectable()
export class DataLayerGeneratorService {
  generateJson(projectId: string, events: EventLike[], version = 1) {
    const data = {
      version: `v${version}`,
      projectId,
      events: events.map((e) => ({
        id: e._id,
        name: e.name,
        category: e.category,
        actionType: e.actionType,
        component: e.component,
      })),
    };
    return JSON.stringify(data, null, 2);
  }

  generateJs(projectId: string, events: EventLike[], version = 1) {
    const json = this.generateJson(projectId, events, version);
    const lines = [
      'window.dataLayer = window.dataLayer || [];',
      'function gtag(){dataLayer.push(arguments);}',
      'gtag("js", new Date());',
      `// Project ${projectId} - Measurement plan v${version}`,
      `// Events:`,
      ...events.map(
        (e) =>
          `// ${e.name} -> example: gtag('event', '${e.name}', { category: '${e.category}', component: '${e.component}' });`,
      ),
      `// --- Full plan ---`,
      `// ${json.replace(/\n/g, '\\n')}`,
    ];
    return lines.join('\n');
  }
}
