import { useCallback, useState } from 'react';
import { Upload, File, X, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './button';

interface FileUploadProps {
  accept?: string;
  maxSize?: number; // in MB
  onUpload: (file: File) => void;
  className?: string;
  label?: string;
  description?: string;
}

export function FileUpload({ 
  accept = ".csv,.xlsx,.xls", 
  maxSize = 50,
  onUpload, 
  className,
  label = "Glissez votre fichier ici",
  description = "ou cliquez pour parcourir"
}: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const validateFile = (file: File): boolean => {
    setError(null);
    
    if (file.size > maxSize * 1024 * 1024) {
      setError(`Le fichier dépasse la taille maximale de ${maxSize}MB`);
      return false;
    }
    
    return true;
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && validateFile(droppedFile)) {
      setFile(droppedFile);
      onUpload(droppedFile);
    }
  }, [onUpload, maxSize]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && validateFile(selectedFile)) {
      setFile(selectedFile);
      onUpload(selectedFile);
    }
  };

  const clearFile = () => {
    setFile(null);
    setError(null);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (file) {
    return (
      <div className={cn(
        "border-2 border-success/30 bg-success/5 rounded-xl p-6",
        className
      )}>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-success/10 flex items-center justify-center">
            <CheckCircle className="h-6 w-6 text-success" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-foreground truncate">{file.name}</p>
            <p className="text-sm text-muted-foreground">{formatFileSize(file.size)}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={clearFile}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        "border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer",
        isDragging 
          ? "border-primary bg-primary/5" 
          : "border-border hover:border-primary/50 hover:bg-muted/50",
        error && "border-destructive bg-destructive/5",
        className
      )}
    >
      <input
        type="file"
        accept={accept}
        onChange={handleFileSelect}
        className="hidden"
        id="file-upload"
      />
      <label htmlFor="file-upload" className="cursor-pointer">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <Upload className="h-8 w-8 text-primary" />
        </div>
        <p className="font-medium text-foreground mb-1">{label}</p>
        <p className="text-sm text-muted-foreground mb-2">{description}</p>
        <p className="text-xs text-muted-foreground">
          Formats: CSV, Excel • Max: {maxSize}MB
        </p>
        {error && (
          <p className="text-sm text-destructive mt-2">{error}</p>
        )}
      </label>
    </div>
  );
}

export default FileUpload;
