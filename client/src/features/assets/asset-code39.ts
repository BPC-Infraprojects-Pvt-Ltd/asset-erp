const code39Patterns: Record<string, string> = {
  "0": "nnnwwnwnn",
  "1": "wnnwnnnnw",
  "2": "nnwwnnnnw",
  "3": "wnwwnnnnn",
  "4": "nnnwwnnnw",
  "5": "wnnwwnnnn",
  "6": "nnwwwnnnn",
  "7": "nnnwnnwnw",
  "8": "wnnwnnwnn",
  "9": "nnwwnnwnn",
  A: "wnnnnwnnw",
  B: "nnwnnwnnw",
  C: "wnwnnwnnn",
  D: "nnnnwwnnw",
  E: "wnnnwwnnn",
  F: "nnwnwwnnn",
  "*": "nwnnwnwnn",
};

export interface Code39Bar {
  x: number;
  width: number;
}

export interface EncodedAssetId {
  bars: Code39Bar[];
  width: number;
}

export function encodeAssetIdCode39(assetId: string): EncodedAssetId {
  const compactId = assetId.replaceAll("-", "").toUpperCase();
  if (!/^[0-9A-F]{32}$/.test(compactId)) {
    throw new Error("Asset ID must be a UUID.");
  }

  const encoded = `*${compactId}*`;
  const bars: Code39Bar[] = [];
  let cursor = 10;

  for (const [characterIndex, character] of [...encoded].entries()) {
    const pattern = code39Patterns[character];
    if (!pattern)
      throw new Error("Asset ID contains an unsupported character.");

    for (const [patternIndex, widthType] of [...pattern].entries()) {
      const width = widthType === "w" ? 3 : 1;
      if (patternIndex % 2 === 0) bars.push({ x: cursor, width });
      cursor += width;
    }

    if (characterIndex < encoded.length - 1) cursor += 1;
  }

  return { bars, width: cursor + 10 };
}
