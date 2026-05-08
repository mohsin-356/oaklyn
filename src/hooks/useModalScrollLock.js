import { useEffect, useRef } from 'react'

/**
 * Custom hook to lock/unlock body scroll when modal is open
 * Uses padding-right to prevent layout shift instead of position:fixed
 * @param {boolean} isOpen - Whether the modal is open
 */
export function useModalScrollLock(isOpen) {
  const scrollYRef = useRef(0)
  
  useEffect(() => {
    if (isOpen) {
      // Store current scroll position
      scrollYRef.current = window.scrollY || document.documentElement.scrollTop
      
      // Get scrollbar width to prevent layout shift
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth
      
      // Store original styles
      const originalOverflow = document.body.style.overflow
      const originalPaddingRight = document.body.style.paddingRight
      
      // Lock scroll - only modify overflow, don't use position:fixed
      document.body.style.overflow = 'hidden'
      if (scrollbarWidth > 0) {
        document.body.style.paddingRight = `${scrollbarWidth}px`
      }
      
      // Cleanup function to restore scroll
      return () => {
        document.body.style.overflow = originalOverflow
        document.body.style.paddingRight = originalPaddingRight
        // Restore scroll position
        window.scrollTo(0, scrollYRef.current)
      }
    }
  }, [isOpen])
}

export default useModalScrollLock
