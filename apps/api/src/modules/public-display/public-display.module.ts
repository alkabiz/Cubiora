import { Module } from '@nestjs/common';
import { PublicDisplayController } from './public-display.controller';
import { PublicDisplayService } from './public-display.service';

@Module({
  controllers: [PublicDisplayController],
  providers: [PublicDisplayService],
  exports: [PublicDisplayService],
})
export class PublicDisplayModule {}
