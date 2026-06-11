import Taro from '@tarojs/taro';
import { accessToken } from '../store/auth';
import { apiBaseUrl, http } from './http';

export type SubmissionCategory = 'DRAMA' | 'VIDEO' | 'SCIFI_PAINT' | 'CREATIVE_APP';

export type ReviewTaskType = 'FORMAT' | 'ANONYMITY' | 'CONTENT' | string;
export type ReviewTaskStatus = 'PASS' | 'FAIL' | 'NEED_MANUAL' | 'PENDING' | string;

export type ReviewFinding = {
  code?: string;
  message?: string;
  field?: string;
  detail?: any;
  [k: string]: any;
};

export type ReviewTask = {
  id: string;
  createdAt: string;
  updatedAt: string;
  caseId: string;
  type: ReviewTaskType;
  status: ReviewTaskStatus;
  findings: ReviewFinding[] | any;
};

export type ReviewCase = {
  id: string;
  createdAt: string;
  updatedAt: string;
  submissionId: string;
  summary: ReviewTaskStatus | string;
  tasks: ReviewTask[];
};

export type SubmissionMember = {
  id: string;
  createdAt: string;
  userId: string;
  role: string;
};

export type CreateSubmissionInput = {
  category: SubmissionCategory;
  title: string;
  intro?: string;
  aiToolsUsage?: string;
  teacherName?: string;
  teacherContact?: string;
};

export type Submission = {
  id: string;
  category: SubmissionCategory;
  status: string;
  title: string;
  intro: string | null;
  aiToolsUsage?: string | null;
  teacherName?: string | null;
  teacherContact?: string | null;
  attachments?: Array<{
    id: string;
    createdAt: string;
    kind: string;
    originalName: string;
    mimeType: string | null;
    byteSize: number;
    meta?: any;
  }>;
  members?: SubmissionMember[];
  reviewCases?: ReviewCase[];
};

export function createSubmissionDraft(input: CreateSubmissionInput) {
  return http<Submission>('/submissions', { method: 'POST', data: input });
}

export type UpdateSubmissionInput = Partial<CreateSubmissionInput>;

export function updateSubmissionDraft(id: string, input: UpdateSubmissionInput) {
  return http<Submission>(`/submissions/${id}`, { method: 'PUT', data: input });
}

export function getSubmission(id: string) {
  return http<Submission>(`/submissions/${id}`, { method: 'GET' });
}

export function submitSubmission(id: string) {
  return http(`/submissions/${id}/submit`, { method: 'POST' });
}

export async function uploadAttachment(params: {
  submissionId: string;
  kind: string;
  filePath: string;
  name?: string;
  formData?: Record<string, string>;
}) {
  const token = accessToken();
  const res = await Taro.uploadFile({
    url: `${apiBaseUrl()}/submissions/${params.submissionId}/attachments/${params.kind}`,
    filePath: params.filePath,
    name: params.name ?? 'file',
    formData: params.formData ?? {},
    header: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (res.statusCode >= 200 && res.statusCode < 300) {
    return JSON.parse(res.data as unknown as string);
  }
  throw new Error(res.data as unknown as string);
}
