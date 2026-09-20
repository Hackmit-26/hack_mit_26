/**
 * The one-line verdict on the group's loudest thread. Same shape as `templateCopy` in
 * wrappedGenerator.ts: a template fed real facts, so the line is always grounded and always true
 * of the data it was built from. There is no model behind it and there is not meant to be - the
 * facts are the joke.
 */
export type DebateFacts = {
  itemName: string;
  messageCount: number;
  spanDays: number;
  /** Comment authors in the order they first spoke. */
  participantNames: string[];
  /** Null when the item is shared anonymously - the verdict must not out the owner either. */
  ownerName: string | null;
  ownerReplied: boolean;
};

const NUMBER_WORDS = [
  'zero',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
  'thirteen',
  'fourteen',
  'fifteen',
  'sixteen',
  'seventeen',
  'eighteen',
  'nineteen',
  'twenty',
];

const numberWord = (value: number): string => NUMBER_WORDS[value] ?? String(value);

const plural = (count: number, noun: string): string => (count === 1 ? noun : `${noun}s`);

const capitalise = (value: string): string => (value ? value[0]?.toUpperCase() + value.slice(1) : value);

function listNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? 'nobody';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

export function templateVerdict(facts: DebateFacts): string {
  const days = `${capitalise(numberWord(facts.spanDays))} ${plural(facts.spanDays, 'day')}`;
  const messages = `${numberWord(facts.messageCount)} ${plural(facts.messageCount, 'message')}`;
  const count = facts.participantNames.length;
  const people = `${numberWord(count)} ${count === 1 ? 'person' : 'people'}`;
  const lead = `${days}, ${messages}, ${people} deep`;

  const others = facts.participantNames.filter((name) => name !== facts.ownerName);

  if (others.length === 0) {
    return `${lead} — "${facts.itemName}" is somehow having this argument with itself.`;
  }

  const chorus =
    others.length === 1 ? `${others[0]} had opinions` : `${listNames(others)} all had opinions`;

  if (facts.ownerName === null) {
    return `${lead} — ${chorus}, and nobody will admit whose "${facts.itemName}" it is.`;
  }
  if (facts.ownerReplied) {
    return `${lead} — ${chorus}, and ${facts.ownerName} answered back.`;
  }
  return `${lead} — ${chorus}, and ${facts.ownerName} has still not said a word.`;
}
