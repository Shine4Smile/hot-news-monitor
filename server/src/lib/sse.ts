import type { Response } from 'express';

/**
 * SSE (Server-Sent Events) hub for pushing real-time updates to connected clients.
 */
class SSEHub {
  private clients: Set<Response> = new Set();

  /** Register a new SSE client connection */
  addClient(res: Response): void {
    this.clients.add(res);
    console.log(`📡 SSE client connected (total: ${this.clients.size})`);

    res.on('close', () => {
      this.clients.delete(res);
      console.log(`📡 SSE client disconnected (total: ${this.clients.size})`);
    });
  }

  /** Broadcast an event to all connected clients */
  broadcast(event: string, data: unknown): void {
    const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const client of this.clients) {
      client.write(message);
    }
  }

  /** Get number of connected clients */
  get clientCount(): number {
    return this.clients.size;
  }
}

// Singleton instance
export const sseHub = new SSEHub();
