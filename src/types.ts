// Shared frontend types

export interface Highlight {
  id: number;
  userId: number;
  text: string;
  sourceUrl: string;
  pageTitle: string;
  domain: string;
  notes: string | null;
  tagIds: string; // JSON array string like "[1,2,3]"
  createdAt: Date;
  updatedAt: Date;
}

export interface Tag {
  id: number;
  userId: number;
  name: string;
  color: string;
  createdAt: Date;
}

export interface ApiToken {
  id: number;
  userId: number;
  token: string;
  label: string | null;
  createdAt: Date;
}

// Helper to parse tagIds
export function parseTagIds(tagIds: string): number[] {
  try {
    return JSON.parse(tagIds) as number[];
  } catch {
    return [];
  }
}
