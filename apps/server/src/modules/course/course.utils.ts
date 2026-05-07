export function toReleaseDate(
	value: string | null | undefined
): Date | null | undefined {
	if (value === undefined) {
		return undefined;
	}
	if (value === null) {
		return null;
	}
	return new Date(`${value}T00:00:00.000Z`);
}

export function normalizeString(value: string | undefined): string | undefined {
	const trimmed = value?.trim();
	return trimmed ? trimmed : undefined;
}

export function hasDuplicates(values: string[]): boolean {
	return new Set(values).size !== values.length;
}
