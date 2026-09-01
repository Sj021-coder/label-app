// Pure text-pattern matching — no API calls, no secrets. Works identically
// in the browser (Admin's "coller un post" tool) or, later, server-side
// (e.g. scanning the news articles daily-sync.mjs already collects).
//
// Deliberately heuristic, not "smart": it only recognizes a few common,
// clean phrasings real French rap media actually use (confirmed against a
// real Booska-P headline about Ninho crossing 100M streams). Anything it
// doesn't recognize comes back as "unknown" — it never guesses silently,
// and the UI that calls this always shows the result for a human to
// confirm or correct before anything is saved.

const NUMBER_UNIT_RE = /(\d+(?:[.,]\d+)?)\s*(k|m|millions?|milliards?)\b/i;
const STREAM_WORD_RE = /(streams?|écoutes?|vues?|plays?|abonnés?|followers?)/i;
const MILESTONE_VERB_RE = /(passe|franchit|dépasse|atteint|décroche)/i;
const QUOTE_RE = /[«"“]([^»"”]{2,80})[»"”]/;
const PLATFORM_RE = /(spotify|youtube|deezer|apple music)/i;

const ANNOUNCEMENT_RE =
  /(annonce|dévoile|d[ée]voile|pr[ée]voit|sortira|prochain(?:e)?\s+(album|single|ep|projet|mixtape)|date de sortie|tourn[ée]e|dates? de concerts?|feat(?:uring)? à venir)/i;

// Returns { type: "milestone" | "announcement" | "unknown", ...details, raw }
export function extractSignal(text) {
  const raw = (text || "").trim();
  if (!raw) return { type: "unknown", raw };

  const numMatch = raw.match(NUMBER_UNIT_RE);
  const quoteMatch = raw.match(QUOTE_RE);
  const platformMatch = raw.match(PLATFORM_RE);

  if (numMatch && STREAM_WORD_RE.test(raw) && MILESTONE_VERB_RE.test(raw)) {
    const rawNum = parseFloat(numMatch[1].replace(",", "."));
    const unit = numMatch[2].toLowerCase();
    const isMilliard = unit.startsWith("milliard");
    const isMillion = unit.startsWith("m") && !isMilliard;
    const multiplier = isMilliard ? 1_000_000_000 : isMillion ? 1_000_000 : 1_000;
    return {
      type: "milestone",
      songName: quoteMatch ? quoteMatch[1].trim() : null,
      amount: Math.round(rawNum * multiplier),
      amountLabel: `${numMatch[1]}${isMilliard ? "Md" : isMillion ? "M" : "K"}`,
      platform: platformMatch ? platformMatch[1] : null,
      raw,
    };
  }

  if (ANNOUNCEMENT_RE.test(raw)) {
    return {
      type: "announcement",
      songName: quoteMatch ? quoteMatch[1].trim() : null,
      raw,
    };
  }

  return { type: "unknown", raw };
}

// A starting point only — always shown to a human for confirmation/edit
// before it's ever saved. Never applied blind.
export function suggestScoring(signal) {
  if (signal.type === "milestone") {
    return {
      category: "momentum",
      delta: 20,
      label: signal.songName
        ? `🎯 « ${signal.songName} » franchit les ${signal.amountLabel}${
            signal.platform ? ` sur ${signal.platform[0].toUpperCase()}${signal.platform.slice(1)}` : ""
          }`
        : `🎯 Nouveau palier de streams atteint (${signal.amountLabel})`,
    };
  }
  if (signal.type === "announcement") {
    return {
      category: "activity",
      delta: 5,
      label: signal.songName ? `📢 Annonce : « ${signal.songName} »` : "📢 Annonce à venir",
    };
  }
  return { category: "culture", delta: 0, label: "" };
}
