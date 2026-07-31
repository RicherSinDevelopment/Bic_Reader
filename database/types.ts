export type PdfDocument = {
  id: string;
  name: string;
  originalName: string;
  uri: string;
  size?: number;
  mimeType?: string;
  addedAt: string;
  dateOpened: string;
  currentPage: number;
  totalPages?: number;
  completionPercentage: number;
};

export type NewPdfDocument = PdfDocument & {
  normalizedName: string;
};
