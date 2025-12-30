import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';

export default function AccessDenied() {
  const { signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-background">
      <div className="w-full max-w-md space-y-6 text-center">
        <div className="w-12 h-12 bg-red-500 rounded-lg flex items-center justify-center mx-auto">
          <span className="text-white font-bold text-lg">!</span>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gm-neutral-900 dark:text-gm-neutral-100">
            Access Denied
          </h1>
          <p className="mt-2 text-gm-neutral-600 dark:text-gm-neutral-400">
            You don&apos;t currently have access to the GM Dashboard.
            Please contact an administrator if you believe this is a mistake.
          </p>
        </div>
        <Button
          onClick={handleSignOut}
          className="w-full bg-gm-primary-500 hover:bg-gm-primary-600"
          variant="default"
        >
          Return to login
        </Button>
      </div>
    </div>
  );
}


















