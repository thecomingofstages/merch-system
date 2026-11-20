/** An in-memory stand-in for the R2 bucket binding: what the server calls, nothing more. */
export class FakeBucket {
  files = new Map<string, { body: Uint8Array; contentType?: string }>();
  async put(key: string, value: ArrayBuffer | Uint8Array, options?: { httpMetadata?: { contentType?: string } }) {
    this.files.set(key, { body: new Uint8Array(value), contentType: options?.httpMetadata?.contentType });
    return {};
  }
  async delete(keys: string | string[]) {
    for (const key of Array.isArray(keys) ? keys : [keys]) this.files.delete(key);
  }
}
