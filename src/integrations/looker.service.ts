import { Injectable } from '@nestjs/common';

@Injectable()
export class LookerService {
  templateLink(projectId: string) {
    return `https://lookerstudio.google.com/reporting/template?project=${projectId}`;
  }

  exportCsv(projectId: string) {
    return `event,metric\n${projectId}_purchase,100\n${projectId}_signup,250`;
  }
}
