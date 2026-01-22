// Auto-generated code utility for various models
// Format: I-DDMMYYYY-0001 (where 0001 is a 4-digit sequence)

export interface AutoCodeOptions {
  prefix?: string; // Default: 'I' for Invoice
  date?: Date; // Default: current date
  sequence?: number; // Default: 1
}

export function generateAutoCode(options: AutoCodeOptions = {}): string {
  const {
    prefix = 'I',
    date = new Date(),
    sequence = 1
  } = options;

  // Format date as DDMMYYYY
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  
  // Format sequence as 4-digit number
  const sequenceStr = String(sequence).padStart(4, '0');
  
  return `${prefix}-${day}${month}${year}-${sequenceStr}`;
}

export function parseAutoCode(code: string): {
  prefix: string;
  date: Date;
  sequence: number;
} | null {
  // Match pattern: I-DDMMYYYY-0001
  const match = code.match(/^(I|S)-(\d{2})(\d{2})(\d{4})-(\d{4})$/);
  
  if (!match) {
    return null;
  }
  
  const [, prefix, day, month, year, sequence] = match;
  
  return {
    prefix,
    date: new Date(`${year}-${month}-${day}`),
    sequence: parseInt(sequence)
  };
}

// Get next sequence number for today
export function getNextSequence(existingCodes: string[], date: Date = new Date()): number {
  const today = generateAutoCode({ date, sequence: 1 }).slice(2, 10); // Get DDMMYYYY part
  
  const todayCodes = existingCodes.filter(code => {
    const parsed = parseAutoCode(code);
    return parsed && 
      parsed.date.getDate() === date.getDate() &&
      parsed.date.getMonth() === date.getMonth() &&
      parsed.date.getFullYear() === date.getFullYear();
  });
  
  if (todayCodes.length === 0) {
    return 1;
  }
  
  // Find the highest sequence number for today
  const sequences = todayCodes.map(code => {
    const parsed = parseAutoCode(code);
    return parsed?.sequence || 0;
  });
  
  return Math.max(...sequences) + 1;
}
