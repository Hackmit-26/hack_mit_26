import type { Group, User, UserId } from "@/lib/types";

/**
 * "Each friend owns a color, used for their avatar and their tile on every
 * card" — design system artboard.
 */
export const users: Record<UserId, User> = {
  kristina: {
    id: "kristina",
    name: "Kristina",
    persona: "the midnight researcher",
    color: "#E8806F",
    isViewer: true,
  },
  esh: {
    id: "esh",
    name: "Esh",
    persona: "the store collector",
    color: "#BBA9E8",
    isViewer: false,
  },
  sabina: {
    id: "sabina",
    name: "Sabina",
    persona: "the weekend warrior",
    color: "#A8DCC2",
    isViewer: false,
  },
  madhav: {
    id: "madhav",
    name: "Madhav",
    persona: "the regular",
    color: "#F5E39B",
    isViewer: false,
  },
};

export const userList: User[] = [
  users.kristina,
  users.esh,
  users.sabina,
  users.madhav,
];

export const viewer: User = users.kristina;

export const group: Group = {
  id: "tea-party",
  name: "The Tea Party",
  period: "September",
  memberIds: ["kristina", "esh", "sabina", "madhav"],
  inviteCode: "TEAPARTY",
};

/**
 * The same four people as they exist in Supabase. The cards are keyed by first name because the
 * copy is written by hand; anything that talks to the API needs the uuid instead.
 */
export const backendUserIds: Record<UserId, string> = {
  kristina: "11111111-1111-1111-1111-111111111111",
  esh: "22222222-2222-2222-2222-222222222222",
  sabina: "33333333-3333-3333-3333-333333333333",
  madhav: "44444444-4444-4444-4444-444444444444",
};

export const backendGroupId = "99999999-9999-9999-9999-999999999999";

export function getUser(id: UserId): User {
  return users[id];
}

/** "You" for the viewer, first name for everyone else. */
export function displayName(id: UserId): string {
  return users[id].isViewer ? "You" : users[id].name;
}
