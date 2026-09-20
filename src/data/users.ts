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

/**
 * Who the app is currently being used as. `let`, not `const`: ESM live bindings mean every module
 * that did `import { viewer } from "@/data/users"` follows the reassignment, so the demo switcher
 * does not need every call site to be rewritten.
 */
export let viewer: User = users.kristina;

/**
 * Points the whole app at another member of the group. Only the demo viewer switcher calls this;
 * it must be followed by a React re-render (see `setViewerId` in `@/state/store`), because module
 * state on its own tells React nothing.
 */
export function setActiveViewer(id: UserId): void {
  viewer = users[id];
  for (const user of userList) user.isViewer = user.id === id;
}

export const group: Group = {
  id: "tea-party",
  name: "The Tea Party",
  period: "September",
  memberIds: ["kristina", "esh", "sabina", "madhav"],
  inviteCode: "TEAPARTY",
};

/**
 * Everyone in the group except one person, in roster order.
 *
 * A function, not a constant: `viewer` is a live binding, so anything computed once at import
 * time would still name the person who happened to be viewing when the module first loaded.
 * The gift pickers pass the current viewer; the group-gift split passes the recipient.
 */
export function groupMembersExcept(userId: UserId): UserId[] {
  return group.memberIds.filter((id) => id !== userId);
}

/**
 * The same four people as the backend seeds them. The demo backend (`DB_MODE=memory`) uses these
 * exact strings as its primary keys, so `UserId` is also the dev bearer token: `Bearer dev:sabina`.
 * Nothing is mapped, which is the point - there is one set of ids, not two.
 */
export const backendUserIds: Record<UserId, string> = {
  kristina: "kristina",
  esh: "esh",
  sabina: "sabina",
  madhav: "madhav",
};

export const backendGroupId = "tea-party";

export function getUser(id: UserId): User {
  return users[id];
}

/** "You" for whoever the app is currently being used as, first name for everyone else. */
export function displayName(id: UserId): string {
  return id === viewer.id ? "You" : users[id].name;
}
