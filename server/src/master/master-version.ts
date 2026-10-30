import { BadRequestException } from '@nestjs/common';

export function parseMasterRecordVersion(value: string | undefined): number {
  const match = value?.match(/^"([1-9]\d*)"$/);
  if (!match) {
    throw new BadRequestException(
      'A single quoted positive integer If-Match version is required',
    );
  }
  const version = Number(match[1]);
  if (!Number.isSafeInteger(version) || version > 2_147_483_647) {
    throw new BadRequestException(
      'A single quoted positive integer If-Match version is required',
    );
  }
  return version;
}
