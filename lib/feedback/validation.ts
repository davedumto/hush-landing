import { z } from "zod";

const TITLE_MAX = 120;
const TEXT_MAX = 2000;
const DIAGNOSTICS_MAX = 8000;

export const feedbackSchema = z.object({
  type: z.enum(["bug", "feature"]),
  title: z.string().min(1).max(TITLE_MAX),
  description: z
    .object({
      whatHappened: z.string().max(TEXT_MAX).optional(),
      steps: z.string().max(TEXT_MAX).optional(),
      expected: z.string().max(TEXT_MAX).optional(),
      featureDescription: z.string().max(TEXT_MAX).optional(),
    })
    .refine(
      (d) =>
        d.whatHappened != null ||
        d.steps != null ||
        d.expected != null ||
        d.featureDescription != null,
      { message: "At least one description field is required" }
    ),
  model: z.string().max(TEXT_MAX).optional(),
  replyEmail: z.string().email().max(TEXT_MAX).optional().or(z.literal("")),
  appVersion: z.string().max(TEXT_MAX).optional(),
  appBuild: z.string().max(TEXT_MAX).optional(),
  macosVersion: z.string().max(TEXT_MAX).optional(),
  macModel: z.string().max(TEXT_MAX).optional(),
  profileName: z.string().max(TEXT_MAX).optional(),
  locale: z.string().max(TEXT_MAX).optional(),
  diagnostics: z.string().max(DIAGNOSTICS_MAX).optional(),
  clientUuid: z.string().max(TEXT_MAX).optional(),
  honeypot: z.string().optional(),
});

export type FeedbackInput = z.infer<typeof feedbackSchema>;

export const LIMITS = { TITLE_MAX, TEXT_MAX, DIAGNOSTICS_MAX };
