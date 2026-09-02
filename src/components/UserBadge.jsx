import { ShieldIcon, VerifiedIcon } from "@/components/icons";

export function UserBadge({ role, isTrusted, className = "" }) {
  if (role === "admin") {
    return (
      <span
        className={`user-badge user-badge--admin ${className}`}
        title="Admin"
      >
        <ShieldIcon size={12} /> Admin
      </span>
    );
  }
  if (role === "member" && isTrusted) {
    return (
      <span
        className={`user-badge user-badge--trusted ${className}`}
        title="Akun terpercaya"
      >
        <VerifiedIcon size={14} />
      </span>
    );
  }
  return null;
}
