import { Separator } from '@/components/ui/separator';
import { Users, Mail, Phone } from 'lucide-react';
import type { OccasionWithStats } from '@/services/occasionService';

interface OrganiserDetailsProps {
  occasion: OccasionWithStats;
}

export function OrganiserDetails({ occasion }: OrganiserDetailsProps) {
  if (!occasion.organiser_name && !occasion.organiser_email && !occasion.organiser_phone) {
    return null;
  }

  return (
    <>
      <Separator />
      <div>
        <h3 className="font-semibold mb-3 dark:text-white">Organiser</h3>
        <div className="space-y-2 text-sm">
          {occasion.organiser_name && (
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-gray-400 dark:text-gray-500" />
              <span className="dark:text-gray-200">{occasion.organiser_name}</span>
            </div>
          )}
          {occasion.organiser_email && (
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-gray-400 dark:text-gray-500" />
              <a
                href={`mailto:${occasion.organiser_email}`}
                className="text-blue-600 dark:text-blue-400 hover:underline"
              >
                {occasion.organiser_email}
              </a>
            </div>
          )}
          {occasion.organiser_phone && (
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-gray-400 dark:text-gray-500" />
              <a
                href={`tel:${occasion.organiser_phone}`}
                className="text-blue-600 dark:text-blue-400 hover:underline"
              >
                {occasion.organiser_phone}
              </a>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
