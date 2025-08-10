import { AppCourse, AppModule, AppSlide, ApiListResponse, Course, Module, Slide } from './types';

const BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:3001';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) {
    const message = await res.text().catch(() => res.statusText);
    throw new Error(`HTTP ${res.status}: ${message}`);
  }
  return (await res.json()) as T;
}

function mediaToUrl(media?: { url?: string; sizes?: Record<string, { url: string }> } | null): string | undefined {
  if (!media) return undefined;
  const sizes = media.sizes || {};
  return sizes['card']?.url || sizes['thumbnail']?.url || media.url;
}

function mapCourse(c: Course): AppCourse {
  return {
    id: c.id,
    title: c.title,
    description: c.description,
    thumbnailUrl: mediaToUrl((c as any).thumbnail),
  };
}

function mapModule(m: Module): AppModule {
  return {
    id: m.id,
    title: m.title,
    description: m.description,
    estimatedMinutes: (m as any).estimatedMinutes ?? 4,
  };
}

function mapSlide(s: Slide): AppSlide {
  return {
    id: s.id,
    title: s.title,
    description: s.description,
    type: s.type,
    imageUrl: mediaToUrl(s.image),
    urls: s.urls,
  };
}

export const api = {
  async listCourses(page = 1, limit = 20): Promise<AppCourse[]> {
    const data = await request<ApiListResponse<Course>>(`/api/courses?limit=${limit}&page=${page}&depth=1`);
    return (data.docs || []).map(mapCourse);
  },

  async getCourseModules(courseId: string | number): Promise<AppModule[]> {
    const data = await request<Module[]>(`/api/courses/${courseId}/modules?depth=1`);
    return (data || []).map(mapModule);
  },

  async getModule(moduleId: string | number): Promise<{ module: AppModule; slides: AppSlide[] }> {
    const data = await request<Module>(`/api/modules/${moduleId}?depth=2`);
    const slides = (data.slides || []).map(mapSlide);
    return { module: mapModule(data), slides };
  },
};


