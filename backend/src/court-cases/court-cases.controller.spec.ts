import { Test, TestingModule } from '@nestjs/testing';
import { CourtCasesController } from './court-cases.controller';
import { CourtCasesService } from './court-cases.service';

describe('CourtCasesController', () => {
  let controller: CourtCasesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CourtCasesController],
      providers: [CourtCasesService],
    }).compile();

    controller = module.get<CourtCasesController>(CourtCasesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
