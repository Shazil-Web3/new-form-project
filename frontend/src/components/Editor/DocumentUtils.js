import { BLOCK_TYPES } from './DocumentEngineConstants';

export const DocumentUtils = {
  // Convert blocks to plain text
  blocksToText(blocks) {
    return blocks.map(block => {
      switch (block.type) {
        case BLOCK_TYPES.HEADING:
          const level = block.metadata.level || 1;
          return '#'.repeat(level) + ' ' + block.content;
        case BLOCK_TYPES.LIST:
          return block.content.map(item => `• ${item}`).join('\n');
        case BLOCK_TYPES.QUOTE:
          return `> ${block.content}`;
        default:
          return block.content;
      }
    }).join('\n\n');
  },

  // Get word count for document
  getWordCount(blocks) {
    return blocks.reduce((count, block) => {
      if (typeof block.content === 'string') {
        return count + block.content.split(/\s+/).filter(word => word.length > 0).length;
      } else if (Array.isArray(block.content)) {
        return count + block.content.join(' ').split(/\s+/).filter(word => word.length > 0).length;
      }
      return count;
    }, 0);
  },

  // Search blocks by content
  searchBlocks(blocks, query) {
    const results = [];
    blocks.forEach(block => {
      const content = typeof block.content === 'string' ? 
        block.content : 
        Array.isArray(block.content) ? block.content.join(' ') : '';
      
      if (content.toLowerCase().includes(query.toLowerCase())) {
        results.push(block);
      }
    });
    return results;
  }
};
