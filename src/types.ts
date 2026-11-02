export interface PodcastEpisode {
  id: string;
  title: string;
  description: string;
  pubDate: string;
  duration: string;
  author: string;
  audioUrl: string;
  link: string;
  imageUrl?: string;
}

export interface FactItem {
  id?: string;
  fact: string;
  context: string;
  sourceOrCategory: string;
  sourceUrl?: string;
  searchUrl?: string;
  sourceCountry?: string;
  sourceLanguage?: string;
  publishedDate?: string;
  detailedSummary?: string;
  keyInsights?: string[];
  relevanceToPodcast?: string;
}

export interface EpisodeAnalysis {
  summary: string;
  keyPoints: string[];
  facts: FactItem[];
  silviaIntro: string;
  suggestedQuestions: string[];
}

export interface ChatMessage {
  id: string;
  role: 'silvia' | 'user';
  text: string;
  timestamp: string;
  audioUrl?: string;
}
