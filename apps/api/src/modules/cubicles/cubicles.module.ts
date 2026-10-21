import { Module } from '@nestjs/common';
import { CubiclesController } from './cubicles.controller';
import { CubiclesService } from './cubicles.service';

@Module({
  controllers: [CubiclesController],
  providers: [CubiclesService],
  exports: [CubiclesService],
})
export class CubiclesModule {}
