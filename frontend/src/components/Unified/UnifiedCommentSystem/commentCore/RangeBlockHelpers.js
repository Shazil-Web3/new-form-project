// Helper to compute character offset of a node & nodeOffset relative to a block element
const getOffsetInBlock = (blockElement, containerNode, nodeOffset) => {
  let offset = 0;
  const walker = document.createTreeWalker(blockElement, NodeFilter.SHOW_TEXT);
  let currentNode = walker.nextNode();
  while (currentNode) {
    if (currentNode === containerNode) {
      return offset + nodeOffset;
    }
    offset += currentNode.textContent.length;
    currentNode = walker.nextNode();
  }
  return offset;
};

// Helper to find text node and nodeOffset in a block element from character offset
const getNodeFromOffsetInBlock = (blockElement, targetOffset) => {
  const walker = document.createTreeWalker(blockElement, NodeFilter.SHOW_TEXT);
  let currentNode = walker.nextNode();
  let currentPos = 0;
  let lastNode = null;

  while (currentNode) {
    lastNode = currentNode;
    const nodeLength = currentNode.textContent.length;
    if (currentPos + nodeLength >= targetOffset) {
      return { node: currentNode, offset: Math.max(0, targetOffset - currentPos) };
    }
    currentPos += nodeLength;
    currentNode = walker.nextNode();
  }

  if (lastNode) {
    return { node: lastNode, offset: lastNode.textContent.length };
  }
  return null;
};

// Helper to compute block-level range offsets supporting multi-block selections
const getRangeBlockOffsets = (range) => {
  if (!range) return null;
  const startBlock = range.startContainer.nodeType === Node.TEXT_NODE
    ? range.startContainer.parentElement?.closest('[data-block-id]')
    : range.startContainer?.closest('[data-block-id]');
  const endBlock = range.endContainer.nodeType === Node.TEXT_NODE
    ? range.endContainer.parentElement?.closest('[data-block-id]')
    : range.endContainer?.closest('[data-block-id]');

  if (!startBlock || !endBlock) return null;

  const startBlockId = startBlock.getAttribute('data-block-id');
  const endBlockId = endBlock.getAttribute('data-block-id');

  const startOffset = getOffsetInBlock(startBlock, range.startContainer, range.startOffset);
  const endOffset = getOffsetInBlock(endBlock, range.endContainer, range.endOffset);

  return {
    startBlockId,
    startOffset,
    endBlockId,
    endOffset
  };
};

// Helper to recreate a Range spanning across one or multiple blocks
const recreateRangeFromBlockOffsets = (container, offsets) => {
  if (!container || !offsets) return null;
  const { startBlockId, startOffset, endBlockId, endOffset } = offsets;
  const startBlock = container.querySelector(`[data-block-id="${startBlockId}"]`);
  const endBlock = container.querySelector(`[data-block-id="${endBlockId}"]`);

  if (!startBlock || !endBlock) return null;

  const startRes = getNodeFromOffsetInBlock(startBlock, startOffset);
  const endRes = getNodeFromOffsetInBlock(endBlock, endOffset);

  if (startRes && endRes) {
    try {
      const range = document.createRange();
      range.setStart(startRes.node, startRes.offset);
      range.setEnd(endRes.node, endRes.offset);
      return range;
    } catch (e) {
      console.warn('[CommentCore] Failed to recreate multi-block range:', e);
    }
  }
  return null;
};


export {
  getOffsetInBlock,
  getNodeFromOffsetInBlock,
  getRangeBlockOffsets,
  recreateRangeFromBlockOffsets
};
