// Storage keeps the existing UTF-16 capacity. UTF-8 needs at most three bytes
// per code unit, so a supported Unicode history fits in the backup envelope.
export const MAX_STORAGE_CHARACTERS = 4000000;
export const MAX_BACKUP_BYTES = MAX_STORAGE_CHARACTERS * 3;
