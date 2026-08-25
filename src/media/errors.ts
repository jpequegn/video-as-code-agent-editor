export class MediaError extends Error {
  public constructor(
    message: string,
    public readonly code:
      "INVALID_MEDIA" | "UNSUPPORTED_MEDIA" | "PROBE_FAILED" | "STORE_CONFLICT" | "TOOL_UNAVAILABLE"
  ) {
    super(message);
    this.name = "MediaError";
  }
}
