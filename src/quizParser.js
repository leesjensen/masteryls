export default function parseQuiz(html, submitCallbackName = 'onMasteryLSSubmit') {
  // --- helpers --------------------------------------------------------------
  const decodeHtml = (s) =>
    s
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");

  const escapeHtml = (str) => str.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

  // Minimal inline Markdown: images, links, bold, italics
  const renderInline = (md) => {
    let s = escapeHtml(md);
    s = s.replace(/!\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/g, (_, alt, url) => `<img src="${url}" alt="${escapeHtml(alt)}" loading="lazy" decoding="async">`);
    s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, (_, t, url) => `<a href="${url}" target="_blank" rel="noopener">${t}</a>`);
    s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/_(.+?)_/g, '<em>$1</em>');
    return s;
  };

  const parseBlock = (raw) => {
    const text = raw.replace(/\r/g, '');
    // grab first {...} as metadata json
    let meta = {};
    const braceStart = text.indexOf('{');
    if (braceStart !== -1) {
      // naive: find matching first closing brace after start on the same line
      const lineEnd = text.indexOf('\n', braceStart);
      const end = lineEnd === -1 ? text.length : lineEnd;
      const cand = text.slice(braceStart, end);
      try {
        meta = JSON.parse(cand);
      } catch (_) {
        /* ignore bad JSON */
      }
    }

    const options = [];
    text.split('\n').forEach((line) => {
      const m = line.match(/^\s*-\s*\[( |x|X)\]\s+(.*)$/);
      if (m) options.push({ correct: m[1].toLowerCase() === 'x', label: m[2] });
    });
    if (!options.length) throw new Error('No quiz options found.');

    const correctCount = options.filter((o) => o.correct).length;
    const kind = correctCount > 1 ? 'multiple' : 'single';
    return { meta, options, kind };
  };

  let quizSeq = 0;

  const buildQuizHTML = ({ meta, options, kind }) => {
    const id = `mls-${++quizSeq}`;
    const groupName = `${id}-grp`;
    // Store meta JSON on the root as URI-encoded
    const encodedMeta = encodeURIComponent(JSON.stringify(meta));

    const items = options
      .map((opt, i) => {
        const type = kind === 'single' ? 'radio' : 'checkbox';
        const checkedAttr = ''; // not pre-checked
        const input = `<input class="mls-input" type="${type}" name="${groupName}" value="${i}" data-correct="${opt.correct}" ${checkedAttr}>`;
        const label = `<label class="mls-label">${input}<span class="mls-text">${renderInline(opt.label || '')}</span></label>`;
        return `<li class="mls-item">${label}</li>`;
      })
      .join('');

    // Inline onclick handler (no extra JS required). It:
    // - finds inputs, computes correctness,
    // - toggles feedback classes & locks inputs,
    // - calls window[submitCallbackName](payload)
    const onClick = `;(function(btn){` + `var root=btn.closest('.mls-quiz');` + `var inputs=[].slice.call(root.querySelectorAll('.mls-input'));` + `if(!inputs.length)return;` + `var selected=[], correct=[];` + `inputs.forEach(function(el,i){ if(el.dataset.correct==='true') correct.push(i); if(el.checked) selected.push(i); });` + `if(!selected.length){ var r=root.querySelector('.mls-result'); if(r) r.textContent='Pick an answer first.'; return; }` + `var isCorrect=(selected.length===correct.length)&&correct.every(function(i){return selected.indexOf(i)!==-1;});` + `inputs.forEach(function(el,i){ var li=el.closest('.mls-item'); if(!li) return; li.classList.remove('is-correct','is-incorrect','is-incorrect-missed'); ` + `var sel=el.checked, tru=(el.dataset.correct==='true');` + `if(sel&&tru) li.classList.add('is-correct');` + `if(sel&&!tru) li.classList.add('is-incorrect');` + `if(!sel&&tru&&correct.length>1) li.classList.add('is-incorrect-missed');` + `el.disabled=true; });` + `var res=root.querySelector('.mls-result'); if(res) res.textContent=isCorrect?'✅ Correct!':'❌ Not quite.';` + `btn.hidden=true; var rb=root.querySelector('.mls-reset'); if(rb) rb.hidden=false;` + `var meta=JSON.parse(decodeURIComponent(root.dataset.meta||'%7B%7D'));` + `var cb='${submitCallbackName}';` + `if(window[cb]){ try{ window[cb]({ id:'${id}', meta:meta, isCorrect:isCorrect, selectedIndexes:selected, correctIndexes:correct }); }catch(e){ console&&console.error&&console.error(e); } }` + `})(this);`;

    const onReset = `;(function(btn){var root=btn.closest('.mls-quiz');var inputs=root.querySelectorAll('.mls-input');` + `inputs.forEach?inputs.forEach(function(i){i.checked=false;i.disabled=false;}):[].slice.call(inputs).forEach(function(i){i.checked=false;i.disabled=false;});` + `root.querySelectorAll('.mls-item').forEach?root.querySelectorAll('.mls-item').forEach(function(li){li.classList.remove('is-correct','is-incorrect','is-incorrect-missed');}):0;` + `var res=root.querySelector('.mls-result'); if(res) res.textContent='';` + `var sb=root.querySelector('.mls-submit'); if(sb) sb.hidden=false; btn.hidden=true; })(this);`;

    return `<div class="mls-quiz" data-meta="${encodedMeta}" role="group" aria-label="${escapeHtml(meta.title || 'quiz')}">
  <ul class="mls-list">
    ${items}
  </ul>
  <div class="mls-actions">
    <button type="button" class="mls-submit" onclick="${onClick.replace(/"/g, '&quot;')}">Submit</button>
    <button type="button" class="mls-reset" onclick="${onReset.replace(/"/g, '&quot;')}" hidden>Reset</button>
  </div>
  <div class="mls-result" aria-live="polite"></div>
</div>`;
  };

  // ensure styles are present once
  const ensureStyles = (h) => {
    if (h.includes('id="mls-styles"')) return h;
    const css = `<style id="mls-styles">
.mls-quiz{border:1px solid #e5e7eb;border-radius:12px;padding:12px;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.04);margin:8px 0;}
.mls-list{list-style:none;margin:0 0 12px 0;padding:0;}
.mls-item{padding:6px 8px;border-radius:8px;}
.mls-item+.mls-item{margin-top:6px;}
.mls-label{display:grid;grid-template-columns:auto 1fr;gap:8px;align-items:start;cursor:pointer;}
.mls-input{margin-top:3px;}
.mls-text img{max-width:100%;height:auto;display:block;margin-top:4px;border-radius:6px;}
.mls-actions{display:flex;gap:8px;align-items:center;}
.mls-submit,.mls-reset{padding:6px 10px;border-radius:8px;border:1px solid #d1d5db;background:#f8fafc;cursor:pointer;}
.mls-submit:hover,.mls-reset:hover{background:#f1f5f9;}
.mls-result{margin-top:6px;font-weight:600;}
.mls-item.is-correct{outline:2px solid #22c55e;background:rgba(34,197,94,.08);}
.mls-item.is-incorrect,.mls-item.is-incorrect-missed{outline:2px solid #ef4444;background:rgba(239,68,68,.08);}
</style>`;
    // inject right before </head> if present, else prepend
    return h.replace(/<\/head>/i, (m) => css + m) || css + h;
  };

  // --- main transform -------------------------------------------------------
  const PRE_RE = /<pre\b[^>]*\blang=['"]masteryls['"][^>]*>[\s\S]*?<\/pre>/gi;

  const replaced = html.replace(PRE_RE, (preBlock) => {
    // prefer <code> inner text if present
    const codeMatch = preBlock.match(/<code\b[^>]*>([\s\S]*?)<\/code>/i);
    const raw = decodeHtml(codeMatch ? codeMatch[1] : preBlock.replace(/^<pre[^>]*>|<\/pre>$/gi, ''));
    try {
      const quiz = parseBlock(raw.trim());
      return buildQuizHTML(quiz);
    } catch (_) {
      // if parsing fails, keep original block
      return preBlock;
    }
  });

  return ensureStyles(replaced);
}
