import { BadRequestException } from '@nestjs/common';

export function parseSoftwareVersion(value: string | undefined): number {
  const match = value?.match(/^"([1-9]\d*)"$/);
  if (!match) {
    throw new BadRequestException(
      'If-Match must contain one quoted positive software record version',
    );
  }
  const version = Number(match[1]);
  if (!Number.isSafeInteger(version) || version > 2_147_483_647) {
    throw new BadRequestException(
      'If-Match software record version is out of range',
    );
  }
  return version;
}
