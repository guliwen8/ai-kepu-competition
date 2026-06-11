import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

@Injectable()
export class StorageService {
  readonly uploadDir: string;

  constructor(configService: ConfigService) {
    const dir = configService.get<string>('UPLOAD_DIR') ?? './uploads';
    this.uploadDir = resolve(process.cwd(), dir);
    mkdirSync(this.uploadDir, { recursive: true });
  }
}

