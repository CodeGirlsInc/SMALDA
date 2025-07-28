import { Test, TestingModule } from '@nestjs/testing';
import { CourtCasesService } from './court-cases.service';

describe('CourtCasesService', () => {
  let service: CourtCasesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CourtCasesService],
    }).compile();

    service = module.get<CourtCasesService>(CourtCasesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
