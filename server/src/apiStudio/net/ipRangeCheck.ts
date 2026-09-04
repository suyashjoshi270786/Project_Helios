// SSRF guard: blocks loopback/private/link-local/CGNAT/multicast/reserved
// ranges and the cloud-metadata address (169.254.169.254 falls inside the
// blocked 169.254.0.0/16 link-local range). Deliberately has no allowlist —
// confirmed policy for this stage is strict with no exceptions; an internal-
// API testing allowlist, if ever needed, is its own reviewed feature.

function ipv4ToLong(ip: string): number {
  const parts = ip.split(".").map(Number);
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

function ipv4InCidr(ip: string, cidr: string): boolean {
  const [base, bitsStr] = cidr.split("/");
  const bits = Number(bitsStr);
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return (ipv4ToLong(ip) & mask) === (ipv4ToLong(base) & mask);
}

const IPV4_BLOCKED_CIDRS = [
  "127.0.0.0/8", // loopback
  "10.0.0.0/8", // private
  "172.16.0.0/12", // private
  "192.168.0.0/16", // private
  "169.254.0.0/16", // link-local, incl. 169.254.169.254 cloud metadata
  "100.64.0.0/10", // CGNAT
  "0.0.0.0/8", // "this network"
  "224.0.0.0/4", // multicast
  "240.0.0.0/4", // reserved
];

function isBlockedIpv4(ip: string): boolean {
  return IPV4_BLOCKED_CIDRS.some((cidr) => ipv4InCidr(ip, cidr));
}

// Expands a valid IPv6 address (including an IPv4-mapped/compatible tail
// like "::ffff:192.168.1.1") into 8 zero-padded 16-bit hex groups.
function expandIpv6Groups(ip: string): string[] {
  let addr = ip;
  const lastColon = addr.lastIndexOf(":");
  const possibleV4 = addr.slice(lastColon + 1);
  if (possibleV4.includes(".")) {
    const v4parts = possibleV4.split(".").map(Number);
    const hex1 = ((v4parts[0] << 8) | v4parts[1]).toString(16).padStart(4, "0");
    const hex2 = ((v4parts[2] << 8) | v4parts[3]).toString(16).padStart(4, "0");
    addr = `${addr.slice(0, lastColon + 1)}${hex1}:${hex2}`;
  }

  let head = addr;
  let tail = "";
  const dc = addr.indexOf("::");
  if (dc !== -1) {
    head = addr.slice(0, dc);
    tail = addr.slice(dc + 2);
  }
  const headParts = head.length ? head.split(":") : [];
  const tailParts = tail.length ? tail.split(":") : [];
  const missing = 8 - headParts.length - tailParts.length;
  const groups = [...headParts, ...Array(Math.max(missing, 0)).fill("0"), ...tailParts];
  return groups.map((g) => g.padStart(4, "0"));
}

function ipv6ToBigInt(ip: string): bigint {
  return expandIpv6Groups(ip).reduce((acc, g) => (acc << 16n) | BigInt(parseInt(g, 16)), 0n);
}

function ipv6InPrefix(ip: string, prefixAddr: string, prefixBits: number): boolean {
  const shift = 128n - BigInt(prefixBits);
  return ipv6ToBigInt(ip) >> shift === ipv6ToBigInt(prefixAddr) >> shift;
}

function longToIpv4(n: bigint): string {
  const v = Number(n & 0xffffffffn);
  return [(v >>> 24) & 0xff, (v >>> 16) & 0xff, (v >>> 8) & 0xff, v & 0xff].join(".");
}

function isBlockedIpv6(ip: string): boolean {
  if (ipv6ToBigInt(ip) === 0n) return true; // "::" — unspecified, not a real destination
  if (ipv6InPrefix(ip, "::1", 128)) return true; // loopback
  if (ipv6InPrefix(ip, "fe80::", 10)) return true; // link-local
  if (ipv6InPrefix(ip, "fc00::", 7)) return true; // unique local (ULA)
  if (ipv6InPrefix(ip, "ff00::", 8)) return true; // multicast

  // IPv4-mapped (::ffff:0:0/96) — re-check the embedded IPv4 address.
  if (ipv6InPrefix(ip, "::ffff:0:0", 96)) {
    return isBlockedIpv4(longToIpv4(ipv6ToBigInt(ip) & 0xffffffffn));
  }
  return false;
}

export function isPrivateOrReservedIp(ip: string, family: 4 | 6): boolean {
  return family === 4 ? isBlockedIpv4(ip) : isBlockedIpv6(ip);
}
