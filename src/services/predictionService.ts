import { PredictionInput, PredictionSession, PredictionResult } from '@/types';

const MOCK_DELAY = 700;
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

let mockPredictionSessions: PredictionSession[] = [];

export const predictionService = {
  async predict(projectId: string, modelId: string, input: PredictionInput): Promise<PredictionSession> {
    await delay(MOCK_DELAY * 2);
    
    const results: PredictionResult[] = [];
    const dataArray = Array.isArray(input.data) ? input.data : [{ file: 'uploaded' }];
    
    for (let i = 0; i < Math.min(dataArray.length, 10); i++) {
      results.push({
        id: String(i + 1),
        sessionId: String(mockPredictionSessions.length + 1),
        prediction: Math.random() > 0.5 ? 'Positif' : 'Négatif',
        confidence: 0.75 + Math.random() * 0.2,
        inputData: dataArray[i] as Record<string, unknown>,
      });
    }
    
    const session: PredictionSession = {
      id: String(mockPredictionSessions.length + 1),
      projectId,
      modelId,
      results,
      accuracy: 0.88 + Math.random() * 0.08,
      createdAt: new Date().toISOString(),
    };
    
    mockPredictionSessions.push(session);
    return session;
  },

  async getSession(sessionId: string): Promise<PredictionSession> {
    await delay(MOCK_DELAY);
    const session = mockPredictionSessions.find(s => s.id === sessionId);
    if (!session) {
      throw new Error('Session non trouvée');
    }
    return session;
  },

  async getSessions(projectId: string): Promise<PredictionSession[]> {
    await delay(MOCK_DELAY);
    return mockPredictionSessions.filter(s => s.projectId === projectId);
  },

  async exportResults(sessionId: string): Promise<Blob> {
    await delay(MOCK_DELAY);
    const session = mockPredictionSessions.find(s => s.id === sessionId);
    const content = JSON.stringify(session, null, 2);
    return new Blob([content], { type: 'application/json' });
  },
};

export default predictionService;
