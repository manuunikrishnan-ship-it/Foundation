import React, { useState, useEffect } from 'react'
import { 
  ChevronLeft, CheckCircle, AlertCircle, XCircle, 
  SkipForward, Terminal, PenTool, ExternalLink, ArrowRight, ArrowLeft, Play, Code, FileText, Copy, ClipboardCheck
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
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(2, 6, 23, 0.8)' }}>
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="w-full max-w-2xl bg-white border border-slate-200 rounded-[24px] shadow-2xl overflow-hidden"
        >
          <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div>
              <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">Final Assessment Notes</h2>
              <p className="text-slate-500 text-sm mt-1">Review and refine your observations before finalizing the report.</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 border border-indigo-100">
              <ClipboardCheck size={24} />
            </div>
          </div>

          <div className="p-8">
            <div className="mb-6">
              <div className="flex justify-between items-center mb-3">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest px-1">Evaluation Commentary</label>
                <div className="flex items-center gap-2 text-[10px] font-medium text-slate-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Auto-saving...
                </div>
              </div>
              <textarea 
                className="w-full h-64 p-5 rounded-2xl bg-slate-50 border border-slate-200 text-slate-700 placeholder:text-slate-400 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none resize-none text-[15px] leading-relaxed transition-all shadow-inner"
                placeholder="Detail the student's performance, areas of excellence, and specific technical gaps identified during this session..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
                autoFocus
              />
            </div>

            <div className="flex items-center gap-4 bg-amber-50/50 border border-amber-100/50 p-4 rounded-xl mb-8">
              <div className="p-2 bg-amber-100 rounded-lg text-amber-700">
                <AlertCircle size={18} />
              </div>
              <p className="text-xs text-amber-800 leading-normal">
                <b>Internal Policy:</b> Ensure feedback is constructive and includes specific examples from the practical assessment.
              </p>
            </div>

            <div className="flex gap-3">
              <button 
                className="flex-1 py-4 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors border border-slate-200"
                onClick={() => setShowFeedbackModal(false)}
              >
                Back to Session
              </button>
              <button 
                className="flex-[2] py-4 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] transition-all shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2"
                onClick={handleGenerateReport}
              >
                Finalize Evaluation Report
                <ArrowRight size={18} />
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
    const perfectQs = moduleQuestions.filter(q => results.find(r => r.questionId === q.id)?.status === 'answered')

    return (
      <div className="fixed inset-0 z-50 bg-[#f8fafc] flex items-center justify-center overflow-y-auto p-6">
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white border border-slate-200 rounded-[32px] shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col"
        >
          {/* Executive Header */}
          <div className={`p-10 text-white relative overflow-hidden ${isPassed ? 'bg-emerald-600' : 'bg-rose-600'}`}>
            <div className="absolute top-0 right-0 p-12 opacity-10 rotate-12">
              {isPassed ? <CheckCircle size={180} /> : <XCircle size={180} />}
            </div>
            
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/20 rounded-full text-[10px] font-bold uppercase tracking-widest mb-4">
                  Assessment Complete
                </div>
                <h1 className="text-4xl font-extrabold tracking-tight mb-2">
                  {isPassed ? 'Certification Passed' : 'Assessment Failed'}
                </h1>
                <p className="text-white/80 font-medium">
                  {review.studentName} • {review.module} • {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </p>
              </div>
              <div className="flex flex-col items-end">
                <div className="text-white/60 text-xs font-bold uppercase tracking-tighter mb-1">AGGREGATE PROFICIENCY</div>
                <div className="text-6xl font-black">{totalScore.toFixed(0)}<span className="text-2xl opacity-50">%</span></div>
              </div>
            </div>
          </div>

          <div className="p-10 flex flex-col gap-10">
            {/* Score Distribution */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { label: 'Theoretical Aptitude', value: (stats.theoretical / stats.maxTheoretical) * 70, max: 70, color: 'indigo' },
                { label: 'Practical Execution', value: (practicalMark / 10) * 30, max: 30, color: 'sky' },
                { label: 'Cumulative Index', value: totalScore, max: 100, color: isPassed ? 'emerald' : 'rose' }
              ].map((metric, idx) => (idx < 2 ? (
                <div key={metric.label} className="p-6 bg-slate-50 border border-slate-100 rounded-2xl">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">{metric.label}</span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-extrabold text-slate-800">{metric.value.toFixed(1)}</span>
                    <span className="text-sm font-bold text-slate-400">/ {metric.max}</span>
                  </div>
                  <div className="mt-4 h-2 bg-slate-200 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${(metric.value / metric.max) * 100}%` }}
                      transition={{ delay: 0.5, duration: 1 }}
                      className={`h-full bg-${metric.color}-500`}
                    />
                  </div>
                </div>
              ) : (
                <div key={metric.label} className="p-6 bg-slate-900 rounded-2xl shadow-xl shadow-slate-200">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">{metric.label}</span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-black text-white">{metric.value.toFixed(1)}%</span>
                  </div>
                  <div className="mt-4 flex gap-1">
                    {Array.from({ length: 12 }).map((_, i) => (
                      <div 
                        key={i} 
                        className={`h-1.5 flex-1 rounded-full ${i/12 * 100 < metric.value ? (isPassed ? 'bg-emerald-500' : 'bg-rose-500') : 'bg-slate-700'}`} 
                      />
                    ))}
                  </div>
                </div>
              )))}
            </div>

            {/* Performance Analysis */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
              <div className="space-y-8">
                <div>
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider mb-5 flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                    Insight Summary
                  </h3>
                  <div className="bg-slate-50 border border-slate-100 rounded-2xl p-6 relative">
                    <FileText className="absolute top-6 right-6 text-slate-200" size={20} />
                    <p className="text-slate-600 text-sm italic leading-relaxed whitespace-pre-wrap">
                      {notes || "No qualitative feedback provided for this session. Recommended to review theoretical segments for the next attempt."}
                    </p>
                  </div>
                </div>
                
                <div className="flex flex-col gap-3">
                   <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    Key Proficiency Strengths
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {perfectQs.length > 0 ? perfectQs.map(q => (
                      <span key={q.id} className="text-[11px] font-bold px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-lg">
                        {q.text.split(' ').slice(0, 4).join(' ')}...
                      </span>
                    )) : <span className="text-xs text-slate-400 italic">No specific strengths noted.</span>}
                  </div>
                </div>
              </div>

              <div className="space-y-8">
                <div>
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider mb-5 flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                    Critical Modules for Review
                  </h3>
                  <div className="space-y-3">
                    {wrongQs.length > 0 ? wrongQs.map(q => (
                      <div key={q.id} className="flex gap-4 p-4 bg-rose-50/50 border border-rose-100 rounded-xl">
                        <XCircle size={18} className="text-rose-500 shrink-0" />
                        <span className="text-xs font-semibold text-rose-900 leading-normal">{q.text}</span>
                      </div>
                    )) : (
                      <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center gap-3">
                        <CheckCircle size={18} className="text-emerald-500" />
                        <span className="text-xs font-bold text-emerald-900">Zero critical failures detected.</span>
                      </div>
                    )}
                    
                    {improveQs.length > 0 && improveQs.map(q => (
                      <div key={q.id} className="flex gap-4 p-4 bg-amber-50/50 border border-amber-100 rounded-xl">
                        <AlertCircle size={18} className="text-amber-500 shrink-0" />
                        <span className="text-xs font-semibold text-amber-900 leading-normal">{q.text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="pt-6 border-t border-slate-100 flex flex-col sm:flex-row gap-4">
              <button 
                onClick={copyReport}
                className="btn border-slate-200 hover:bg-slate-50 text-slate-600 font-bold px-8"
              >
                <Copy size={18} />
                Copy Report
              </button>
              <button 
                onClick={() => window.print()}
                className="btn border-slate-200 hover:bg-slate-50 text-slate-600 font-bold px-8"
              >
                <ExternalLink size={18} />
                Export to PDF
              </button>
              <div className="sm:ml-auto" />
              <button 
                className="bg-slate-900 hover:bg-black text-white font-bold h-[52px] px-10 rounded-xl transition-all active:scale-95 shadow-lg shadow-slate-200" 
                onClick={handleFinishSession}
              >
                Exit to Dashboard
              </button>
            </div>
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
          <button 
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-8 h-[44px] rounded-xl transition-all active:scale-95 shadow-lg shadow-indigo-500/20 flex items-center gap-2" 
            onClick={handleSubmit}
          >
            Submit Review
            <ArrowRight size={18} />
          </button>
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
