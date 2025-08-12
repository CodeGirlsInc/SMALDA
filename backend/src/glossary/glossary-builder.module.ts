import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GlossaryTerm } from './glossary-term.entity';
import { GlossaryBuilderService } from './glossary-builder.service';
import { GlossaryBuilderController } from './glossary-builder.controller';

@Module({
  imports: [TypeOrmModule.forFeature([GlossaryTerm])],
  providers: [GlossaryBuilderService],
  controllers: [GlossaryBuilderController],
  exports: [GlossaryBuilderService],
})
export class GlossaryBuilderModule {}
