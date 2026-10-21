import type { FeedbackInput } from "./validation";

const EMBED_DESCRIPTION_MAX = 4096;
const FIELD_VALUE_MAX = 1024;

const COLOR_BUG = 0xe74c3c;
const COLOR_FEATURE = 0x2ecc71;

function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  const suffix = "\n… (truncated)";
  return value.slice(0, Math.max(0, max - suffix.length)) + suffix;
}

export type DiscordEmbed = {
  title: string;
  color: number;
  description?: string;
  fields: { name: string; value: string; inline?: boolean }[];
  timestamp: string;
};

export function buildDiscordEmbed(input: FeedbackInput, createdAt: Date): DiscordEmbed {
  const color = input.type === "bug" ? COLOR_BUG : COLOR_FEATURE;

  const descriptionParts: string[] = [];
  if (input.description.whatHappened) {
    descriptionParts.push(`**What happened**\n${input.description.whatHappened}`);
  }
  if (input.description.steps) {
    descriptionParts.push(`**Steps**\n${input.description.steps}`);
  }
  if (input.description.expected) {
    descriptionParts.push(`**Expected**\n${input.description.expected}`);
  }
  if (input.description.featureDescription) {
    descriptionParts.push(`**Feature description**\n${input.description.featureDescription}`);
  }

  const fields: DiscordEmbed["fields"] = [];
  if (input.appVersion || input.appBuild) {
    fields.push({
      name: "App",
      value: truncate(`${input.appVersion ?? "?"} (${input.appBuild ?? "?"})`, FIELD_VALUE_MAX),
      inline: true,
    });
  }
  if (input.macosVersion || input.macModel) {
    fields.push({
      name: "Mac",
      value: truncate(`${input.macModel ?? "?"} — macOS ${input.macosVersion ?? "?"}`, FIELD_VALUE_MAX),
      inline: true,
    });
  }
  if (input.profileName) {
    fields.push({ name: "Profile", value: truncate(input.profileName, FIELD_VALUE_MAX), inline: true });
  }
  if (input.model) {
    fields.push({ name: "Model", value: truncate(input.model, FIELD_VALUE_MAX), inline: true });
  }
  if (input.locale) {
    fields.push({ name: "Locale", value: truncate(input.locale, FIELD_VALUE_MAX), inline: true });
  }
  if (input.diagnostics) {
    fields.push({
      name: "Diagnostics",
      value: "```\n" + truncate(input.diagnostics, FIELD_VALUE_MAX - 8) + "\n```",
    });
  }
  if (input.replyEmail) {
    fields.push({ name: "Reply email", value: truncate(input.replyEmail, FIELD_VALUE_MAX) });
  }

  return {
    title: `[${input.type === "bug" ? "Bug" : "Feature"}] ${input.title}`,
    color,
    description: truncate(descriptionParts.join("\n\n"), EMBED_DESCRIPTION_MAX),
    fields,
    timestamp: createdAt.toISOString(),
  };
}

export async function sendDiscordEmbed(webhookUrl: string, embed: DiscordEmbed): Promise<boolean> {
  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ embeds: [embed] }),
    });
    return res.ok;
  } catch (err) {
    console.error("Discord webhook send failed", err instanceof Error ? err.message : err);
    return false;
  }
}
