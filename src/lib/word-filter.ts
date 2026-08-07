const DEFAULT_BLOCKED_WORDS = [
  "putangina",
  "tangina",
  "gago",
  "bobo",
  "tarantado",
  "ulol",
  "fuck",
  "shit",
  "damn",
  "asshole",
  "bitch",
  "bastard",
  "porn",
  "sex",
];

export function censorMessage(text: string, blockedWords: string[] = DEFAULT_BLOCKED_WORDS): string {
  let result = text;
  for (const word of blockedWords) {
    const regex = new RegExp(`\\b${word}\\b`, "gi");
    result = result.replace(regex, "****");
  }
  return result;
}
