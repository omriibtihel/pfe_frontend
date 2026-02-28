export type ProjectStatus = 'active' | 'completed' | 'archived';

export interface Project {
  id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
  userId: string;
  datasetName?: string;
  targetColumn?: string;
  accuracy?: number;
}

export interface ProjectStats {
  activeProjects: number;
  averageAccuracy: number;
  performanceGrowth: number;
  totalPredictions: number;
}
