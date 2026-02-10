import React, { useState, useEffect } from 'react'
import { 
  ChevronLeft, CheckCircle, AlertCircle, XCircle, 
  SkipForward, Terminal, PenTool, ExternalLink, ArrowRight, ArrowLeft, Play, Pause, Code, FileText, Copy, ClipboardCheck
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
  const [isPaused, setIsPaused] = useState(() => getSaved('isPaused', false))
  
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
    if (isPaused) return
    const timer = setInterval(() => setSeconds((s: number) => s + 1), 1000)
    return () => clearInterval(timer)
  }, [isPaused])

  // Persistence Effect
  useEffect(() => {
    const state = { currentIndex, results, practicalMark, practicalLink, seconds, notes, language, code, isPaused }
    localStorage.setItem(`review_session_${review.id}`, JSON.stringify(state))
  }, [currentIndex, results, practicalMark, practicalLink, seconds, notes, language, code, isPaused, review.id])

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
      sessionData: { results, currentIndex, seconds, code, language, practicalLink }
    }

    const promise = fetch(`${API_URL}/reviews/${review.id}/`, { 
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(finalState)
    })
    .then(res => {
      if (!res.ok) throw new Error('API Error')
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
      <div className="modal-overlay">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="modal-content"
        >
          <div className="modal-header">
            <div>
              <h2 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)' }}>Final Assessment Notes</h2>
              <p style={{ color: 'var(--text-tertiary)', fontSize: '14px', marginTop: '4px' }}>Review and refine your observations before finalizing the report.</p>
            </div>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'var(--primary-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
              <ClipboardCheck size={24} />
            </div>
          </div>

          <div className="modal-body">
            <div style={{ marginBottom: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'between', alignItems: 'center', marginBottom: '12px' }}>
                <label className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Evaluation Commentary</label>
              </div>
              <textarea 
                className="feedback-textarea"
                placeholder="Detail the student's performance, areas of excellence, and specific technical gaps identified during this session..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
                autoFocus
              />
            </div>

            <div style={{ display: 'flex', gap: '12px', background: '#fffbeb', border: '1px solid #fef3c7', padding: '16px', borderRadius: '12px', marginBottom: '32px' }}>
              <AlertCircle size={18} style={{ color: '#92400e', flexShrink: 0 }} />
              <p style={{ fontSize: '12px', color: '#92400e', lineHeight: 1.5 }}>
                <b>Internal Policy:</b> Ensure feedback is constructive and includes specific examples from the practical assessment.
              </p>
            </div>

            <div className="flex gap-4">
              <button 
                className="btn btn-secondary" 
                style={{ flex: 1, height: '52px' }}
                onClick={() => setShowFeedbackModal(false)}
              >
                Back to Session
              </button>
              <button 
                className="btn btn-primary" 
                style={{ flex: 2, height: '52px', background: 'var(--primary)', color: 'white' }}
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
      <div className="result-screen-root">
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="report-container"
        >
          {/* Executive Header */}
          <div className={`report-header ${isPassed ? 'passed' : 'failed'}`}>
            <div style={{ position: 'absolute', top: '0', right: '0', padding: '48px', opacity: 0.1, transform: 'rotate(12deg)' }}>
              {isPassed ? <CheckCircle size={180} /> : <XCircle size={180} />}
            </div>
            
            <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '24px' }}>
              <div>
                <span className="badge" style={{ background: 'rgba(255,255,255,0.2)', color: 'white', marginBottom: '16px', display: 'inline-block' }}>
                  Assessment Complete
                </span>
                <h1 style={{ color: 'white', fontSize: '36px', marginBottom: '8px' }}>
                  {isPassed ? 'Certification Passed' : 'Assessment Failed'}
                </h1>
                <p style={{ color: 'rgba(255,255,255,0.8)', fontWeight: 500 }}>
                  {review.studentName} • {review.module} • {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
                  AGGREGATE PROFICIENCY
                </div>
                <div style={{ fontSize: '56px', fontWeight: 900, lineHeight: 1 }}>
                  {totalScore.toFixed(0)}<span style={{ fontSize: '24px', opacity: 0.5 }}>%</span>
                </div>
              </div>
            </div>
          </div>

          <div className="report-content">
            {/* Score Distribution */}
            <div className="score-grid">
              <div className="score-card">
                <span className="text-xs" style={{ color: 'var(--text-tertiary)', marginBottom: '8px', display: 'block' }}>Theoretical Aptitude</span>
                <div className="flex" style={{ alignItems: 'baseline', gap: '4px' }}>
                  <span style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text-primary)' }}>{((stats.theoretical / stats.maxTheoretical) * 70).toFixed(1)}</span>
                  <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-tertiary)' }}>/ 70</span>
                </div>
                <div className="proficiency-bar">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${(stats.theoretical / stats.maxTheoretical) * 100}%` }}
                    className="proficiency-fill"
                    style={{ background: 'var(--primary)' }}
                  />
                </div>
              </div>

              <div className="score-card">
                <span className="text-xs" style={{ color: 'var(--text-tertiary)', marginBottom: '8px', display: 'block' }}>Practical Execution</span>
                <div className="flex" style={{ alignItems: 'baseline', gap: '4px' }}>
                  <span style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text-primary)' }}>{((practicalMark / 10) * 30).toFixed(1)}</span>
                  <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-tertiary)' }}>/ 30</span>
                </div>
                <div className="proficiency-bar">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${(practicalMark / 10) * 100}%` }}
                    className="proficiency-fill"
                    style={{ background: '#0ea5e9' }}
                  />
                </div>
              </div>

              <div className="score-card score-card-dark">
                <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)', marginBottom: '8px', display: 'block' }}>Cumulative Index</span>
                <div className="flex" style={{ alignItems: 'baseline', gap: '4px' }}>
                  <span style={{ fontSize: '32px', fontWeight: 900 }}>{totalScore.toFixed(1)}%</span>
                </div>
                <div style={{ display: 'flex', gap: '4px', marginTop: '16px' }}>
                  {Array.from({ length: 10 }).map((_, i) => (
                    <div 
                      key={i} 
                      style={{ 
                        height: '6px', flex: 1, borderRadius: '99px',
                        background: (i + 1) * 10 <= totalScore ? (isPassed ? '#10b981' : '#f43f5e') : '#334155'
                      }} 
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Performance Analysis */}
            <div className="analysis-grid">
              <div>
                <h3 className="section-title">
                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--primary)' }} />
                  Insight Summary
                </h3>
                <div className="insight-box">
                  {notes || "No qualitative feedback provided for this session."}
                </div>
                
                <h3 className="section-title" style={{ marginTop: '32px' }}>
                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }} />
                  Key Proficiency Strengths
                </h3>
                <div className="tag-list">
                  {perfectQs.length > 0 ? perfectQs.map(q => (
                    <span key={q.id} className="strength-tag">
                      {q.text.split(' ').slice(0, 4).join(' ')}...
                    </span>
                  )) : <span style={{ fontSize: '12px', color: 'var(--text-tertiary)', fontStyle: 'italic' }}>No specific strengths noted.</span>}
                </div>
              </div>

              <div>
                <h3 className="section-title">
                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#f43f5e' }} />
                  Critical Modules for Review
                </h3>
                <div className="critical-list">
                  {wrongQs.length > 0 ? wrongQs.map(q => (
                    <div key={q.id} className="critical-item wrong">
                      <XCircle size={18} style={{ flexShrink: 0 }} />
                      <span style={{ fontSize: '13px', fontWeight: 600 }}>{q.text}</span>
                    </div>
                  )) : (
                    <div className="critical-item" style={{ background: '#ecfdf5', border: '1px solid #d1fae5', color: '#065f46' }}>
                      <CheckCircle size={18} />
                      <span style={{ fontSize: '13px', fontWeight: 700 }}>Zero critical failures detected.</span>
                    </div>
                  )}
                  
                  {improveQs.length > 0 && improveQs.map(q => (
                    <div key={q.id} className="critical-item improve">
                      <AlertCircle size={18} style={{ flexShrink: 0 }} />
                      <span style={{ fontSize: '13px', fontWeight: 600 }}>{q.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="report-footer">
              <button onClick={copyReport} className="btn btn-secondary" style={{ padding: '0 24px' }}>
                <Copy size={18} /> Copy Report
              </button>
              <button onClick={() => window.print()} className="btn btn-secondary" style={{ padding: '0 24px' }}>
                <ExternalLink size={18} /> Export to PDF
              </button>
              <div style={{ flex: 1 }} />
              <button 
                className="btn btn-primary" 
                style={{ background: '#0f172a', color: 'white', padding: '0 32px', height: '52px' }} 
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
          <div className="flex gap-4 items-center" style={{ background: 'var(--surface-subtle)', padding: '6px 16px', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
            <button 
              onClick={() => setIsPaused(!isPaused)}
              style={{ 
                padding: '8px', 
                borderRadius: '8px', 
                background: isPaused ? 'var(--success-bg)' : 'var(--warning-bg)',
                color: isPaused ? 'var(--success)' : 'var(--warning)',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s ease'
              }}
              title={isPaused ? 'Start Timer' : 'Pause Timer'}
            >
              {isPaused ? <Play size={16} fill="currentColor" /> : <Pause size={16} fill="currentColor" />}
            </button>
            <div className="flex-col" style={{ alignItems: 'flex-start' }}>
              <span className="text-xs" style={{ color: 'var(--text-tertiary)', fontSize: '10px', fontWeight: 800, letterSpacing: '0.05em' }}>{isPaused ? 'PAUSED' : 'ELAPSED'}</span>
              <span style={{ fontFamily: 'var(--terminal-font)', fontWeight: 700, fontSize: '16px', color: isPaused ? 'var(--text-tertiary)' : 'var(--text-primary)' }}>{formatTime(seconds)}</span>
            </div>
          </div>
          
          <div className="flex-col" style={{ alignItems: 'flex-end', justifyContent: 'center' }}>
            <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>OVERALL SCORE</span>
            <span style={{ fontWeight: 800, fontSize: '18px', color: isPassed ? 'var(--success)' : 'var(--warning)' }}>{totalScore.toFixed(1)}%</span>
          </div>
          <button 
            className="btn btn-primary" 
            style={{ 
              backgroundColor: 'var(--primary)', 
              padding: '0 32px', 
              borderRadius: '12px',
              height: '48px',
              fontSize: '15px',
              fontWeight: 800,
              boxShadow: '0 4px 15px rgba(99, 102, 241, 0.4)',
              border: 'none'
            }} 
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
