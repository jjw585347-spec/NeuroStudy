export interface MessageAttachment {
  name: string;
  type: "image" | "file";
  url?: string;
  base64?: string;
  mimeType?: string;
  content?: string;
}

export interface TutorMessage {
  id: string;
  role: "user" | "assistant";
  questionText?: string;
  attachment?: MessageAttachment;
  explanation?: string;
  visualPrompt?: string;
  visualEntity?: {
    isPhysicalEntity?: boolean;
    canonicalEn?: string;
    canonicalFa?: string;
    category?: string;
  };
  imageUrl?: string;
  imageSource?: "web_encyclopedia" | "ai_generated";
  imageTitle?: string;
  isVerified?: boolean;
  diagramCode?: string;
  audioUrl?: string;
  audioBlob?: Blob;
  ttsSummary?: string;
  subject?: string;
  isOffTopic?: boolean;
  detectedSubject?: string;
  suggestedSubjectName?: string;
  followUpQuestions?: string[];
  createdAt: string;
  isLoading?: boolean;
  loadingStep?: "thinking" | "writing" | "illustrating" | "speaking" | "done";
}

export interface TutorSession {
  id: string;
  title: string;
  messages: TutorMessage[];
  createdAt: string;
  updatedAt: string;
}
