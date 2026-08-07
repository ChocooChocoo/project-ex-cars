// Converts Obsidian [[wikilinks]] to standard markdown [links]() across all docs
const { readdirSync, readFileSync, writeFileSync } = require("node:fs");
const { join, relative, dirname } = require("node:path");

const DOCS_ROOT = join(__dirname, "..", "docs");

function findMdFiles(dir) {
  const results = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory() && !entry.name.startsWith(".")) {
      results.push(...findMdFiles(full));
    } else if (entry.name.endsWith(".md")) {
      results.push(full);
    }
  }
  return results;
}

function headingAnchor(heading) {
  return heading
    .toLowerCase()
    .replace(/[^\w\s-—–]/g, "")
    .replace(/[—–]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

const allMdFiles = findMdFiles(DOCS_ROOT);
const fileIndex = new Map();

// Build index: filename (including subdir from docs root) -> absolute path
// e.g., "ANALYSIS - GLOBAL CAR EXCHANGE/01 - OVERVIEW.md" -> abs path
for (const f of allMdFiles) {
  const relFromDocs = relative(DOCS_ROOT, f).replace(/\\/g, "/");
  fileIndex.set(relFromDocs, f);
}

// Also index by just the base filename (for same-dir lookups)
const baseNameIndex = new Map();
for (const [relPath, absPath] of fileIndex) {
  const base = relPath.split("/").pop();
  baseNameIndex.set(base, absPath);
}

function resolveLink(currentFileAbsPath, obsidianTarget) {
  // Strip any heading anchor
  const hashIdx = obsidianTarget.indexOf("#");
  const filePart = hashIdx >= 0 ? obsidianTarget.slice(0, hashIdx) : obsidianTarget;
  const anchorPart = hashIdx >= 0 ? obsidianTarget.slice(hashIdx) : "";

  // Try exact match against the file index
  const exactMatch = `${filePart}.md`.replace(/\\/g, "/");
  if (fileIndex.has(exactMatch)) {
    return { file: fileIndex.get(exactMatch), anchor: anchorPart };
  }

  // Try base-name match
  const baseMatch = `${filePart.replace(/^.*[\\/]/, "")}.md`;
  if (baseNameIndex.has(baseMatch)) {
    return { file: baseNameIndex.get(baseMatch), anchor: anchorPart };
  }

  // Fallback: assume same directory as the source file
  const currentDir = dirname(currentFileAbsPath);
  return { file: join(currentDir, `${filePart}.md`), anchor: anchorPart };
}

let total = 0;

for (const filepath of allMdFiles) {
  let content = readFileSync(filepath, "utf8");
  if (!content.includes("[[")) continue;

  const sourceDir = dirname(filepath);

  content = content.replace(/\[\[([^\]|]+?)(?:\|([^\]]+?))?\]\]/g, (_match, target, display) => {
    const { file: targetAbs, anchor } = resolveLink(filepath, target);
    const relPath = relative(sourceDir, targetAbs).replace(/\\/g, "/").replace(/ /g, "%20");
    const headingSlug = anchor ? `#${headingAnchor(anchor.slice(1))}` : "";
    const text = display || target.replace(/#.*$/, "");
    return `[${text}](${relPath}${headingSlug})`;
  });

  writeFileSync(filepath, content);
  total++;
  console.log(`Converted: ${relative(DOCS_ROOT, filepath)}`);
}

console.log(`\nDone. ${total} files updated.`);
