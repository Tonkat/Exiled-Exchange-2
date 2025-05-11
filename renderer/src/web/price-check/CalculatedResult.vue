<!-- renderer/src/web/price-check/CalculatedResult.vue -->
<template>
  <div class="calculated-result p-2 bg-gray-900 text-gray-100 rounded overflow-x-auto">
    <pre v-html="result"></pre>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, computed, watch } from "vue";
import { simplifyItemString } from "../../utils/itemStringUtils";

/**
 * Converts an array of strings with color codes into an HTML string.
 * Color codes are in the format "^xRRGGBB" to start a colored segment
 * and "^7" to reset the color to the default.
 *
 * @param lines An array of strings potentially containing color codes.
 * @returns A string of HTML representing the input with colored segments.
 */
 function convertToHtmlWithColors(jsonString: string): string {
    let lines: string[];

    try {
        // Attempt to parse the input string as a JSON array of strings
        const parsedInput = JSON.parse(jsonString);

        // Validate that the parsed input is indeed an array of strings
        if (!Array.isArray(parsedInput) || !parsedInput.every(item => typeof item === 'string')) {
            return 'Error: Invalid input format. Expected a JSON array of strings.';
        }

        lines = parsedInput;

    } catch (error) {
        // Handle JSON parsing errors
        console.error("Error parsing JSON string:", error);
        return `Error parsing input string: ${(error as Error).message}`;
    }

    let htmlOutput = '';
    const colorRegex = /\^x([0-9A-Fa-f]{6})/g;
    const resetRegex = /\^7/g;

    // Comment this line if you want to see the full output
    lines = lines.slice(lines.findIndex(line => line.includes("Equipping")), -1);

    for (const line of lines) {
        let processedLine = '';
        let lastIndex = 0;
        let currentColor = '';
        let fontSize = 'medium';
        let fontWeight = 'normal';

        if (line.includes("Effective") || line.includes("DPS")) {
          fontSize = 'large';
          fontWeight = 'bold';
        }

        // Combine reset and color matches and sort by index
        const matches: { index: number; type: 'color' | 'reset'; value?: string }[] = [];

        let colorMatch;
        while ((colorMatch = colorRegex.exec(line)) !== null) {
            matches.push({ index: colorMatch.index, type: 'color', value: colorMatch[1] });
        }

        let resetMatch;
        while ((resetMatch = resetRegex.exec(line)) !== null) {
            matches.push({ index: resetMatch.index, type: 'reset' });
        }

        matches.sort((a, b) => a.index - b.index);

        for (const match of matches) {
            // Add text before the current match
            if (match.index > lastIndex) {
                const text = line.substring(lastIndex, match.index);
                if (currentColor) {
                    processedLine += `<span style="font-weight: ${fontWeight}; font-size: ${fontSize}; color: #${currentColor};">${text}</span>`;
                } else {
                    processedLine += text;
                }
            }

            // Process the current match
            if (match.type === 'color' && match.value) {
                // If there was a previous color, close the span
                if (currentColor) {
                    processedLine += '</span>';
                }
                currentColor = match.value;
                 // The '^xRRGGBB' takes up 8 characters
                lastIndex = match.index + 8;
            } else if (match.type === 'reset') {
                // If there was a current color, close the span
                if (currentColor) {
                    processedLine += '</span>';
                }
                currentColor = '';
                // The '^7' takes up 2 characters
                lastIndex = match.index + 2;
            }
        }

        // Add any remaining text after the last match
        if (lastIndex < line.length) {
            const remainingText = line.substring(lastIndex);
            if (currentColor) {
                processedLine += `<span style="font-weight: ${fontWeight}; font-size: ${fontSize}; color: #${currentColor};">${remainingText}</span>`;
            } else {
                processedLine += remainingText;
            }
        }

        // Add the processed line to the output
        htmlOutput += processedLine + '<br>';
    }

    return htmlOutput;
}

export default defineComponent({
  name: "CalculatedResult",
  props: {
    rawText: {
      type: String,
      required: true,
    },
  },
  setup(props) {
    const result = ref<string>("Loading...");
    const simplifiedItemString = computed(() => simplifyItemString(props.rawText));

    // Fallback function to try direct HTTP requests if IPC fails
    const fallbackToDirectFetch = (encoded: string) => {
      console.log("Falling back to direct HTTP requests");
      
      // Try 127.0.0.1 first
      fetch(`http://127.0.0.1:49090/calculate_item?item=${encoded}`)
        .then((res) => res.text())
        .then((text: string) => {
          result.value = convertToHtmlWithColors(text);
        })
        .catch((err: Error) => {
          console.error("Error with 127.0.0.1:", err);
          
          // Then try localhost
          fetch(`http://localhost:49090/calculate_item?item=${encoded}`)
            .then((res) => res.text())
            .then((text: string) => {
              result.value = convertToHtmlWithColors(text);
            })
            .catch((innerErr: Error) => {
              console.error("Error with localhost:", innerErr);
              result.value = `Error: Could not connect to server. Please make sure the server is running and accessible.`;
            });
        });
    };

    const fetchResult = () => {
        const encoded = encodeURIComponent(simplifiedItemString.value);
        
        // Check if we're running in Electron with IPC available
        // @ts-ignore - Electron API is available at runtime but not during type checking
        if (window.electron && window.electron.ipcRenderer) {
            console.log("Using Electron IPC to fetch data");
            // @ts-ignore - Electron API is available at runtime but not during type checking
            window.electron.ipcRenderer.invoke('fetch-calculate-item', encoded)
            .then((text: string) => {
                result.value = convertToHtmlWithColors(text);
            })
            .catch((err: Error) => {
                console.error("IPC error:", err);
                fallbackToDirectFetch(encoded);
            });
        } else {
            // Fallback to direct fetch
            fallbackToDirectFetch(encoded);
        }
    };

    watch(() => props.rawText, fetchResult, { immediate: true });

    return {
      result
    };
  },
});

</script>

<style scoped>
/* allow the result div to grow and scroll */
.calculated-result {
  display: flex;
  flex: 1 1 auto;
  overflow-y: auto;
  white-space: pre-wrap;
}
</style>