// components/Editor/Page.js
import React from 'react';
import Block from './Block';
import PageLayout from './PageLayout';

const Page = ({ 
  page, 
  pageIndex, 
  paperSize, 
  onBlockChange, 
  onBlockKeyDown, 
  onBlockPaste,
  onPageClick,
  onKeyDown
}) => {
  return (
    <PageLayout
      paperSize={paperSize}
      pageIndex={pageIndex}
      onPageClick={onPageClick}
      onKeyDown={onKeyDown}
    >
      {page.blocks.map((block, blockIndex) => (
        <Block
          key={block.id}
          block={block}
          blockIndex={blockIndex}
          pageIndex={pageIndex}
          onChange={onBlockChange}
          onKeyDown={onBlockKeyDown}
          onPaste={onBlockPaste}
        />
      ))}
    </PageLayout>
  );
};

export default Page;