import React, { useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Bold, Copy, Italic, Link2, Plus, Trash2 } from 'lucide-react';
import { backendUrl } from '../../api';

const blockLabels = {
  paragraph: 'Paragraph', subheading: 'Subheading', image: 'Image', link: 'Link',
  bulletList: 'Bullet list', numberedList: 'Numbered list', quote: 'Quote', richText: 'Rich text'
};

export function createContentBlock(type) {
  return {
    id: `${Date.now()}-${Math.random()}`,
    type,
    content: '',
    headingLevel: 'h2',
    src: '',
    alt: '',
    caption: '',
    url: '',
    items: type === 'bulletList' || type === 'numberedList' ? [''] : []
  };
}

function safeHref(value) {
  const href = String(value || '').trim();
  if (/^\/uploads\/[a-zA-Z0-9._-]+$/.test(href)) return href;
  try {
    const url = new URL(href);
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : '';
  } catch (error) {
    return '';
  }
}

function inlineContent(value) {
  return String(value || '').split(/(\[[^\]]+\]\((?:https?:\/\/|\/uploads\/)[^)]+\)|\*\*[^*]+\*\*|\*[^*]+\*)/g).map((part, index) => {
    const link = part.match(/^\[([^\]]+)\]\((https?:\/\/[^)]+|\/uploads\/[a-zA-Z0-9._-]+)\)$/);
    if (link && safeHref(link[2])) return <a href={backendUrl(safeHref(link[2]))} target="_blank" rel="noopener noreferrer" key={index}>{link[1]}</a>;
    if (/^\*\*.+\*\*$/.test(part)) return <strong key={index}>{part.slice(2, -2)}</strong>;
    if (/^\*[^*]+\*$/.test(part)) return <em key={index}>{part.slice(1, -1)}</em>;
    return part;
  });
}

export function EventArticle({ blocks = [] }) {
  return <div className="event-article-body">{blocks.map((block, index) => {
    if (block.type === 'subheading') {
      const Heading = block.headingLevel === 'h3' ? 'h3' : 'h2';
      return <Heading key={`${block.position}-${index}`}>{block.content}</Heading>;
    }
    if (block.type === 'image') return <figure key={`${block.position}-${index}`}><img src={backendUrl(safeHref(block.src) || '')} alt={block.alt || ''} loading="lazy" />{block.caption && <figcaption>{block.caption}</figcaption>}</figure>;
    if (block.type === 'link') return <p className="event-article-link" key={`${block.position}-${index}`}><a href={backendUrl(safeHref(block.url) || '#')} target="_blank" rel="noopener noreferrer">{block.content}</a></p>;
    if (block.type === 'bulletList' || block.type === 'numberedList') {
      const List = block.type === 'bulletList' ? 'ul' : 'ol';
      return <List key={`${block.position}-${index}`}>{(block.items || []).map((item, itemIndex) => <li key={itemIndex}>{inlineContent(item)}</li>)}</List>;
    }
    if (block.type === 'quote') return <blockquote key={`${block.position}-${index}`}>{inlineContent(block.content)}</blockquote>;
    return <p key={`${block.position}-${index}`}>{inlineContent(block.content)}</p>;
  })}</div>;
}

function updateAt(blocks, index, changes) {
  return blocks.map((block, blockIndex) => blockIndex === index ? { ...block, ...changes } : block);
}

export default function EventContentEditor({ blocks, onChange, onUploadImage }) {
  const [newType, setNewType] = useState('paragraph');
  const [preview, setPreview] = useState(false);
  const textareas = useRef({});
  const currentBlocks = blocks || [];

  function addBlock(type, index = currentBlocks.length) {
    const next = [...currentBlocks];
    next.splice(index, 0, createContentBlock(type));
    onChange(next);
  }

  function duplicateBlock(index) {
    const next = [...currentBlocks];
    next.splice(index + 1, 0, { ...currentBlocks[index], id: `${Date.now()}-${Math.random()}`, items: [...(currentBlocks[index].items || [])] });
    onChange(next);
  }

  function moveBlock(index, direction) {
    const target = index + direction;
    if (target < 0 || target >= currentBlocks.length) return;
    const next = [...currentBlocks];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  function formatSelection(index, before, after) {
    const textarea = textareas.current[index];
    if (!textarea) return;
    const value = currentBlocks[index].content || '';
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = value.slice(start, end) || 'text';
    const updated = `${value.slice(0, start)}${before}${selected}${after}${value.slice(end)}`;
    onChange(updateAt(currentBlocks, index, { content: updated }));
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(start + before.length, start + before.length + selected.length);
    });
  }

  return <div className="event-content-editor">
    <div className="event-content-tools"><label>Add block<select value={newType} onChange={(event) => setNewType(event.target.value)}>{Object.entries(blockLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><button className="button button-light" type="button" onClick={() => addBlock(newType)}><Plus size={16} />Add content block</button><button className="event-preview-toggle" type="button" aria-pressed={preview} onClick={() => setPreview(!preview)}>{preview ? 'Edit blocks' : 'Preview article'}</button></div>
    {preview ? <EventArticle blocks={currentBlocks} /> : <div className="event-block-list">
      {currentBlocks.map((block, index) => <article className="event-content-block" key={block.id || `${block.position}-${index}`}>
        <div className="event-block-heading"><label>Block type<select value={block.type} onChange={(event) => onChange(updateAt(currentBlocks, index, createContentBlock(event.target.value)))}>{Object.entries(blockLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><div className="event-block-actions"><button type="button" aria-label="Move block up" disabled={index === 0} onClick={() => moveBlock(index, -1)}><ArrowUp size={16} /></button><button type="button" aria-label="Move block down" disabled={index === currentBlocks.length - 1} onClick={() => moveBlock(index, 1)}><ArrowDown size={16} /></button><button type="button" aria-label="Duplicate block" onClick={() => duplicateBlock(index)}><Copy size={16} /></button><button type="button" aria-label="Delete block" onClick={() => onChange(currentBlocks.filter((_, blockIndex) => blockIndex !== index))}><Trash2 size={16} /></button></div></div>
        {block.type === 'subheading' && <label>Heading level<select value={block.headingLevel || 'h2'} onChange={(event) => onChange(updateAt(currentBlocks, index, { headingLevel: event.target.value }))}><option value="h2">H2</option><option value="h3">H3</option></select></label>}
        {['paragraph', 'subheading', 'quote', 'richText'].includes(block.type) && <>
          {block.type === 'richText' && <div className="event-format-toolbar" aria-label="Text formatting"><button type="button" aria-label="Bold" onClick={() => formatSelection(index, '**', '**')}><Bold size={15} /></button><button type="button" aria-label="Italic" onClick={() => formatSelection(index, '*', '*')}><Italic size={15} /></button><button type="button" aria-label="Insert link" onClick={() => formatSelection(index, '[', '](https://example.com)')}><Link2 size={15} /></button><span>Links use a URL in the format [text](https://…)</span></div>}
          <textarea ref={(textarea) => { textareas.current[index] = textarea; }} value={block.content || ''} onChange={(event) => onChange(updateAt(currentBlocks, index, { content: event.target.value }))} rows={block.type === 'subheading' ? 2 : 4} maxLength={block.type === 'subheading' ? 140 : 12000} aria-label={`${blockLabels[block.type]} content`} />
        </>}
        {block.type === 'image' && <div className="event-image-fields"><label>Image URL<input value={block.src || ''} onChange={(event) => onChange(updateAt(currentBlocks, index, { src: event.target.value }))} placeholder="https:// or upload an image" /></label><label>Upload image<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(event) => { void onUploadImage(event.target.files?.[0], (src) => onChange(updateAt(currentBlocks, index, { src }))); }} /></label><label>Alt text<input value={block.alt || ''} onChange={(event) => onChange(updateAt(currentBlocks, index, { alt: event.target.value }))} maxLength={300} /></label><label>Caption<input value={block.caption || ''} onChange={(event) => onChange(updateAt(currentBlocks, index, { caption: event.target.value }))} maxLength={500} /></label>{block.src && <img className="event-block-image-preview" src={backendUrl(safeHref(block.src))} alt={block.alt || 'Article image preview'} />}</div>}
        {block.type === 'link' && <div className="event-link-fields"><label>Link text<input value={block.content || ''} onChange={(event) => onChange(updateAt(currentBlocks, index, { content: event.target.value }))} maxLength={500} /></label><label>URL<input type="url" value={block.url || ''} onChange={(event) => onChange(updateAt(currentBlocks, index, { url: event.target.value }))} placeholder="https://" /></label></div>}
        {(block.type === 'bulletList' || block.type === 'numberedList') && <label>List items<textarea value={(block.items || []).join('\n')} onChange={(event) => onChange(updateAt(currentBlocks, index, { items: event.target.value.split('\n') }))} rows={4} aria-label="List items, one per line" /></label>}
        <button className="event-add-below" type="button" onClick={() => addBlock(newType, index + 1)}><Plus size={14} />Add block below</button>
      </article>)}
      {!currentBlocks.length && <p className="event-block-empty">Start with a paragraph, heading, or any other article block.</p>}
    </div>}
  </div>;
}