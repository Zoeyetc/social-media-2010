export type PreviewTrack = { id: string; title: string; artist: string };
export function approvedPreviewURL(value: unknown): value is string;
export function matchesPreview(track: PreviewTrack, result: Record<string, unknown>): boolean;
