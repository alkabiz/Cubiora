import { IsOptional, IsInt, Min } from 'class-validator';

export class TicketCommandDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  expectedVersion?: number;
}
