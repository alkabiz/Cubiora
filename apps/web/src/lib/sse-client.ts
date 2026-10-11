/**
 * Cliente SSE simple para suscripción a eventos de pantalla pública.
 */
export type SSEEventHandler<T> = (data: T) => void;

export interface SSEClientOptions {
  onError?: (error: unknown) => void;
}

export class SSEClient {
  private eventSource: EventSource | null = null;
  private reconnectTimeout: number | null = null;

  constructor(
    private readonly url: string,
    private readonly options?: SSEClientOptions,
  ) {}

  connect<T>(eventName: string, handler: SSEEventHandler<T>): () => void {
    const fullUrl = this.url.startsWith('/') ? `/api/v1${this.url}` : this.url;

    const setupConnection = () => {
      this.eventSource = new EventSource(fullUrl);

      this.eventSource.addEventListener(eventName, (event: MessageEvent) => {
        try {
          const parsed = JSON.parse(event.data);
          handler(parsed);
        } catch (err) {
          this.options?.onError?.(err);
        }
      });

      this.eventSource.onerror = (err) => {
        this.options?.onError?.(err);
        this.eventSource?.close();
        this.reconnectTimeout = window.setTimeout(setupConnection, 3000);
      };
    };

    setupConnection();

    // Función de limpieza para desmontar
    return () => {
      if (this.reconnectTimeout) {
        clearTimeout(this.reconnectTimeout);
      }
      this.eventSource?.close();
    };
  }
}
