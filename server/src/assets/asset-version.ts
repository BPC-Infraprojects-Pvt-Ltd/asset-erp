import { BadRequestException } from '@nestjs/common';

export function parseAssetVersion(value: string | undefined): number {
  return parseVersion(value, 'asset');
}

export function parseAssetCategoryVersion(value: string | undefined): number {
  return parseVersion(value, 'asset category');
}

function parseVersion(value: string | undefined, resource: string): number {
  if (!value || !/^"[1-9]\d*"$/.test(value)) {
    throw new BadRequestException(
      `If-Match must contain one quoted positive ${resource} version, for example "1"`,
    );
  }
  const version = Number(value.slice(1, -1));
  if (!Number.isSafeInteger(version) || version > 2147483647) {
    throw new BadRequestException(
      `If-Match ${resource} version is out of range`,
    );
  }
  return version;
}
