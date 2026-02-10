import React, { useState, useEffect } from 'react'
import { Calendar, BookOpen, Clock, Search, ArrowRight, UserPlus, SlidersHorizontal } from 'lucide-react'
import type { ScheduledReview } from '../types'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { API_URL } from '../config'

interface Props {
  reviews: ScheduledReview[];
  setReviews: (reviews: ScheduledReview[]) => void;
  onStartReview: (review: ScheduledReview) => void;
}

const Dashboard: React.FC<Props> = ({ reviews, setReviews, onStartReview }) => {
  const [showForm, setShowForm] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [formData, setFormData] = useState({
    studentName: '',
    module: 'Module 1',
    batch: '',
  })

  useEffect(() => {
    fetch(`${API_URL}/reviews/`)
      .then(res => res.json())
      .then(data => setReviews(data))
      .catch(err => toast.error('Failed to load reviews. Backend might be down.'))
  }, [])

  const handleCreateReview = (e: React.FormEvent) => {
    e.preventDefault()
    
    const newReview = {
      studentName: formData.studentName,
      batch: formData.batch,
      module: formData.module,
      status: 'pending' as const,
      scheduledAt: new Date().toISOString(),
    }

    const promise = fetch(`${API_URL}/reviews/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newReview)
    })
    .then(async res => {
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to create review')
      }
      return res.json()
    })
    .then(savedReview => {
      setReviews([savedReview, ...reviews])
      setShowForm(false)
      setFormData({ studentName: '', batch: '', module: 'Module 1' })
    })
    
    toast.promise(promise, {
      loading: 'Scheduling review...',
      success: 'Review scheduled successfully!',
      error: (err) => err.message
    })
  }

  const filteredReviews = reviews.filter(r => 
    r.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.batch.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-main)' }}>
      {/* Precision Header */}
      <header className="dashboard-header">
        <div className="container">
          <div className="flex justify-between items-start">
            <div className="flex-col gap-2" style={{ alignItems: 'flex-start' }}>
              <div className="flex gap-2">
                <span className="badge" style={{ backgroundColor: 'var(--primary-subtle)', color: 'var(--primary)', padding: '6px 12px' }}>
                  v2.0 Stable
                </span>
                <span className="badge" style={{ backgroundColor: 'var(--border-subtle)', color: 'var(--text-tertiary)', padding: '6px 12px' }}>
                  Enterprise Core
                </span>
              </div>
              <h1>Evaluation Center</h1>
              <p style={{ color: 'var(--text-secondary)', maxWidth: '500px', fontSize: '15px' }}>
                Conduct standardized module assessments with real-time scoring and practical insights.
              </p>
            </div>
            <button className="btn btn-secondary">
              <SlidersHorizontal size={18} />
              View Protocol
            </button>
          </div>
        </div>
      </header>

      <div className="container">
        {/* Strict Action Bar */}
        <div className="action-bar">
          <div className="search-wrapper">
            <Search className="search-icon" size={20} />
            <input 
              type="text" 
              className="input-field" 
              placeholder="Search student profile or batch lookup..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <button className="btn btn-secondary">
            <Calendar size={18} />
            History
          </button>
          <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
            <UserPlus size={18} />
            Schedule Session
          </button>
        </div>

        {/* Modular Form */}
        <AnimatePresence>
          {showForm && (
            <motion.div 
              initial={{ opacity: 0, height: 0, marginTop: 0 }}
              animate={{ opacity: 1, height: 'auto', marginTop: 32 }}
              exit={{ opacity: 0, height: 0, marginTop: 0 }}
              style={{ overflow: 'hidden' }}
            >
              <div className="review-card" style={{ border: '2px solid var(--primary)', background: '#fcfcfe' }}>
                <div style={{ marginBottom: '24px' }}>
                  <h2 style={{ marginBottom: '4px' }}>Initialize Session</h2>
                  <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Set evaluation parameters for the upcoming module review.</p>
                </div>
                <form onSubmit={handleCreateReview} className="mb-12 p-8 bg-white border border-slate-200 rounded-2xl shadow-sm" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '20px', alignItems: 'flex-end' }}>
                  <div className="flex-col gap-2" style={{ alignItems: 'flex-start' }}>
                    <label className="text-xs">Student Full Name</label>
                    <input 
                      type="text" 
                      className="input-field" 
                      style={{ paddingLeft: '16px' }}
                      placeholder="Alexander King"
                      required
                      value={formData.studentName}
                      onChange={e => setFormData({ ...formData, studentName: e.target.value })}
                    />
                  </div>
                  <div className="flex-col gap-2" style={{ alignItems: 'flex-start' }}>
                    <label className="text-xs">Target Module</label>
                    <select 
                      className="input-field" 
                      style={{ paddingLeft: '16px', appearance: 'none' }}
                      value={formData.module}
                      onChange={e => setFormData({ ...formData, module: e.target.value })}
                    >
                      {[1, 2, 3, 4, 5, 6].map(m => <option key={m} value={`Module ${m}`}>Module {m} - Core Proficiencies</option>)}
                    </select>
                  </div>
                  <div className="flex-col gap-2" style={{ alignItems: 'flex-start' }}>
                    <label className="text-xs">Batch Reference</label>
                    <input 
                      type="text" 
                      className="input-field" 
                      style={{ paddingLeft: '16px' }}
                      placeholder="B2026-FT-01"
                      required
                      value={formData.batch}
                      onChange={e => setFormData({ ...formData, batch: e.target.value })}
                    />
                  </div>
                  <button type="submit" className="btn btn-primary" style={{ padding: '0 32px' }}>Confirm Session</button>
                </form>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Grid System */}
        <div className="review-grid">
          {filteredReviews.length === 0 ? (
            <div className="flex-col items-center justify-center p-20" style={{ gridColumn: '1 / -1', border: '1px dashed var(--border-base)', borderRadius: '16px', gap: '16px' }}>
              <Search size={48} style={{ color: 'var(--border-base)' }} />
              <p className="font-semibold" style={{ color: 'var(--text-tertiary)' }}>No evaluations found matching search parameters.</p>
            </div>
          ) : (
            filteredReviews.map((review) => (
              <motion.div 
                layout
                key={review.id}
                className="review-card"
              >
                <div className="card-top">
                  <div className="avatar">{review.studentName[0]}</div>
                  <span className={`badge ${review.status === 'completed' ? 'badge-completed' : 'badge-pending'}`}>
                    {review.status}
                  </span>
                </div>
                
                <div className="card-body">
                  <h3 style={{ fontSize: '18px', marginBottom: '4px' }}>{review.studentName}</h3>
                  <div className="info-item" style={{ marginBottom: '8px', color: 'var(--text-tertiary)', fontWeight: 'bold', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    <Clock size={14} /> Batch {review.batch}
                  </div>
                  
                  <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '16px' }}>
                    <div className="info-item" style={{ marginBottom: '8px' }}>
                      <BookOpen size={16} style={{ color: 'var(--primary)' }} />
                      <span>{review.module} Evaluation</span>
                    </div>
                    <div className="info-item">
                      <Calendar size={16} style={{ color: 'var(--text-tertiary)' }} />
                      <span>Scheduled: {review.date}</span>
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: 'auto' }}>
                  {review.status === 'pending' ? (
                    <button 
                      onClick={() => onStartReview(review)}
                      className="btn btn-primary w-full"
                    >
                      Start Assessment
                      <ArrowRight size={18} />
                    </button>
                  ) : (
                    <div className="flex items-center justify-center btn btn-secondary w-full" style={{ cursor: 'default', backgroundColor: 'var(--bg-subtle)' }}>
                      Assessment Finalized
                    </div>
                  )}
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

export default Dashboard
