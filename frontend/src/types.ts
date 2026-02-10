export interface Question {
  id: number;
  text: string;
  module_id: number;
  answer: string | null;
}

export type ReviewStatus = 'answered' | 'need-improvement' | 'wrong' | 'skip';

export interface ScheduledReview {
  id: string;
  studentName: string;
  module: string;
  batch: string;
  status: 'pending' | 'ongoing' | 'completed';
  date: string;
}

export interface QuestionResult {
  questionId: number;
  status: ReviewStatus;
  score: number;
}

export interface ReviewSession {
  reviewId: string;
  results: QuestionResult[];
  practicalMark: number;
  practicalLink: string;
  startTime: number;
  notes: string;
}
