import api from './axios'

// The server caps a single page at 200 notes (MAX_PAGE_LIMIT in
// noteController). Callers used to request exactly that and read only
// `response.data.notes`, discarding `total` — so a user with more than 200
// notes simply stopped seeing the rest, everywhere, with no message.
//
// It wasn't only the note grid. Backlinks, the wikilink graph, folder counts,
// the command palette and the Ask-AI modal's note index are all derived from
// this one in-memory array, so a truncated fetch made those quietly *wrong*
// rather than merely incomplete — a backlink to note 250 would render as if
// it didn't exist.
//
// That is why this pages through to completion instead of adding paging
// controls: the app's model is "all of the user's notes are in memory", and
// changing that is a much larger redesign than the bug warrants.
const PAGE_SIZE = 200;

// Ceiling on the fan-out, so a pathological account can't fire hundreds of
// requests on every refetch. At PAGE_SIZE this covers 5,000 notes; beyond it
// the caller is told the list is truncated rather than being silently lied to
// (which is the exact failure this function exists to fix).
const MAX_PAGES = 25;

/**
 * Fetches every note matching `params`, following pagination.
 * Returns { notes, total, truncated }.
 */
export const fetchAllNotes = async (params = {}) => {
  const first = await api.get('/notes', { params: { ...params, limit: PAGE_SIZE, page: 1 } });
  const { notes = [], total = 0, totalPages = 1 } = first.data;

  if (totalPages <= 1) return { notes, total, truncated: false };

  const pagesToFetch = Math.min(totalPages, MAX_PAGES);
  // Remaining pages in parallel — they're independent reads, and a user with
  // 1,000 notes shouldn't wait for four sequential round trips.
  const rest = await Promise.all(
    Array.from({ length: pagesToFetch - 1 }, (_, i) =>
      api.get('/notes', { params: { ...params, limit: PAGE_SIZE, page: i + 2 } })
    )
  );

  return {
    notes: notes.concat(...rest.map((res) => res.data.notes || [])),
    total,
    truncated: totalPages > MAX_PAGES,
  };
};

export const NOTES_PAGE_SIZE = PAGE_SIZE;
export const MAX_NOTE_PAGES = MAX_PAGES;
