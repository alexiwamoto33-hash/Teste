/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI } from "@google/genai";
import { motion, AnimatePresence } from 'motion/react';
import { 
  Send, 
  Cpu, 
  Zap, 
  Brain, 
  Sparkles, 
  Terminal, 
  Copy, 
  Check, 
  AlertCircle,
  Loader2,
  RefreshCw,
  ChevronRight,
  History,
  Trash2,
  X,
  Clock
} from 'lucide-react';

// Initialize Gemini
const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

interface AIResponse {
  model: string;
  text: string;
  loading: boolean;
  error?: string;
  icon: React.ReactNode;
  color: string;
}

interface HistoryItem {
  id: string;
  timestamp: number;
  prompt: string;
  responses: { model: string; text: string; error?: string }[];
  consensus: string;
}

export default function App() {
  const [prompt, setPrompt] = useState('');
  const [isConsulting, setIsConsulting] = useState(false);
  const [responses, setResponses] = useState<AIResponse[]>([
    { model: 'Gemini 2.5 Flash', text: '', loading: false, icon: <Sparkles className="w-4 h-4" />, color: 'text-blue-400' },
    { model: 'GPT-5.4 (OpenAI)', text: '', loading: false, icon: <Brain className="w-4 h-4" />, color: 'text-green-400' },
    { model: 'Claude Sonnet 4.6', text: '', loading: false, icon: <Cpu className="w-4 h-4" />, color: 'text-orange-400' },
    { model: 'Grok 4.20 (xAI)', text: '', loading: false, icon: <Zap className="w-4 h-4" />, color: 'text-purple-400' },
  ]);
  const [consensus, setConsensus] = useState('');
  const [copied, setCopied] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load history from localStorage on mount
  useEffect(() => {
    const savedHistory = localStorage.getItem('omnisolver_history');
    if (savedHistory) {
      try {
        setHistory(JSON.parse(savedHistory));
      } catch (e) {
        console.error('Failed to parse history', e);
      }
    }
  }, []);

  // Save history to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('omnisolver_history', JSON.stringify(history));
  }, [history]);

  const updateResponse = (modelName: string, updates: Partial<AIResponse>) => {
    setResponses(prev => prev.map(r => r.model === modelName ? { ...r, ...updates } : r));
  };

  const getGeminiResponse = async (userPrompt: string) => {
    updateResponse('Gemini 2.5 Flash', { loading: true, error: undefined, text: '' });
    try {
      const response = await genAI.models.generateContent({
        model: 'gemini-2.0-flash-exp', // Use a valid version for the current environment
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      });
      updateResponse('Gemini 2.5 Flash', { text: response.text || 'No response', loading: false });
      return response.text;
    } catch (err: any) {
      updateResponse('Gemini 2.5 Flash', { error: err.message, loading: false });
      return null;
    }
  };

  const getProxyResponse = async (endpoint: string, modelName: string, userPrompt: string, internalModel: string) => {
    updateResponse(modelName, { loading: true, error: undefined, text: '' });
    try {
      const res = await fetch(`/api/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: userPrompt, model: internalModel }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
      updateResponse(modelName, { text: data.text, loading: false });
      return data.text;
    } catch (err: any) {
      updateResponse(modelName, { error: err.message, loading: false });
      return null;
    }
  };

  const generateConsensus = async (allTexts: (string | null)[], currentPrompt: string) => {
    const validTexts = allTexts.filter(t => t !== null) as string[];
    if (validTexts.length === 0) return null;

    setConsensus('Generating consensus...');
    try {
      const consensusPrompt = `
        Below are responses from multiple AI models to the prompt: "${currentPrompt}"
        
        ${validTexts.map((t, i) => `Model ${i + 1}: ${t}`).join('\n\n')}
        
        Please provide a concise consensus summary that highlights the common points and notes any significant disagreements.
      `;
      const response = await genAI.models.generateContent({
        model: 'gemini-2.0-flash-exp',
        contents: [{ role: 'user', parts: [{ text: consensusPrompt }] }],
      });
      const text = response.text || 'Could not generate consensus.';
      setConsensus(text);
      return text;
    } catch (err: any) {
      const errorMsg = 'Error generating consensus: ' + err.message;
      setConsensus(errorMsg);
      return errorMsg;
    }
  };

  const handleConsult = async () => {
    if (!prompt.trim()) return;
    setIsConsulting(true);
    setConsensus('');
    const currentPrompt = prompt;

    const promises = [
      getGeminiResponse(currentPrompt),
      getProxyResponse('openai', 'GPT-5.4 (OpenAI)', currentPrompt, 'gpt-4o'),
      getProxyResponse('claude', 'Claude Sonnet 4.6', currentPrompt, 'claude-3-5-sonnet-20240620'),
      getProxyResponse('grok', 'Grok 4.20 (xAI)', currentPrompt, 'grok-beta')
    ];

    const results = await Promise.all(promises);
    const consensusText = await generateConsensus(results, currentPrompt);
    
    // Save to history
    const newHistoryItem: HistoryItem = {
      id: Date.now().toString(),
      timestamp: Date.now(),
      prompt: currentPrompt,
      responses: results.map((text, i) => ({
        model: ['Gemini 2.5 Flash', 'GPT-5.4 (OpenAI)', 'Claude Sonnet 4.6', 'Grok 4.20 (xAI)'][i],
        text: text || '',
        error: text === null ? 'Failed to fetch' : undefined
      })),
      consensus: consensusText || ''
    };
    
    setHistory(prev => [newHistoryItem, ...prev].slice(0, 50)); // Keep last 50
    setIsConsulting(false);
  };

  const loadFromHistory = (item: HistoryItem) => {
    setPrompt(item.prompt);
    setConsensus(item.consensus);
    setResponses(prev => prev.map(r => {
      const histResp = item.responses.find(hr => hr.model === r.model);
      return {
        ...r,
        text: histResp?.text || '',
        error: histResp?.error,
        loading: false
      };
    }));
    setIsHistoryOpen(false);
  };

  const deleteFromHistory = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setHistory(prev => prev.filter(item => item.id !== id));
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(consensus);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#E4E3E0] font-sans selection:bg-emerald-500/30 overflow-x-hidden">
      {/* Sidebar Overlay */}
      <AnimatePresence>
        {isHistoryOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsHistoryOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]"
            />
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-[#141414] border-l border-white/10 z-[70] shadow-2xl flex flex-col"
            >
              <div className="p-6 border-b border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <History className="w-5 h-5 text-emerald-500" />
                  <h2 className="text-lg font-bold">Consultation History</h2>
                </div>
                <button 
                  onClick={() => setIsHistoryOpen(false)}
                  className="p-2 hover:bg-white/5 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-white/40" />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {history.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-white/20 space-y-4">
                    <Clock className="w-12 h-12" />
                    <p className="font-mono text-xs uppercase tracking-widest">No history yet</p>
                  </div>
                ) : (
                  history.map((item) => (
                    <div 
                      key={item.id}
                      onClick={() => loadFromHistory(item)}
                      className="group bg-black/40 border border-white/5 rounded-xl p-4 cursor-pointer hover:border-emerald-500/30 transition-all relative"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-[10px] font-mono text-white/20">
                          {new Date(item.timestamp).toLocaleString()}
                        </span>
                        <button 
                          onClick={(e) => deleteFromHistory(item.id, e)}
                          className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-500/10 rounded-md transition-all"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-red-500/60 hover:text-red-500" />
                        </button>
                      </div>
                      <p className="text-sm font-medium line-clamp-2 text-white/80 mb-2">{item.prompt}</p>
                      <div className="flex gap-1">
                        {item.responses.map((r, i) => (
                          <div key={i} className={`w-1.5 h-1.5 rounded-full ${r.error ? 'bg-red-500' : 'bg-emerald-500/40'}`} />
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="border-b border-white/10 bg-[#0A0A0A]/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Terminal className="w-5 h-5 text-black" />
            </div>
            <h1 className="text-xl font-bold tracking-tight">OmniSolver<span className="text-emerald-500">.AI</span></h1>
          </div>
          
          <div className="flex items-center gap-6">
            <button 
              onClick={() => setIsHistoryOpen(true)}
              className="flex items-center gap-2 text-xs font-mono text-white/40 hover:text-emerald-500 transition-colors group"
            >
              <History className="w-4 h-4 group-hover:rotate-[-10deg] transition-transform" />
              HISTORY
            </button>
            <div className="flex items-center gap-4 text-xs font-mono text-white/40">
              <span className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                SYSTEM_READY
              </span>
              <span className="hidden sm:inline">v1.1.0-STABLE</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Column: Input */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-[#141414] border border-white/10 rounded-2xl p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <label className="text-xs font-mono uppercase tracking-widest text-white/40">Input Prompt</label>
                <RefreshCw 
                  className={`w-4 h-4 text-white/20 cursor-pointer hover:text-white/60 transition-colors ${isConsulting ? 'animate-spin' : ''}`}
                  onClick={() => { setPrompt(''); setResponses(r => r.map(x => ({...x, text: '', error: undefined}))); setConsensus(''); }}
                />
              </div>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Enter your complex query here..."
                className="w-full h-48 bg-black/40 border border-white/5 rounded-xl p-4 text-lg resize-none focus:outline-none focus:border-emerald-500/50 transition-all placeholder:text-white/10"
              />
              <button
                onClick={handleConsult}
                disabled={isConsulting || !prompt.trim()}
                className="w-full mt-6 bg-emerald-500 hover:bg-emerald-400 disabled:bg-white/5 disabled:text-white/20 text-black font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
              >
                {isConsulting ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Send className="w-5 h-5" />
                    CONSULT MULTI-MODEL
                  </>
                )}
              </button>
            </div>

            {/* Consensus Card */}
            <AnimatePresence>
              {consensus && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-6 overflow-hidden relative"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-emerald-500" />
                      <span className="text-xs font-mono uppercase tracking-widest text-emerald-500">Consensus Engine</span>
                    </div>
                    <button 
                      onClick={copyToClipboard}
                      className="p-2 hover:bg-emerald-500/10 rounded-lg transition-colors"
                    >
                      {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4 text-emerald-500/60" />}
                    </button>
                  </div>
                  <div className="prose prose-invert max-w-none">
                    <p className="text-emerald-100/90 leading-relaxed whitespace-pre-wrap">
                      {consensus}
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Right Column: Results */}
          <div className="lg:col-span-7 space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xs font-mono uppercase tracking-widest text-white/40">Model Outputs</h2>
              <div className="flex gap-2">
                {responses.map(r => (
                  <div key={r.model} className={`w-2 h-2 rounded-full ${r.loading ? 'bg-yellow-500 animate-pulse' : r.text ? 'bg-emerald-500' : 'bg-white/10'}`} />
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {responses.map((resp, idx) => (
                <motion.div
                  key={resp.model}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className="bg-[#141414] border border-white/10 rounded-xl p-5 group hover:border-white/20 transition-all"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className={`p-1.5 rounded-md bg-white/5 ${resp.color}`}>
                        {resp.icon}
                      </div>
                      <span className="font-medium text-sm">{resp.model}</span>
                    </div>
                    {resp.loading && <Loader2 className="w-3 h-3 animate-spin text-white/20" />}
                    {resp.error && <AlertCircle className="w-3 h-3 text-red-500" />}
                  </div>

                  <div className="min-h-[60px] relative">
                    {resp.loading ? (
                      <div className="space-y-2">
                        <div className="h-3 bg-white/5 rounded w-full animate-pulse" />
                        <div className="h-3 bg-white/5 rounded w-4/5 animate-pulse" />
                      </div>
                    ) : resp.error ? (
                      <p className="text-xs font-mono text-red-400/80 bg-red-500/5 p-3 rounded-lg border border-red-500/10">
                        {resp.error}
                      </p>
                    ) : resp.text ? (
                      <p className="text-sm text-white/70 leading-relaxed line-clamp-6 group-hover:line-clamp-none transition-all">
                        {resp.text}
                      </p>
                    ) : (
                      <p className="text-sm text-white/10 italic">Waiting for input...</p>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 py-8 mt-12">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-[10px] font-mono text-white/20 uppercase tracking-widest">
          <p>© 2026 OmniSolver Research Labs</p>
          <div className="flex gap-6">
            <a href="#" className="hover:text-white transition-colors">Documentation</a>
            <a href="#" className="hover:text-white transition-colors">API Status</a>
            <a href="#" className="hover:text-white transition-colors">Privacy</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
