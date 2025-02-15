import React, { useEffect, useState } from 'react';
import { PaperUploader } from './components/PaperUploader';
import { PaperList } from './components/PaperList';
import { supabase } from './lib/supabase';
import { summarizePaper, detectBias, answerQuestion } from './lib/gemini';
import { FileText, AlertTriangle, HelpCircle } from 'lucide-react';

interface Paper {
  id: string;
  title: string;
  summary: string;
  created_at: string;
  full_text: string;
}

function App() {
  const [papers, setPapers] = useState<Paper[]>([]);
  const [selectedPaper, setSelectedPaper] = useState<Paper | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'summary' | 'bias' | 'qa'>('summary');
  const [biasAnalysis, setBiasAnalysis] = useState<string>('');
  const [question, setQuestion] = useState<string>('');
  const [answer, setAnswer] = useState<string>('');
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    fetchPapers();
  }, []);

  async function fetchPapers() {
    const { data, error } = await supabase
      .from('papers')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching papers:', error);
      return;
    }

    setPapers(data);
  }

  async function handleUpload(text: string, fileName: string) {
    setLoading(true);
    try {
      const summary = await summarizePaper(text);
      
      const { data, error } = await supabase
        .from('papers')
        .insert([
          {
            title: fileName,
            summary,
            full_text: text,
          },
        ])
        .select()
        .single();

      if (error) throw error;

      setPapers((prev) => [data, ...prev]);
      setSelectedPaper(data);
    } catch (error) {
      console.error('Error processing paper:', error);
      alert('Error processing paper');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    const { error } = await supabase.from('papers').delete().eq('id', id);

    if (error) {
      console.error('Error deleting paper:', error);
      return;
    }

    setPapers((prev) => prev.filter((paper) => paper.id !== id));
    if (selectedPaper?.id === id) {
      setSelectedPaper(null);
    }
  }

  async function handleBiasDetection() {
    if (!selectedPaper?.full_text) return;
    
    setAnalyzing(true);
    try {
      const analysis = await detectBias(selectedPaper.full_text);
      setBiasAnalysis(analysis);
    } catch (error) {
      console.error('Error detecting bias:', error);
      alert('Error analyzing bias');
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleQuestionSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedPaper?.full_text || !question) return;

    setAnalyzing(true);
    try {
      const response = await answerQuestion(selectedPaper.full_text, question);
      setAnswer(response);
    } catch (error) {
      console.error('Error answering question:', error);
      alert('Error answering question');
    } finally {
      setAnalyzing(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center space-x-2 mb-8">
          <FileText className="h-8 w-8 text-blue-500" />
          <h1 className="text-2xl font-bold text-gray-900">
            Research Paper Summarizer
          </h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-6">
            <PaperUploader onUpload={handleUpload} />
            <div className="h-[1px] bg-gray-200" />
            <PaperList
              papers={papers}
              onSelect={setSelectedPaper}
              onDelete={handleDelete}
            />
          </div>

          <div className="bg-white rounded-lg shadow">
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
              </div>
            ) : selectedPaper ? (
              <div>
                <div className="border-b">
                  <nav className="flex -mb-px">
                    <button
                      onClick={() => setActiveTab('summary')}
                      className={`px-4 py-3 font-medium text-sm border-b-2 ${
                        activeTab === 'summary'
                          ? 'border-blue-500 text-blue-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      Summary
                    </button>
                    <button
                      onClick={() => {
                        setActiveTab('bias');
                        if (!biasAnalysis) handleBiasDetection();
                      }}
                      className={`px-4 py-3 font-medium text-sm border-b-2 ${
                        activeTab === 'bias'
                          ? 'border-blue-500 text-blue-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      Bias Analysis
                    </button>
                    <button
                      onClick={() => setActiveTab('qa')}
                      className={`px-4 py-3 font-medium text-sm border-b-2 ${
                        activeTab === 'qa'
                          ? 'border-blue-500 text-blue-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      Q&A
                    </button>
                  </nav>
                </div>

                <div className="p-6">
                  <h2 className="text-xl font-semibold mb-4">{selectedPaper.title}</h2>
                  
                  {activeTab === 'summary' && (
                    <div className="prose max-w-none">
                      <p className="text-gray-600 whitespace-pre-wrap">
                        {selectedPaper.summary}
                      </p>
                    </div>
                  )}

                  {activeTab === 'bias' && (
                    <div className="prose max-w-none">
                      {analyzing ? (
                        <div className="flex items-center justify-center py-8">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
                        </div>
                      ) : biasAnalysis ? (
                        <>
                          <div className="flex items-center gap-2 mb-4">
                            <AlertTriangle className="h-5 w-5 text-yellow-500" />
                            <h3 className="text-lg font-medium">Bias Analysis</h3>
                          </div>
                          <p className="text-gray-600 whitespace-pre-wrap">
                            {biasAnalysis}
                          </p>
                        </>
                      ) : (
                        <p>Analyzing bias...</p>
                      )}
                    </div>
                  )}

                  {activeTab === 'qa' && (
                    <div className="space-y-6">
                      <form onSubmit={handleQuestionSubmit} className="space-y-4">
                        <div>
                          <label htmlFor="question" className="block text-sm font-medium text-gray-700">
                            Ask a question about this paper
                          </label>
                          <div className="mt-1">
                            <input
                              type="text"
                              id="question"
                              value={question}
                              onChange={(e) => setQuestion(e.target.value)}
                              className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                              placeholder="e.g., What were the main findings?"
                            />
                          </div>
                        </div>
                        <button
                          type="submit"
                          disabled={analyzing}
                          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                        >
                          {analyzing ? 'Thinking...' : 'Ask Question'}
                        </button>
                      </form>

                      {answer && (
                        <div className="prose max-w-none">
                          <div className="flex items-center gap-2 mb-4">
                            <HelpCircle className="h-5 w-5 text-blue-500" />
                            <h3 className="text-lg font-medium">Answer</h3>
                          </div>
                          <p className="text-gray-600 whitespace-pre-wrap">
                            {answer}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                <FileText className="h-16 w-16 mb-4" />
                <p>Select a paper to view its analysis</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;