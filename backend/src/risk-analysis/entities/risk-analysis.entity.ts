import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm"
import { Document } from "../../documents/entities/document.entity"

export enum RiskLevel {
  LOW = "LOW",
  MEDIUM = "MEDIUM",
  HIGH = "HIGH",
  CRITICAL = "CRITICAL",
}

@Entity("risk_analyses")
export class RiskAnalysis {
  @PrimaryGeneratedColumn("uuid")
  id: string

  @Column()
  documentId: string

  @ManyToOne(() => Document)
  @JoinColumn({ name: "documentId" })
  document: Document

  @Column({
    type: "enum",
    enum: RiskLevel,
    default: RiskLevel.LOW,
  })
  riskLevel: RiskLevel

  @Column("text")
  summary: string

  @Column("jsonb")
  detectedKeywords: string[]

  @Column("jsonb")
  riskFactors: RiskFactor[]

  @Column("decimal", { precision: 5, scale: 2 })
  riskScore: number

  @Column()
  analyzedBy: string

  @Column({ default: "STATIC_RULES" })
  analysisMethod: string

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date
}

export interface RiskFactor {
  category: string
  severity: string
  description: string
  keywords: string[]
  score: number
}
