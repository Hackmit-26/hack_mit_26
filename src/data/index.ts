/**
 * Single entry point for seeded data.
 *
 * Swapping in a backend means re-exporting the same names from API clients;
 * no component imports a data file directly by path.
 */
export * from "./users";
export * from "./chapters";
export * from "./purchases";
export * from "./products";
export * from "./wrapped";
export * from "./reactions";
