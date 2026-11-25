import { apiClient } from '@/services/api-client';

export type IpaReferenceResult = {
  status: 'REFERENCE' | 'UNASSESSABLE';
  score: number | null;
  reliable?: boolean;
  reasons?: string[];
  heardText?: string | null;
  label?: string | null;
  differences?: { errors?: { word?: string; phones?: { expected?: string; heard?: string; confidence?: number }[] }[] };
};

export const ipaReferenceRepository = {
  assess: (token: string, uri: string, targetText: string) => {
    const form = new FormData();
    form.append('targetText', targetText);
    form.append('audio', { uri, name: 'ipa-recording.m4a', type: 'audio/mp4' } as unknown as Blob);
    return apiClient.upload<IpaReferenceResult>('/api/v1/ipa/reference', form, token);
  },
};
