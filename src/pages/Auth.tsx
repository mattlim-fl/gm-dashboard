import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

export default function Auth() {
  const { user, signIn, signUp, loading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const mode = searchParams.get('mode');
  const inviteEmailParam = searchParams.get('email') ?? '';
  const isInviteMode = mode === 'invite';

  // Redirect if already authenticated
  useEffect(() => {
    if (user && !loading) {
      navigate('/dashboard');
    }
  }, [user, loading, navigate]);

  const handleSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    const { error } = await signIn(email, password);

    if (error) {
      toast({
        title: 'Login Failed',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Welcome back!',
        description: 'You have successfully logged in.',
      });
    }

    setIsLoading(false);
  };

  const handleSignUp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const email = (formData.get('email') as string).toLowerCase();
    const password = formData.get('password') as string;
    const firstName = formData.get('firstName') as string;
    const lastName = formData.get('lastName') as string;

    // Enforce invite-only signup
    const { data: invite, error: inviteError } = await supabase
      .from('allowed_emails')
      .select('email')
      .eq('email', email)
      .maybeSingle();

    if (inviteError) {
      toast({
        title: 'Signup Failed',
        description: 'There was a problem checking your invite. Please try again or contact an administrator.',
        variant: 'destructive',
      });
      setIsLoading(false);
      return;
    }

    if (!invite) {
      toast({
        title: 'Invite required',
        description: 'You must be invited by an administrator before you can create an account.',
        variant: 'destructive',
      });
      setIsLoading(false);
      return;
    }

    const { error } = await signUp(email, password, firstName, lastName);

    if (error) {
      toast({
        title: 'Signup Failed',
        description: error.message,
        variant: 'destructive',
      });
      setIsLoading(false);
      return;
    }

    // Auto-login after successful signup (invited users have verified email ownership)
    const { error: signInError } = await signIn(email, password);
    if (signInError) {
      toast({
        title: 'Account Created',
        description: 'Your account was created. Please log in with your new password.',
      });
      // Redirect to login
      navigate('/auth');
    } else {
      toast({
        title: 'Welcome!',
        description: 'Your account has been created and you are now logged in.',
      });
      // Navigation will happen automatically via the useEffect watching user state
    }

    setIsLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 bg-gm-primary-500 rounded-lg flex items-center justify-center mx-auto mb-4">
            <span className="text-white font-bold text-sm">GM</span>
          </div>
          <p className="text-gm-neutral-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-background">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <div className="w-12 h-12 bg-gm-primary-500 rounded-lg flex items-center justify-center mx-auto mb-4">
            <span className="text-white font-bold text-lg">GM</span>
          </div>
          <h2 className="text-3xl font-bold text-gm-neutral-900 dark:text-gm-neutral-100">GM Staff Portal</h2>
          <p className="text-gm-neutral-600 dark:text-gm-neutral-400 mt-2">Access your management dashboard</p>
        </div>

        {isInviteMode ? (
          /* Create Account Form - only accessible via invite link */
          <Card>
            <CardHeader>
              <CardTitle>Create Account</CardTitle>
              <CardDescription>
                Create your GM Staff Portal account using the email address your admin invited.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-4 text-sm text-gm-neutral-600 dark:text-gm-neutral-400">
                You&apos;ll only be able to create an account if your email has been added by an administrator.
              </div>
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-firstName">First Name</Label>
                    <Input
                      id="signup-firstName"
                      name="firstName"
                      type="text"
                      required
                      placeholder="John"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-lastName">Last Name</Label>
                    <Input
                      id="signup-lastName"
                      name="lastName"
                      type="text"
                      required
                      placeholder="Doe"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input
                    id="signup-email"
                    name="email"
                    type="email"
                    required
                    placeholder="your.email@example.com"
                    defaultValue={inviteEmailParam}
                    readOnly={Boolean(inviteEmailParam)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Password</Label>
                  <Input
                    id="signup-password"
                    name="password"
                    type="password"
                    required
                    placeholder="Create a password"
                    minLength={6}
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full bg-gm-primary-500 hover:bg-gm-primary-600"
                  disabled={isLoading}
                >
                  {isLoading ? 'Creating account...' : 'Create Account'}
                </Button>
              </form>
              <div className="mt-4 text-center text-sm text-gm-neutral-600 dark:text-gm-neutral-400">
                Already have an account?{' '}
                <Link to="/auth" className="text-gm-primary-500 hover:underline">
                  Log in
                </Link>
              </div>
            </CardContent>
          </Card>
        ) : (
          /* Login Form - default view */
          <Card>
            <CardHeader>
              <CardTitle>Login</CardTitle>
              <CardDescription>Enter your credentials to access the portal</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email">Email</Label>
                  <Input
                    id="login-email"
                    name="email"
                    type="email"
                    required
                    placeholder="your.email@example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password">Password</Label>
                  <Input
                    id="login-password"
                    name="password"
                    type="password"
                    required
                    placeholder="Enter your password"
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full bg-gm-primary-500 hover:bg-gm-primary-600"
                  disabled={isLoading}
                >
                  {isLoading ? 'Signing in...' : 'Sign In'}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
