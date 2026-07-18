// Code 39 Barcode Generator for DoodhOS

const Code39Map: Record<string, string> = {
  '0': '101001101101', '1': '110100101011', '2': '101100101011', '3': '110110010101',
  '4': '101001101011', '5': '110100110101', '6': '101100110101', '7': '101001011011',
  '8': '110100101101', '9': '101100101101', 'A': '110101001011', 'B': '101101001011',
  'C': '110110100101', 'D': '101011001011', 'E': '110101100101', 'F': '101101100101',
  'G': '101010011011', 'H': '110101001101', 'I': '101101001101', 'J': '101011001101',
  'K': '110101010011', 'L': '101101010011', 'M': '110110101001', 'N': '101011010011',
  'O': '110101101001', 'P': '101101101001', 'Q': '101010110011', 'R': '110101011001',
  'S': '101101011001', 'T': '101011011001', 'U': '110010101011', 'V': '100110101011',
  'W': '110011010101', 'X': '100101101011', 'Y': '110010110101', 'Z': '100110110101',
  '-': '100101011011', '.': '110010101101', ' ': '100110101101', '*': '100101101101',
  '$': '100100100101', '/': '100100101001', '+': '100101001001', '%': '101001001001'
};

/**
 * Generates an SVG string representation of a Code 39 barcode.
 * @param text The input string to encode (should be uppercase letters, numbers, spaces, or $, /, +, %, -, .)
 * @param height Height of the barcode bars (default 50)
 * @param barWidth Width of a single narrow bar element (default 2)
 */
export function generateBarcodeSVG(
  text: string,
  height = 50,
  barWidth = 2
): string {
  // Code 39 requires start/stop characters (*)
  const formattedText = text.toUpperCase();
  const fullText = `*${formattedText}*`;

  // Build the binary barcode stream
  let stream = '';
  for (let i = 0; i < fullText.length; i++) {
    const char = fullText[i];
    const pattern = Code39Map[char] || Code39Map[' ']; // fallback to space
    stream += pattern + '0'; // Inter-character gap is 1 narrow space
  }

  // Generate paths for the SVG
  let pathD = '';
  let x = 0;

  for (let i = 0; i < stream.length; i++) {
    if (stream[i] === '1') {
      // Find consecutive '1's to make a single bar path
      let run = 0;
      while (i < stream.length && stream[i] === '1') {
        run++;
        i++;
      }
      i--; // adjust loop index
      
      const width = run * barWidth;
      pathD += `M${x},0h${width}v${height}h-${width}z `;
      x += width;
    } else {
      // It's a space, just advance X
      x += barWidth;
    }
  }

  const totalWidth = x;
  
  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalWidth} ${height + 25}" width="100%" height="100%" style="max-width: ${totalWidth}px;">
      <style>
        .barcode-text { font-family: monospace; font-size: 14px; fill: #111111; text-anchor: middle; font-weight: bold; }
      </style>
      <path d="${pathD}" fill="#111111" />
      <text x="${totalWidth / 2}" y="${height + 18}" class="barcode-text">${formattedText}</text>
    </svg>
  `.trim();
}

/**
 * Validates if the text can be encoded in Code 39.
 */
export function isValidCode39(text: string): boolean {
  const allowed = /^[0-9A-Z\-.\s$/+%=]*$/;
  return allowed.test(text.toUpperCase());
}
