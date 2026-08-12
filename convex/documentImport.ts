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

// Shared by both extraction actions below (parseAcademicCalendar, parseCourseTimetable)
// — identical request shape, only the prompt/schema differ.
//
// thinkingBudget: 0 is a real bug magnet: it's only valid on Flash-tier models — Gemini's
// Pro-tier models enforce a nonzero minimum thinking budget and reject 0 outright with a
// bare "Request contains an invalid argument" 400, no field-level detail. GEMINI_MODEL
// defaults to the rolling "-latest" alias specifically so a model retirement doesn't need
// a code change here (see GEMINI_MODEL's own comment) — but that same rolling behavior
// means which tier it resolves to isn't a fixed, verified fact, it can drift. Rather than
// re-pinning to a specific dated model (defeats the whole point of the alias) or dropping
// the token-cost optimization outright, retry once without thinkingConfig on a 400 before
// surfacing an error — cheap, self-healing, and never fires at all against a model that
// does accept thinkingBudget: 0.
// `schema: null` skips responseMimeType/responseSchema entirely for a plain-text
// reply (classifyDocument's one-word answer) — every other caller passes a real
// OpenAPI-subset schema for structured JSON extraction.
async function callGeminiExtraction(
  apiKey: string,
  prompt: string,
  schema: object | null,
  base64: string,
): Promise<string> {
  async function request(includeThinkingConfig: boolean) {
    return fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          { parts: [{ text: prompt }, { inline_data: { mime_type: 'application/pdf', data: base64 } }] },
        ],
        generationConfig: {
          ...(schema !== null ? { responseMimeType: 'application/json', responseSchema: schema } : {}),
          ...(includeThinkingConfig ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
        },
      }),
    });
  }

  let response = await request(true);
  if (!response.ok && response.status === 400) {
    response = await request(false);
  }

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Gemini request failed (${response.status}): ${errorBody.slice(0, 500)}`);
  }

  const result = await response.json();
  const text: unknown = result?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof text !== 'string') {
    throw new Error("Gemini's response didn't include any extractable content.");
  }
  return text;
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
    const text = await callGeminiExtraction(apiKey, EXTRACTION_PROMPT, RESPONSE_SCHEMA, base64);

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

// --- Course timetable extraction ---------------------------------------------------
// Structurally different from the academic calendar above: not a flat list of
// title+date rows, but a grid of academic-class sections (one per program+level+
// session, e.g. "HND ACCT 1"), each with per-day course slots (code+title, lecturer,
// time range, venue). Kept in this same file rather than a new one — same Gemini
// plumbing (GEMINI_MODEL, fileToBase64, the fetch call shape above), no reason to
// duplicate it for a second document type.

const TIMETABLE_EXTRACTION_PROMPT = `You are extracting course schedule rows from a university teaching timetable document.

The document is organized into sections, one per academic class (e.g. "HND ACCT 1", "BTECH ACCT 1(4YR)", "HND ACCT 2") — each section has its own header naming the class, followed by a grid of course slots grouped by day (SATURDAY, SUNDAY, FRIDAY, ...).

For every course slot in every day row, in every class section, emit one row with:

- "classLabel": the class section's own header text, exactly as written (e.g. "HND ACCT 1", "BTECH ACCT 1(4YR)"). Every row belonging to the same section must repeat the identical classLabel string.
- "day": the day-of-week label the slot appears under, exactly as written, uppercase (e.g. "SATURDAY").
- "courseCode": the course code only, e.g. "ACCT 108" — not the title.
- "courseTitle": the course's title, cleaned of OCR line-wrap noise, without the code and without the lecturer's name.
- "lecturer": the lecturer's name, with the surrounding parentheses removed. Omit this field entirely if no lecturer is given for that slot.
- "startTime" / "endTime": the slot's time range, each converted to 24-hour "HH:MM" (e.g. "6:00AM-9:00AM" becomes startTime "06:00", endTime "09:00").
- "venue": the room/venue code following the time (e.g. "BM205"). Omit this field entirely if none is given.

If the exact same course appears under more than one day within the same class section (common for weekend timetables, where a course repeats identically on Saturday and Sunday), emit one row per day — do not merge them.

Ignore the "VIRTUAL LECTURERS" / "FACE-TO-FACE LECTURERS" week-number calendar footer that appears at the bottom of each section — those are date-range references, not course slots, and must not appear in the output.

Return ONLY a JSON array of these row objects. No prose, no markdown fences, nothing outside the array.`;

const TIMETABLE_RESPONSE_SCHEMA = {
  type: 'ARRAY',
  items: {
    type: 'OBJECT',
    properties: {
      classLabel: { type: 'STRING' },
      day: { type: 'STRING' },
      courseCode: { type: 'STRING' },
      courseTitle: { type: 'STRING' },
      lecturer: { type: 'STRING' },
      startTime: { type: 'STRING' },
      endTime: { type: 'STRING' },
      venue: { type: 'STRING' },
    },
    required: ['classLabel', 'day', 'courseCode', 'courseTitle', 'startTime', 'endTime'],
  },
};

export type ParsedTimetableRow = {
  classLabel: string;
  day: string;
  courseCode: string;
  courseTitle: string;
  lecturer?: string;
  startTime: string;
  endTime: string;
  venue?: string;
};

// Gemini is asked for 24h "HH:MM" directly (see the prompt above) rather than parsed
// out of freeform AM/PM text here — the model already has to read every time in the
// document itself, having it also emit the normalized form is more reliable than a
// second regex-based parse of whatever freeform string it might otherwise return.
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

function isRawTimetableRow(row: unknown): row is {
  classLabel: string;
  day: string;
  courseCode: string;
  courseTitle: string;
  lecturer?: string;
  startTime: string;
  endTime: string;
  venue?: string;
} {
  if (typeof row !== 'object' || row === null) return false;
  const r = row as Record<string, unknown>;
  return (
    typeof r.classLabel === 'string' &&
    typeof r.day === 'string' &&
    typeof r.courseCode === 'string' &&
    typeof r.courseTitle === 'string' &&
    typeof r.startTime === 'string' &&
    typeof r.endTime === 'string' &&
    (r.lecturer === undefined || typeof r.lecturer === 'string') &&
    (r.venue === undefined || typeof r.venue === 'string')
  );
}

// Reads the uploaded timetable PDF and asks Gemini to extract it into structured rows
// grouped by raw class-section label — same "parse, don't publish" split as
// parseAcademicCalendar above: the admin maps each detected classLabel to a real
// academicClass and reviews every row before anything is written to courses/
// courseSections (see courses.ts#importCourseTimetable — this action never writes to
// the database itself).
export const parseCourseTimetable = action({
  args: { storageId: v.id('_storage') },
  handler: async (ctx, { storageId }): Promise<ParsedTimetableRow[]> => {
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
    const text = await callGeminiExtraction(apiKey, TIMETABLE_EXTRACTION_PROMPT, TIMETABLE_RESPONSE_SCHEMA, base64);

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
      .filter(isRawTimetableRow)
      .filter((row) => TIME_PATTERN.test(row.startTime) && TIME_PATTERN.test(row.endTime))
      .map((row) => ({
        classLabel: row.classLabel.trim(),
        day: row.day.trim().toUpperCase(),
        courseCode: row.courseCode.trim(),
        courseTitle: row.courseTitle.trim(),
        lecturer: row.lecturer?.trim() || undefined,
        startTime: row.startTime,
        endTime: row.endTime,
        venue: row.venue?.trim() || undefined,
      }));
  },
});

// --- Exam timetable extraction ------------------------------------------------------
// A third, again structurally different document: no per-row day/class grid like the
// teaching timetable above — instead one exam date (and one or two time-slot blocks,
// e.g. a 9AM-12noon block beside a 2PM-5PM block) per page/section, under which a flat
// list of course rows sits (course code+title, the class it belongs to — often without
// a level number, e.g. "HND ACCT" rather than "HND ACCT 2", since a resit isn't
// necessarily tied to a student's current level), venue, and registration/invigilator
// counts this app has no use for. Because "class" here is frequently under-specified,
// importCourseTimetable/exam import resolves purely by courseCode against the whole
// semester's existing courses (see courseActivities.ts#importExamTimetable) rather
// than asking admin to map each class group to one academicClass the way the teaching
// timetable import does — classLabel is carried through only as review-table context.
const EXAM_EXTRACTION_PROMPT = `You are extracting exam schedule rows from a university exam timetable document (this may be a regular end-of-semester exam timetable OR a resit exam timetable — check the document's own title/header text to tell which).

The document is organized into dated sections — each section states one exam date, and one or two time-slot blocks (e.g. "9:00AM-12NOON" and "2:00PM-5:00PM" side by side, or a single evening slot like "6:00PM-9:00PM"). Under each time-slot block sits a list of course rows (columns typically: course title/code, class, registered-student count, venue, invigilator count — the last two counts are not needed in your output).

For every course row, in every time-slot block, in every dated section, emit one row with:

- "courseCode": the course code only, e.g. "ACT208" — not the title.
- "courseTitle": the course's title, cleaned of OCR line-wrap noise, without the code.
- "classLabel": the class/program text given for that row, exactly as written, even if it has no level number (e.g. "HND ACCT", "BTECH ACCT (4YR)", "BTECH PS (TP)"). Omit this field entirely if no class is given for that row.
- "examDate": that row's section date, as YYYY-MM-DD.
- "examTime": that row's time-slot block, converted to 24-hour "HH:MM-HH:MM" (e.g. "9:00AM-12NOON" becomes "09:00-12:00", "6:00PM-9:00PM" becomes "18:00-21:00"). Omit this field entirely if the document gives no time for that section.
- "venue": the room/venue code for that row, when given (e.g. "CCB202"). Omit this field entirely if none is given.
- "isResit": true if the document's own title/header identifies this as a RESIT exam timetable, false otherwise.

Ignore registered-student-count and invigilator-count columns entirely — do not include them in the output.

Return ONLY a JSON array of these row objects. No prose, no markdown fences, nothing outside the array.`;

const EXAM_RESPONSE_SCHEMA = {
  type: 'ARRAY',
  items: {
    type: 'OBJECT',
    properties: {
      courseCode: { type: 'STRING' },
      courseTitle: { type: 'STRING' },
      classLabel: { type: 'STRING' },
      examDate: { type: 'STRING' },
      examTime: { type: 'STRING' },
      venue: { type: 'STRING' },
      isResit: { type: 'BOOLEAN' },
    },
    required: ['courseCode', 'courseTitle', 'examDate', 'isResit'],
  },
};

export type ParsedExamRow = {
  courseCode: string;
  courseTitle: string;
  classLabel?: string;
  examDate: number;
  examTime?: string;
  venue?: string;
  isResit: boolean;
};

const TIME_RANGE_PATTERN = /^([01]\d|2[0-3]):[0-5]\d-([01]\d|2[0-3]):[0-5]\d$/;

function isRawExamRow(row: unknown): row is {
  courseCode: string;
  courseTitle: string;
  classLabel?: string;
  examDate: string;
  examTime?: string;
  venue?: string;
  isResit: boolean;
} {
  if (typeof row !== 'object' || row === null) return false;
  const r = row as Record<string, unknown>;
  return (
    typeof r.courseCode === 'string' &&
    typeof r.courseTitle === 'string' &&
    typeof r.examDate === 'string' &&
    typeof r.isResit === 'boolean' &&
    (r.classLabel === undefined || typeof r.classLabel === 'string') &&
    (r.examTime === undefined || typeof r.examTime === 'string') &&
    (r.venue === undefined || typeof r.venue === 'string')
  );
}

// Reads the uploaded exam-timetable PDF and asks Gemini to extract it into structured
// rows — same "parse, don't publish" split as the two extractors above: the admin
// reviews every row before anything is written to courseActivities (see
// courseActivities.ts#importExamTimetable — this action never writes to the database
// itself).
export const parseExamTimetable = action({
  args: { storageId: v.id('_storage') },
  handler: async (ctx, { storageId }): Promise<ParsedExamRow[]> => {
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
    const text = await callGeminiExtraction(apiKey, EXAM_EXTRACTION_PROMPT, EXAM_RESPONSE_SCHEMA, base64);

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
      .filter(isRawExamRow)
      .map((row) => ({ ...row, parsedDate: Date.parse(row.examDate) }))
      .filter((row) => !Number.isNaN(row.parsedDate))
      .filter((row) => row.examTime === undefined || TIME_RANGE_PATTERN.test(row.examTime))
      .map((row) => ({
        courseCode: row.courseCode.trim(),
        courseTitle: row.courseTitle.trim(),
        classLabel: row.classLabel?.trim() || undefined,
        examDate: row.parsedDate,
        examTime: row.examTime,
        venue: row.venue?.trim() || undefined,
        isResit: row.isResit,
      }));
  },
});

// --- Fallback classification --------------------------------------------------------
// The admin app's upload flow primarily detects a document's category from its own
// filename (cheap, instant, no API call — see termio-admin's
// lib/detectDocumentCategory.ts) and only reaches this when the filename itself gives
// no hint. Deliberately the cheapest possible Gemini call: no responseSchema (plain
// text, not JSON), just one word back — classifying which of the three extraction
// pipelines above a document belongs to doesn't need structured output.
const CLASSIFY_PROMPT = `Look at this document and answer with exactly one word, no punctuation, nothing else:

- "calendar" if it's a university academic calendar (a list of dates/deadlines across a semester or year — registration periods, exam periods, vacations, etc.)
- "timetable" if it's a course teaching timetable (a weekly class schedule: course codes/titles, lecturers, days, times, venues)
- "exam" if it's an exam or resit exam timetable (a list of exams by date, each with a course code and venue)

Answer with only one of: calendar, timetable, exam`;

const CLASSIFY_VALUES = ['calendar', 'timetable', 'exam'] as const;
export type DocumentCategory = (typeof CLASSIFY_VALUES)[number];

export const classifyDocument = action({
  args: { storageId: v.id('_storage') },
  handler: async (ctx, { storageId }): Promise<DocumentCategory | null> => {
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
    const text = await callGeminiExtraction(apiKey, CLASSIFY_PROMPT, null, base64);
    const normalized = text.trim().toLowerCase();
    return (CLASSIFY_VALUES as readonly string[]).includes(normalized)
      ? (normalized as DocumentCategory)
      : null;
  },
});
