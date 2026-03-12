// Force rebuild: v3.0.1 - Fixed infinite polling loop
import React, { useEffect, useState } from 'react';
import { Upload, Send, FileText, Trash2, CheckCircle2, AlertTriangle, Loader2, BookOpen, X } from 'lucide-react';

function renderMarkdown(md: string) {
  const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!));

  let s = md;

  // Process tables - more flexible regex that handles tables with or without leading newline
  s = s.replace(/(?:^|\n)\|(.+)\|\n\|[-:\s|]+\|\n((?:\|.+\|(?:\n|$))+)/gm, (match, header, rows) => {
    const headers = header.split('|').map((h: string) => h.trim()).filter((h: string) => h);
    const rowData = rows.trim().split('\n').map((row: string) =>
      row.split('|').map((cell: string) => cell.trim()).filter((cell: string) => cell)
    );

    let table = "<div class='overflow-x-auto my-4'><table class='min-w-full border-collapse border border-zinc-300 text-sm'>";
    table += "<thead class='bg-indigo-50'><tr>";
    headers.forEach((h: string) => {
      table += `<th class='border border-zinc-300 px-4 py-2 text-left font-semibold text-indigo-900'>${esc(h)}</th>`;
    });
    table += "</tr></thead><tbody>";
    rowData.forEach((row: string[], idx: number) => {
      const bgClass = idx % 2 === 0 ? 'bg-white' : 'bg-zinc-50';
      table += `<tr class='${bgClass} hover:bg-indigo-50'>`;
      row.forEach((cell: string) => {
        table += `<td class='border border-zinc-300 px-4 py-2'>${esc(cell)}</td>`;
      });
      table += "</tr>";
    });
    table += "</tbody></table></div>";
    return '\n' + table + '\n';
  });

  // Escape HTML for non-table content
  const parts = s.split(/(<div class='overflow-x-auto[\s\S]*?<\/div>)/g);
  s = parts.map((part, i) => {
    if (i % 2 === 0) {
      // Not a table, apply escaping and other formatting
      let p = esc(part);

      // Headings
      p = p.replace(/^## (.+)$/gm, '<h2 class="text-lg font-bold mt-4 mb-2">$1</h2>');
      p = p.replace(/^### (.+)$/gm, '<h3 class="text-base font-semibold mt-3 mb-2">$1</h3>');

      // Code blocks
      p = p.replace(/```([\s\S]*?)```/g, (_m, code) => `<pre class='bg-zinc-900 text-zinc-100 p-4 rounded-xl overflow-auto text-sm my-3'>${esc(code)}</pre>`);

      // Bold and italic
      p = p.replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold">$1</strong>');
      p = p.replace(/(^|[^*])\*(?!\*)(.+?)\*(?!\*)/g, '$1<em>$2</em>');

      // Inline code
      p = p.replace(/`([^`]+)`/g, '<code class="px-1.5 py-0.5 bg-zinc-100 rounded-md border border-zinc-200 text-sm">$1</code>');

      // Line breaks
      p = p.replace(/\n/g, '<br/>');

      return p;
    }
    return part; // Return table as-is
  }).join('');

  return s;
}

type Source = { source: string; page: number; score?: number };
type ChatItem = { role: 'user' | 'assistant'; content: string; sources?: Source[]; ts: number };
type UploadStatus = {
  filename: string;
  stage: string;
  progress: number;
  message: string;
  timestamp: string;
};

export default function App() {
  const [files, setFiles] = useState<File[]>([]);
  const [busyUpload, setBusyUpload] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string>('');
  const [uploadProgress, setUploadProgress] = useState<{[key: string]: UploadStatus}>({});
  const [busyAsk, setBusyAsk] = useState(false);
  const [health, setHealth] = useState<string>('');
  const [query, setQuery] = useState<string>('');
  const [chat, setChat] = useState<ChatItem[]>([]);

  useEffect(() => {
    fetch('/health')
      .then(r => r.json())
      .then(j => setHealth(j.status || 'ok'))
      .catch(() => setHealth(''));
  }, []);

  const onDrop = (ev: React.DragEvent) => {
    ev.preventDefault();
    const list = Array.from(ev.dataTransfer.files || []).filter(
      f => f.type === 'application/pdf' || 
           f.name.toLowerCase().endsWith('.pdf') ||
           f.name.toLowerCase().endsWith('.docx')
    );
    setFiles(p => [...p, ...list]);
  };

  const doUpload = async () => {
    if (!files.length) return;
    
    setBusyUpload(true);
    setUploadMessage('Uploading documents...');
    setUploadProgress({});
    
    try {
      const fd = new FormData();
      files.forEach(f => fd.append('files', f));
      
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const data = await res.json();
      
      if (data.file_ids && data.file_ids.length > 0) {
        setUploadMessage('📤 Documents uploaded! Processing...');
        
        // Poll for progress updates
        const pollInterval = setInterval(async () => {
          try {
            const statusRes = await fetch('/api/upload/status');
            const statusData = await statusRes.json();

            console.log('📊 Status API Response:', statusData);

            if (statusData.files) {
              // Build progress map
              const progressMap: {[key: string]: UploadStatus} = {};
              statusData.files.forEach((f: UploadStatus) => {
                progressMap[f.filename] = f;
              });
              setUploadProgress(progressMap);

              // Check if all done
              const allDone = statusData.files.every(
                (f: UploadStatus) => f.stage === 'completed' || f.stage === 'failed'
              );

              console.log('🔍 All done?', allDone, 'Files:', statusData.files.map((f: UploadStatus) => ({ name: f.filename, stage: f.stage })));

              if (allDone) {
                console.log('✅ Stopping polling - all files done!');
                clearInterval(pollInterval);
                setBusyUpload(false);

                const failedCount = statusData.files.filter((f: UploadStatus) => f.stage === 'failed').length;
                const successCount = statusData.files.filter((f: UploadStatus) => f.stage === 'completed').length;
                
                if (failedCount > 0) {
                  setUploadMessage(`⚠️ ${successCount} succeeded, ${failedCount} failed`);
                } else {
                  setUploadMessage('✅ All documents processed successfully!');
                }
                
                // Clear after 3 seconds
                setTimeout(() => {
                  setFiles([]);
                  setUploadMessage('');
                  setUploadProgress({});
                }, 3000);
              }
            }
          } catch (e) {
            console.error('Progress poll error:', e);
          }
        }, 500); // Poll every 500ms
        
        // Safety timeout after 5 minutes
        setTimeout(() => {
          clearInterval(pollInterval);
          if (busyUpload) {
            setBusyUpload(false);
            setUploadMessage('⚠️ Processing is taking longer than expected. Check server logs.');
          }
        }, 300000);
      } else {
        // No file IDs - old API or error
        setUploadMessage('✅ Documents uploaded! Processing in background...');
        setTimeout(() => {
          setFiles([]);
          setUploadMessage('');
        }, 2000);
        setBusyUpload(false);
      }
      
    } catch (e) {
      console.error(e);
      setUploadMessage('❌ Upload failed. Please try again.');
      setBusyUpload(false);
    }
  };

  const doAsk = async () => {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) return;
    
    setBusyAsk(true);
    const userMsg: ChatItem = { role: 'user', content: trimmedQuery, ts: Date.now() };
    setChat(p => [...p, userMsg]);
    
    // Clear input immediately
    setQuery('');
    
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmedQuery })
      });
      
      const data = await res.json();
      const botMsg: ChatItem = {
        role: 'assistant',
        content: data.answer || '(no answer)',
        sources: data.sources || [],
        ts: Date.now()
      };
      setChat(p => [...p, botMsg]);
    } catch (e) {
      console.error(e);
      setChat(p => [...p, {
        role: 'assistant',
        content: 'Sorry — something went wrong. Check the server.',
        ts: Date.now()
      }]);
    } finally {
      setBusyAsk(false);
    }
  };

  const clearChat = () => setChat([]);

  return (
    <div className='min-h-screen bg-gradient-to-b from-zinc-50 to-zinc-100'>
      {/* Header */}
      <header className='sticky top-0 z-10 border-b border-zinc-200 bg-white/80 backdrop-blur'>
        <div className='max-w-6xl mx-auto px-4 py-3 flex items-center justify-between'>
          <div className='flex items-center gap-2'>
            <FileText className='w-5 h-5 text-indigo-600' />
            <h1 className='text-lg font-semibold'>Document Assistant</h1>
          </div>
          <div className='flex items-center gap-3 text-sm text-zinc-600'>
            {health ? (
              <span className='inline-flex items-center gap-1'>
                <CheckCircle2 className='w-4 h-4 text-emerald-600' /> Online
              </span>
            ) : (
              <span className='inline-flex items-center gap-1'>
                <AlertTriangle className='w-4 h-4 text-amber-600' /> Offline
              </span>
            )}
          </div>
        </div>
      </header>

      <main className='max-w-6xl mx-auto px-4 py-6 grid md:grid-cols-3 gap-6'>
        {/* Upload Section */}
        <section className='md:col-span-1'>
          <div className='rounded-2xl border bg-white shadow-sm'>
            <div className='p-4 border-b flex items-center justify-between'>
              <div className='flex items-center gap-2'>
                <Upload className='w-4 h-4' />
                <span className='font-medium'>Upload Documents</span>
              </div>
              {files.length > 0 && (
                <button onClick={() => setFiles([])} className='text-zinc-500 hover:text-zinc-700'>
                  <Trash2 className='w-4 h-4' />
                </button>
              )}
            </div>
            
            <div className='p-4'>
              {/* Drop Zone */}
              <div
                onDrop={onDrop}
                onDragOver={(e) => e.preventDefault()}
                className='border-2 border-dashed rounded-xl p-6 text-center hover:bg-zinc-50 transition-colors'
              >
                <Upload className='w-8 h-8 mx-auto mb-2 text-zinc-400' />
                <p className='text-sm text-zinc-600 mb-2'>Drag & drop files here</p>
                <input
                  type='file'
                  accept='application/pdf,.pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.docx'
                  multiple
                  onChange={(e) => setFiles(p => [...p, ...Array.from(e.target.files || [])])}
                  className='hidden'
                  id='file-upload'
                />
                <label
                  htmlFor='file-upload'
                  className='inline-block px-4 py-2 text-sm border rounded-lg hover:bg-zinc-50 cursor-pointer'
                >
                  Choose Files
                </label>
              </div>

              {/* File List */}
              {files.length > 0 && (
                <div className='mt-4 space-y-2 max-h-56 overflow-auto'>
                  {files.map(f => (
                    <div key={f.name} className='flex items-center justify-between text-sm border rounded-lg px-3 py-2'>
                      <div className='flex items-center gap-2 flex-1 min-w-0'>
                        <FileText className='w-4 h-4 flex-shrink-0' />
                        <span className='truncate'>{f.name}</span>
                        <span className='text-zinc-400 text-xs flex-shrink-0'>
                          ({Math.round(f.size / 1024)} KB)
                        </span>
                      </div>
                      <button
                        onClick={() => setFiles(p => p.filter(x => x.name !== f.name))}
                        className='text-zinc-500 hover:text-zinc-700 ml-2'
                      >
                        <X className='w-4 h-4' />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Upload Button */}
              <button
                disabled={!files.length || busyUpload}
                onClick={doUpload}
                className='mt-4 w-full inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-2 bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
              >
                {busyUpload ? (
                  <>
                    <Loader2 className='w-4 h-4 animate-spin' />
                    Processing...
                  </>
                ) : (
                  <>
                    <Upload className='w-4 h-4' />
                    Upload & Index
                  </>
                )}
              </button>

              {/* Progress Display */}
              {Object.keys(uploadProgress).length > 0 && (
                <div className='mt-4 space-y-3'>
                  <div className='text-sm font-medium text-zinc-700'>Processing Progress</div>
                  {Object.values(uploadProgress).map((status, idx) => (
                    <div key={idx} className='border rounded-lg p-3 bg-zinc-50'>
                      <div className='flex items-center justify-between mb-2'>
                        <span className='text-sm font-medium truncate flex-1'>
                          {status.filename}
                        </span>
                        <span className='text-xs text-zinc-500 ml-2'>
                          {status.progress}%
                        </span>
                      </div>
                      
                      {/* Progress Bar */}
                      <div className='w-full bg-zinc-200 rounded-full h-2 mb-2'>
                        <div
                          className={`h-2 rounded-full transition-all duration-300 ${
                            status.stage === 'completed' ? 'bg-emerald-500' :
                            status.stage === 'failed' ? 'bg-red-500' :
                            'bg-indigo-600'
                          }`}
                          style={{ width: `${status.progress}%` }}
                        />
                      </div>

                      {/* Status Message */}
                      <div className='flex items-center gap-2'>
                        {status.stage === 'completed' && (
                          <CheckCircle2 className='w-4 h-4 text-emerald-600' />
                        )}
                        {status.stage === 'failed' && (
                          <AlertTriangle className='w-4 h-4 text-red-600' />
                        )}
                        {status.stage !== 'completed' && status.stage !== 'failed' && (
                          <Loader2 className='w-4 h-4 animate-spin text-indigo-600' />
                        )}
                        <span className='text-xs text-zinc-600'>{status.message}</span>
                      </div>
                      
                      {/* Stage Badge */}
                      <div className='mt-2'>
                        <span className={`inline-flex px-2 py-0.5 text-xs rounded-full ${
                          status.stage === 'extracting' ? 'bg-blue-100 text-blue-700' :
                          status.stage === 'chunking' ? 'bg-purple-100 text-purple-700' :
                          status.stage === 'embedding' ? 'bg-yellow-100 text-yellow-700' :
                          status.stage === 'storing' ? 'bg-orange-100 text-orange-700' :
                          status.stage === 'indexing' ? 'bg-pink-100 text-pink-700' :
                          status.stage === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                          status.stage === 'failed' ? 'bg-red-100 text-red-700' :
                          'bg-zinc-100 text-zinc-700'
                        }`}>
                          {status.stage}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Simple Message (when no progress data) */}
              {uploadMessage && Object.keys(uploadProgress).length === 0 && (
                <div className={`mt-3 p-3 rounded-lg text-sm ${
                  uploadMessage.includes('✅') ? 'bg-emerald-50 text-emerald-700' :
                  uploadMessage.includes('❌') ? 'bg-red-50 text-red-700' :
                  uploadMessage.includes('⚠️') ? 'bg-amber-50 text-amber-700' :
                  'bg-blue-50 text-blue-700'
                }`}>
                  {uploadMessage}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Chat Section */}
        <section className='md:col-span-2'>
          <div className='rounded-2xl border bg-white shadow-sm flex flex-col h-[78vh]'>
            <div className='p-4 border-b flex items-center justify-between'>
              <div className='flex items-center gap-2'>
                <BookOpen className='w-4 h-4' />
                <span className='font-medium'>Chat</span>
              </div>
              {chat.length > 0 && (
                <button
                  onClick={clearChat}
                  className='inline-flex items-center gap-2 text-sm text-zinc-600 hover:text-zinc-900'
                >
                  <Trash2 className='w-4 h-4' />
                  Clear
                </button>
              )}
            </div>

            {/* Messages */}
            <div className='flex-1 overflow-auto p-4 space-y-4'>
              {!chat.length && (
                <div className='text-center py-12'>
                  <BookOpen className='w-12 h-12 mx-auto mb-4 text-zinc-300' />
                  <p className='text-zinc-500 mb-2'>No messages yet</p>
                  <p className='text-sm text-zinc-400'>Upload documents and ask questions to get started</p>
                </div>
              )}
              
              {chat.map((m, i) => (
                <div key={m.ts + i} className={m.role === 'user' ? 'text-right' : 'text-left'}>
                  <div className={
                    'inline-block max-w-[85%] px-4 py-3 rounded-2xl border ' +
                    (m.role === 'user' 
                      ? 'bg-indigo-600 text-white border-indigo-600' 
                      : 'bg-zinc-50 border-zinc-200')
                  }>
                    {m.role === 'assistant' ? (
                      <div dangerouslySetInnerHTML={{ __html: renderMarkdown(m.content) }} />
                    ) : (
                      <div>{m.content}</div>
                    )}
                  </div>
                  {m.sources && m.sources.length > 0 && (
                    <div className='mt-3 text-xs'>
                      <div className='inline-block text-left max-w-full'>
                        <div className='text-zinc-600 font-medium mb-2 flex items-center gap-1'>
                          <FileText className='w-3.5 h-3.5' />
                          <span>Sources</span>
                        </div>
                        <div className='flex flex-wrap gap-2'>
                          {(() => {
                            // Remove duplicates and group by source file
                            const uniqueSources = Array.from(
                              new Map(
                                m.sources.map(s => [`${s.source}-${s.page}`, s])
                              ).values()
                            );

                            // Group by filename
                            const grouped = uniqueSources.reduce((acc, s) => {
                              if (!acc[s.source]) acc[s.source] = [];
                              acc[s.source].push(s.page);
                              return acc;
                            }, {} as Record<string, number[]>);

                            return Object.entries(grouped).map(([filename, pages], idx) => {
                              const sortedPages = pages.sort((a, b) => a - b);
                              const pageText = sortedPages.length === 1
                                ? `p.${sortedPages[0]}`
                                : `p.${sortedPages.join(', ')}`;

                              return (
                                <span
                                  key={idx}
                                  className='inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-br from-indigo-50 to-indigo-100 border border-indigo-200 text-indigo-800 hover:shadow-sm transition-shadow'
                                >
                                  <FileText className='w-3.5 h-3.5 flex-shrink-0' />
                                  <span className='font-medium'>{filename}</span>
                                  <span className='text-indigo-600'>({pageText})</span>
                                </span>
                              );
                            });
                          })()}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Input */}
            <div className='p-3 border-t'>
              <div className='flex items-center gap-2'>
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      doAsk();
                    }
                  }}
                  placeholder='Ask a question about your documents...'
                  className='flex-1 border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500'
                  disabled={busyAsk}
                />
                <button
                  onClick={doAsk}
                  disabled={busyAsk || !query.trim()}
                  className='inline-flex items-center gap-2 rounded-xl px-6 py-3 bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
                >
                  {busyAsk ? (
                    <Loader2 className='w-4 h-4 animate-spin' />
                  ) : (
                    <Send className='w-4 h-4' />
                  )}
                  Send
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
