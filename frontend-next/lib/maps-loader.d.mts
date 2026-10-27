export function loadMapsSdk(options: {
  fetchImpl: (url: string) => Promise<{ ok: boolean; json(): Promise<any> }>;
  documentRef: Document;
  google: any;
  onReady: () => void;
  onUnavailable: (message: string) => void;
}): () => void;
