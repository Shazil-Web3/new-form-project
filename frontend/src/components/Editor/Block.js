// components/Editor/Block.js
import React from 'react';
import { BLOCK_TYPES } from './DocumentEngine';
import { BlockContentExtractor } from './PasteHandler';
import { sanitizeHtml } from '../../utils/sanitizeHtml';

const Block = ({ 
  block, 
  blockIndex, 
  pageIndex, 
  onChange, 
  onKeyDown, 
  onPaste 
}) => {
  const handleInput = (e) => {
    const content = extractContentFromElement(e.target, block.type);
    onChange(block.id, content, pageIndex, blockIndex);
  };

  const handleKeyDown = (e) => {
    onKeyDown(e, block, pageIndex, blockIndex);
  };

  const handlePaste = (e) => {
    onPaste(e, block, pageIndex, blockIndex);
  };

  const extractContentFromElement = (element, blockType) => {
    return BlockContentExtractor.extractContentFromElement(element, blockType);
  };

  const renderBlock = () => {
    const commonProps = {
      'data-block-id': block.id,
      'data-block-type': block.type,
      contentEditable: true,
      onInput: handleInput,
      onKeyDown: handleKeyDown,
      onPaste: handlePaste,
      suppressContentEditableWarning: true
    };

    switch (block.type) {
      case BLOCK_TYPES.PARAGRAPH:
        return (
          <p {...commonProps} dangerouslySetInnerHTML={{ __html: sanitizeHtml(block.content) }}>
          </p>
        );

      case BLOCK_TYPES.HEADING:
        const HeadingTag = `h${block.metadata?.level || 1}`;
        return React.createElement(HeadingTag, { ...commonProps, dangerouslySetInnerHTML: { __html: sanitizeHtml(block.content) } });

      case BLOCK_TYPES.LIST:
        const ListTag = block.metadata?.listType === 'numbered' ? 'ol' : 'ul';
        const listClassName = block.metadata?.listType === 'numbered' ? 'custom-numbered-list' : '';
        
        return React.createElement(
          ListTag,
          {
            ...commonProps,
            className: listClassName
          },
          (Array.isArray(block.content) ? block.content : []).map((item, index) => (
            <li key={index} dangerouslySetInnerHTML={{ __html: sanitizeHtml(item) }}></li>
          ))
        );

      case BLOCK_TYPES.QUOTE:
        return (
          <blockquote {...commonProps} dangerouslySetInnerHTML={{ __html: sanitizeHtml(block.content) }}>
          </blockquote>
        );

      case BLOCK_TYPES.CODE:
        return (
          <pre {...commonProps}>
            <code dangerouslySetInnerHTML={{ __html: sanitizeHtml(block.content) }}></code>
          </pre>
        );

      case BLOCK_TYPES.DIVIDER:
        return (
          <hr {...commonProps} contentEditable={false} />
        );

      case BLOCK_TYPES.IMAGE:
        return (
          <img
            {...commonProps}
            src={block.content}
            alt={block.metadata?.alt || ''}
            title={block.metadata?.title || ''}
            width={block.metadata?.width}
            height={block.metadata?.height}
            contentEditable={false}
          />
        );

      case BLOCK_TYPES.TABLE: {
        const { headers = [], rows = [] } = block.content || { headers: [], rows: [] };
        return (
          <table {...commonProps} data-continued={block.metadata?.continuedFrom ? 'true' : undefined}>
            {headers.length > 0 && (
              <thead>
                <tr>
                  {headers.map((h, i) => <th key={i} dangerouslySetInnerHTML={{ __html: sanitizeHtml(h) }} />)}
                </tr>
              </thead>
            )}
            <tbody>
              {rows.map((row, rIdx) => (
                <tr key={rIdx}>
                  {row.map((cell, cIdx) => <td key={cIdx} dangerouslySetInnerHTML={{ __html: sanitizeHtml(cell) }} />)}
                </tr>
              ))}
            </tbody>
          </table>
        );
      }

      default:
        return (
          <p {...commonProps} dangerouslySetInnerHTML={{ __html: sanitizeHtml(block.content) }}>
          </p>
        );
    }
  };

  return (
    <div className="block-wrapper">
      {renderBlock()}
    </div>
  );
};

export default Block;