import { useState, useCallback, useRef } from 'react'
import { DialogueLine } from '../types'

export interface UndoRedoOptions<T> {
  maxHistory?: number
  isEqual?: (a: T, b: T) => boolean
}

export function areLinesEqual(a: DialogueLine[], b: DialogueLine[]): boolean {
  if (a === b) return true
  if (!a || !b) return false
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    const l1 = a[i]
    const l2 = b[i]
    if (
      l1.id !== l2.id ||
      l1.startTime !== l2.startTime ||
      l1.endTime !== l2.endTime ||
      l1.text !== l2.text ||
      (l1.layer || 1) !== (l2.layer || 1) ||
      l1.activeTakeIndex !== l2.activeTakeIndex ||
      (l1.audioOffset || 0) !== (l2.audioOffset || 0)
    ) {
      return false
    }
    const t1 = l1.takes || []
    const t2 = l2.takes || []
    if (t1.length !== t2.length) return false
    for (let j = 0; j < t1.length; j++) {
      if (t1[j].id !== t2[j].id || t1[j].filePath !== t2[j].filePath) {
        return false
      }
    }
  }
  return true
}

function cloneValue<T>(val: T): T {
  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(val)
    } catch {
      // Fallback if structuredClone fails on any DOM or special reference
    }
  }
  return JSON.parse(JSON.stringify(val))
}

export interface UseUndoRedoReturn<T> {
  state: T
  setState: React.Dispatch<React.SetStateAction<T>>
  setWithoutHistory: (newStateOrUpdater: T | ((prev: T) => T)) => void
  reset: (initialState: T) => void
  undo: () => boolean
  redo: () => boolean
  canUndo: boolean
  canRedo: boolean
  clearHistory: () => void
  historySize: number
  futureSize: number
}

export function useUndoRedo<T>(
  initialPresent: T,
  options: UndoRedoOptions<T> = {}
): UseUndoRedoReturn<T> {
  const { maxHistory = 100, isEqual } = options

  const [state, setInternalState] = useState<T>(initialPresent)
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)

  // Keep stacks in refs to ensure synchronous access and avoid stale closures
  const pastRef = useRef<T[]>([])
  const futureRef = useRef<T[]>([])
  const presentRef = useRef<T>(initialPresent)
  presentRef.current = state

  const isEqualRef = useRef(isEqual)
  isEqualRef.current = isEqual

  const setState: React.Dispatch<React.SetStateAction<T>> = useCallback(
    (updater: T | ((prev: T) => T)) => {
      setInternalState((prev) => {
        const nextState =
          typeof updater === 'function'
            ? (updater as (p: T) => T)(prev)
            : updater

        const areEqual = isEqualRef.current
          ? isEqualRef.current(prev, nextState)
          : prev === nextState

        if (areEqual) {
          return prev
        }

        // Push previous state clone to past stack
        const snapshot = cloneValue(prev)
        const updatedPast = [...pastRef.current, snapshot]
        if (updatedPast.length > maxHistory) {
          updatedPast.shift()
        }
        pastRef.current = updatedPast
        futureRef.current = []

        setCanUndo(true)
        setCanRedo(false)

        return nextState
      })
    },
    [maxHistory]
  )

  const setWithoutHistory = useCallback((newStateOrUpdater: T | ((prev: T) => T)) => {
    setInternalState((prev) => {
      const nextState =
        typeof newStateOrUpdater === 'function'
          ? (newStateOrUpdater as (p: T) => T)(prev)
          : newStateOrUpdater
      return nextState
    })
  }, [])

  const reset = useCallback((initialState: T) => {
    pastRef.current = []
    futureRef.current = []
    setCanUndo(false)
    setCanRedo(false)
    setInternalState(initialState)
  }, [])

  const clearHistory = useCallback(() => {
    pastRef.current = []
    futureRef.current = []
    setCanUndo(false)
    setCanRedo(false)
  }, [])

  const undo = useCallback((): boolean => {
    if (pastRef.current.length === 0) return false

    const previous = pastRef.current[pastRef.current.length - 1]
    pastRef.current = pastRef.current.slice(0, pastRef.current.length - 1)

    const currentSnapshot = cloneValue(presentRef.current)
    futureRef.current = [currentSnapshot, ...futureRef.current]

    setCanUndo(pastRef.current.length > 0)
    setCanRedo(true)

    setInternalState(previous)
    return true
  }, [])

  const redo = useCallback((): boolean => {
    if (futureRef.current.length === 0) return false

    const next = futureRef.current[0]
    futureRef.current = futureRef.current.slice(1)

    const currentSnapshot = cloneValue(presentRef.current)
    const updatedPast = [...pastRef.current, currentSnapshot]
    if (updatedPast.length > maxHistory) {
      updatedPast.shift()
    }
    pastRef.current = updatedPast

    setCanUndo(true)
    setCanRedo(futureRef.current.length > 0)

    setInternalState(next)
    return true
  }, [maxHistory])

  return {
    state,
    setState,
    setWithoutHistory,
    reset,
    undo,
    redo,
    canUndo,
    canRedo,
    clearHistory,
    historySize: pastRef.current.length,
    futureSize: futureRef.current.length,
  }
}
