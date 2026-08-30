// HeliosQE has exactly one true platform Owner. Every other person who
// touches a team is Admin or Member — "Owner" is never assignable to
// anyone else, whether by creating a new team or by a role change.
export const PLATFORM_OWNER_EMAIL = process.env.PLATFORM_OWNER_EMAIL || "suyash.joshi27@gmail.com";
