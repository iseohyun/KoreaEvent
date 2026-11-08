import { FirestoreEventDoc, SeriesHistoryItem, EventSeriesRecord } from '../types/event';

export function extractEditionNumber(title?: string): number | undefined;
export function extractEventYear(title?: string, startDate?: string): number | undefined;
export function normalizeSeriesTitle(rawTitle?: string): {
  baseKey: string;
  canonicalName: string;
};
export function linkEventSeries(docs: FirestoreEventDoc[]): {
  docs: FirestoreEventDoc[];
  seriesMap: Record<string, EventSeriesRecord>;
};
