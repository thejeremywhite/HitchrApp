import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, CheckCircle2, Loader2, TestTube2, Trash2, Users, MapPin } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function AdminTestTools() {
  const queryClient = useQueryClient();
  const [numUsers, setNumUsers] = useState('5');
  const [numPosts, setNumPosts] = useState('10');
  const [status, setStatus] = useState(null);

  const seedUsersMutation = useMutation({
    mutationFn: async (count) => {
      const response = await base44.functions.invoke('generateTestData', { 
        type: 'users',
        count: parseInt(count)
      });
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-metrics'] });
      setStatus({ type: 'success', message: `Created ${data.count} test users` });
      setTimeout(() => setStatus(null), 5000);
    },
    onError: (error) => {
      setStatus({ type: 'error', message: error.message || 'Failed to seed users' });
      setTimeout(() => setStatus(null), 5000);
    }
  });

  const generatePostsMutation = useMutation({
    mutationFn: async (count) => {
      const response = await base44.functions.invoke('generateTestData', {
        type: 'posts',
        count: parseInt(count)
      });
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['home-data'] });
      queryClient.invalidateQueries({ queryKey: ['admin-metrics'] });
      setStatus({ type: 'success', message: `Created ${data.count} test posts` });
      setTimeout(() => setStatus(null), 5000);
    },
    onError: (error) => {
      setStatus({ type: 'error', message: error.message || 'Failed to generate posts' });
      setTimeout(() => setStatus(null), 5000);
    }
  });

  const clearTestDataMutation = useMutation({
    mutationFn: async () => {
      const response = await base44.functions.invoke('clearTestData', {});
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries();
      setStatus({ type: 'success', message: `Cleared ${data.deleted} test records` });
      setTimeout(() => setStatus(null), 5000);
    },
    onError: (error) => {
      setStatus({ type: 'error', message: error.message || 'Failed to clear test data' });
      setTimeout(() => setStatus(null), 5000);
    }
  });

  return (
    <div className="space-y-6">
      {status && (
        <div className={`flex items-center gap-2 p-4 rounded-lg ${
          status.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
        }`}>
          {status.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5" />
          ) : (
            <AlertCircle className="w-5 h-5" />
          )}
          <p className="text-sm font-medium">{status.message}</p>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Seed Test Users
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Number of Users</Label>
            <Input
              type="number"
              min="1"
              max="50"
              value={numUsers}
              onChange={(e) => setNumUsers(e.target.value)}
              className="max-w-[200px]"
            />
            <p className="text-xs text-gray-500 mt-1">
              Creates mock users with varied roles, modes, and profiles
            </p>
          </div>
          <Button
            onClick={() => seedUsersMutation.mutate(numUsers)}
            disabled={seedUsersMutation.isPending}
            className="w-full sm:w-auto"
          >
            {seedUsersMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Creating Users...
              </>
            ) : (
              <>
                <TestTube2 className="w-4 h-4 mr-2" />
                Seed Test Users
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5" />
            Generate Sample Posts
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Number of Posts</Label>
            <Input
              type="number"
              min="1"
              max="100"
              value={numPosts}
              onChange={(e) => setNumPosts(e.target.value)}
              className="max-w-[200px]"
            />
            <p className="text-xs text-gray-500 mt-1">
              Creates sample standard posts and Hot Shot posts for test drivers
            </p>
          </div>
          <Button
            onClick={() => generatePostsMutation.mutate(numPosts)}
            disabled={generatePostsMutation.isPending}
            className="w-full sm:w-auto"
          >
            {generatePostsMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generating Posts...
              </>
            ) : (
              <>
                <MapPin className="w-4 h-4 mr-2" />
                Generate Sample Posts
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <Card className="border-red-200 bg-red-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-800">
            <Trash2 className="w-5 h-5" />
            Clear Test Data
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-red-700">
            This will permanently delete all records marked as test data, including users, posts, messages, and related entities.
            This action cannot be undone.
          </p>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="destructive"
                disabled={clearTestDataMutation.isPending}
                className="w-full sm:w-auto"
              >
                {clearTestDataMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Clearing...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4 mr-2" />
                    Clear Test Data
                  </>
                )}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete all test data from the database.
                  This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => clearTestDataMutation.mutate()}
                  className="bg-red-600 hover:bg-red-700"
                >
                  Yes, Clear All Test Data
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  );
}