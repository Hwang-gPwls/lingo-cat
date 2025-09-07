/**
 * Text utility functions for formatting and processing
 */

export const maskText = (text: string, shouldMask: boolean): string => {
  if (!shouldMask) return text;
  
  // Mask all but first and last 2 characters
  if (text.length <= 4) return '***';
  return text.slice(0, 2) + '***' + text.slice(-2);
};

export const shouldIgnoreMessage = (message: any): boolean => {
  // Ignore bot messages
  if (message.bot_id || message.subtype === 'bot_message') {
    return true;
  }
  
  // Ignore system messages (join/leave etc)
  if (message.subtype && message.subtype !== 'message_changed') {
    return true;
  }
  
  // Ignore empty or whitespace only messages
  if (!message.text || message.text.trim().length === 0) {
    return true;
  }
  
  // Ignore emoji-only messages (simple check)
  const emojiPattern = /^[\s\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]*$/u;
  if (emojiPattern.test(message.text)) {
    return true;
  }
  
  // Ignore ignore commands
  if (message.text.toLowerCase().includes('/ignore')) {
    return true;
  }
  
  return false;
};

export const preserveFormatting = (text: string): string => {
  // This function would be used to preserve Slack formatting in translations
  // For now, return as-is but could be extended to handle special formatting
  return text;
};

export const splitLongMessage = (text: string, maxLength: number = 4000): string[] => {
  if (text.length <= maxLength) {
    return [text];
  }
  
  const chunks: string[] = [];
  let currentChunk = '';
  
  const lines = text.split('\n');
  
  for (const line of lines) {
    if (currentChunk.length + line.length + 1 > maxLength) {
      if (currentChunk) {
        chunks.push(currentChunk.trim());
        currentChunk = '';
      }
      
      // If single line is too long, split it
      if (line.length > maxLength) {
        const words = line.split(' ');
        for (const word of words) {
          if (currentChunk.length + word.length + 1 > maxLength) {
            if (currentChunk) {
              chunks.push(currentChunk.trim());
              currentChunk = '';
            }
          }
          currentChunk += (currentChunk ? ' ' : '') + word;
        }
      } else {
        currentChunk = line;
      }
    } else {
      currentChunk += (currentChunk ? '\n' : '') + line;
    }
  }
  
  if (currentChunk) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks;
};
