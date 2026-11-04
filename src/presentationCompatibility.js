import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";

function enforcePresentationArchiveLimits(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const minimumEndRecord = Math.max(0, bytes.length - 65_557);
  let endRecord = -1;
  for (
    let offset = bytes.length - 22;
    offset >= minimumEndRecord;
    offset -= 1
  ) {
    if (view.getUint32(offset, true) === 0x06054b50) {
      endRecord = offset;
      break;
    }
  }
  if (endRecord < 0) throw new Error("Invalid presentation archive.");

  const entryCount = view.getUint16(endRecord + 10, true);
  const directorySize = view.getUint32(endRecord + 12, true);
  const directoryOffset = view.getUint32(endRecord + 16, true);
  const directoryEnd = directoryOffset + directorySize;
  if (
    entryCount > 500 ||
    directoryOffset === 0xffffffff ||
    directoryEnd > endRecord
  ) {
    throw new Error("The presentation exceeds preview limits.");
  }

  let offset = directoryOffset;
  let expandedBytes = 0;
  for (let index = 0; index < entryCount; index += 1) {
    if (
      offset + 46 > directoryEnd ||
      view.getUint32(offset, true) !== 0x02014b50
    ) {
      throw new Error("Invalid presentation archive.");
    }
    const uncompressedSize = view.getUint32(offset + 24, true);
    const filenameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    if (uncompressedSize === 0xffffffff) {
      throw new Error("The presentation exceeds preview limits.");
    }
    expandedBytes += uncompressedSize;
    if (expandedBytes > 32 * 1024 * 1024) {
      throw new Error("The presentation exceeds preview limits.");
    }
    offset += 46 + filenameLength + extraLength + commentLength;
  }
}

export function normalizePresentationNamespacePrefixes(bytes) {
  enforcePresentationArchiveLimits(bytes);
  const files = unzipSync(bytes);
  const xmlBytes = files["ppt/presentation.xml"];
  if (!xmlBytes) throw new Error("Invalid presentation archive.");
  let xml = strFromU8(xmlBytes);
  const bindings = [...xml.matchAll(/xmlns:([\w.-]+)\s*=\s*(["'])(.*?)\2/g)];
  const normalizedBindings = [];
  const occupiedPrefixes = new Map(
    bindings.map(([, prefix, , uri]) => [prefix, uri]),
  );
  for (const [, prefix, , uri] of bindings) {
    const target = uri.endsWith("/presentationml/2006/main")
      ? "p"
      : uri.endsWith("/officeDocument/2006/relationships")
        ? "r"
        : uri.endsWith("/drawingml/2006/main")
          ? "a"
          : null;
    if (!target || prefix === target) continue;
    if (occupiedPrefixes.has(target) && occupiedPrefixes.get(target) !== uri)
      continue;
    occupiedPrefixes.set(target, uri);
    normalizedBindings.push([prefix, target]);
  }
  if (!normalizedBindings.length) return bytes;

  for (const [prefix, target] of normalizedBindings) {
    xml = xml.replaceAll(`xmlns:${prefix}=`, `xmlns:${target}=`);
    xml = xml.replace(new RegExp(`(<\\/?|\\s)${prefix}:`, "g"), `$1${target}:`);
  }
  files["ppt/presentation.xml"] = strToU8(xml);
  return zipSync(files, { level: 0 });
}
