// Staff accounts that may also act as a participant: sign in to the portal from
// the participant login page and register for trainings. An account has one
// role, so without this a staff member cannot see the participant side at all.
//
// PORTAL_STAFF_EMAILS is a comma-separated list of emails. Unset means nobody.
export function staffMayUsePortal(email: string): boolean {
  const allowed = (process.env.PORTAL_STAFF_EMAILS ?? '')
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
  return allowed.includes(email.toLowerCase());
}
