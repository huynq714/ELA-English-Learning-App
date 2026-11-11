export interface Deck {
  id: string;
  title: string;
  description: string | null;
  level: string | null;
  isPublished: boolean;
  createdAt: string;
}

export function parseDeck(value: unknown): Deck {
  if (!value || typeof value !== 'object') {
    throw new Error('Backend trả về một bộ từ không hợp lệ.');
  }

  const deck = value as Record<string, unknown>;
  if (typeof deck.id !== 'string' || typeof deck.title !== 'string'
    || typeof deck.isPublished !== 'boolean' || typeof deck.createdAt !== 'string'
    || (deck.description !== null && typeof deck.description !== 'string')
    || (deck.level !== null && typeof deck.level !== 'string')) {
    throw new Error('Backend trả về dữ liệu bộ từ không đúng định dạng.');
  }

  return {
    id: deck.id,
    title: deck.title,
    description: deck.description,
    level: deck.level,
    isPublished: deck.isPublished,
    createdAt: deck.createdAt,
  };
}
