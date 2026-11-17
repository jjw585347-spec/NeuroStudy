export interface QuestionOption {
  number: number;
  text: string;
  isCorrect: boolean;
  explanation?: string;
}

export interface QuestionSolution {
  id?: string;
  questionText: string;
  isMultipleChoice: boolean;
  options?: QuestionOption[];
  correctOptionNumber: number; // 1, 2, 3, 4 (0 if not multiple choice)
  correctOptionSummary: string; // e.g. "گزینه ۳ صحیح است"
  stepByStepSolution: string;
  keyExamTip?: string; // نکته تستی / دام آموزشی
  subject?: string;
  imageUrl?: string;
  ttsSummary?: string;
  audioUrl?: string;
  createdAt?: string;
}
