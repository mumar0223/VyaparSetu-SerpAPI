import { streamText, Output } from "ai";
import type { z } from "zod";

export type DeepPartial<T> = T extends (infer U)[]
  ? DeepPartial<U>[]
  : T extends object
    ? { [K in keyof T]?: DeepPartial<T[K]> }
    : T;

export async function streamStructured<S extends z.ZodTypeAny>(opts: {
  model: any;
  prompt: string;
  schema: S;
  temperature?: number;
  onPartial?: (p: DeepPartial<z.infer<S>>) => void;
}): Promise<z.infer<S>> {
  const result = streamText({
    model: opts.model,
    prompt: opts.prompt,
    temperature: opts.temperature,
    output: Output.object({ schema: opts.schema }),
    onError: ({ error }) => console.warn("[streamStructured]", error),
  });

  let lastPartial: any = null;
  for await (const partial of result.partialOutputStream) {
    lastPartial = partial;
    opts.onPartial?.(partial as any);
  }

  try {
    return (await result.output) as z.infer<S>;
  } catch (err) {
    if (lastPartial) {
      return lastPartial as z.infer<S>;
    }
    throw err;
  }
}

/**
 * Truncates half-written code blocks (e.g. ```cards, ```chart, ```calculator)
 * during live token streaming so React Markdown never parses broken JSON or unclosed fences.
 */
export function stableMarkdown(md: string): string {
  const fences = (md.match(/^```/gm) || []).length;
  if (fences % 2 === 0) return md;
  const lastIndex = md.lastIndexOf("```");
  return lastIndex >= 0 ? md.slice(0, lastIndex).trimEnd() : md;
}
