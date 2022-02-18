const TO_TITLE_CASE = /[A-Za-zÀ-ÖØ-öø-ÿ]\S*/g;
const titleCaseVariants: Record<string, string> = {
  deletemany: 'DeleteMany',
  getmany: 'GetMany',
  setmany: 'SetMany'
};

export function toTitleCase(str: string): string {
  return str.replace(TO_TITLE_CASE, (txt) => titleCaseVariants[txt.toLowerCase()] ?? txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase());
}