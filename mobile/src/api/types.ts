export type ApiListResponse<T> = {
  docs: T[];
  totalDocs: number;
  limit: number;
  totalPages: number;
  page: number;
  pagingCounter: number;
  hasPrevPage: boolean;
  hasNextPage: boolean;
  prevPage: number | null;
  nextPage: number | null;
};

export type Media = {
  id: string | number;
  url: string;
  filename?: string;
  sizes?: Record<string, { url: string; width: number; height: number }>;
};

export type Slide = {
  id: string | number;
  title: string;
  description?: string;
  type: 'regular' | 'video' | 'quiz' | string;
  image?: Media | null;
  urls?: string[];
};

export type Module = {
  id: string | number;
  title: string;
  description?: string;
  slides?: Slide[];
  moduleThumbnail?: Media | null;
  slidesColor?: string | null;
  estimatedMinutes?: number | null;
};

export type Course = {
  id: string | number;
  title: string;
  description?: string;
  modules?: Module[];
  thumbnail?: Media | null;
  updatedAt?: string;
};

export type AppCourse = {
  id: string | number;
  title: string;
  description?: string;
  thumbnailUrl?: string;
};

export type AppModule = {
  id: string | number;
  title: string;
  description?: string;
  estimatedMinutes?: number;
};

export type AppSlide = {
  id: string | number;
  title: string;
  description?: string;
  type: string;
  imageUrl?: string;
  urls?: string[];
};


