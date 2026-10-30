import {
  BadRequestException,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AccessTokenGuard } from '../auth/access-token.guard.js';
import { CurrentActor } from '../auth/current-actor.decorator.js';
import type { AuthenticatedActor } from '../auth/auth.types.js';
import { parseAssetImportVersion } from './asset-version.js';
import { AssetImportsService } from './asset-imports.service.js';
import { MAX_ASSET_IMPORT_BYTES } from './asset-import-csv.js';
import { ListAssetImportsQueryDto } from './dto/list-asset-imports-query.dto.js';

interface UploadedCsvFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

const csvFileInterceptor = FileInterceptor('file', {
  limits: { fileSize: MAX_ASSET_IMPORT_BYTES, files: 1 },
  fileFilter: (_request, file, callback) => {
    const extensionIsCsv = file.originalname.toLowerCase().endsWith('.csv');
    const declaredTextType = [
      'text/csv',
      'application/csv',
      'application/vnd.ms-excel',
      'text/plain',
    ].includes(file.mimetype.toLowerCase());
    if (!extensionIsCsv || !declaredTextType) {
      callback(
        new BadRequestException('Only UTF-8 CSV files are supported'),
        false,
      );
      return;
    }
    callback(null, true);
  },
});

@Controller('imports')
@UseGuards(AccessTokenGuard)
export class AssetImportsController {
  constructor(private readonly imports: AssetImportsService) {}

  @Get()
  list(
    @CurrentActor() actor: AuthenticatedActor,
    @Query() query: ListAssetImportsQueryDto,
  ) {
    return this.imports.list(actor, query.page, query.pageSize);
  }

  @Get(':importJobId')
  get(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('importJobId', new ParseUUIDPipe()) importJobId: string,
  ) {
    return this.imports.get(actor, importJobId);
  }

  @Get(':importJobId/errors')
  errors(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('importJobId', new ParseUUIDPipe()) importJobId: string,
  ) {
    return this.imports.errors(actor, importJobId);
  }

  @Post('assets/preview')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(csvFileInterceptor)
  preview(
    @CurrentActor() actor: AuthenticatedActor,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @UploadedFile() file: UploadedCsvFile | undefined,
  ) {
    if (!file?.buffer) {
      throw new BadRequestException('Select one CSV file to preview');
    }
    return this.imports.preview(actor, idempotencyKey, file.buffer);
  }

  @Post(':importJobId/commit')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(csvFileInterceptor)
  commit(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('importJobId', new ParseUUIDPipe()) importJobId: string,
    @Headers('if-match') ifMatch: string | undefined,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @UploadedFile() file: UploadedCsvFile | undefined,
  ) {
    if (!file?.buffer) {
      throw new BadRequestException(
        'Select the original CSV file to confirm this import',
      );
    }
    return this.imports.commit(
      actor,
      importJobId,
      parseAssetImportVersion(ifMatch),
      idempotencyKey,
      file.buffer,
    );
  }
}
