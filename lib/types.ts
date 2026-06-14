export type DropStatus = "live" | "ended";

export interface Drop {
  id: string;
  slug: string;
  name: string;
  description: string;
  emoji: string;
  /** Unit price in cents (USD). */
  price: number;
  totalStock: number;
  /** Atomic counter — only ever mutated via conditional UpdateItem. */
  claimed: number;
  /** Atomic counter for waitlist positions. */
  waitlistCount: number;
  status: DropStatus;
  /** Epoch ms. Claims are rejected before this. */
  startsAt: number;
  createdAt: number;
  ownerEmail: string;
}

export type ClaimStatus = "HELD" | "CONFIRMED" | "EXPIRED" | "WAITLIST";

export interface Claim {
  claimId: string;
  dropId: string;
  email: string;
  status: ClaimStatus;
  /** Claim number (1..totalStock) or waitlist position (1..n). */
  position: number;
  createdAt: number;
  /** Epoch seconds — when a HELD claim auto-releases. Doubles as the DynamoDB TTL attr. */
  holdExpiresAt?: number;
}

export interface ClaimResult {
  outcome: "held" | "waitlisted" | "not_started" | "ended" | "error";
  claim?: Claim;
}

export interface DropStats {
  id: string;
  slug: string;
  name: string;
  emoji: string;
  price: number;
  totalStock: number;
  claimed: number;
  waitlistCount: number;
  status: DropStatus;
  startsAt: number;
}

/** Public-safe projection of a drop (what buyers see). */
export function toPublicDrop(d: Drop): DropStats & { description: string } {
  return {
    id: d.id,
    slug: d.slug,
    name: d.name,
    emoji: d.emoji,
    description: d.description,
    price: d.price,
    totalStock: d.totalStock,
    claimed: Math.min(d.claimed, d.totalStock),
    waitlistCount: d.waitlistCount,
    status: d.status,
    startsAt: d.startsAt,
  };
}
