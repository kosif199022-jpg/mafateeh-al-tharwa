import { spawn } from "node:child_process";
import { access, mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import path from "node:path";
import vm from "node:vm";

const ROOT = process.cwd();
const READER_PATH = path.join(ROOT, "public", "reader.html");
const AUDIO_DIR = path.join(ROOT, "public", "audio");
const BUILD_DIR = path.join(ROOT, ".audio-build");
const PROGRESS_PATH = path.join(BUILD_DIR, "progress.json");
const ENDPOINT = process.env.AUDIOBOOK_TTS_URL || "https://mafateeh-al-tharwa.kosif199022.workers.dev/api/ai/tts";
const ORIGIN = process.env.AUDIOBOOK_ORIGIN || new URL(ENDPOINT).origin;
const MAX_CHUNK = 1750;
const DEFAULT_CONCURRENCY = 1;
const RATE_LIMIT_WAIT_MS = 15 * 60 * 1000 + 10_000;
const GEMINI_QUOTA_WAIT_MS = 75_000;

function parseArgs() {
  const args = process.argv.slice(2);
  const options = { from: 1, to: Number.MAX_SAFE_INTEGER, concurrency: DEFAULT_CONCURRENCY, force: false };
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--chapter") options.from = options.to = Number(args[++i]);
    else if (arg === "--from") options.from = Number(args[++i]);
    else if (arg === "--to") options.to = Number(args[++i]);
    else if (arg === "--concurrency") options.concurrency = Number(args[++i]);
    else if (arg === "--force") options.force = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!Number.isInteger(options.from) || !Number.isInteger(options.to) || options.from < 1 || options.from > options.to) {
    throw new Error("Invalid chapter range.");
  }
  options.concurrency = Math.max(1, Math.min(2, Number(options.concurrency) || 1));
  return options;
}

async function exists(file) {
  try { await access(file, fsConstants.F_OK); return true; } catch { return false; }
}

async function loadBook() {
  const source = await readFile(READER_PATH, "utf8");
  const start = source.indexOf("const D = ");
  const end = source.indexOf("const CH", start);
  if (start < 0 || end < 0) throw new Error("Book data was not found in reader.html.");
  const book = vm.runInNewContext(`${source.slice(start, end)}\nD`, Object.create(null), { timeout: 2_000 });
  return book.parts.flatMap((part) => part.chapters);
}

function chapterText(chapter) {
  return [
    `الفصل ${chapter.no}. ${chapter.title}`,
    chapter.key,
    ...chapter.body.map(([, text]) => text),
    `الفكرة المحورية. ${chapter.idea}`,
    `التطبيق العملي. ${chapter.apply}`,
    `أسئلة للتفكير. ${chapter.qs.join(" ")}`,
    `تحدي سبعة أيام. ${chapter.week}`,
  ].filter(Boolean).join("\n\n");
}

function splitSpeech(value, max = MAX_CHUNK) {
  const text = String(value || "").replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trim();
  if (!text) return [];
  const units = [];
  for (const paragraph of text.split(/\n+/).map((x) => x.trim()).filter(Boolean)) {
    if (paragraph.length <= max) { units.push(paragraph); continue; }
    const sentences = paragraph.match(/[^.!؟؛]+[.!؟؛]?/g) || [paragraph];
    for (let sentence of sentences) {
      sentence = sentence.trim();
      while (sentence.length > max) {
        let cut = sentence.lastIndexOf(" ", max);
        if (cut < max * 0.55) cut = max;
        units.push(sentence.slice(0, cut).trim());
        sentence = sentence.slice(cut).trim();
      }
      if (sentence) units.push(sentence);
    }
  }
  const chunks = [];
  let current = "";
  for (const unit of units) {
    const next = current ? `${current}\n\n${unit}` : unit;
    if (next.length > max && current) { chunks.push(current); current = unit; }
    else current = next;
  }
  if (current) chunks.push(current);
  return chunks;
}

function run(command, args, { input } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: ROOT, stdio: [input === undefined ? "ignore" : "pipe", "pipe", "pipe"] });
    const stdout = [], stderr = [];
    child.stdout.on("data", (x) => stdout.push(x));
    child.stderr.on("data", (x) => stderr.push(x));
    child.on("error", reject);
    child.on("close", (code) => code === 0
      ? resolve(Buffer.concat(stdout).toString("utf8"))
      : reject(new Error(`${command} exited ${code}: ${Buffer.concat(stderr).toString("utf8").slice(-900)}`)));
    if (input !== undefined) child.stdin.end(input);
  });
}

async function validWave(file) {
  if (!(await exists(file))) return false;
  const { open } = await import("node:fs/promises");
  const handle = await open(file, "r");
  try {
    const header = Buffer.alloc(12);
    const { bytesRead } = await handle.read(header, 0, 12, 0);
    return bytesRead === 12 && header.subarray(0, 4).toString() === "RIFF" && header.subarray(8, 12).toString() === "WAVE";
  } finally { await handle.close(); }
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function requestChunk(text, output, label) {
  if (await validWave(output)) return;
  const payload = JSON.stringify({ text, voice: "mixed", provider: "gemini" });
  for (let attempt = 1; attempt <= 10; attempt += 1) {
    const status = (await run("curl", [
      "-sS", "--max-time", "125", "-o", output, "-w", "%{http_code}",
      "-H", "Content-Type: application/json",
      "-H", `Origin: ${ORIGIN}`,
      "-H", `Referer: ${ORIGIN}/reader.html`,
      "--data-binary", "@-", ENDPOINT,
    ], { input: payload })).trim();
    if (status === "200" && await validWave(output)) return;
    let code = "";
    try { code = JSON.parse(await readFile(output, "utf8")).error || ""; } catch {}
    await rm(output, { force: true });
    if (code === "gemini_not_configured") throw new Error("Gemini API is not configured on the deployed app.");
    if (code === "gemini_quota") { console.log(`[gemini-quota] ${label}; retrying in 75s`); await wait(GEMINI_QUOTA_WAIT_MS); continue; }
    if (status === "429" || code === "rate_limit") {
      console.log(`[rate-limit] ${label}; waiting for 15-minute window`);
      await wait(RATE_LIMIT_WAIT_MS);
      continue;
    }
    if (attempt === 10) throw new Error(`${label} failed with HTTP ${status}${code ? ` (${code})` : ""}.`);
    await wait(Math.min(45_000, 4_000 * attempt));
  }
}

async function mapLimit(items, limit, worker) {
  let cursor = 0;
  async function runner() { while (cursor < items.length) { const index = cursor++; await worker(items[index], index); } }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, runner));
}

async function probeDuration(file) {
  const output = await run("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", file]);
  return Math.round(Number(String(output).trim()) || 0);
}

async function loadProgress() {
  try { return JSON.parse(await readFile(PROGRESS_PATH, "utf8")); }
  catch { return { version: 2, voice: "mixed", speakers: { male: "Charon", female: "Kore" }, chapters: {} }; }
}
async function saveProgress(progress) { await mkdir(BUILD_DIR, { recursive: true }); await writeFile(PROGRESS_PATH, `${JSON.stringify(progress, null, 2)}\n`); }

async function buildChapter(chapter, total, options, progress) {
  const number = String(chapter.no).padStart(2, "0");
  const target = path.join(AUDIO_DIR, `chapter-${number}.mp3`);
  const done = progress.chapters[chapter.no];
  if (!options.force && done?.voice === "mixed" && done?.bookVersion === 46 && await exists(target)) {
    console.log(`[skip] ${number}/${total} ${chapter.title}`); return done;
  }
  const chunks = splitSpeech(chapterText(chapter));
  const chapterDir = path.join(BUILD_DIR, `chapter-${number}`);
  await mkdir(chapterDir, { recursive: true });
  console.log(`[chapter] ${number}/${total} ${chapter.title} — ${chunks.length} chunk(s)`);
  await mapLimit(chunks, options.concurrency, async (text, index) => {
    const chunkFile = path.join(chapterDir, `chunk-${String(index + 1).padStart(3, "0")}.wav`);
    await requestChunk(text, chunkFile, `chapter ${number}, chunk ${index + 1}/${chunks.length}`);
    console.log(`[audio] ${number}/${total} chunk ${index + 1}/${chunks.length} ready`);
  });
  const concatList = path.join(chapterDir, "concat.txt");
  await writeFile(concatList, `${chunks.map((_, index) => `file '${path.join(chapterDir, `chunk-${String(index + 1).padStart(3, "0")}.wav`).replaceAll("'", "'\\''")}'`).join("\n")}\n`);
  const encoded = path.join(BUILD_DIR, `chapter-${number}.mp3`);
  await run("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-f", "concat", "-safe", "0", "-i", concatList,
    "-ac", "1", "-ar", "24000", "-c:a", "libmp3lame", "-b:a", "32k", "-id3v2_version", "3",
    "-metadata", `title=${chapter.title}`, "-metadata", "album=مفاتيح الثروة — Gemini Mixed", "-metadata", "artist=Charon + Kore", encoded]);
  await rename(encoded, target);
  const info = await stat(target);
  const result = { no: chapter.no, title: chapter.title, file: `/audio/chapter-${number}.mp3`, duration: await probeDuration(target), bytes: info.size,
    voice: "mixed", speakers: { male: "Charon", female: "Kore" }, source: "gemini-3.1-flash-tts-preview+2.5-fallback", bookVersion: 46 };
  progress.chapters[chapter.no] = result;
  await saveProgress(progress);
  await rm(chapterDir, { recursive: true, force: true });
  console.log(`[saved] ${number}/${total} ${result.duration}s ${(result.bytes / 1_048_576).toFixed(1)}MB`);
  return result;
}

async function main() {
  const options = parseArgs();
  await mkdir(AUDIO_DIR, { recursive: true }); await mkdir(BUILD_DIR, { recursive: true });
  const chapters = await loadBook();
  const total = chapters.length;
  if (total !== 46) throw new Error(`Expected modified 46-chapter book, found ${total}. Apply book transformation first.`);
  const to = Math.min(options.to, total);
  const selected = chapters.filter((chapter) => chapter.no >= options.from && chapter.no <= to);
  console.log(`[start] ${selected.length}/${total} chapter(s), ${selected.reduce((sum, c) => sum + splitSpeech(chapterText(c)).length, 0)} Gemini mixed-TTS request(s)`);
  const progress = await loadProgress();
  for (const chapter of selected) await buildChapter(chapter, total, options, progress);
  const completed = chapters.map((chapter) => progress.chapters[chapter.no]).filter(Boolean);
  if (completed.length === total) {
    completed.sort((a, b) => a.no - b.no);
    const manifest = { version: 3, bookVersion: 46, title: "مفاتيح الثروة — Gemini Mixed Audiobook", voice: "mixed",
      speakers: { male: "Charon", female: "Kore" }, models: ["gemini-3.1-flash-tts-preview", "gemini-2.5-flash-preview-tts"],
      generated_at: new Date().toISOString(), chapterCount: total,
      total_duration: completed.reduce((sum, c) => sum + c.duration, 0), total_bytes: completed.reduce((sum, c) => sum + c.bytes, 0), chapters: completed };
    await writeFile(path.join(AUDIO_DIR, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
    await rm(PROGRESS_PATH, { force: true });
    console.log(`[complete] ${total} chapters · ${(manifest.total_duration / 3600).toFixed(2)}h · ${(manifest.total_bytes / 1_048_576).toFixed(1)}MB`);
  } else console.log(`[partial] ${completed.length}/${total} chapters complete.`);
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
