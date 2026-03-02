import { Separator } from '@/components/ui/separator';

interface OccasionNotesProps {
  notes: string | null;
}

export function OccasionNotes({ notes }: OccasionNotesProps) {
  if (!notes) {
    return null;
  }

  return (
    <>
      <Separator />
      <div>
        <h3 className="font-semibold mb-2 dark:text-white">Notes</h3>
        <p className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap">{notes}</p>
      </div>
    </>
  );
}
