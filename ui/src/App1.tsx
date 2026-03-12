import React, { useEffect, useState } from 'react';
import { Upload, Send, FileText, Trash2, CheckCircle2, AlertTriangle, Loader2, Settings, BookOpen, Filter, Sparkles, X } from 'lucide-react';
function renderMarkdown(md: string) {
  const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!));
  let s = esc(md);
  s = s.replace(/```([\s\S]*?)```/g, (_m, code) => `<pre class='bg-zinc-900 text-zinc-100 p-4 rounded-xl overflow-auto text-sm'>${esc(code)}</pre>`);
  s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^*])\*(?!\*)(.+?)\*(?!\*)/g, '$1<em>$2</em>');
  s = s.replace(/`([^`]+)`/g, '<code class="px-1.5 py-0.5 bg-zinc-100 rounded-md border border-zinc-200">$1</code>');
  s = s.replace(/\n/g, '<br/>');
  return s;
}
type Source = { source: string; page: number; score?: number };
type ChatItem = { role: 'user' | 'assistant'; content: string; sources?: Source[]; ts: number };
const niceBytes = (n: number) => { if (!n && n !== 0) return ''; const u=['B','KB','MB','GB']; let i=0,x=n; while(x>=1024&&i<u.length-1){x/=1024;i++;} return `${x.toFixed(1)} ${u[i]}`; };
export default function App() {
  const [files, setFiles] = useState<File[]>([]);
  const [indexedCount, setIndexedCount] = useState<number>(0);
  const [busyUpload, setBusyUpload] = useState(false);
  const [busyAsk, setBusyAsk] = useState(false);
  const [health, setHealth] = useState<string>('');
  const [query, setQuery] = useState<string>('');
  const [chat, setChat] = useState<ChatItem[]>([]);
  const [topK, setTopK] = useState<number>(5);
  const [strict, setStrict] = useState<boolean>(true);
  const [alpha, setAlpha] = useState<number>(0.6);
  const [retrieveK, setRetrieveK] = useState<number>(30);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [filterDocs, setFilterDocs] = useState<string[]>([]);
  useEffect(()=>{ fetch('/health').then(r=>r.json()).then(j=>setHealth(j.status||'ok')).catch(()=>setHealth('')); },[]);
  const onDrop=(ev:React.DragEvent)=>{ ev.preventDefault(); const list=Array.from(ev.dataTransfer.files||[]).filter(f=> f.type==='application/pdf'||f.name.toLowerCase().endsWith('.pdf')); setFiles(p=>[...p,...list]); };
  const removeFile=(name:string)=> setFiles(p=>p.filter(f=>f.name!==name));
  const doUpload=async()=>{ if(!files.length)return; setBusyUpload(true); try{ const fd=new FormData(); files.forEach(f=>fd.append('files',f)); const res=await fetch('/api/upload',{method:'POST',body:fd}); const data=await res.json(); setIndexedCount((data&&data.chunks_indexed)||0);}catch(e){console.error(e); alert('Upload failed. Check server logs.');} finally{ setBusyUpload(false);} };
  const doAsk=async()=>{ if(!query.trim())return; setBusyAsk(true); const userMsg:ChatItem={role:'user',content:query,ts:Date.now()}; setChat(p=>[...p,userMsg]); try{ let hint=''; if(strict) hint+='[STRICT]\n'; hint+=`[RETRIEVE_K=${retrieveK}; TOP_K=${topK}; ALPHA=${alpha}]\n`; if(filterDocs.length) hint+=`[DOCS=${filterDocs.join(',')}]\n`; const res=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'}, body: JSON.stringify({message: hint+query})}); const data=await res.json(); const botMsg:ChatItem={role:'assistant',content:data.answer||'(no answer)',sources:data.sources||[], ts:Date.now()}; setChat(p=>[...p,botMsg]); }catch(e){console.error(e); setChat(p=>[...p,{role:'assistant',content:'Sorry — something went wrong. Check the server.', ts:Date.now()}]);} finally{ setBusyAsk(false);} };
  const clearChat=()=> setChat([]);
  return (<div className='min-h-screen bg-gradient-to-b from-zinc-50 to-zinc-100'>
    <header className='sticky top-0 z-10 border-b border-zinc-200 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60'>
      <div className='max-w-6xl mx-auto px-4 py-3 flex items-center justify-between'>
        <div className='flex items-center gap-2'><Sparkles className='w-5 h-5 text-indigo-600'/><h1 className='text-lg font-semibold'>RAG Chatbot</h1><span className='ml-2 px-2 py-0.5 text-xs rounded-full border bg-indigo-50 border-indigo-200 text-indigo-700'>Pro UI</span></div>
        <div className='flex items-center gap-3 text-sm text-zinc-600'>
          {health ? (<span className='inline-flex items-center gap-1'><CheckCircle2 className='w-4 h-4 text-emerald-600'/> healthy</span>) : (<span className='inline-flex items-center gap-1'><AlertTriangle className='w-4 h-4 text-amber-600'/> unknown</span>)}
          <button onClick={()=> setShowSettings(v=>!v)} className='inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 hover:bg-zinc-50'><Settings className='w-4 h-4'/> Settings</button>
        </div>
      </div>
    </header>
    {showSettings && (<div className='max-w-6xl mx-auto px-4 mt-4'><div className='rounded-2xl border bg-white shadow-sm p-4'><div className='grid md:grid-cols-3 gap-4'>
      <div><label className='text-sm font-medium'>Top K</label><input type='number' min={1} max={10} value={topK} onChange={e=> setTopK(parseInt(e.target.value||'5',10))} className='mt-1 w-full border rounded-lg px-3 py-2'/></div>
      <div><label className='text-sm font-medium'>Retrieve K (pre-rerank)</label><input type='number' min={5} max={100} value={retrieveK} onChange={e=> setRetrieveK(parseInt(e.target.value||'30',10))} className='mt-1 w-full border rounded-lg px-3 py-2'/></div>
      <div><label className='text-sm font-medium'>Hybrid α (dense weight)</label><input type='number' step='0.05' min={0} max={1} value={alpha} onChange={e=> setAlpha(parseFloat(e.target.value||'0.6'))} className='mt-1 w-full border rounded-lg px-3 py-2'/></div>
      <div className='col-span-full flex items-center gap-3 mt-2'><label className='inline-flex items-center gap-2 cursor-pointer select-none'><input type='checkbox' checked={strict} onChange={e=> setStrict(e.target.checked)} /><span className='text-sm'>Strict answers (only from docs)</span></label><div className='text-xs text-zinc-500'>We send these preferences as hints in your question.</div></div>
    </div></div></div>)}
    <main className='max-w-6xl mx-auto px-4 py-6 grid md:grid-cols-3 gap-6'>
      <section className='md:col-span-1'>
        <div className='rounded-2xl border bg-white shadow-sm'>
          <div className='p-4 border-b flex items-center justify-between'>
            <div className='flex items-center gap-2'><Upload className='w-4 h-4'/><span className='font-medium'>Upload PDFs</span></div>
            <button onClick={()=> setFiles([])} className='text-zinc-500 hover:text-zinc-700'><Trash2 className='w-4 h-4'/></button>
          </div>
          <div className='p-4'>
            <div onDrop={onDrop} onDragOver={(e)=>e.preventDefault()} className='border-2 border-dashed rounded-xl p-6 text-center hover:bg-zinc-50'>
              <p className='text-sm text-zinc-600'>Drag & drop documents here or click to choose</p>
              <input type='file' accept='application/pdf,.pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.docx' multiple onChange={(e)=> setFiles(p=>[...p, ...Array.from(e.target.files||[])])} className='mt-3'/>
            </div>
            {!!files.length && (<div className='mt-4 space-y-2 max-h-56 overflow-auto'>
              {files.map(f=> (<div key={f.name} className='flex items-center justify-between text-sm border rounded-lg px-3 py-2'>
                <div className='flex items-center gap-2'><FileText className='w-4 h-4'/> {f.name} <span className='text-zinc-400'>({(f as any).size ? (Math.round(((f as any).size/1024/1024)*10)/10)+' MB' : ''})</span></div>
                <button onClick={()=> setFiles(p=>p.filter(x=>x.name!==f.name))} className='text-zinc-500 hover:text-zinc-700'><X className='w-4 h-4'/></button>
              </div>))}
            </div>)}
            <button disabled={!files.length || busyUpload} onClick={doUpload} className='mt-4 w-full inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-2 bg-zinc-900 text-white hover:bg-black'>
              {busyUpload ? <Loader2 className='w-4 h-4 animate-spin'/> : <Upload className='w-4 h-4'/>}
              {busyUpload ? 'Indexing...' : 'Upload & Index'}
            </button>
            {!!indexedCount && <div className='text-xs text-zinc-600 mt-2'>Indexed <b>{indexedCount}</b> chunks</div>}
          </div>
        </div>
        <div className='rounded-2xl border bg-white shadow-sm mt-6'>
          <div className='p-4 border-b flex items-center gap-2'><Filter className='w-4 h-4'/><span className='font-medium'>Filters (hint-only)</span></div>
          <div className='p-4'>
            <div className='text-xs text-zinc-500 mb-2'>Type file names (comma-separated) to bias answers toward those files.</div>
            <input className='w-full border rounded-lg px-3 py-2' placeholder='e.g. Handbook.pdf, Policy.pdf' onChange={(e)=> setFilterDocs((e.target as any).value.split(',').map((s:string)=>s.trim()).filter(Boolean))}/>
          </div>
        </div>
      </section>
      <section className='md:col-span-2'>
        <div className='rounded-2xl border bg-white shadow-sm flex flex-col h-[78vh]'>
          <div className='p-4 border-b flex items-center gap-2'><BookOpen className='w-4 h-4'/><span className='font-medium'>Chat</span></div>
          <div className='flex-1 overflow-auto p-4 space-y-4'>
            {!chat.length && (<div className='text-sm text-zinc-500'>Ask focused questions for the best results. Try: <code className='px-1 py-0.5 bg-zinc-100 rounded'>'Show a recursive CTE example to walk a parent-child hierarchy'</code></div>)}
            {chat.map((m,i)=> (<div key={m.ts+i} className={m.role==='user' ? 'text-right' : 'text-left'}>
              <div className={'inline-block max-w-[85%] px-4 py-3 rounded-2xl border ' + (m.role==='user' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-zinc-50')}>
                {m.role==='assistant' ? (<div dangerouslySetInnerHTML={{ __html: renderMarkdown(m.content) }} />) : (<div>{m.content}</div>)}
              </div>
              {m.sources && !!m.sources.length && (<div className='mt-2 text-xs text-zinc-600'><b>Sources:</b> {m.sources.map((s,idx)=>(<span key={idx} className='inline-flex items-center gap-1 mr-2 px-2 py-0.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700'><FileText className='w-3 h-3'/> {s.source} p.{s.page}</span>))}</div>)}
            </div>))}
          </div>
          <div className='p-3 border-t'>
            <div className='flex items-center gap-2'>
              <input value={query} onChange={(e)=> setQuery((e.target as any).value)} onKeyDown={(e:any)=>{ if(e.key==='Enter' && !e.shiftKey){ e.preventDefault(); doAsk(); } }} placeholder='Ask a question about your PDFs...' className='flex-1 border rounded-xl px-4 py-3'/>
              <button onClick={doAsk} disabled={busyAsk} className='inline-flex items-center gap-2 rounded-xl border px-4 py-3 bg-zinc-900 text-white hover:bg-black'>
                {busyAsk ? <Loader2 className='w-4 h-4 animate-spin'/> : <Send className='w-4 h-4'/>}Ask
              </button>
              <button onClick={clearChat} className='inline-flex items-center gap-2 rounded-xl border px-4 py-3 bg-white hover:bg-zinc-50'>
                <Trash2 className='w-4 h-4'/> Clear
              </button>
            </div>
          </div>
        </div>
      </section>
    </main>
  </div>);
}
