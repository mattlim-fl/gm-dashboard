import { Archive, ArchiveRestore } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ArchiveButtonProps {
  archived: boolean;
  onArchive: () => void;
  onUnarchive: () => void;
  disabled?: boolean;
  variant?: 'default' | 'ghost' | 'secondary';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

export function ArchiveButton({
  archived,
  onArchive,
  onUnarchive,
  disabled = false,
  variant = 'ghost',
  size = 'sm',
}: ArchiveButtonProps) {
  if (archived) {
    return (
      <Button
        variant={variant}
        size={size}
        onClick={onUnarchive}
        disabled={disabled}
        title="Unarchive"
      >
        <ArchiveRestore className="h-4 w-4" />
      </Button>
    );
  }

  return (
    <Button
      variant={variant}
      size={size}
      onClick={onArchive}
      disabled={disabled}
      title="Archive"
    >
      <Archive className="h-4 w-4" />
    </Button>
  );
}
