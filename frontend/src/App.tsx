import { useState, useEffect } from 'react'
import Dashboard from './views/Dashboard.tsx'
import ReviewSessionView from './views/ReviewSession.tsx'
import type { ScheduledReview } from './types'
import { Toaster } from 'sonner'

function App() {
  // Initialize state from potential active session
  const [selectedReview, setSelectedReview] = useState<ScheduledReview | null>(() => {
    try {
      const saved = localStorage.getItem('active_session')
      return saved ? JSON.parse(saved) : null
    } catch { return null }
  })

  // Set view based on whether we have an active session
  const [activeView, setActiveView] = useState<'dashboard' | 'review'>(() => {
    return localStorage.getItem('active_session') ? 'review' : 'dashboard'
  })

  const [reviews, setReviews] = useState<ScheduledReview[]>([])

  useEffect(() => {
    const saved = localStorage.getItem('scheduled_reviews')
    if (saved) setReviews(JSON.parse(saved))
  }, [])

  const handleStartReview = (review: ScheduledReview) => {
    setSelectedReview(review)
    setActiveView('review')
    localStorage.setItem('active_session', JSON.stringify(review))
  }

  const handleCompleteReview = () => {
    setActiveView('dashboard')
    setSelectedReview(null)
    localStorage.removeItem('active_session')
  }

  const handleCancelReview = () => {
    setActiveView('dashboard')
    setSelectedReview(null)
    localStorage.removeItem('active_session')
  }

  return (
    <div className="min-h-screen">
      <Toaster position="top-center" richColors closeButton />
      {activeView === 'dashboard' ? (
        <Dashboard 
          reviews={reviews} 
          setReviews={(r) => {
            setReviews(r)
            localStorage.setItem('scheduled_reviews', JSON.stringify(r))
          }}
          onStartReview={handleStartReview} 
        />
      ) : (
        selectedReview && (
          <ReviewSessionView 
            review={selectedReview} 
            onCancel={handleCancelReview}
            onComplete={handleCompleteReview}
          />
        )
      )}
    </div>
  )
}

export default App
