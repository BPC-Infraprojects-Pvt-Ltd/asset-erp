import { BadRequestException } from '@nestjs/common';

export function parseAssetVersion(value: string | undefined): number {
  if (!value || !/^"[1-9]\d*"$/.test(value)) {
    throw new BadRequestException(
      'If-Match must contain one quoted positive asset version, for example "1"',
    );
  }
  const version = Number(value.slice(1, -1));
  if (!Number.isSafeInteger(version) || version > 2147483647) {
    throw new BadRequestException('If-Match asset version is out of range');
  }
  return version;
}
