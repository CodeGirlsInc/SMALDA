declare module 'sharp' {
  interface Sharp {
    metadata(): Promise<Record<string, unknown>>;
    toBuffer(): Promise<Buffer>;
    resize(width?: number, height?: number): Sharp;
  }

  function sharp(input?: Buffer | string): Sharp;
  export = sharp;
}
