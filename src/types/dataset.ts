export interface DatasetColumn {
  name: string;
  type: 'numeric' | 'categorical' | 'datetime' | 'text';
  nullCount: number;
  uniqueCount: number;
  sampleValues: (string | number)[];
}

export interface Dataset {
  id: string;
  projectId: string;
  name: string;
  fileName: string;
  fileSize: number;
  rowCount: number;
  columnCount: number;
  columns: DatasetColumn[];
  uploadedAt: string;
  data: Record<string, unknown>[];
}

export interface DataVersion {
  id: string;
  projectId: string;
  name: string;
  createdAt: string;
  operations: string[];
  canPredict: boolean;
}
