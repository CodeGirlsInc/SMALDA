// src/case-change-detector/types/case.type.ts
export interface Case {
  id: string;
  status: string;
  assignedTo: string;
  priority: 'low' | 'medium' | 'high';
  updatedAt: Date;
  [key: string]: any; // Allow dynamic fields
}
