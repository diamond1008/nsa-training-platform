export function directoryRowNumber(page: number, perPage: number, rowIndex: number) {
  return (page - 1) * perPage + rowIndex + 1;
}

export function PersonAvatar({
  fullName,
  avatarUrl,
}: {
  fullName: string;
  avatarUrl?: string | null;
}) {
  const initials = fullName
    .split(" ")
    .filter(Boolean)
    .slice(-2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return avatarUrl ? (
    <img
      src={avatarUrl}
      alt={fullName}
      width={36}
      height={36}
      className="h-9 w-9 rounded-full border border-gborder object-cover shadow-2xs"
    />
  ) : (
    <div
      aria-label={`Avatar ${fullName}`}
      className="flex h-9 w-9 items-center justify-center rounded-full bg-gold/25 text-xs font-bold text-gold-dark shadow-2xs"
    >
      {initials || "--"}
    </div>
  );
}
