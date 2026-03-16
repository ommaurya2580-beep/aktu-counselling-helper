export const normalizeString = (str) => {
    if (!str) return "";
    return String(str)
        .toLowerCase()
        // Strip out 'and' (whole word) and '&' to handle cases with or without them
        .replace(/\band\b/g, ' ')
        .replace(/&/g, ' ')
        // Remove common punctuation that might cause mismatches
        .replace(/[,.-]/g, ' ')
        // Collapse multiple spaces into one and trim
        .replace(/\s+/g, ' ')
        .trim();
};
