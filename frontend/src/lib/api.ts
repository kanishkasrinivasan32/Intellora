export async function api<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api${path}`, { ...options, headers: { ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }), ...options.headers } });
  if (!response.ok) {
    if(response.status === 401 && path !== '/auth/login') window.dispatchEvent(new Event('intellora-session-expired'));
    const error = await response.json().catch(() => ({ detail: 'The server could not complete this request.' }));
    throw new Error(typeof error.detail === 'string' ? error.detail : 'Please check the fields and try again.');
  }
  return response.json();
}
export const post = <T = any>(path: string, body?: unknown) => api<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) });
export type Course = { id: string; title: string; topic: string; description: string; color: string; difficulty: string; lesson_count: number; completed_lessons: number; progress: number; lessons: Lesson[] };
export type CourseJob = { id: string; topic: string; level: string; status: 'queued'|'researching'|'building_hierarchy'|'writing_lessons'|'auditing'|'done'|'failed'; progress_current: number; progress_total: number; log: { message: string }[]; course_id?: string; error?: string };
export type Lesson = { id: string; title: string; content: string; position: number; completed: boolean; source_chunk_ids: string[] };
export type Card = { id: string; course_id?: string; topic: string; question: string; answer: string; subtopic: string; explanation: string; key_points: string[]; worked_example: string; reference_links: {title:string;url:string}[]; next_review: string; mastery_score: number };
export type Resource = { id: string; title: string; topic: string; file_type: string; status: string; chunks: number; error?: string; created_at: string; content?: string };
export type Topic = { id: string; name: string; hierarchy: { name: string; prerequisites: string[] }[] };
export type Quiz = { id: string; title: string; topic: string; submitted: boolean; score: number; answers?: Record<string,number>; questions: { id: string; question: string; options: string[]; correct_index?: number; explanation?: string }[] };
