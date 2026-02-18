import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import {
  Loader2,
  FileText,
  Plus,
  Pencil,
  Trash2,
  Save,
  X,
  Globe,
  Tag,
} from 'lucide-react';

interface KnowledgeFile {
  id: string;
  venue: string;
  category_key: string | null;
  title: string;
  slug: string;
  content: string;
  is_global: boolean;
  created_at: string;
  updated_at: string;
}

interface EmailCategory {
  category_key: string;
  display_name: string;
}

interface KnowledgeFileEditorProps {
  venue: string;
}

export function KnowledgeFileEditor({ venue }: KnowledgeFileEditorProps) {
  const [files, setFiles] = useState<KnowledgeFile[]>([]);
  const [categories, setCategories] = useState<EmailCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Editor state
  const [editingFile, setEditingFile] = useState<KnowledgeFile | null>(null);
  const [isNewFile, setIsNewFile] = useState(false);
  const [showEditor, setShowEditor] = useState(false);

  // Form state
  const [formTitle, setFormTitle] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formCategory, setFormCategory] = useState<string>('global');
  const [formIsGlobal, setFormIsGlobal] = useState(true);

  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, [venue]);

  async function fetchData() {
    try {
      setLoading(true);

      const [filesRes, catsRes] = await Promise.all([
        supabase
          .from('knowledge_files')
          .select('*')
          .eq('venue', venue)
          .order('is_global', { ascending: false })
          .order('title'),
        supabase.from('email_categories').select('category_key, display_name'),
      ]);

      if (filesRes.error) throw filesRes.error;
      if (catsRes.error) throw catsRes.error;

      setFiles(filesRes.data || []);
      setCategories(catsRes.data || []);
    } catch (error) {
      console.error('Error fetching knowledge files:', error);
      toast({
        title: 'Error',
        description: 'Failed to load knowledge files',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  function openNewFile() {
    setEditingFile(null);
    setIsNewFile(true);
    setFormTitle('');
    setFormContent('');
    setFormCategory('global');
    setFormIsGlobal(true);
    setShowEditor(true);
  }

  function openEditFile(file: KnowledgeFile) {
    setEditingFile(file);
    setIsNewFile(false);
    setFormTitle(file.title);
    setFormContent(file.content);
    setFormCategory(file.is_global ? 'global' : (file.category_key || 'global'));
    setFormIsGlobal(file.is_global);
    setShowEditor(true);
  }

  function handleCategoryChange(value: string) {
    setFormCategory(value);
    setFormIsGlobal(value === 'global');
  }

  function generateSlug(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  async function saveFile() {
    if (!formTitle.trim()) {
      toast({
        title: 'Title Required',
        description: 'Please enter a title for the knowledge file',
        variant: 'destructive',
      });
      return;
    }

    if (!formContent.trim()) {
      toast({
        title: 'Content Required',
        description: 'Please enter content for the knowledge file',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSaving(true);

      const fileData = {
        venue,
        title: formTitle.trim(),
        slug: editingFile?.slug || generateSlug(formTitle),
        content: formContent,
        is_global: formIsGlobal,
        category_key: formIsGlobal ? null : formCategory,
      };

      if (isNewFile) {
        const { error } = await supabase.from('knowledge_files').insert(fileData);
        if (error) throw error;
        toast({ title: 'Success', description: 'Knowledge file created' });
      } else if (editingFile) {
        const { error } = await supabase
          .from('knowledge_files')
          .update(fileData)
          .eq('id', editingFile.id);
        if (error) throw error;
        toast({ title: 'Success', description: 'Knowledge file updated' });
      }

      setShowEditor(false);
      fetchData();
    } catch (error: unknown) {
      console.error('Error saving knowledge file:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast({
        title: 'Error',
        description: `Failed to save: ${errorMessage}`,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  }

  async function deleteFile(file: KnowledgeFile) {
    if (!confirm(`Delete "${file.title}"? This cannot be undone.`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('knowledge_files')
        .delete()
        .eq('id', file.id);

      if (error) throw error;

      toast({ title: 'Deleted', description: 'Knowledge file removed' });
      fetchData();
    } catch (error) {
      console.error('Error deleting knowledge file:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete file',
        variant: 'destructive',
      });
    }
  }

  function getCategoryName(categoryKey: string | null): string {
    if (!categoryKey) return 'All Categories';
    const cat = categories.find((c) => c.category_key === categoryKey);
    return cat?.display_name || categoryKey;
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-gm-primary-500" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      {/* Editor Dialog */}
      <Dialog open={showEditor} onOpenChange={setShowEditor}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {isNewFile ? 'Create Knowledge File' : 'Edit Knowledge File'}
            </DialogTitle>
            <DialogDescription>
              Knowledge files provide context to the AI when drafting email replies.
              Use Markdown for formatting.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="e.g., Venue Information"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">Applies To</Label>
                <Select value={formCategory} onValueChange={handleCategoryChange}>
                  <SelectTrigger id="category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="global">
                      <div className="flex items-center gap-2">
                        <Globe className="h-4 w-4" />
                        All Categories (Global)
                      </div>
                    </SelectItem>
                    {categories.map((cat) => (
                      <SelectItem key={cat.category_key} value={cat.category_key}>
                        <div className="flex items-center gap-2">
                          <Tag className="h-4 w-4" />
                          {cat.display_name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="content">Content (Markdown)</Label>
              <Textarea
                id="content"
                value={formContent}
                onChange={(e) => setFormContent(e.target.value)}
                placeholder="# Heading&#10;&#10;Write your knowledge content here using Markdown..."
                className="min-h-[300px] font-mono text-sm"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditor(false)}>
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button onClick={saveFile} disabled={saving}>
              {saving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              {isNewFile ? 'Create' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Main Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Knowledge Base</CardTitle>
              <CardDescription>
                Content the AI uses to draft accurate, on-brand email replies
              </CardDescription>
            </div>
            <Button onClick={openNewFile}>
              <Plus className="h-4 w-4 mr-2" />
              Add File
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {files.length === 0 ? (
            <div className="text-center py-8 text-gm-neutral-500">
              <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No knowledge files yet</p>
              <p className="text-sm mt-1">
                Add files to help the AI understand your venue and policies
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {files.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-gm-neutral-50 group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <FileText className="h-5 w-5 text-gm-neutral-400 flex-shrink-0" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium truncate">{file.title}</p>
                        {file.is_global ? (
                          <Badge variant="outline" className="flex-shrink-0">
                            <Globe className="h-3 w-3 mr-1" />
                            Global
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="flex-shrink-0">
                            <Tag className="h-3 w-3 mr-1" />
                            {getCategoryName(file.category_key)}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-gm-neutral-500">
                        Updated{' '}
                        {new Date(file.updated_at).toLocaleDateString('en-AU', {
                          dateStyle: 'medium',
                        })}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEditFile(file)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteFile(file)}
                      className="text-red-500 hover:text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
