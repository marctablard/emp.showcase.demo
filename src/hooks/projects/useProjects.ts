'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Project, ProjectCreateDto } from '@/platform/services/model/project/project';

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/projects');
      if (!response.ok) throw new Error(`Failed to fetch projects: ${response.statusText}`);
      const data = await response.json();
      setProjects(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const createProject = useCallback(async (data: ProjectCreateDto): Promise<Project> => {
    const response = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error(`Failed to create project: ${response.statusText}`);
    const project = await response.json();
    setProjects((prev) => [project, ...prev]);
    return project;
  }, []);

  const deleteProject = useCallback(async (projectId: string): Promise<void> => {
    const response = await fetch(`/api/projects/${projectId}`, { method: 'DELETE' });
    if (!response.ok) throw new Error(`Failed to delete project: ${response.statusText}`);
    setProjects((prev) => prev.filter((p) => p.id !== projectId));
  }, []);

  return { projects, loading, error, fetchProjects, createProject, deleteProject };
}
