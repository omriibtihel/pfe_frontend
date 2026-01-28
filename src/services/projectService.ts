// src/services/projectService.ts
import apiClient from "./apiClient";
import { Project, ProjectStats } from "@/types";

/**
 * Adaptation backend -> frontend
 * Backend Project (FastAPI) renvoie typiquement:
 * {
 *   id: number,
 *   name: string,
 *   description: string | null,
 *   owner_id: number,
 *   created_at: string,
 *   updated_at: string
 * }
 */
type BackendProject = {
  id: number;
  name: string;
  description?: string | null;
  owner_id: number;
  created_at?: string;
  updated_at?: string;
};

function mapProject(p: BackendProject): Project {
  return {
    id: String(p.id),
    name: p.name,
    description: p.description ?? "",
    // ton front utilise "userId" => owner_id
    userId: String(p.owner_id),
    // champs du front
    status: "active", // ton backend ne gère pas encore status -> valeur par défaut
    createdAt: p.created_at ?? "",
    updatedAt: p.updated_at ?? "",
    // champs optionnels côté front (peuvent rester undefined)
    datasetName: undefined,
    targetColumn: undefined,
    accuracy: undefined,
  } as Project;
}

/**
 * Helper: stats calculées côté front (en attendant un endpoint backend).
 * Tu peux plus tard remplacer par un vrai endpoint /api/projects/stats.
 */
function computeStats(projects: Project[]): ProjectStats {
  const activeProjects = projects.filter((p) => p.status === "active").length;

  const accuracies = projects
    .map((p) => p.accuracy)
    .filter((x): x is number => typeof x === "number");

  const averageAccuracy =
    accuracies.length > 0
      ? accuracies.reduce((a, b) => a + b, 0) / accuracies.length
      : 0;

  return {
    activeProjects,
    averageAccuracy,
    performanceGrowth: 0, // pas dispo backend pour l’instant
    totalPredictions: 0, // pas dispo backend pour l’instant
  };
}

export const projectService = {
  /**
   * IMPORTANT:
   * Ton backend filtre déjà par current_user => pas besoin de userId.
   * On garde la signature userId pour éviter de casser DashboardPage,
   * mais on l’ignore.
   */
  async getProjects(_userId?: string): Promise<Project[]> {
    const data = await apiClient.get<BackendProject[]>("/projects");
    return data.map(mapProject);
  },

  async getProject(projectId: string): Promise<Project> {
    const data = await apiClient.get<BackendProject>(`/projects/${projectId}`);
    return mapProject(data);
  },

  async createProject(data: {
    name: string;
    description?: string;
    userId?: string; // ignoré: backend utilise current_user
  }): Promise<Project> {
    const payload = {
      name: data.name,
      description: data.description ?? "",
    };

    const created = await apiClient.postJson<BackendProject>("/projects", payload);
    return mapProject(created);
  },

  async updateProject(projectId: string, data: Partial<Project>): Promise<Project> {
    const payload: { name?: string; description?: string } = {};
    if (typeof data.name === "string") payload.name = data.name;
    if (typeof data.description === "string") payload.description = data.description;

    const updated = await apiClient.putJson<BackendProject>(`/projects/${projectId}`, payload);
    return mapProject(updated);
  },

  async deleteProject(projectId: string): Promise<void> {
    await apiClient.delete<void>(`/projects/${projectId}`);
  },

  async getStats(userId?: string): Promise<ProjectStats> {
    const projects = await this.getProjects(userId);
    return computeStats(projects);
  },
};

export default projectService;
