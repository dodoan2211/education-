/**
 * Clean unpolished formatting remnants that AI sometimes adds incorrectly
 * such as raw markdown characters (*, #, \), backticks, and bullet points.
 */
export function cleanUnpolishedText(str: string): string {
  if (typeof str !== "string") return str;
  let s = str.trim();
  
  // Remove markdown headers if any (e.g. # Header, ## Header, etc.)
  s = s.replace(/^#+\s*/, "");
  
  // Remove bullet points/dashes at the beginning of a line (e.g. - Item, * Item, + Item)
  s = s.replace(/^[-*+]\s+/, "");
  
  // Strip formatting markers like double asterisks, asterisks, backticks, backslashes, underscores
  s = s.replace(/\*\*/g, "");
  s = s.replace(/\*/g, "");
  s = s.replace(/__/g, "");
  s = s.replace(/_/g, "");
  s = s.replace(/`/g, "");
  s = s.replace(/\\/g, ""); // strip backslashes
  
  return s.trim();
}

/**
 * Recursively clean an object's string properties of unpolished formatting remnants
 */
export function cleanObject<T>(obj: T): T {
  if (typeof obj === "string") {
    return cleanUnpolishedText(obj) as unknown as T;
  }
  if (Array.isArray(obj)) {
    return obj.map(item => cleanObject(item)) as unknown as T;
  }
  if (obj && typeof obj === "object") {
    const cleaned: any = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        cleaned[key] = cleanObject(obj[key]);
      }
    }
    return cleaned as T;
  }
  return obj;
}
