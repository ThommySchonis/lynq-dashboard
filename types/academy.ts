export interface QuizQuestion {
  q: string
  opts: string[]
  correct: number
}

export interface Section {
  title: string
  mins: number
  body?: string
  takeaways?: string[]
  tips?: string[]
  example?: string
  type?: 'quiz'
}

export interface Module {
  id: string
  examType: string
  num: string
  color: string
  label: string
  description: string
  sections: Section[]
  quiz: QuizQuestion[]
}

export type AcademyView = 'welcome' | 'module' | 'lesson' | 'quiz' | 'certificate'

export interface ExamQuestion {
  q: string
  opts: string[]
  correct: number
  caseTitle?: string
  caseContext?: string
  showContext?: boolean
}

export interface SectionMeta {
  label: string
  color: string
}

export interface ExamResult {
  id: string
  user_id: string
  score: number
  total: number
  passed: boolean
  created_at: string
}

export interface Certificate {
  id: string
  user_id: string
  user_name: string
  score: number
  issued_at: string
}
