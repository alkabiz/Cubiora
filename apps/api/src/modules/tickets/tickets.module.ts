import { Module } from '@nestjs/common';
import { TicketsController } from './tickets.controller';
import { TicketsService } from './tickets.service';
import { PublicDisplayModule } from '../public-display/public-display.module';
import { CubiclesModule } from '../cubicles/cubicles.module';

@Module({
  imports: [PublicDisplayModule, CubiclesModule],
  controllers: [TicketsController],
  providers: [TicketsService],
  exports: [TicketsService],
})
export class TicketsModule {}
