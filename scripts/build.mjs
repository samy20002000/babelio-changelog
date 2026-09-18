/**
 * Turns `releases/*.md` into the published site.
 *
 * Two outputs from one source, which is the whole point of the format: the
 * page a reader opens, and the JSON the app reads for its "what's new" screen.
 * Write a release once, in Markdown, and both follow.
 */
import { readdir, readFile, writeFile, mkdir, cp } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const RELEASES = join(root, "releases");
const DOCS = join(root, "docs");

/** Front matter, then body. Deliberately small: the format is ours, the
 *  fields are few, and a YAML dependency would outweigh what it parses. */
const parse = (raw) => {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) throw new Error("missing front matter");
  const meta = {};
  for (const line of match[1].split("\n")) {
    const [, key, value] = line.match(/^(\w+):\s*(.*)$/) ?? [];
    if (!key) continue;
    meta[key] = value.startsWith("[")
      ? value.slice(1, -1).split(",").map((v) => v.trim()).filter(Boolean)
      : value.replace(/^"|"$/g, "");
  }
  return { meta, body: match[2].trim() };
};

const escape = (s) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Just enough Markdown for what a changelog actually uses. */
const render = (md) => {
  const out = [];
  let inList = false;
  for (const line of md.split("\n")) {
    const img = line.match(/^!\[(.*?)\]\((.*?)\)$/);
    if (img) {
      if (inList) { out.push("</ul>"); inList = false; }
      out.push(
        `<img src="${img[2].replace("../assets/", "assets/")}" alt="${escape(img[1])}" loading="lazy">`,
      );
      continue;
    }
    const h = line.match(/^(#{2,3})\s+(.*)$/);
    if (h) {
      if (inList) { out.push("</ul>"); inList = false; }
      out.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`);
      continue;
    }
    if (line.startsWith("- ")) {
      if (!inList) { out.push("<ul>"); inList = true; }
      out.push(`<li>${inline(line.slice(2))}</li>`);
      continue;
    }
    if (!line.trim()) {
      if (inList) { out.push("</ul>"); inList = false; }
      continue;
    }
    if (inList) out[out.length - 1] = out[out.length - 1].replace(/<\/li>$/, ` ${inline(line)}</li>`);
    else out.push(`<p>${inline(line)}</p>`);
  }
  if (inList) out.push("</ul>");
  return out.join("\n");
};

const inline = (s) =>
  escape(s)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/«\s?(.+?)\s?»/g, "«&nbsp;$1&nbsp;»");

/** Plain text for the app: the screen renders it, it does not parse HTML. */
const toBlocks = (md) => {
  const blocks = [];
  let current = null;
  for (const line of md.split("\n")) {
    const h2 = line.match(/^##\s+(.*)$/);
    const h3 = line.match(/^###\s+(.*)$/);
    const img = line.match(/^!\[.*?\]\((.*?)\)$/);
    if (h2) { current = { section: h2[1], items: [] }; blocks.push(current); continue; }
    if (!current) continue;
    if (h3) { current.items.push({ title: h3[1], text: "", image: null }); continue; }
    if (img) {
      const last = current.items[current.items.length - 1];
      if (last) last.image = img[1].replace("../assets/", "assets/");
      continue;
    }
    if (line.startsWith("- ")) {
      current.items.push({ title: null, text: strip(line.slice(2)), image: null });
      continue;
    }
    if (!line.trim()) continue;
    const last = current.items[current.items.length - 1];
    if (last) last.text = `${last.text} ${strip(line)}`.trim();
  }
  return blocks;
};

const strip = (s) => s.replace(/\*\*(.+?)\*\*/g, "$1");

const main = async () => {
  const files = (await readdir(RELEASES)).filter((f) => f.endsWith(".md"));
  const releases = [];
  for (const file of files) {
    const { meta, body } = parse(await readFile(join(RELEASES, file), "utf8"));
    releases.push({ ...meta, build: Number(meta.build), body });
  }
  // Newest first — a reader opens this to see what just changed.
  releases.sort((a, b) => b.build - a.build);

  await mkdir(DOCS, { recursive: true });
  if (existsSync(join(root, "assets"))) {
    await cp(join(root, "assets"), join(DOCS, "assets"), { recursive: true });
  }

  await writeFile(
    join(DOCS, "index.json"),
    JSON.stringify(
      {
        updated: new Date().toISOString().slice(0, 10),
        releases: releases.map(({ body, ...meta }) => ({
          ...meta,
          sections: toBlocks(body),
        })),
      },
      null,
      2,
    ),
  );

  const dateFr = (iso) =>
    new Date(iso).toLocaleDateString("fr-FR", {
      day: "numeric", month: "long", year: "numeric",
    });

  const articles = releases
    .map(
      (r) => `<article id="v${r.build}">
  <header>
    <h1>Version ${escape(r.version)}</h1>
    <p class="meta"><time datetime="${r.date}">${dateFr(r.date)}</time> · ${r.platforms.join(" et ")}</p>
  </header>
  ${render(r.body)}
</article>`,
    )
    .join("\n");

  const html = await readFile(join(root, "scripts", "template.html"), "utf8");
  await writeFile(join(DOCS, "index.html"), html.replace("<!--RELEASES-->", articles));
  await writeFile(join(DOCS, ".nojekyll"), "");
  console.log(`${releases.length} version(s) publiée(s)`);
};

main();
