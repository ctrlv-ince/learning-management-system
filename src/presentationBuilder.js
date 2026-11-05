import { strToU8, zipSync } from "fflate";

const NS = {
  a: "http://schemas.openxmlformats.org/drawingml/2006/main",
  p: "http://schemas.openxmlformats.org/presentationml/2006/main",
  r: "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
  rel: "http://schemas.openxmlformats.org/package/2006/relationships",
};

const palettes = {
  forest: { accent: "547562", dark: "26372D", ink: "34443A", muted: "6B786E", paper: "F6F7F3", soft: "E8EFE8" },
  ocean: { accent: "356A78", dark: "1D3540", ink: "304951", muted: "647A80", paper: "F3F7F7", soft: "E2EFF0" },
  clay: { accent: "A65F47", dark: "432F2B", ink: "57413A", muted: "89756C", paper: "FAF6F2", soft: "F2E6DD" },
};

const slideSize = { width: 12192000, height: 6858000 };

function escapeXml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function groupTree() {
  return `<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>`;
}

function rectShape(id, name, x, y, cx, cy, color, radius = false) {
  const geometry = radius ? "roundRect" : "rect";
  return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${name}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="${geometry}"><a:avLst/></a:prstGeom><a:solidFill><a:srgbClr val="${color}"/></a:solidFill><a:ln><a:noFill/></a:ln></p:spPr></p:sp>`;
}

function textShape(id, name, x, y, cx, cy, paragraphs, options = {}) {
  const {
    color = "26372D",
    size = 1800,
    bold = false,
    italic = false,
    bullet = false,
    align = "l",
    font = "Aptos",
    margin = "0",
  } = options;
  const body = paragraphs.map((paragraph) => {
    const text = escapeXml(paragraph.text ?? paragraph);
    const isBullet = paragraph.bullet ?? bullet;
    const paraProps = isBullet
      ? `<a:pPr algn="${align}" marL="304800" indent="-190500"><a:buChar char="&#x2022;"/></a:pPr>`
      : `<a:pPr algn="${align}"><a:buNone/></a:pPr>`;
    return `<a:p>${paraProps}<a:r><a:rPr lang="en-US" sz="${size}"${bold ? ' b="1"' : ""}${italic ? ' i="1"' : ""}><a:solidFill><a:srgbClr val="${color}"/></a:solidFill><a:latin typeface="${font}"/></a:rPr><a:t xml:space="preserve">${text}</a:t></a:r><a:endParaRPr lang="en-US" sz="${size}"/></a:p>`;
  }).join("");
  return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${name}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/><a:ln><a:noFill/></a:ln></p:spPr><p:txBody><a:bodyPr wrap="square" lIns="${margin}" rIns="${margin}" tIns="0" bIns="0" anchor="t"/><a:lstStyle/>${body}</p:txBody></p:sp>`;
}

function makePicture(id, name, x, y, cx, cy, relationshipId) {
  return `<p:pic><p:nvPicPr><p:cNvPr id="${id}" name="${escapeXml(name)}"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="${relationshipId}"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>`;
}

function tableShapes(table, palette, startId = 10, textStyle = {}) {
  const rows = Array.isArray(table) ? table : [];
  const rowCount = Math.max(1, rows.length);
  const columnCount = Math.max(1, ...rows.map((row) => Array.isArray(row) ? row.length : 0));
  const x = 685800;
  const y = 2133600;
  const width = 10515600;
  const height = 3810000;
  const cellWidth = Math.floor(width / columnCount);
  const cellHeight = Math.floor(height / rowCount);
  const shapes = [];
  rows.forEach((row, rowIndex) => {
    for (let column = 0; column < columnCount; column += 1) {
      const cellX = x + column * cellWidth;
      const cellY = y + rowIndex * cellHeight;
      const fill = rowIndex === 0 ? palette.dark : rowIndex % 2 ? "FFFFFF" : palette.soft;
      const formatted = styleOptions(textStyle, { color: rowIndex === 0 ? "FFFFFF" : palette.ink, size: rowIndex === 0 ? 1500 : 1300, bold: rowIndex === 0, font: "Aptos" });
      shapes.push(rectShape(startId++, `Table cell ${rowIndex + 1}-${column + 1}`, cellX, cellY, cellWidth - 18000, cellHeight - 18000, fill));
      shapes.push(textShape(startId++, `Table text ${rowIndex + 1}-${column + 1}`, cellX + 100000, cellY + 85000, cellWidth - 210000, cellHeight - 170000, [{ text: row?.[column] || "" }], { ...formatted, color: textStyle.color ? formatted.color : (rowIndex === 0 ? "FFFFFF" : palette.ink), bold: textStyle.bold ?? rowIndex === 0, margin: "50000" }));
    }
  });
  return shapes;
}

function styleOptions(style = {}, fallback = {}) {
  const alignment = { left: "l", center: "ctr", right: "r" };
  const rawColor = style.color || fallback.color || "26372D";
  const safeColor = String(rawColor).replace("#", "").replace(/[^0-9a-f]/gi, "").slice(0, 6);
  return {
    ...fallback,
    color: safeColor.length === 6 ? safeColor : fallback.color || "26372D",
    size: style.size ? Number(style.size) * 100 : fallback.size,
    font: style.font || fallback.font || "Aptos",
    bold: style.bold ?? fallback.bold ?? false,
    italic: style.italic ?? fallback.italic ?? false,
    align: alignment[style.align] || style.align || fallback.align || "l",
  };
}

function makeSlide(slide, index, total, palette) {
  const bodyLines = String(slide.body || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const bulletLines = String(slide.bullets || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const layout = slide.layout || (index === 0 ? "cover" : "keypoints");
  const shapes = [];
  const darkCanvas = layout === "cover" || layout === "quote";
  if (darkCanvas) {
    shapes.push(rectShape(2, "Accent panel", layout === "quote" ? 0 : 0, 0, layout === "quote" ? slideSize.width : 762000, slideSize.height, layout === "quote" ? palette.dark : palette.accent));
    if (layout === "quote") shapes.push(rectShape(3, "Quote accent", 0, 0, 220000, slideSize.height, palette.accent));
  } else {
    shapes.push(rectShape(2, "Top accent", 685800, 548640, 990600, 76200, palette.accent, true));
  }

  const titleX = layout === "cover" ? 1143000 : 685800;
  const titleY = layout === "cover" ? 1828800 : 1219200;
  const titleWidth = layout === "image" ? 5900000 : 10515600;
  const titleColor = darkCanvas ? "FFFFFF" : palette.dark;
  const titleSize = layout === "cover" ? 4300 : layout === "quote" ? 3300 : 3000;
  const titleStyle = styleOptions(slide.titleStyle, { color: titleColor, size: titleSize, bold: true, font: "Aptos Display" });
  const bodyStyle = styleOptions(slide.bodyStyle, { color: darkCanvas ? "F1F4EF" : palette.ink, size: 1900, font: "Aptos" });
  const bulletStyle = styleOptions(slide.bulletStyle, { color: darkCanvas ? "FFFFFF" : palette.ink, size: 1800, font: "Aptos" });
  shapes.push(textShape(4, "Modulink label", titleX, layout === "cover" ? 914400 : 762000, 10515600, 304800, [{ text: `MODULINK LEARNING  /  ${String(index + 1).padStart(2, "0")}` }], { color: darkCanvas ? "E2E9E2" : palette.muted, size: 1100, bold: true }));
  shapes.push(textShape(5, "Slide title", titleX, titleY, titleWidth, layout === "cover" ? 1524000 : 1051560, [{ text: slide.title }], titleStyle));

  if (layout === "cover") {
    if (bodyLines.length) shapes.push(textShape(6, "Introduction", titleX, 3657600, 8382000, 1219200, bodyLines.map((text) => ({ text })), { ...bodyStyle, color: slide.bodyStyle?.color ? bodyStyle.color : "F1F4EF", size: slide.bodyStyle?.size ? bodyStyle.size : 2100 }));
    if (bulletLines.length) shapes.push(textShape(7, "Opening points", titleX, 4953000, 8382000, 914400, bulletLines.map((text) => ({ text, bullet: true })), { ...bulletStyle, color: slide.bulletStyle?.color ? bulletStyle.color : "FFFFFF", size: slide.bulletStyle?.size ? bulletStyle.size : 1600 }));
  } else if (layout === "split") {
    shapes.push(rectShape(6, "Right column card", 6400800, 2133600, 4724400, 3505200, palette.soft, true));
    if (bodyLines.length) shapes.push(textShape(7, "Explanation", 685800, 2133600, 5000000, 3505200, bodyLines.map((text) => ({ text })), bodyStyle));
    if (bulletLines.length) shapes.push(textShape(8, "Key points", 6858000, 2438400, 3810000, 2895600, bulletLines.map((text) => ({ text, bullet: true })), bulletStyle));
  } else if (layout === "image") {
    if (bodyLines.length || bulletLines.length) shapes.push(textShape(6, "Image slide text", 685800, 2438400, 5000000, 3100000, [...bodyLines.map((text) => ({ text })), ...bulletLines.map((text) => ({ text, bullet: true }))], bodyStyle));
    if (slide.image) shapes.push(makePicture(20, slide.image.name, 6400800, 1981200, 4724400, 3657600, "rId2"));
    else shapes.push(rectShape(20, "Image placeholder", 6400800, 1981200, 4724400, 3657600, palette.soft, true));
  } else if (layout === "table") {
    shapes.push(...tableShapes(slide.table, palette, 10, slide.bodyStyle || {}));
  } else if (layout === "quote") {
    if (bodyLines.length) shapes.push(textShape(6, "Quote text", 1143000, 2743200, 9144000, 2286000, bodyLines.map((text) => ({ text })), { ...bodyStyle, color: slide.bodyStyle?.color ? bodyStyle.color : "FFFFFF", size: slide.bodyStyle?.size ? bodyStyle.size : 2700, font: "Aptos Display" }));
    if (bulletLines.length) shapes.push(textShape(7, "Quote attribution", 1143000, 5334000, 9144000, 609600, bulletLines.map((text) => ({ text })), { ...bulletStyle, color: slide.bulletStyle?.color ? bulletStyle.color : "D8E3D9", size: slide.bulletStyle?.size ? bulletStyle.size : 1500, bold: slide.bulletStyle?.bold ?? true }));
  } else {
    if (bodyLines.length) shapes.push(textShape(6, "Lesson notes", 685800, 2286000, 10515600, bulletLines.length ? 1219200 : 3048000, bodyLines.map((text) => ({ text })), bodyStyle));
    if (bulletLines.length) shapes.push(textShape(7, "Key points", 914400, bodyLines.length ? 3657600 : 2286000, 9906000, 2133600, bulletLines.map((text) => ({ text, bullet: true })), bulletStyle));
  }
  shapes.push(textShape(100, "Slide number", 10287000, 6248400, 1676400, 304800, [{ text: `${String(index + 1).padStart(2, "0")}  /  ${String(total).padStart(2, "0")}` }], { color: darkCanvas ? "E2E9E2" : palette.muted, size: 1000, align: "r" }));

  const background = darkCanvas ? palette.dark : palette.paper;
  const relationship = slide.image
    ? `<Relationships xmlns="${NS.rel}"><Relationship Id="rId1" Type="${NS.r}/slideLayout" Target="../slideLayouts/slideLayout1.xml"/><Relationship Id="rId2" Type="${NS.r}/image" Target="../media/${slide.image.path}"/></Relationships>`
    : `<Relationships xmlns="${NS.rel}"><Relationship Id="rId1" Type="${NS.r}/slideLayout" Target="../slideLayouts/slideLayout1.xml"/></Relationships>`;
  return {
    xml: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sld xmlns:a="${NS.a}" xmlns:r="${NS.r}" xmlns:p="${NS.p}"><p:cSld><p:bg><p:bgPr><a:solidFill><a:srgbClr val="${background}"/></a:solidFill><a:effectLst/></p:bgPr></p:bg><p:spTree>${groupTree()}${shapes.join("")}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`,
    relationships: relationship,
  };
}

function themeXml(palette) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><a:theme xmlns:a="${NS.a}" name="Modulink"><a:themeElements><a:clrScheme name="Modulink"><a:dk1><a:srgbClr val="${palette.dark}"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="${palette.ink}"/></a:dk2><a:lt2><a:srgbClr val="${palette.paper}"/></a:lt2><a:accent1><a:srgbClr val="${palette.accent}"/></a:accent1><a:accent2><a:srgbClr val="${palette.soft}"/></a:accent2><a:accent3><a:srgbClr val="78917F"/></a:accent3><a:accent4><a:srgbClr val="BCA77B"/></a:accent4><a:accent5><a:srgbClr val="7B8790"/></a:accent5><a:accent6><a:srgbClr val="A65F47"/></a:accent6><a:hlink><a:srgbClr val="0563C1"/></a:hlink><a:folHlink><a:srgbClr val="954F72"/></a:folHlink></a:clrScheme><a:fontScheme name="Modulink"><a:majorFont><a:latin typeface="Aptos Display"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont><a:minorFont><a:latin typeface="Aptos"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme><a:fmtScheme name="Modulink"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst><a:lnStyleLst><a:ln w="6350"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/></a:ln><a:ln w="12700"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/></a:ln><a:ln w="19050"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/></a:ln></a:lnStyleLst><a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst><a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst></a:fmtScheme></a:themeElements></a:theme>`;
}

function addFile(files, name, contents) {
  files[name] = strToU8(contents);
}

export function buildLessonPresentationPptx(slides, themeName = "forest") {
  const palette = palettes[themeName] || palettes.forest;
  const files = {};
  const preparedSlides = slides.map((slide, index) => {
    if (!slide.image?.data) return slide;
    const extension = slide.image.type === "image/png" ? "png" : "jpg";
    const path = `image${index + 1}.${extension}`;
    files[`ppt/media/${path}`] = slide.image.data;
    return { ...slide, image: { ...slide.image, path } };
  });
  const slideEntries = preparedSlides.map((slide, index) => `<p:sldId id="${256 + index}" r:id="rId${index + 2}"/>`).join("");
  const slideRelationships = slides.map((_, index) => `<Relationship Id="rId${index + 2}" Type="${NS.r}/slide" Target="slides/slide${index + 1}.xml"/>`).join("");

  const hasPng = preparedSlides.some((slide) => slide.image?.type === "image/png");
  const hasJpg = preparedSlides.some((slide) => slide.image && slide.image.type !== "image/png");
  addFile(files, "[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>${hasPng ? '<Default Extension="png" ContentType="image/png"/>' : ""}${hasJpg ? '<Default Extension="jpg" ContentType="image/jpeg"/>' : ""}<Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/><Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/><Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/><Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>${slides.map((_, index) => `<Override PartName="/ppt/slides/slide${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`).join("")}</Types>`);
  addFile(files, "_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${NS.rel}"><Relationship Id="rId1" Type="${NS.r}/officeDocument" Target="ppt/presentation.xml"/></Relationships>`);
  addFile(files, "ppt/presentation.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:presentation xmlns:a="${NS.a}" xmlns:r="${NS.r}" xmlns:p="${NS.p}"><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst><p:sldIdLst>${slideEntries}</p:sldIdLst><p:sldSz cx="12192000" cy="6858000" type="screen16x9"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>`);
  addFile(files, "ppt/_rels/presentation.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${NS.rel}"><Relationship Id="rId1" Type="${NS.r}/slideMaster" Target="slideMasters/slideMaster1.xml"/>${slideRelationships}</Relationships>`);
  addFile(files, "ppt/slideMasters/slideMaster1.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sldMaster xmlns:a="${NS.a}" xmlns:r="${NS.r}" xmlns:p="${NS.p}"><p:cSld><p:spTree>${groupTree()}</p:spTree></p:cSld><p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/><p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst><p:txStyles/></p:sldMaster>`);
  addFile(files, "ppt/slideMasters/_rels/slideMaster1.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${NS.rel}"><Relationship Id="rId1" Type="${NS.r}/slideLayout" Target="../slideLayouts/slideLayout1.xml"/><Relationship Id="rId2" Type="${NS.r}/theme" Target="../theme/theme1.xml"/></Relationships>`);
  addFile(files, "ppt/slideLayouts/slideLayout1.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sldLayout xmlns:a="${NS.a}" xmlns:r="${NS.r}" xmlns:p="${NS.p}" type="blank" preserve="1"><p:cSld name="Blank"><p:spTree>${groupTree()}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>`);
  addFile(files, "ppt/slideLayouts/_rels/slideLayout1.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${NS.rel}"><Relationship Id="rId1" Type="${NS.r}/slideMaster" Target="../slideMasters/slideMaster1.xml"/></Relationships>`);
  addFile(files, "ppt/theme/theme1.xml", themeXml(palette));
  preparedSlides.forEach((slide, index) => {
    const generated = makeSlide(slide, index, slides.length, palette);
    addFile(files, `ppt/slides/slide${index + 1}.xml`, generated.xml);
    addFile(files, `ppt/slides/_rels/slide${index + 1}.xml.rels`, generated.relationships);
  });
  return zipSync(files, { level: 6 });
}

export const presentationPalettes = palettes;
