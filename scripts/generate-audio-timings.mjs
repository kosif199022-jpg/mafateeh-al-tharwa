import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";

const ROOT = process.cwd();
const READER_PATH = path.join(ROOT, "public", "reader.html");
const AUDIO_DIR = path.join(ROOT, "public", "audio");
const OUTPUT_DIR = path.join(AUDIO_DIR, "timings");

function parseArgs() {
  const args = process.argv.slice(2);
  let from = 1, to = Number.MAX_SAFE_INTEGER, engine = "estimate";
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === "--chapter") from = to = Number(args[++i]);
    else if (args[i] === "--from") from = Number(args[++i]);
    else if (args[i] === "--to") to = Number(args[++i]);
    else if (args[i] === "--engine") engine = String(args[++i]);
    else throw new Error(`Unknown argument: ${args[i]}`);
  }
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 1 || from > to) throw new Error("Invalid chapter range.");
  if (!['estimate'].includes(engine)) throw new Error("Only --engine estimate is supported in CI; forced alignment can be run later for precision.");
  return { from, to, engine };
}

async function loadBook() {
  const source = await readFile(READER_PATH, "utf8");
  const start = source.indexOf("const D = "), end = source.indexOf("const CH", start);
  if (start < 0 || end < 0) throw new Error("Book data was not found in reader.html.");
  const book = vm.runInNewContext(`${source.slice(start, end)}\nD`, Object.create(null), { timeout: 2_000 });
  return book.parts.flatMap((part) => part.chapters);
}

function buildTranscript(chapter) {
  let text = "";
  const visibleRanges = [];
  const append = (value, visible) => {
    if (!value) return;
    const start = text.length; text += value;
    if (visible) visibleRanges.push({ start, end: text.length });
  };
  const paragraph = (parts) => {
    if (text) text += "\n\n";
    for (const [value, visible] of parts) append(value, visible);
  };
  paragraph([[`الفصل ${chapter.no}. `, false], [chapter.title, true]]);
  paragraph([[chapter.key, true]]);
  for (const [, value] of chapter.body) paragraph([[value, true]]);
  paragraph([["الفكرة المحورية. ", false], [chapter.idea, true]]);
  paragraph([["التطبيق العملي. ", false], [chapter.apply, true]]);
  paragraph([["أسئلة للتفكير. ", false], ...chapter.qs.flatMap((q, i) => i ? [[" ", false], [q, true]] : [[q, true]])]);
  paragraph([["تحدي سبعة أيام. ", false], [chapter.week, true]]);

  const all = [];
  for (const match of text.matchAll(/\S+/gu)) {
    if (!/[\p{L}\p{N}]/u.test(match[0])) continue;
    const start = match.index, end = start + match[0].length;
    const visible = visibleRanges.some((range) => end > range.start && start < range.end);
    const letters = (match[0].match(/[\p{L}\p{N}]/gu) || []).length;
    let weight = 0.75 + Math.sqrt(Math.max(1, letters)) * 0.38;
    if (/[.!؟]$/.test(match[0])) weight += 1.15;
    else if (/[،؛:]$/.test(match[0])) weight += 0.55;
    all.push({ text: match[0], visible, weight });
  }
  return all;
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] });
    const stdout = [], stderr = [];
    child.stdout.on("data", (x) => stdout.push(x)); child.stderr.on("data", (x) => stderr.push(x)); child.on("error", reject);
    child.on("close", (code) => code === 0 ? resolve(Buffer.concat(stdout).toString("utf8")) : reject(new Error(`${command} exited ${code}: ${Buffer.concat(stderr).toString("utf8").slice(-500)}`)));
  });
}

async function duration(file) {
  const out = await run("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", file]);
  const value = Number(String(out).trim());
  if (!Number.isFinite(value) || value <= 0) throw new Error(`Could not read duration for ${file}`);
  return value;
}

function estimateWords(tokens, totalDuration) {
  const totalWeight = tokens.reduce((sum, token) => sum + token.weight, 0) || 1;
  const usable = Math.max(0.5, totalDuration - 0.3);
  let cursor = 0.12;
  const visible = [];
  for (const token of tokens) {
    const span = usable * token.weight / totalWeight;
    const start = cursor;
    const end = Math.min(totalDuration, start + Math.max(0.05, span * 0.76));
    if (token.visible) visible.push([Math.round(start * 1000) / 1000, Math.round(end * 1000) / 1000]);
    cursor += span;
  }
  return visible;
}

async function main() {
  const { from, to } = parseArgs();
  const chapters = await loadBook();
  if (chapters.length !== 46) throw new Error(`Expected 46 chapters, found ${chapters.length}.`);
  await mkdir(OUTPUT_DIR, { recursive: true });
  for (const chapter of chapters.filter((c) => c.no >= from && c.no <= Math.min(to, chapters.length))) {
    const n = String(chapter.no).padStart(2, "0");
    const seconds = await duration(path.join(AUDIO_DIR, `chapter-${n}.mp3`));
    const words = estimateWords(buildTranscript(chapter), seconds);
    const result = { version: 2, chapter: chapter.no, duration: Math.round(seconds * 1000) / 1000, wordCount: words.length,
      method: "estimated-from-gemini-mixed-duration-v36", words };
    await writeFile(path.join(OUTPUT_DIR, `chapter-${n}.json`), `${JSON.stringify(result)}\n`);
    console.log(`[timed] ${n}/46 ${words.length} words · ${seconds.toFixed(1)}s`);
  }
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
