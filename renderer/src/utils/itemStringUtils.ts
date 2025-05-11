/**
 * Simplifies a string containing item information by removing modifier lines
 * and parenthesized content from subsequent lines.
 *
 * @param inputString The raw string with excess information.
 * @returns The simplified string.
 */
export function simplifyItemString(inputString: string): string {
    // Split the input string into individual lines
    const lines = inputString.split('\n');
    const simplifiedLines: string[] = [];
    let skipNextLine = false;

    for (let i = 0; i < lines.length; i++) {
        const currentLine = lines[i];

        // Check if the current line is a modifier line
        if (currentLine.trim().startsWith('{ ') && currentLine.trim().endsWith('}')) {
            // If it's a modifier line, skip it and mark the next line for processing
            skipNextLine = true;
        } else if (skipNextLine) {
            // If the previous line was a modifier line, process the current line
            const processedLine = removeParenthesizedContent(currentLine);
            simplifiedLines.push(processedLine);
            skipNextLine = false; // Reset the flag
        } else {
            // For other lines, still remove parenthesized content if they contain stat values
            if (containsStatValue(currentLine)) {
                simplifiedLines.push(removeParenthesizedContent(currentLine));
            } else {
                // Keep other lines as they are
                simplifiedLines.push(currentLine);
            }
        }
    }

    // Join the simplified lines back into a single string with line breaks
    return simplifiedLines.join('\n');
}

/**
 * Removes content within parentheses from a string
 * 
 * @param line The line to process
 * @returns The line with parenthesized content removed
 */
function removeParenthesizedContent(line: string): string {
    return line.replace(/\([^)]*\)/g, '');
}

/**
 * Checks if a line contains a stat value (numbers with % or + signs)
 * 
 * @param line The line to check
 * @returns True if the line contains a stat value
 */
function containsStatValue(line: string): boolean {
    // Match lines that contain numbers with % or + signs, typical for item stats
    return /(\d+%|[+-]\d+)/.test(line);
}
