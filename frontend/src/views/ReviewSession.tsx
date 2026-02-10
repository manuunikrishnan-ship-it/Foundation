import React, { useState, useEffect } from 'react'
import { 
  ChevronLeft, CheckCircle, AlertCircle, XCircle, 
  SkipForward, Terminal, PenTool, ExternalLink, GraduationCap, ArrowRight, ArrowLeft, Play, Save, Code, FileText, Copy, ClipboardList, ClipboardCheck
} from 'lucide-react'
import confetti from 'canvas-confetti'
import type { ScheduledReview, Question, ReviewStatus, QuestionResult } from '../types'
import questionsData from '../data/questions.json'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { API_URL } from '../config'

// ... (imports remain)

interface Props {
  review: ScheduledReview;
  onCancel: () => void;
  onComplete: () => void;
}

const ReviewSessionView: React.FC<Props> = ({ review, onCancel, onComplete }) => {
  // Fix module ID matching: "Module 1" -> 1
  const moduleIdStr = review.module.split(' ')[1]
  const moduleId = parseInt(moduleIdStr)
  
  // Robust filtering
  const moduleQuestions = (questionsData as Question[]).filter(q => 
    q.module_id === moduleId || 
    q.module_id === moduleIdStr as any
  )
  
  // Helper for persistence
  const getSaved = (key: string, def: any) => {
    try {
      const saved = localStorage.getItem(`review_session_${review.id}`)
      if (!saved) return def
      const data = JSON.parse(saved)
      return data[key] !== undefined ? data[key] : def
    } catch { return def }
  }

  const [currentIndex, setCurrentIndex] = useState(() => getSaved('currentIndex', 0))
  const [results, setResults] = useState<QuestionResult[]>(() => getSaved('results', []))
  const [practicalMark, setPracticalMark] = useState<number>(() => getSaved('practicalMark', 0))
  const [practicalLink, setPracticalLink] = useState(() => getSaved('practicalLink', ''))
  const [seconds, setSeconds] = useState(() => getSaved('seconds', 0))
  const [notes, setNotes] = useState(() => getSaved('notes', ''))
  const [showResult, setShowResult] = useState(false)
  const [showFeedbackModal, setShowFeedbackModal] = useState(false)
  const [linkError, setLinkError] = useState(false)
  
  // Compiler State
  const [language, setLanguage] = useState<'java' | 'c'>(() => getSaved('language', 'c'))
  const [code, setCode] = useState(() => getSaved('code', '#include <stdio.h>\n\nint main() {\n    printf("Hello World\\n");\n    return 0;\n}'))
  const [output, setOutput] = useState<string[]>(['System: Ready for execution...'])
  const [isRunning, setIsRunning] = useState(false)

  const handleLanguageChange = (newLang: 'java' | 'c') => {
    setLanguage(newLang)
    if (newLang === 'java') {
      setCode('public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello World");\n    }\n}')
    } else {
      setCode('#include <stdio.h>\n\nint main() {\n    printf("Hello World\\n");\n    return 0;\n}')
    }
  }

  const currentQuestion = moduleQuestions[currentIndex]
  const currentResult = results.find(r => r.questionId === currentQuestion?.id)

  useEffect(() => {
    const timer = setInterval(() => setSeconds((s: number) => s + 1), 1000)
    return () => clearInterval(timer)
  }, [])

  // Persistence Effect
  useEffect(() => {
    const state = { currentIndex, results, practicalMark, practicalLink, seconds, notes, language, code }
    localStorage.setItem(`review_session_${review.id}`, JSON.stringify(state))
  }, [currentIndex, results, practicalMark, practicalLink, seconds, notes, language, code, review.id])

  const handleFinishSession = () => {
    const finalState = {
      status: isPassed ? 'completed' : 'failed',
      scores: {
        theoretical: stats.theoretical,
        maxTheoretical: stats.maxTheoretical,
        practical: practicalMark,
        total: totalScore
      },
      notes,
      session_data: { results, currentIndex, seconds, code, language, practicalLink }
    }

    const promise = fetch(`${API_URL}/reviews/${review.id}/`, { // Note trailing slash for Django
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(finalState)
    })
    .then(res => {
      if (!res.ok) throw new Error()
      localStorage.removeItem(`review_session_${review.id}`)
      onComplete()
    })
    
    toast.promise(promise, {
      loading: 'Saving session results...',
      success: 'Session completed successfully!',
      error: 'Failed to save results. Please try again.'
    })
  }

  const formatTime = (s: number) => {
    const min = Math.floor(s / 60)
    const sec = s % 60
    return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`
  }

  const handleMark = (status: ReviewStatus) => {
    let score = 0
    if (status === 'answered') score = 10
    else if (status === 'need-improvement') score = 5
    
    setResults(prev => [...prev.filter(r => r.questionId !== currentQuestion.id), { 
      questionId: currentQuestion.id, 
      status, 
      score 
    }])
    
    // Auto-advance if not last
    if (currentIndex < moduleQuestions.length - 1) {
      setTimeout(() => setCurrentIndex(currentIndex + 1), 300)
    }
  }

  const runCode = () => {
    setIsRunning(true)
    setOutput(prev => [...prev, `[${new Date().toLocaleTimeString()}] Compiling ${language}...`])
    
    setTimeout(() => {
      setOutput(prev => [...prev.slice(-10), `[${new Date().toLocaleTimeString()}] Execution Successful.`, `> Program output: Hello World`])
      setIsRunning(false)
    }, 800)
  }

  const stats = {
    theoretical: results.reduce((acc, curr) => acc + curr.score, 0),
    maxTheoretical: moduleQuestions.length * 10
  }
  const totalScore = (stats.maxTheoretical > 0 ? (stats.theoretical / stats.maxTheoretical) * 70 : 0) + ((practicalMark / 10) * 30)
  const isPassed = totalScore >= 60

  const handleSubmit = () => {
    // Check for unmarked questions
    const unmarkedIndex = moduleQuestions.findIndex(q => !results.find(r => r.questionId === q.id))
    
    if (unmarkedIndex !== -1) {
      setCurrentIndex(unmarkedIndex)
      toast.error(`Please mark Question ${unmarkedIndex + 1} before submitting.`, {
        description: 'All questions must be evaluated.'
      })
      return
    }

    if (!practicalLink.trim()) {
      setLinkError(true)
      toast.error("Missing Question Link", {
        description: "Please provide the Question Link to complete the evaluation."
      })
      return
    }
    setLinkError(false)
    setShowFeedbackModal(true)
  }

  const handleGenerateReport = () => {
    setShowFeedbackModal(false)
    setShowResult(true)
    if (isPassed) {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      })
    }
  }

  const copyReport = () => {
    const wrongQs = moduleQuestions.filter(q => results.find(r => r.questionId === q.id)?.status === 'wrong')
    const improveQs = moduleQuestions.filter(q => results.find(r => r.questionId === q.id)?.status === 'need-improvement')
    
    let report = `Evaluation Report: ${review.studentName}\nModule: ${review.module}\nResult: ${isPassed ? 'Passed' : 'Failed'} (${totalScore.toFixed(1)}%)\n\n`
    
    if (improveQs.length > 0) {
      report += `Need Improvement\n---------\n`
      improveQs.forEach(q => report += `- ${q.text}\n`)
      report += `\n`
    }
    
    if (wrongQs.length > 0) {
      report += `Incorrect / Pending Mastery\n---------\n`
      wrongQs.forEach(q => report += `- ${q.text}\n`)
      report += `\n`
    }
    
    if (notes) {
      report += `Feedback:\n${notes}\n`
    }

    navigator.clipboard.writeText(report)
    toast.success('Report copied to clipboard')
  }

  if (showFeedbackModal) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.85)' }}>
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 0 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="w-full max-w-lg bg-zinc-950 border border-zinc-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col"
        >
          <div className="p-8 pb-4">
             <div className="w-14 h-14 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-indigo-500 mb-6 shadow-sm mx-auto">
              <ClipboardCheck size={28} strokeWidth={2} />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2 text-center tracking-tight">Final Feedback</h2>
            <p className="text-zinc-400 text-sm text-center leading-relaxed">
              Refine your notes before generating the report. This will be shared with the hiring manager.
            </p>
          </div>

          <div className="p-8 pt-2 flex flex-col gap-6">
            <div className="relative">
               <div className="flex justify-between items-center mb-2 px-1">
                <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest">Reviewer Notes</label>
                <span className="text-[10px] font-medium text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">MARKDOWN</span>
              </div>
              <textarea 
                className="w-full h-48 p-4 rounded-xl bg-zinc-900/50 border border-zinc-800 text-zinc-200 placeholder:text-zinc-600 focus:bg-zinc-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none resize-none text-sm transition-all"
                placeholder="Enter your detailed observations here..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
                autoFocus
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button 
                className="py-3 rounded-xl text-sm font-semibold text-zinc-400 hover:bg-zinc-900 transition-colors"
                onClick={() => setShowFeedbackModal(false)}
              >
                Back
              </button>
              <button 
                className="py-3 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 active:scale-95 transition-all shadow-lg shadow-indigo-500/20"
                onClick={handleGenerateReport}
              >
                Generate Report
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    )
  }

  if (showResult) {
    const wrongQs = moduleQuestions.filter(q => results.find(r => r.questionId === q.id)?.status === 'wrong')
    const improveQs = moduleQuestions.filter(q => results.find(r => r.questionId === q.id)?.status === 'need-improvement')

    return (
      <div className="fixed inset-0 z-40 bg-slate-50 flex items-center justify-center overflow-y-auto py-10">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-3xl shadow-xl w-[600px] max-w-[95vw] overflow-hidden flex flex-col my-auto"
        >
          <div className={`p-8 flex flex-col items-center justify-center text-center ${isPassed ? 'bg-green-50' : 'bg-red-50'}`}>
            <div 
              style={{ 
                width: '64px', height: '64px', borderRadius: '50%', 
                background: isPassed ? 'var(--success)' : 'var(--danger)',
                color: 'white',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: '16px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
              }}
            >
              {isPassed ? <CheckCircle size={32} /> : <XCircle size={32} />}
            </div>
            <h1 className="text-3xl font-bold mb-2 text-slate-900">{isPassed ? 'Evaluation Passed' : 'Evaluation Failed'}</h1>
            <p className="text-slate-500 font-medium">
              {review.studentName} has {isPassed ? 'successfully completed' : 'failed'} {review.module}.
            </p>
          </div>

          <div className="p-8 flex flex-col gap-6 text-center">
            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 text-center">
                <span className="text-xs font-bold text-slate-400 block mb-1">THEORETICAL</span>
                <span className="text-xl font-bold text-slate-700">{((stats.theoretical / stats.maxTheoretical) * 70).toFixed(1)}%</span>
              </div>
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 text-center">
                <span className="text-xs font-bold text-slate-400 block mb-1">PRACTICAL</span>
                <span className="text-xl font-bold text-slate-700">{((practicalMark / 10) * 30).toFixed(1)}%</span>
              </div>
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 text-center relative overflow-hidden">
                <div className={`absolute inset-0 opacity-10 ${isPassed ? 'bg-green-500' : 'bg-red-500'}`} />
                <span className="text-xs font-bold text-slate-400 block mb-1">TOTAL SCORE</span>
                <span className={`text-2xl font-black ${isPassed ? 'text-green-600' : 'text-red-600'}`}>{totalScore.toFixed(1)}%</span>
              </div>
            </div>

            {improveQs.length > 0 && (
              <div>
                <h3 className="text-xs font-bold text-amber-600 uppercase mb-3 flex items-center justify-center gap-2">
                  <AlertCircle size={14} /> Need Improvement
                </h3>
                <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
                  <ul className="space-y-1 text-sm text-slate-700 list-none">
                    {improveQs.map(q => <li key={q.id}>{q.text}</li>)}
                  </ul>
                </div>
              </div>
            )}

            {wrongQs.length > 0 && (
              <div>
                <h3 className="text-xs font-bold text-red-600 uppercase mb-3 flex items-center justify-center gap-2">
                  <XCircle size={14} /> Incorrect / Pending
                </h3>
                <div className="bg-red-50 border border-red-100 rounded-xl p-4">
                  <ul className="space-y-1 text-sm text-slate-700 list-none">
                    {wrongQs.map(q => <li key={q.id}>{q.text}</li>)}
                  </ul>
                </div>
              </div>
            )}

            <div>
              <h3 className="text-xs font-bold text-slate-500 uppercase mb-3 flex items-center justify-center gap-2">
                <FileText size={14} /> Feedback
              </h3>
              <div className="relative group">
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 text-sm text-slate-700 italic min-h-[100px] whitespace-pre-wrap text-center flex items-center justify-center">
                  {notes || "No additional feedback provided."}
                </div>
                <button 
                  onClick={copyReport}
                  className="absolute top-2 right-2 p-2 bg-white border border-slate-200 rounded-lg hover:border-indigo-500 hover:text-indigo-600 transition-all opacity-0 group-hover:opacity-100 shadow-sm flex items-center gap-2 text-xs font-bold"
                >
                  <ClipboardList size={14} />
                </button>
              </div>
            </div>

            <button className="btn btn-primary w-full py-3" onClick={handleFinishSession}>
              Return to Dashboard
            </button>
          </div>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="session-root">
      {/* Top Header */}
      <header className="session-header">
        <button onClick={onCancel} className="btn btn-secondary" style={{ padding: '8px', border: 'none' }}>
          <ChevronLeft size={20} />
        </button>
        <div style={{ width: '1px', height: '24px', background: 'var(--border-base)', margin: '0 20px' }} />
        <div className="flex gap-4">
          <div className="avatar" style={{ width: '32px', height: '32px', fontSize: '14px' }}>{review.studentName[0]}</div>
          <div className="flex-col" style={{ alignItems: 'flex-start' }}>
            <span style={{ fontWeight: 700, fontSize: '14px' }}>{review.studentName}</span>
            <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontWeight: 600 }}>{review.batch} • {review.module}</span>
          </div>
        </div>
        
        <div style={{ flex: 1 }} />
        
        <div className="flex gap-8">
          <div className="flex-col" style={{ alignItems: 'flex-end' }}>
            <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>TIMER</span>
            <span style={{ fontFamily: 'var(--terminal-font)', fontWeight: 700, fontSize: '15px' }}>{formatTime(seconds)}</span>
          </div>
          <div className="flex-col" style={{ alignItems: 'flex-end' }}>
            <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>OVERALL SCORE</span>
            <span style={{ fontWeight: 800, fontSize: '18px', color: isPassed ? 'var(--success)' : 'var(--warning)' }}>{totalScore.toFixed(1)}%</span>
          </div>
          <button className="btn btn-primary" onClick={handleSubmit}>Submit Review</button>
        </div>
      </header>

      {/* Main Split Body */}
      <div className="split-container">
        {/* Left Side: Question & Marking */}
        <div className="side-left">
          <div style={{ maxWidth: '640px', margin: '0 auto' }}>
            <div className="flex justify-between items-center mb-8">
              <span className="badge" style={{ background: 'var(--primary-subtle)', color: 'var(--primary)' }}>Question {currentIndex + 1} of {moduleQuestions.length}</span>
              <div className="flex gap-2">
                <button className="btn btn-secondary" style={{ width: '40px', padding: 0 }} onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))} disabled={currentIndex === 0}>
                  <ArrowLeft size={18} />
                </button>
                <button className="btn btn-secondary" style={{ width: '40px', padding: 0 }} onClick={() => setCurrentIndex(Math.min(moduleQuestions.length - 1, currentIndex + 1))} disabled={currentIndex === moduleQuestions.length - 1}>
                  <ArrowRight size={18} />
                </button>
              </div>
            </div>

            <AnimatePresence mode="wait">
              {currentQuestion ? (
                <motion.div
                  key={currentQuestion.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                >
                  <h1 style={{ fontSize: '28px', marginBottom: '32px' }}>{currentQuestion.text}</h1>
                  
                  <div className="review-card review-card-no-hover" style={{ padding: '24px', background: 'white', border: '1px solid var(--border-base)', marginBottom: '32px' }}>
                    <div className="flex gap-2 text-xs mb-3" style={{ color: 'var(--text-tertiary)' }}>
                      <PenTool size={14} /> EXPECTED INSIGHT
                    </div>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '15px', fontWeight: 500, lineHeight: 1.6 }}>{currentQuestion.answer}</p>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    {[
                      { status: 'answered' as ReviewStatus, label: 'Perfect', icon: CheckCircle, color: 'var(--success)' },
                      { status: 'need-improvement' as ReviewStatus, label: 'Needs Fix', icon: AlertCircle, color: 'var(--warning)' },
                      { status: 'wrong' as ReviewStatus, label: 'Wrong', icon: XCircle, color: 'var(--danger)' },
                      { status: 'skip' as ReviewStatus, label: 'Skip', icon: SkipForward, color: 'var(--text-tertiary)' }
                    ].map(btn => (
                      <button 
                        key={btn.status}
                        onClick={() => handleMark(btn.status)}
                        className="btn"
                        style={{ 
                          height: '56px',
                          justifyContent: 'flex-start',
                          padding: '0 20px',
                          border: '2px solid',
                          borderColor: currentResult?.status === btn.status ? btn.color : 'var(--border-subtle)',
                          background: currentResult?.status === btn.status ? 'white' : 'transparent',
                          color: currentResult?.status === btn.status ? btn.color : 'var(--text-secondary)',
                          gap: '12px'
                        }}
                      >
                        <btn.icon size={18} />
                        <span className="font-bold">{btn.label}</span>
                      </button>
                    ))}
                  </div>
                </motion.div>
              ) : (
                <div className="flex-col items-center justify-center py-20">
                  <span className="text-xs font-bold text-slate-400">NO QUESTIONS LOADED</span>
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Right Side: Compiler, Notepad, Practical */}
        <div className="side-right">
          {/* Compiler Simulator */}
          <div className="compiler-box">
            <div className="compiler-header">
              <div className="flex gap-4">
                <div className="flex gap-2 items-center">
                  <Code size={16} style={{ color: 'var(--primary)' }} />
                  <span className="text-xs font-bold" style={{ color: '#8b949e' }}>CODE COMPILER</span>
                </div>
                <select 
                  className="input-field" 
                  style={{ height: '28px', fontSize: '11px', padding: '0 8px', width: '80px', background: '#21262d', color: '#e6edf3', border: '1px solid #30363d' }}
                  value={language}
                  onChange={e => handleLanguageChange(e.target.value as any)}
                >
                  <option value="c">C</option>
                  <option value="java">Java</option>
                </select>
              </div>
              <button 
                onClick={runCode} 
                disabled={isRunning}
                className="btn btn-primary" 
                style={{ height: '28px', fontSize: '11px', padding: '0 12px', borderRadius: '6px' }}
              >
                {isRunning ? 'Running...' : <><Play size={12} fill="currentColor" /> Run Code</>}
              </button>
            </div>
            <textarea 
              className="compiler-editor"
              value={code}
              onChange={e => setCode(e.target.value)}
              spellCheck={false}
            />
            <div className="compiler-output">
              {output.map((line, i) => <div key={i}>{line}</div>)}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            {/* Notepad */}
            <div className="review-card review-card-no-hover" style={{ padding: '16px', background: '#fffef0', borderColor: '#fef3c7' }}>
              <div className="flex justify-between items-center mb-3">
                <div className="flex gap-2 text-xs" style={{ color: '#92400e' }}>
                  <FileText size={14} /> REVIEWER NOTEPAD
                </div>
                <button 
                  onClick={() => {
                    if (!notes) return
                    navigator.clipboard.writeText(notes)
                    toast.success('Notes copied to clipboard')
                  }}
                  className="p-1 hover:bg-[#fef9c3] rounded cursor-pointer transition-colors"
                  title="Copy notes"
                  style={{ color: '#92400e' }}
                >
                  <Copy size={13} />
                </button>
              </div>
              <textarea 
                style={{ width: '100%', height: '120px', background: 'transparent', border: 'none', resize: 'none', outline: 'none', fontSize: '13px', color: '#92400e', fontFamily: 'inherit' }}
                placeholder="Type observations here..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
              />
            </div>

            {/* Practical Section */}
            <div className="review-card review-card-no-hover" style={{ padding: '16px', borderColor: linkError ? 'var(--danger)' : 'var(--border-base)' }}>
              <div className="flex gap-2 text-xs mb-4" style={{ color: linkError ? 'var(--danger)' : 'var(--text-tertiary)' }}>
                <Terminal size={14} /> PRACTICAL EVALUATION {linkError && '(REQUIRED)'}
              </div>
              
              <div className="flex-col gap-4">
                <div className="flex-col gap-1" style={{ alignItems: 'flex-start' }}>
                  <label className="text-xs" style={{ color: linkError ? 'var(--danger)' : 'inherit' }}>Question Link *</label>
                  <div className="flex gap-2 w-full">
                    <input 
                      type="text" 
                      className="input-field" 
                      style={{ height: '32px', fontSize: '12px', borderColor: linkError ? 'var(--danger)' : 'var(--border-base)' }}
                      placeholder="Paste Question Link..."
                      value={practicalLink}
                      onChange={e => {
                        setPracticalLink(e.target.value)
                        if (e.target.value) setLinkError(false)
                      }}
                    />
                    <button className="btn btn-secondary" style={{ height: '32px', width: '32px', padding: 0 }}><ExternalLink size={14} /></button>
                  </div>
                </div>

                <div className="flex-col gap-1" style={{ alignItems: 'flex-start' }}>
                  <div className="flex justify-between w-full">
                    <label className="text-xs">Practical Proficiency</label>
                    <span className="font-bold" style={{ color: 'var(--primary)', fontSize: '12px' }}>{practicalMark}/10</span>
                  </div>
                  <input 
                    type="range" 
                    min="0" max="10" step="0.5" 
                    style={{ width: '100%' }}
                    value={practicalMark}
                    onChange={e => setPracticalMark(parseFloat(e.target.value))}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ReviewSessionView
