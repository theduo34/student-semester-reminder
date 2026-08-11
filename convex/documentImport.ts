'use node';

import { v } from 'convex/values';

import { internal } from './_generated/api';
import { action } from './_generated/server';

// Free-tier-eligible, native-PDF-input, structured-JSON-output — see the project's own
// notes on why Gemini over Claude/GPT for this specific job (messy, inconsistently
// formatted academic-calendar tables). "gemini-flash-latest" is a rolling alias Google
// keeps pointed at its current flash model (confirmed live — it resolved to
// gemini-3.6-flash at the time this was written), not a specific dated version, so a
// model retirement (already hit once during setup: gemini-2.0-flash 404s now) doesn't
// need a code change. Still overridable via env var for a deliberate pin.
const GEMINI_MODEL = process.env.GEMINI_MODEL ?? 'gemini-flash-latest';

const EXTRACTION_PROMPT = `You are extracting rows from a university academic calendar document into structured data.

For every activity/event/deadline listed (registration periods, lecture start dates, exams, vacations, board meetings, publication of results, everything — not just the first section):

- "title": the activity's name, cleaned of obvious OCR noise (stray spaces, broken line-wraps), kept close to the document's own wording. Do not include the row number.
- "description": only when the date field carries extra context worth keeping — a date range's full text ("12th May – 12th July, 2026"), a qualifier like "Regular and Weekend" or "Graduate School only". Omit entirely when there's nothing extra to say.
- "date": the single most relevant date, as YYYY-MM-DD. For a range, use the START date (the range itself belongs in "description", not here). If no real date can be determined (e.g. "Yet to be determined", "Yet to determined"), leave that row out of the output entirely — do not guess a date.

Return ONLY a JSON array of these objects. No prose, no markdown fences, nothing outside the array.`;

// Gemini's structured-output schema format: OpenAPI-subset, but with the type enum
// spelled in caps (STRING/OBJECT/ARRAY, not "string"/"object"/"array") — easy to get
// wrong copying from OpenAPI docs, called out here because it's non-obvious.
const RESPONSE_SCHEMA = {
  type: 'ARRAY',
  items: {
    type: 'OBJECT',
    properties: {
      title: { type: 'STRING' },
      description: { type: 'STRING' },
      date: { type: 'STRING' },
    },
    required: ['title', 'date'],
  },
};

export type ParsedActivity = {
  title: string;
  description: string;
  date: number;
};

function isRawExtractedRow(row: unknown): row is { title: string; date: string; description?: string } {
  return (
    typeof row === 'object' &&
    row !== null &&
    typeof (row as Record<string, unknown>).title === 'string' &&
    typeof (row as Record<string, unknown>).date === 'string'
  );
}

// Large PDFs (the sample timetables run to 1MB+) need chunked base64 encoding to avoid
// blowing the call stack on String.fromCharCode(...hugeArray) — Buffer sidesteps that
// entirely, which is the actual reason this file needs the Node runtime ('use node'
// above), not just because it happens to call fetch.
async function fileToBase64(blob: Blob): Promise<string> {
  const bytes = await blob.arrayBuffer();
  return Buffer.from(bytes).toString('base64');
}

// Reads the uploaded PDF (see documentUploads.ts#generateImportUploadUrl for the
// upload step — a plain mutation, which can't live in this file, since 'use node'
// above puts everything here in the Node runtime and Convex only allows
// actions/internalActions there, not mutations), asks Gemini to extract it into
// structured rows, and hands those back for the admin to review — this does NOT write
// to semesterActivities itself. Parsing and publishing are deliberately separate
// steps: an LLM misreading a date or a title is a "did you check this before it went
// out" problem, not something to auto-commit on a good day.
export const parseAcademicCalendar = action({
  args: { storageId: v.id('_storage') },
  handler: async (ctx, { storageId }): Promise<ParsedActivity[]> => {
    // Actions have no ctx.db, so the admin check has to ride along via ctx.runQuery —
    // see adminAuth.ts#requireAdminForAction.
    await ctx.runQuery(internal.adminAuth.requireAdminForAction, {});

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not configured on this Convex deployment.');
    }

    const blob = await ctx.storage.get(storageId);
    if (blob === null) {
      throw new Error('Uploaded file could not be found — try uploading again.');
    }

    const base64 = await fileToBase64(blob);

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: EXTRACTION_PROMPT }, { inline_data: { mime_type: 'application/pdf', data: base64 } }],
            },
          ],
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: RESPONSE_SCHEMA,
            // This is table-reading, not multi-step reasoning — extended "thinking"
            // just burns tokens (confirmed live: ~100 thinking tokens for a one-word
            // reply) without improving a straightforward extraction task.
            thinkingConfig: { thinkingBudget: 0 },
          },
        }),
      },
    );

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Gemini request failed (${response.status}): ${errorBody.slice(0, 500)}`);
    }

    const result = await response.json();
    const text: unknown = result?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof text !== 'string') {
      throw new Error("Gemini's response didn't include any extractable content.");
    }

    let rows: unknown;
    try {
      rows = JSON.parse(text);
    } catch {
      throw new Error("Gemini's response wasn't valid JSON — try again, or a smaller document.");
    }
    if (!Array.isArray(rows)) {
      throw new Error('Gemini returned something other than a list of rows.');
    }

    return rows
      .filter(isRawExtractedRow)
      .map((row) => ({ ...row, parsedDate: Date.parse(row.date) }))
      .filter((row) => !Number.isNaN(row.parsedDate))
      .map((row) => ({
        title: row.title.trim(),
        description: row.description?.trim() ?? '',
        date: row.parsedDate,
      }));
  },
});
