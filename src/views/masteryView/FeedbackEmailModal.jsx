import React from 'react';
import CopyToClipboard from '../../components/CopyToClipboard';
import Modal from '../../components/ui/Modal.jsx';
import Button from '../../components/ui/Button.jsx';
import Input from '../../components/ui/Input.jsx';
import Textarea from '../../components/ui/Textarea.jsx';

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
    <Modal dialogRef={dialogRef} size="xl" title={`Feedback Email for ${learnerName}`} titleClassName="text-lg font-semibold text-gray-800 mb-4" onClose={onClose}>
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">From name</label>
            <Input value={senderName} onChange={(e) => setSenderName(e.target.value)} disabled={generating} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Reply-to email</label>
            <Input type="email" value={replyEmail} onChange={(e) => setReplyEmail(e.target.value)} disabled={generating} />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">To</label>
          <input readOnly value={learnerEmail} className="w-full rounded-md border border-gray-100 bg-gray-50 px-3 py-2 text-sm text-gray-500" />
        </div>

        {(generated || generating) && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
              {generating ? (
                <div className="h-8 bg-gray-100 rounded animate-pulse" />
              ) : (
                <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
              {generating ? (
                <div className="h-48 bg-gray-100 rounded animate-pulse" />
              ) : (
                <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={10} className="font-mono" />
              )}
            </div>
          </>
        )}
      </div>

      <div className="flex justify-end gap-2 mt-4">
        <Button type="button" variant="secondary" size="sm" onClick={handleClose}>
          Close
        </Button>
        <Button type="button" size="sm" onClick={handleGenerate} disabled={generating}>
          {generating ? 'Generating...' : generated ? 'Regenerate' : 'Generate'}
        </Button>
        {generated && !generating && <CopyToClipboard position="inline" text={copyText} />}
      </div>
    </Modal>
  );
}
