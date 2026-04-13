import * as fs from 'fs/promises';
import * as path from 'path';
import { SessionMetadata, SessionStorageEngine } from './types';

export class FileSessionStore implements SessionStorageEngine {
  private dataDir: string;

  constructor(dataDir: string) {
    this.dataDir = path.resolve(dataDir);
  }

  private async ensureDir() {
    await fs.mkdir(this.dataDir, { recursive: true });
  }

  async saveSession(session: SessionMetadata): Promise<void> {
    await this.ensureDir();
    session.updatedAt = Date.now();
    const filePath = path.join(this.dataDir, `${session.id}.json`);
    await fs.writeFile(filePath, JSON.stringify(session, null, 2));
  }

  async loadSession(id: string): Promise<SessionMetadata | null> {
    const filePath = path.join(this.dataDir, `${id}.json`);
    try {
      const data = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(data) as SessionMetadata;
    } catch {
      return null;
    }
  }

  async deleteSession(id: string): Promise<boolean> {
    const filePath = path.join(this.dataDir, `${id}.json`);
    try {
      await fs.unlink(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async listSessions(): Promise<SessionMetadata[]> {
    await this.ensureDir();
    const files = await fs.readdir(this.dataDir);
    const sessions: SessionMetadata[] = [];
    
    for (const file of files) {
      if (file.endsWith('.json')) {
        const id = file.replace('.json', '');
        const session = await this.loadSession(id);
        if (session) {
          sessions.push(session);
        }
      }
    }
    
    return sessions.sort((a, b) => b.updatedAt - a.updatedAt);
  }
}
