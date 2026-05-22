import logUpdate from "log-update";

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
const MAX_VISIBLE_LINES = 6;

/** Returns the inner content width for a given terminal/box width. */
function boxInnerWidth(): number {
  const cols = process.stdout.columns ?? 80;
  // box: "│ " + content + " │" = 4 chars overhead; clamp to sane range
  return Math.max(40, Math.min(cols, 100)) - 4;
}

interface Slot {
  label: string;
  /** Raw accumulated text from the model */
  rawText: string;
  /** Lines derived from rawText, updated on each append */
  lines: string[];
  /** Spinner frame counter, incremented per chunk */
  frame: number;
  done: boolean;
}

class TerminalDisplay {
  private readonly slots = new Map<string, Slot>();
  private active = false;

  /** Open a new generation display slot. */
  open(key: string, label: string): void {
    this.slots.set(key, {
      label,
      rawText: "",
      lines: [],
      frame: 0,
      done: false,
    });
    this.active = true;
    this.render();
  }

  /**
   * Append a streamed text chunk to a slot. The spinner advances on each call
   * so it animates naturally as chunks arrive.
   */
  append(key: string, text: string): void {
    const slot = this.slots.get(key);
    if (!slot) return;

    slot.rawText += text;
    slot.frame += 1;

    // Rebuild lines from raw text — split on newlines, expanding each logical
    // line into wrapped segments so they fit inside the box.
    const inner = boxInnerWidth();
    slot.lines = slot.rawText
      .split("\n")
      .flatMap((line) => wrapAt(line, inner));

    this.render();
  }

  /** Mark a slot as complete; remove it from the display after a short pause. */
  close(key: string): void {
    const slot = this.slots.get(key);
    if (slot) {
      slot.done = true;
      this.render();
    }
    setTimeout(() => {
      this.slots.delete(key);
      if (this.slots.size === 0) {
        logUpdate.done();
        this.active = false;
      } else {
        this.render();
      }
    }, 300);
  }

  private render(): void {
    if (!this.active || this.slots.size === 0) return;

    const parts: string[] = [];
    for (const slot of this.slots.values()) {
      parts.push(renderBox(slot));
    }
    logUpdate(parts.join("\n"));
  }
}

function renderBox(slot: Slot): string {
  const inner = boxInnerWidth();
  const boxWidth = inner + 4; // "│ " + inner + " │"

  const spinnerChar = slot.done
    ? "✓"
    : SPINNER_FRAMES[slot.frame % SPINNER_FRAMES.length]!;

  // Title row: "╭─ ⠋ label ──...──╮"
  const titleContent = ` ${spinnerChar} ${slot.label} `;
  const dashCount = Math.max(1, boxWidth - 2 - titleContent.length);
  const topBorder = `╭─${titleContent}${"─".repeat(dashCount)}╮`;
  const bottomBorder = `╰${"─".repeat(boxWidth - 2)}╯`;

  // Pick the last MAX_VISIBLE_LINES from the wrapped line buffer
  const visible = slot.lines.slice(-MAX_VISIBLE_LINES);
  // Pad to MAX_VISIBLE_LINES so the box height stays stable
  while (visible.length < MAX_VISIBLE_LINES) visible.push("");

  const rows = visible.map((line) => {
    const truncated = line.slice(0, inner);
    return `│ ${truncated.padEnd(inner)} │`;
  });

  return [topBorder, ...rows, bottomBorder].join("\n");
}

/** Split a line into segments of at most `width` characters. */
function wrapAt(line: string, width: number): string[] {
  if (line.length <= width) return [line];
  const segments: string[] = [];
  for (let i = 0; i < line.length; i += width) {
    segments.push(line.slice(i, i + width));
  }
  return segments;
}

export const terminalDisplay = new TerminalDisplay();
