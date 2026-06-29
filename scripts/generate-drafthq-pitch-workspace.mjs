import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

const workspace = path.join(os.tmpdir(), "codex-presentations", "manual-drafthq-pitch", "screenshot-refresh");
const tmp = path.join(workspace, "tmp");
const inspectDir = path.join(tmp, "template-inspect");
const assetDir = path.join(tmp, "assets");

const screenshots = {
  4: "C:/Users/regot/AppData/Local/Temp/codex-clipboard-4aad454b-9d3e-40ad-840e-b1278ca0e6ef.png",
  5: "C:/Users/regot/AppData/Local/Temp/codex-clipboard-9a7e2e26-8ab9-4fae-9c80-4ab0895fc61d.png",
  6: "C:/Users/regot/AppData/Local/Temp/codex-clipboard-17ebf4c1-bd61-4cf1-8e62-718a4e4670c9.png",
  7: "C:/Users/regot/OneDrive/Pictures/Screenshots 1/Screenshot 2026-06-28 164341.png",
  8: "C:/Users/regot/AppData/Local/Temp/codex-clipboard-ed1315fb-5d06-4a61-99db-679b83f38f00.png",
  9: "C:/Users/regot/AppData/Local/Temp/codex-clipboard-41e0b068-720a-46fa-b37e-57e33471d57f.png",
  10: "C:/Users/regot/AppData/Local/Temp/codex-clipboard-08bf0908-56aa-4ac6-b6ee-0d7a5c0a0cc4.png",
};

await fs.mkdir(assetDir, { recursive: true });
for (const [slide, source] of Object.entries(screenshots)) {
  await fs.copyFile(source, path.join(assetDir, `product-slide-${slide}.png`));
}

const layouts = {};
for (let slide = 1; slide <= 14; slide += 1) {
  layouts[slide] = JSON.parse(await fs.readFile(
    path.join(inspectDir, "layouts", `source-slide-${String(slide).padStart(2, "0")}.layout.json`),
    "utf8"
  ));
}

function elementByName(slide, name) {
  return layouts[slide].elements.find((element) => element.name === name);
}

function screenshotDeletes(slide) {
  // Slide 6's wireframe is a grouped object. The exported layout expands its
  // children, while the source-deck inspector exposes the inherited group ID.
  if (slide === 6) {
    return [{
      action: "delete",
      sourceElementId: "sh/g3ex0nux",
      reason: "Replace the grouped conceptual teams wireframe with an authentic DraftHQ screenshot.",
    }];
  }
  const maxLeft = slide === 10 ? 470 : 900;
  return layouts[slide].elements
    .filter((element) => element.scope === "slide" && element.bbox?.[1] >= 145 && element.bbox?.[0] < maxLeft)
    .map((element) => ({
      action: "delete",
      sourceElementId: element.aid,
      reason: "Replace conceptual wireframe object with an authentic DraftHQ screenshot.",
    }));
}

const outputSlides = [];
for (let slide = 1; slide <= 14; slide += 1) {
  const editTargets = [];
  if (slide >= 4 && slide <= 10) {
    editTargets.push(...screenshotDeletes(slide));
    if ([4, 7, 9].includes(slide)) {
      for (const name of [`section-${slide}`, `title-${slide}`]) {
        editTargets.push({
          action: "delete",
          sourceElementId: elementByName(slide, name).aid,
          reason: "Replace the inherited title shape affected by a source-render artifact.",
        });
      }
    } else {
      editTargets.push({ action: "rewrite", sourceElementId: elementByName(slide, `section-${slide}`).aid });
    }
    if (slide === 10) {
      for (const name of ["title-10", "mobile-title", "promise-t-0", "promise-t-1", "promise-t-2", "mobile-note"]) {
        editTargets.push({ action: "rewrite", sourceElementId: elementByName(10, name).aid });
      }
    }
    editTargets.push({
      action: "add",
      newPrimitiveAllowed: true,
      mustNotOverlapInherited: true,
      zone: slide === 10
        ? { left: 42, top: 145, width: 430, height: 505 }
        : { left: 42, top: 145, width: 820, height: 490 },
      reason: "Insert a real DraftHQ product screenshot into the cleared inherited media region.",
    });
    if ([4, 7, 9].includes(slide)) {
      editTargets.push({
        action: "add",
        newPrimitiveAllowed: true,
        mustNotOverlapInherited: true,
        zone: { left: 0, top: 0, width: 1280, height: 145 },
        reason: "Repair a source-render artifact in the inherited title band while preserving the established typography.",
      });
    }
  }
  if (slide === 2) {
    for (const element of layouts[2].elements.filter((element) => ["142", "21", "44"].includes(element.textPreview))) {
      editTargets.push({ action: "rewrite", sourceElementId: element.aid });
    }
  }
  if (slide === 12) {
    for (const element of layouts[12].elements.filter((element) => ["142 / 142", "16", "Source lint errors"].includes(element.textPreview))) {
      editTargets.push({ action: "rewrite", sourceElementId: element.aid });
    }
  }
  outputSlides.push({
    outputSlide: slide,
    sourceSlide: slide,
    narrativeRole: editTargets.length ? "product evidence refresh" : "preserve-only",
    reuseMode: "duplicate-slide",
    editTargets,
  });
}

await fs.writeFile(path.join(tmp, "template-frame-map.json"), JSON.stringify({ outputSlides, omittedSourceSlides: [] }, null, 2));
await fs.writeFile(path.join(tmp, "template-audit.txt"), `DraftHQ product-story source deck audit

- 14 slides, 1280x720, white/navy/teal visual system.
- Calibri/Calibri Light typography inherited throughout.
- Slides 4-10 contain conceptual wireframes in bounded product-media regions.
- Slides 1-3 and 11-14 provide narrative, capability, readiness, roadmap, and close patterns.
- The refreshed deck preserves all source slide layouts and replaces only the wireframe regions with authentic screenshots.
- Existing DraftHQ logo assets and all footer/page markers remain inherited.
`);
await fs.writeFile(path.join(tmp, "deviation-log.txt"), `Intentional deviations

- Slides 4-10: conceptual wireframe objects removed and replaced by real DraftHQ screenshots supplied during the build session.
- Slide 10: mobile-wireframe copy updated to describe the real pick-reveal experience shown in the screenshot.
- Slides 2 and 12: verification metrics updated to current repository values (153 unit tests, 32 build routes, 70 migrations, zero TypeScript errors).
`);
await fs.writeFile(path.join(tmp, "source-notes.txt"), `Visual sources

- Product screenshots: user-provided DraftHQ screenshots from the current local application build.
- Brand mark and deck styling: inherited from outputs/DraftHQ-product-story.pptx.
- No generated or third-party product UI was used.
`);

const builder = `import fs from "node:fs/promises";
import path from "node:path";
import { FileBlob, PresentationFile } from "file:///C:/Users/regot/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@oai/artifact-tool/dist/artifact_tool.mjs";

const tmp = ${JSON.stringify(tmp.replaceAll("\\", "/"))};
const starter = path.join(tmp, "template-starter.pptx");
const output = "D:/Projects/fantasy-draft-room/outputs/DraftHQ-screenshot-pitch.pptx";
const presentation = await PresentationFile.importPptx(await FileBlob.load(starter));

function shapeText(shape) { return shape.text?.toString?.() ?? ""; }
function findText(slide, text) {
  return slide.shapes.items.find((shape) => shapeText(shape) === text);
}
function replaceText(slide, from, to) {
  const shape = findText(slide, from);
  if (!shape) throw new Error(\`Missing text on slide \${slide.index + 1}: \${from}\`);
  shape.text.set(to);
}
async function imageBytes(file) {
  const bytes = await fs.readFile(file);
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

const labels = {
  4: "PRODUCT 1 OF 7", 5: "PRODUCT 2 OF 7", 6: "PRODUCT 3 OF 7",
  7: "PRODUCT 4 OF 7", 8: "PRODUCT 5 OF 7", 9: "PRODUCT 6 OF 7",
  10: "PRODUCT 7 OF 7",
};

for (let slideNumber = 4; slideNumber <= 10; slideNumber += 1) {
  const slide = presentation.slides.items[slideNumber - 1];
  const maxLeft = slideNumber === 10 ? 470 : 900;
  for (const shape of [...slide.shapes.items]) {
    const pos = shape.position;
    if (pos.top >= 145 && pos.left < maxLeft) shape.delete();
  }
  replaceText(slide, slideNumber === 10 ? "MOBILE EXPERIENCE" : \`WIREFRAME \${slideNumber - 3} OF 6\`, labels[slideNumber]);
  const frame = slideNumber === 10
    ? { left: 42, top: 145, width: 430, height: 505 }
    : slideNumber === 9
      ? { left: 42, top: 202, width: 820, height: 375 }
    : { left: 42, top: 145, width: 820, height: 490 };
  slide.images.add({
    blob: await imageBytes(path.join(tmp, "assets", \`product-slide-\${slideNumber}.png\`)),
    contentType: "image/png",
    alt: \`DraftHQ product screenshot for slide \${slideNumber}\`,
    fit: slideNumber === 9 ? "fill" : "contain",
    position: frame,
  });
}

const repairedTitles = {
  4: ["PRODUCT 1 OF 7", "Current state: dashboard"],
  7: ["PRODUCT 4 OF 7", "Current state: draft setup"],
  9: ["PRODUCT 6 OF 7", "Current state: live draft room"],
};
for (const [slideNumberText, copy] of Object.entries(repairedTitles)) {
  const slide = presentation.slides.items[Number(slideNumberText) - 1];
  for (const name of [\`section-\${slideNumberText}\`, \`title-\${slideNumberText}\`]) {
    slide.shapes.items.find((shape) => shape.name === name)?.delete();
  }
  const eyebrow = slide.shapes.add({
    geometry: "textbox",
    position: { left: 42, top: 28, width: 360, height: 24 },
    fill: "none",
    line: { style: "solid", fill: "none", width: 0 },
  });
  eyebrow.text = copy[0];
  eyebrow.text.style = { fontFamily: "Calibri", fontSize: 11, bold: true, color: "#008F87" };
  const title = slide.shapes.add({
    geometry: "textbox",
    position: { left: 42, top: 58, width: 1130, height: 64 },
    fill: "none",
    line: { style: "solid", fill: "none", width: 0 },
  });
  title.text = copy[1];
  title.text.style = { fontFamily: "Calibri", fontSize: 32, bold: true, color: "#071525" };
}

replaceText(presentation.slides.items[9], "The same draft, from a phone", "Current state: pick reveal");
replaceText(presentation.slides.items[9], "Draft owners should need only three things", "Every pick gets a shared moment");
replaceText(presentation.slides.items[9], "Know when it’s my turn", "Announce the selection");
replaceText(presentation.slides.items[9], "See the best available players", "Show the player and team");
replaceText(presentation.slides.items[9], "Make one safe, confirmed pick", "Move everyone to the next clock");
replaceText(presentation.slides.items[9], "Mobile support is a release priority—not a decorative afterthought.", "A polished reveal turns database state into draft-night theater.");

replaceText(presentation.slides.items[1], "142", "153");
replaceText(presentation.slides.items[1], "21", "32");
replaceText(presentation.slides.items[1], "44", "70");
replaceText(presentation.slides.items[11], "142 / 142", "153 / 153");
replaceText(presentation.slides.items[11], "16", "0");
replaceText(presentation.slides.items[11], "Source lint errors", "TypeScript errors");

for (let index = 0; index < presentation.slides.items.length; index += 1) {
  const slide = presentation.slides.items[index];
  const stem = \`slide-\${String(index + 1).padStart(2, "0")}\`;
  const png = await presentation.export({ slide, format: "png", scale: 1 });
  await fs.writeFile(path.join(tmp, "preview", \`\${stem}.png\`), new Uint8Array(await png.arrayBuffer()));
  const layout = await slide.export({ format: "layout" });
  await fs.writeFile(path.join(tmp, "layout", "final", \`\${stem}.layout.json\`), await layout.text());
}
const montage = await presentation.export({ format: "webp", montage: true, scale: 1 });
await fs.writeFile(path.join(tmp, "preview", "final-montage.webp"), new Uint8Array(await montage.arrayBuffer()));
const pptx = await PresentationFile.exportPptx(presentation);
await pptx.save(output);
console.log(output);
`;

await fs.mkdir(path.join(tmp, "preview"), { recursive: true });
await fs.mkdir(path.join(tmp, "layout", "final"), { recursive: true });
await fs.writeFile(path.join(tmp, "build-deck.mjs"), builder);
console.log(tmp);
