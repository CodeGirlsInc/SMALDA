import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { GlossaryTerm } from './glossary-term.entity';
import { Repository, ILike } from 'typeorm';

@Injectable()
export class GlossaryBuilderService {
  constructor(
    @InjectRepository(GlossaryTerm)
    private readonly glossaryRepo: Repository<GlossaryTerm>,
  ) {}

  /**
   * Extract legal terms from document text (basic placeholder logic)
   */
  async extractTermsFromText(text: string): Promise<string[]> {
    // Example: match capitalized words (you can replace with NLP/Regex for legal)
    const matches = text.match(/\b[A-Z][a-z]+\b/g) || [];
    const uniqueTerms = [...new Set(matches)];
    return uniqueTerms;
  }

  /**
   * Build glossary from document text
   */
  async buildFromDocument(text: string): Promise<GlossaryTerm[]> {
    const terms = await this.extractTermsFromText(text);

    const savedTerms: GlossaryTerm[] = [];
    for (const term of terms) {
      let existing = await this.glossaryRepo.findOne({ where: { term } });
      if (!existing) {
        existing = this.glossaryRepo.create({ term });
        savedTerms.push(await this.glossaryRepo.save(existing));
      }
    }
    return savedTerms;
  }

  /**
   * Search glossary term
   */
  async searchTerm(query: string): Promise<GlossaryTerm[]> {
    return this.glossaryRepo.find({
      where: { term: ILike(`%${query}%`) },
      order: { term: 'ASC' },
    });
  }
}
