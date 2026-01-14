import { useState, useCallback, useRef } from 'react';
import { Upload, X, Image, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Venue } from '@/services/photoService';
import { useUploadPhoto } from '@/hooks/usePhotoAlbums';

interface PhotoUploaderProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  albumId: string;
  venue: Venue;
}

interface FileWithPreview {
  file: File;
  preview: string;
  status: 'pending' | 'uploading' | 'success' | 'error';
  error?: string;
}

const ACCEPTED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export function PhotoUploader({ open, onOpenChange, albumId, venue }: PhotoUploaderProps) {
  const [files, setFiles] = useState<FileWithPreview[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadPhoto = useUploadPhoto();

  const validateFile = (file: File): string | null => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      return 'Invalid file type. Please upload JPEG, PNG, WebP, or GIF images.';
    }
    if (file.size > MAX_FILE_SIZE) {
      return 'File too large. Maximum size is 10MB.';
    }
    return null;
  };

  const addFiles = useCallback((newFiles: FileList | File[]) => {
    const fileArray = Array.from(newFiles);
    const validFiles: FileWithPreview[] = [];

    for (const file of fileArray) {
      const error = validateFile(file);
      if (error) {
        validFiles.push({
          file,
          preview: '',
          status: 'error',
          error,
        });
      } else {
        validFiles.push({
          file,
          preview: URL.createObjectURL(file),
          status: 'pending',
        });
      }
    }

    setFiles((prev) => [...prev, ...validFiles]);
  }, []);

  const removeFile = useCallback((index: number) => {
    setFiles((prev) => {
      const newFiles = [...prev];
      // Revoke object URL to prevent memory leaks
      if (newFiles[index]?.preview) {
        URL.revokeObjectURL(newFiles[index].preview);
      }
      newFiles.splice(index, 1);
      return newFiles;
    });
  }, []);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        addFiles(e.dataTransfer.files);
      }
    },
    [addFiles]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        addFiles(e.target.files);
      }
      // Reset input so same file can be selected again
      e.target.value = '';
    },
    [addFiles]
  );

  const uploadAll = async () => {
    const pendingFiles = files.filter((f) => f.status === 'pending');
    if (pendingFiles.length === 0) return;

    setIsUploading(true);

    for (let i = 0; i < files.length; i++) {
      if (files[i].status !== 'pending') continue;

      // Mark as uploading
      setFiles((prev) => {
        const newFiles = [...prev];
        newFiles[i] = { ...newFiles[i], status: 'uploading' };
        return newFiles;
      });

      try {
        await uploadPhoto.mutateAsync({
          albumId,
          file: files[i].file,
          venue,
        });

        // Mark as success
        setFiles((prev) => {
          const newFiles = [...prev];
          newFiles[i] = { ...newFiles[i], status: 'success' };
          return newFiles;
        });
      } catch (error) {
        // Mark as error
        setFiles((prev) => {
          const newFiles = [...prev];
          newFiles[i] = {
            ...newFiles[i],
            status: 'error',
            error: error instanceof Error ? error.message : 'Upload failed',
          };
          return newFiles;
        });
      }
    }

    setIsUploading(false);
  };

  const handleClose = () => {
    // Clean up object URLs
    files.forEach((f) => {
      if (f.preview) URL.revokeObjectURL(f.preview);
    });
    setFiles([]);
    onOpenChange(false);
  };

  const pendingCount = files.filter((f) => f.status === 'pending').length;
  const successCount = files.filter((f) => f.status === 'success').length;
  const errorCount = files.filter((f) => f.status === 'error').length;
  const uploadProgress = files.length > 0 ? ((successCount + errorCount) / files.length) * 100 : 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Upload Photos</DialogTitle>
          <DialogDescription>
            Drag and drop photos or click to select files. Supports JPEG, PNG, WebP, and GIF up to 10MB.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Drop zone */}
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              dragActive
                ? 'border-primary bg-primary/5'
                : 'border-muted-foreground/25 hover:border-primary/50'
            }`}
          >
            <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-4" />
            <p className="text-sm text-muted-foreground">
              {dragActive ? 'Drop photos here' : 'Drag photos here or click to select'}
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_TYPES.join(',')}
              multiple
              onChange={handleFileInput}
              className="hidden"
            />
          </div>

          {/* File list */}
          {files.length > 0 && (
            <>
              {isUploading && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Uploading...</span>
                    <span>
                      {successCount + errorCount} / {files.length}
                    </span>
                  </div>
                  <Progress value={uploadProgress} />
                </div>
              )}

              <ScrollArea className="h-[200px] border rounded-lg">
                <div className="p-2 space-y-2">
                  {files.map((f, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-3 p-2 bg-muted/50 rounded-lg"
                    >
                      {f.preview ? (
                        <img
                          src={f.preview}
                          alt=""
                          className="w-12 h-12 object-cover rounded"
                        />
                      ) : (
                        <div className="w-12 h-12 bg-muted rounded flex items-center justify-center">
                          <Image className="h-6 w-6 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{f.file.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {(f.file.size / 1024).toFixed(0)} KB
                        </p>
                        {f.error && (
                          <p className="text-xs text-destructive">{f.error}</p>
                        )}
                      </div>
                      <div className="flex-shrink-0">
                        {f.status === 'pending' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeFile(index);
                            }}
                            disabled={isUploading}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                        {f.status === 'uploading' && (
                          <Loader2 className="h-5 w-5 animate-spin text-primary" />
                        )}
                        {f.status === 'success' && (
                          <CheckCircle className="h-5 w-5 text-green-500" />
                        )}
                        {f.status === 'error' && (
                          <AlertCircle className="h-5 w-5 text-destructive" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            {successCount > 0 ? 'Done' : 'Cancel'}
          </Button>
          {pendingCount > 0 && (
            <Button onClick={uploadAll} disabled={isUploading}>
              {isUploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload {pendingCount} Photo{pendingCount !== 1 ? 's' : ''}
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

