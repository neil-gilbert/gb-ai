export type ChatSummary = {
  id: string;
  title: string;
  preview: string;
  createdAtUtc: string;
  updatedAtUtc: string;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  displayText: string;
  modelKey: string;
  createdAtUtc: string;
};

export type ModelEntry = {
  modelKey: string;
  displayName: string;
  provider: string;
  inputWeight: number;
  outputWeight: number;
};
