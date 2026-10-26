import React from 'react';
import CopyToClipboard from '../../components/CopyToClipboard';

export default function FeedbackEmailModal({ learnerName, learnerEmail, senderName: initSenderName, senderEmail: initSenderEmail, onGenerate, onClose }) {
  const [senderName, setSenderName] = React.useState(initSenderName || '');
  const [replyEmail, setReplyEmail] = React.useState(initSenderEmail || '');
  const [subject, setSubject] = React.useState('');
  const [body, setBody] = React.useState('');
  const [generating, setGenerating] = React.useState(false);
  const [generated, setGenerated] = React.useState(false);
  const dialogRef = React.useRef(null);

  React.useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  function handleClose() {
    dialogRef.current?.close();
    onClose?.();
  }

  async function handleGenerate() {
    setGenerating(true);
    try {
      const result = await onGenerate(senderName);
      setSubject(result?.subject || '');
      setBody(result?.body || '');
    } catch {
      setBody('Failed to generate email. Please try again.');
    } finally {
      setGenerating(false);
      setGenerated(true);
    }
  }

  const copyText = `To: ${learnerEmail}\nFrom: ${senderName}\nReply-To: ${replyEmail}\nSubject: ${subject}\n\n${body}`;

  return (
    <dialog ref={dialogRef} className="w-full max-w-2xl p-6 rounded-lg shadow-xl mt-12 mx-auto backdrop:bg-black/40" onClose={onClose}>
      <h2 className="text-lg font-semibold text-gray-800 mb-4">Feedback Email for {learnerName}</h2>

      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">From name</label>
            <input value={senderName} onChange={(e) => setSenderName(e.target.value)} disabled={generating} className="w-full rounded-md border border-gray-200 px-3 py-1.5 text-sm disabled:opacity-60" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Reply-to email</label>
            <input type="email" value={replyEmail} onChange={(e) => setReplyEmail(e.target.value)} disabled={generating} className="w-full rounded-md border border-gray-200 px-3 py-1.5 text-sm disabled:opacity-60" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">To</label>
          <input readOnly value={learnerEmail} className="w-full rounded-md border border-gray-100 bg-gray-50 px-3 py-1.5 text-sm text-gray-500" />
        </div>

        {(generated || generating) && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
              {generating ? (
                <div className="h-8 bg-gray-100 rounded animate-pulse" />
              ) : (
                <input value={subject} onChange={(e) => setSubject(e.target.value)} className="w-full rounded-md border border-gray-200 px-3 py-1.5 text-sm" />
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
              {generating ? (
                <div className="h-48 bg-gray-100 rounded animate-pulse" />
              ) : (
                <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={10} className="w-full rounded-md border border-gray-200 px-3 py-1.5 text-sm font-mono resize-y" />
              )}
            </div>
          </>
        )}
      </div>

      <div className="flex justify-end gap-2 mt-4">
        <button type="button" onClick={handleClose} className="px-3 py-1.5 text-sm rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50">
          Close
        </button>
        <button type="button" onClick={handleGenerate} disabled={generating} className="px-3 py-1.5 text-sm rounded-md bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50">
          {generating ? 'Generating...' : generated ? 'Regenerate' : 'Generate'}
        </button>
        {generated && !generating && <CopyToClipboard position="inline" text={copyText} />}
      </div>
    </dialog>
  );
}
