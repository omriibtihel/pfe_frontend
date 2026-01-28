import { TrainingConfig, TrainingSession, ModelResult, ModelType } from '@/types';

const MOCK_DELAY = 800;
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const generateMockResults = (models: ModelType[]): ModelResult[] => {
  return models.map((modelType, index) => ({
    id: String(index + 1),
    modelType,
    status: 'completed' as const,
    metrics: {
      accuracy: 0.85 + Math.random() * 0.1,
      precision: 0.82 + Math.random() * 0.12,
      recall: 0.80 + Math.random() * 0.15,
      f1: 0.81 + Math.random() * 0.13,
      roc_auc: 0.88 + Math.random() * 0.08,
      mse: 0,
      rmse: 0,
      mae: 0,
      r2: 0,
    },
    trainScore: 0.90 + Math.random() * 0.08,
    testScore: 0.85 + Math.random() * 0.1,
    featureImportance: [
      { feature: 'age', importance: 0.18 + Math.random() * 0.1 },
      { feature: 'thalach', importance: 0.15 + Math.random() * 0.1 },
      { feature: 'cp', importance: 0.14 + Math.random() * 0.1 },
      { feature: 'oldpeak', importance: 0.12 + Math.random() * 0.1 },
      { feature: 'ca', importance: 0.10 + Math.random() * 0.08 },
      { feature: 'chol', importance: 0.09 + Math.random() * 0.08 },
      { feature: 'trestbps', importance: 0.08 + Math.random() * 0.06 },
      { feature: 'sex', importance: 0.07 + Math.random() * 0.05 },
    ].sort((a, b) => b.importance - a.importance),
    confusionMatrix: [
      [Math.floor(120 + Math.random() * 20), Math.floor(10 + Math.random() * 10)],
      [Math.floor(8 + Math.random() * 8), Math.floor(115 + Math.random() * 20)],
    ],
    trainingTime: 2 + Math.random() * 5,
  }));
};

let mockSessions: TrainingSession[] = [];

export const trainingService = {
  async startTraining(projectId: string, config: TrainingConfig): Promise<TrainingSession> {
    await delay(MOCK_DELAY * 3);
    
    const session: TrainingSession = {
      id: String(mockSessions.length + 1),
      projectId,
      config,
      results: generateMockResults(config.models),
      createdAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    };
    
    mockSessions.push(session);
    return session;
  },

  async getSession(sessionId: string): Promise<TrainingSession> {
    await delay(MOCK_DELAY);
    const session = mockSessions.find(s => s.id === sessionId);
    if (!session) {
      throw new Error('Session non trouvée');
    }
    return session;
  },

  async getSessions(projectId: string): Promise<TrainingSession[]> {
    await delay(MOCK_DELAY);
    return mockSessions.filter(s => s.projectId === projectId);
  },

  async saveModel(sessionId: string, modelId: string): Promise<{ success: boolean; message: string }> {
    await delay(MOCK_DELAY);
    return {
      success: true,
      message: 'Modèle enregistré avec succès',
    };
  },

  async downloadResults(sessionId: string): Promise<Blob> {
    await delay(MOCK_DELAY);
    const session = mockSessions.find(s => s.id === sessionId);
    const content = JSON.stringify(session, null, 2);
    return new Blob([content], { type: 'application/json' });
  },
};

export default trainingService;
