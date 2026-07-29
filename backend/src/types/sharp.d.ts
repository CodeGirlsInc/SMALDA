declare module 'sharp' {
  interface Sharp {

    metadata(): Promise<Record<string, unknown>>;
    toBuffer(): Promise<Buffer>;
    resize(width?: number, height?: number): Sharp;
  }

  function sharp(input?: Buffer | string): Sharp;

    withMetadata(metadata?: Record<string, unknown>): Sharp;
    toBuffer(): Promise<Buffer>;
    jpeg(options?: Record<string, unknown>): Sharp;
    png(options?: Record<string, unknown>): Sharp;
  }

  interface SharpOptions {}
  interface CreateOptions {
    width: number;
    height: number;
    channels?: number;
    background?: string | Record<string, number>;
  }

  function sharp(input?: Buffer | string | ArrayBufferView, options?: SharpOptions): Sharp;
  function sharp(options: { create: CreateOptions }): Sharp;
  namespace sharp {}


  export = sharp;
}
