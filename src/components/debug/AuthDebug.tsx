'use client'

import { useAuthenticator } from '@aws-amplify/ui-react'
import { useEffect, useState, useRef, useMemo } from 'react'
import { AuthCookies } from '@/lib/auth'
import { apiClient } from '@/lib/apiClient'
import { fetchAuthSession, getCurrentUser } from 'aws-amplify/auth'
import { Hub } from 'aws-amplify/utils'
import { useSession } from '@/hooks/useSession'

interface DebugLog {
  timestamp: string
  type: 'auth' | 'onboarding' | 'api' | 'error' | 'hub' | 'hook' | 'cookie'
  event: string
  data?: any
  grouped?: boolean
}

interface AuthFlowState {
  route: string
  user: any
  sessionValid: boolean
  cookiesPresent: boolean
  lastChange: string
}

interface OnboardingFlowState {
  currentStep: string
  completedSteps: string[]
  skippedSteps: string[]
  userProfile: any
  organization: any
  isLoading: boolean
  error: string | null
  lastChange: string
}

export default function AuthDebug() {
  // Temporarily disabled
  return null

  const { user: sessionUser, organization, status, error } = useSession()
  const { user, route } = useAuthenticator((context) => [context.user, context.route])
  const userProfile = sessionUser
  const completedSteps = useMemo(
    () => sessionUser?.onboarding_audit?.completed_steps || [],
    [sessionUser]
  )
  const skippedSteps = useMemo(
    () => sessionUser?.onboarding_audit?.skipped_steps || [],
    [sessionUser]
  )
  const currentStep = sessionUser?.onboarding_audit?.current_step || ''
  const isLoading = status === 'loading'
  const [cookieStatus, setCookieStatus] = useState(false)
  const [apiTestResult, setApiTestResult] = useState<any>(null)
  const [sessionInfo, setSessionInfo] = useState<any>(null)
  const [refreshCount, setRefreshCount] = useState(0)
  const [debugLogs, setDebugLogs] = useState<DebugLog[]>([])
  const [authFlowHistory, setAuthFlowHistory] = useState<AuthFlowState[]>([])
  const [onboardingFlowHistory, setOnboardingFlowHistory] = useState<OnboardingFlowState[]>([])
  const [expanded, setExpanded] = useState(false)
  const [hubEvents, setHubEvents] = useState<any[]>([])
  const [cookieMetadata, setCookieMetadata] = useState<any>(null)
  const [apiInterceptorActive, setApiInterceptorActive] = useState(false)
  const [collapsedSections, setCollapsedSections] = useState<{ [key: string]: boolean }>({})
  const prevAuthState = useRef<any>(null)
  const prevOnboardingState = useRef<any>(null)
  const startTime = useRef(Date.now())
  const logContainerRef = useRef<HTMLDivElement>(null)

  const addLog = (type: DebugLog['type'], event: string, data?: any, grouped = false) => {
    const log: DebugLog = {
      timestamp: new Date().toISOString().split('T')[1].split('.')[0],
      type,
      event,
      data,
      grouped,
    }
    setDebugLogs((prev) => {
      const newLogs = [...prev.slice(-99), log] // Keep last 100 logs
      // Auto-scroll to bottom if expanded
      setTimeout(() => {
        if (expanded && logContainerRef.current) {
          logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight
        }
      }, 100)
      return newLogs
    })
    console.log(`[AuthDebug ${type.toUpperCase()}]`, event, data)
  }

  // Hub event listener for real-time auth events
  useEffect(() => {
    const hubListener = (data: any) => {
      const { payload } = data
      addLog('hub', `Hub event: ${payload.event}`, {
        event: payload.event,
        data: payload.data,
        message: payload.message,
      })
      setHubEvents((prev) => [...prev.slice(-19), { ...payload, timestamp: Date.now() }])
    }

    const unsubscribe = Hub.listen('auth', hubListener)
    return unsubscribe
  }, [])

  useEffect(() => {
    setCookieStatus(AuthCookies.check())
    checkCookieMetadata()
    checkSession()
    addLog('auth', 'Debug component mounted/refreshed', { refreshCount })
  }, [refreshCount])

  // Track auth state changes
  useEffect(() => {
    const currentAuthState = {
      route,
      user: user?.userId,
      sessionValid: !!sessionInfo?.hasTokens,
      cookiesPresent: cookieStatus,
    }

    if (
      prevAuthState.current &&
      JSON.stringify(prevAuthState.current) !== JSON.stringify(currentAuthState)
    ) {
      const changes = Object.keys(currentAuthState).filter(
        (key) =>
          prevAuthState.current[key as keyof typeof currentAuthState] !==
          currentAuthState[key as keyof typeof currentAuthState]
      )
      addLog('auth', 'Auth state changed', {
        changes,
        from: prevAuthState.current,
        to: currentAuthState,
      })
    }

    const authState: AuthFlowState = {
      route,
      user: user ? { userId: user.userId, username: user.username } : null,
      sessionValid: !!sessionInfo?.hasTokens,
      cookiesPresent: cookieStatus,
      lastChange: new Date().toISOString(),
    }

    setAuthFlowHistory((prev) => [...prev.slice(-9), authState]) // Keep last 10 states
    prevAuthState.current = currentAuthState
  }, [route, user, sessionInfo, cookieStatus])

  // Track onboarding state changes
  useEffect(() => {
    const currentOnboardingState = {
      currentStep,
      completedSteps,
      skippedSteps,
      userProfile: !!userProfile,
      organization: !!organization,
      isLoading: status === 'loading',
      error,
    }

    if (
      prevOnboardingState.current &&
      JSON.stringify(prevOnboardingState.current) !== JSON.stringify(currentOnboardingState)
    ) {
      type OnboardingKey =
        | 'currentStep'
        | 'completedSteps'
        | 'skippedSteps'
        | 'userProfile'
        | 'organization'
        | 'isLoading'
        | 'error'
      const changes = (Object.keys(currentOnboardingState) as OnboardingKey[]).filter(
        (key) =>
          JSON.stringify(prevOnboardingState.current[key]) !==
          JSON.stringify(currentOnboardingState[key])
      )
      addLog('onboarding', 'Onboarding state changed', {
        changes,
        from: prevOnboardingState.current,
        to: currentOnboardingState,
      })
    }

    const onboardingState: OnboardingFlowState = {
      currentStep,
      completedSteps: [...completedSteps],
      skippedSteps: [...skippedSteps],
      userProfile: userProfile ? { id: userProfile.user_id, email: userProfile.email } : null,
      organization: organization
        ? { id: organization.organization_id, name: organization.name }
        : null,
      isLoading: status === 'loading',
      error,
      lastChange: new Date().toISOString(),
    }

    setOnboardingFlowHistory((prev) => [...prev.slice(-9), onboardingState]) // Keep last 10 states
    prevOnboardingState.current = currentOnboardingState
  }, [currentStep, completedSteps, skippedSteps, userProfile, organization, status, error])

  const checkCookieMetadata = () => {
    const cookies = document.cookie.split(';').reduce((acc, cookie) => {
      const [name, value] = cookie.trim().split('=')
      if (name && (name.includes('amplify') || name.includes('auth') || name.includes('token'))) {
        acc[name] = { value: value?.slice(0, 20) + '...', present: !!value }
      }
      return acc
    }, {} as any)

    setCookieMetadata({
      authCookies: cookies,
      totalCookies: document.cookie.split(';').length,
      cookieString: document.cookie.slice(0, 200) + '...',
    })
  }

  const getAuthHeaders = () => {
    try {
      // This would need to be implemented based on your apiClient setup
      return { Authorization: 'Bearer [token present]' }
    } catch {
      return { Authorization: 'No auth header' }
    }
  }

  const checkSession = async () => {
    const sessionStart = Date.now()
    try {
      addLog('auth', 'Checking session...')
      const session = await fetchAuthSession()
      const sessionTime = Date.now() - sessionStart

      const sessionData = {
        hasTokens: !!(session.tokens?.accessToken && session.tokens?.idToken),
        accessToken: session.tokens?.accessToken ? 'Present' : 'Missing',
        idToken: session.tokens?.idToken ? 'Present' : 'Missing',
        credentials: session.credentials ? 'Present' : 'Missing',
        tokenExpiry:
          session.tokens?.accessToken && session.tokens.accessToken.payload?.exp
            ? new Date(session.tokens.accessToken.payload.exp * 1000).toISOString()
            : 'N/A',
        sessionTime: `${sessionTime}ms`,
      }

      setSessionInfo(sessionData)
      addLog('auth', 'Session check completed', sessionData)
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      setSessionInfo({ error: errorMsg })
      addLog('error', 'Session check failed', {
        error: errorMsg,
        time: `${Date.now() - sessionStart}ms`,
      })
    }
  }

  const forceRefresh = () => {
    addLog('auth', 'Manual refresh triggered')
    setRefreshCount((prev) => prev + 1)
    setCookieStatus(AuthCookies.check())
  }

  const forceAuthCheck = async () => {
    const authStart = Date.now()
    try {
      addLog('auth', 'Force auth check started')
      const session = await fetchAuthSession({ forceRefresh: true })
      const authTime = Date.now() - authStart
      addLog('auth', 'Force auth check completed', {
        time: `${authTime}ms`,
        hasTokens: !!session.tokens,
      })
      forceRefresh()
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      addLog('error', 'Force auth check failed', {
        error: errorMsg,
        time: `${Date.now() - authStart}ms`,
      })
    }
  }

  const clearLogs = () => {
    setDebugLogs([])
    addLog('auth', 'Debug logs cleared')
  }

  const getFlowStatus = () => {
    const uptime = Math.floor((Date.now() - startTime.current) / 1000)
    const authTransitions = authFlowHistory.length
    const onboardingTransitions = onboardingFlowHistory.length

    return {
      uptime: `${Math.floor(uptime / 60)}:${(uptime % 60).toString().padStart(2, '0')}`,
      authTransitions,
      onboardingTransitions,
      totalLogs: debugLogs.length,
    }
  }

  const getFullDebugData = () => ({
    timestamp: new Date().toISOString(),
    auth: {
      route,
      user: user ? { userId: user.userId, username: user.username } : null,
      sessionInfo,
      cookieStatus,
      cookieMetadata,
      hubEvents: hubEvents.slice(-10),
      history: authFlowHistory.slice(-5),
    },
    onboarding: {
      currentStep,
      completedSteps,
      skippedSteps,
      userProfile: userProfile ? { id: userProfile.user_id, email: userProfile.email } : null,
      organization: organization
        ? { id: organization.organization_id, name: organization.name }
        : null,
      isLoading: status === 'loading',
      error,
      history: onboardingFlowHistory.slice(-5),
    },
    logs: debugLogs.slice(-20),
    flowStatus: getFlowStatus(),
    hookState: {
      route,
      hasUser: !!user,
      userId: user?.userId,
    },
  })

  const copyDebugInfo = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(getFullDebugData(), null, 2))
      addLog('auth', 'Debug info copied to clipboard')
    } catch (error) {
      addLog('error', 'Failed to copy debug info')
    }
  }

  const downloadDebugJson = () => {
    const debugData = getFullDebugData()
    const blob = new Blob([JSON.stringify(debugData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `zenith-debug-${Date.now()}.json`
    link.click()
    URL.revokeObjectURL(url)
    addLog('auth', 'Debug data downloaded as JSON')
  }

  const runFullAudit = async () => {
    addLog('auth', '🧪 Running Full Diagnostic Audit...', null, true)

    // Session audit
    await checkSession()

    // Email verification audit
    await handleEmailVerification()

    // Profile API audit
    await testProfileApi()

    // Hook audit
    await testOnboardingHook()

    // Consolidated snapshot
    const snapshot = {
      userId: user?.userId,
      route,
      cookies: cookieMetadata,
      sessionTokens: sessionInfo,
      onboardingState: {
        currentStep,
        completedSteps,
        profile: !!userProfile,
        org: !!organization,
        isLoading: status === 'loading',
        error,
      },
      hubEvents: hubEvents.slice(-5),
    }

    addLog('auth', '📦 Full Audit Snapshot', snapshot, true)
  }

  const toggleSection = (section: string) => {
    setCollapsedSections((prev) => ({ ...prev, [section]: !prev[section] }))
  }

  const logApiRequest = (path: string, method: string, headers: any) => {
    addLog('api', `API Request: ${method} ${path}`, {
      path,
      method,
      headers: { ...headers, Authorization: headers.Authorization ? '[PRESENT]' : '[MISSING]' },
      cookies: cookieMetadata?.authCookies,
      timestamp: new Date().toISOString(),
    })
  }

  const logApiResponse = (path: string, status: number, duration: number, data?: any) => {
    addLog('api', `API Response: ${status} ${path}`, {
      status,
      duration: `${duration}ms`,
      hasData: !!data,
      dataSize: data ? JSON.stringify(data).length : 0,
    })
  }

  const testApiCall = async () => {
    const apiStart = Date.now()
    const path = '/api/auth/test'
    try {
      logApiRequest(path, 'GET', getAuthHeaders())
      const response = await apiClient(path)
      const result = await response.json()
      const apiTime = Date.now() - apiStart

      logApiResponse(path, response.status, apiTime, result)

      const apiResult = {
        success: true,
        data: result,
        time: `${apiTime}ms`,
        status: response.status,
      }
      setApiTestResult(apiResult)
      addLog('api', 'API test completed', apiResult)
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      const apiTime = Date.now() - apiStart

      logApiResponse(path, 0, apiTime)

      const apiResult = { success: false, error: errorMsg, time: `${apiTime}ms` }
      setApiTestResult(apiResult)
      addLog('error', 'API test failed', apiResult)
    }
  }

  const testProfileApi = async () => {
    const apiStart = Date.now()
    const path = '/api/users/me/profile'
    try {
      logApiRequest(path, 'GET', getAuthHeaders())
      const response = await apiClient(path)
      const result = await response.json()
      const apiTime = Date.now() - apiStart

      logApiResponse(path, response.status, apiTime, result)

      const apiResult = {
        success: true,
        data: result,
        time: `${apiTime}ms`,
        status: response.status,
      }
      setApiTestResult(apiResult)
      addLog('api', 'Profile API test completed', apiResult)
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      const apiTime = Date.now() - apiStart

      logApiResponse(path, 0, apiTime)

      const apiResult = { success: false, error: errorMsg, time: `${apiTime}ms` }
      setApiTestResult(apiResult)
      addLog('error', 'Profile API test failed', apiResult)
    }
  }

  const debugOnboardingHook = () => {
    addLog('onboarding', 'Current onboarding state', {
      currentStep,
      completedSteps,
      skippedSteps,
      hasUserProfile: !!userProfile,
      hasOrganization: !!organization,
      isLoading: status === 'loading',
      error,
      route,
      hasUser: !!user,
      userId: user?.userId,
      username: user?.username,
    })
  }

  const testOnboardingHook = async () => {
    try {
      addLog('hook', 'useInitialOnboardingState hook activation check', {
        route,
        userId: user?.userId,
        hasUser: !!user,
        hasTokens: !!sessionInfo?.hasTokens,
        shouldHookRun: (route === 'authenticated' || route === 'setup') && !!user,
        earlyExitReasons: {
          noUser: !user,
          wrongRoute: route !== 'authenticated' && route !== 'setup',
        },
      })

      if (user) {
        addLog('hook', 'Hook would proceed - testing profile fetch...')
        const response = await apiClient('/api/users/me/profile')
        const result = await response.json()
        addLog('hook', 'Hook profile fetch simulation result', {
          success: response.ok,
          status: response.status,
          hasData: !!result,
          isEmpty: !result || Object.keys(result).length === 0,
          userId: result?.user_id,
        })
      } else {
        addLog('hook', 'Hook would early-exit due to missing user')
      }
    } catch (error) {
      addLog('error', 'Hook simulation failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  const forceOnboardingRefresh = () => {
    addLog('onboarding', 'Forcing onboarding context refresh...')
    // Force a re-render by updating a state that the onboarding hook depends on
    forceRefresh()
  }

  const triggerOnboardingHook = async () => {
    try {
      addLog('onboarding', 'Manually triggering onboarding data load...')
      const response = await apiClient('/api/users/me/profile')
      const result = await response.json()

      if (response.ok) {
        addLog('onboarding', 'Profile loaded successfully', {
          hasProfile: !!result,
          userId: result?.user_id,
          email: result?.email,
        })
        addLog(
          'onboarding',
          'Profile data loaded - the onboarding hook should pick this up automatically'
        )

        // Force a refresh to trigger re-evaluation
        forceRefresh()
      } else {
        addLog('error', 'Manual profile load failed', { status: response.status })
      }
    } catch (error) {
      addLog('error', 'Manual onboarding trigger failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  const handleEmailVerification = async () => {
    try {
      addLog('auth', 'Checking email verification status...')
      const currentUser = await getCurrentUser()

      console.log('currentUser object:', currentUser)
      const verified = false
      const isInSetupButVerified = route === 'setup' && verified

      addLog('auth', 'Email verification check', {
        userId: currentUser.userId,
        verified,
        route,
        isInSetupButVerified,
        attributes: currentUser.signInDetails,
      })

      if (isInSetupButVerified) {
        addLog('auth', '⚠️ User is verified but still in setup route - potential bug', {
          route,
          verified,
          userId: currentUser.userId,
        })
      }

      forceAuthCheck()
    } catch (error) {
      if (error instanceof Error && error.message.includes('already confirmed')) {
        addLog('auth', 'Email already verified, refreshing session')
        forceAuthCheck()
      } else {
        addLog('error', 'Email verification check failed', {
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }
  }

  const forceAuthState = async () => {
    try {
      addLog('auth', 'Forcing authentication state...')
      if (sessionInfo?.hasTokens) {
        const { Hub } = await import('aws-amplify/utils')
        const { getCurrentUser } = await import('aws-amplify/auth')

        try {
          const currentUser = await getCurrentUser()
          addLog('auth', 'Got current user', { userId: currentUser.userId })

          Hub.dispatch('auth', {
            event: 'signedIn',
            data: { user: currentUser },
          })
          addLog('auth', 'Authentication state forced - dispatched signedIn event')
        } catch (userError) {
          addLog('error', 'Failed to get current user', {
            error: userError instanceof Error ? userError.message : 'Unknown error',
          })
        }

        forceRefresh()
      } else {
        addLog('error', 'Cannot force auth state - no valid tokens')
      }
    } catch (error) {
      addLog('error', 'Failed to force auth state', {
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  if (process.env.NODE_ENV !== 'development') {
    return null
  }

  const flowStatus = getFlowStatus()
  return (
    <div
      className={`fixed bottom-4 right-4 bg-black/90 text-white p-4 rounded-lg text-xs z-50 transition-all duration-300 ${
        expanded ? 'max-w-4xl max-h-[80vh] w-[90vw]' : 'max-w-sm max-h-96'
      } overflow-y-auto`}
    >
      <div className="flex justify-between items-center mb-2">
        <h3 className="font-bold">Debug Panel - {flowStatus.uptime}</h3>
        <div className="flex gap-1">
          <button
            onClick={copyDebugInfo}
            className="bg-gray-600 px-2 py-1 rounded text-xs hover:bg-gray-500"
            title="Copy debug info to clipboard"
          >
            📋
          </button>
          <button
            onClick={() => setExpanded(!expanded)}
            className="bg-gray-600 px-2 py-1 rounded text-xs hover:bg-gray-500"
          >
            {expanded ? '−' : '+'}
          </button>
        </div>
      </div>

      <div className={expanded ? 'grid grid-cols-2 gap-4' : 'space-y-3'}>
        {/* Auth Section */}
        <div className="space-y-1">
          <div
            className="sticky top-0 bg-black/90 font-semibold text-blue-300 flex items-center gap-2 cursor-pointer"
            onClick={() => toggleSection('auth')}
          >
            Auth Flow ({flowStatus.authTransitions} transitions)
            <span
              className={`w-2 h-2 rounded-full ${
                route === 'authenticated'
                  ? 'bg-green-400'
                  : route === 'setup'
                    ? 'bg-yellow-400 animate-pulse'
                    : 'bg-red-400'
              }`}
            ></span>
            <span className="text-xs">{collapsedSections.auth ? '▶' : '▼'}</span>
          </div>
          {!collapsedSections.auth && (
            <>
              <div>
                Route:{' '}
                <span
                  className={
                    route === 'authenticated'
                      ? 'text-green-400'
                      : route === 'setup'
                        ? 'text-yellow-400'
                        : 'text-red-400'
                  }
                >
                  {route}
                </span>
              </div>
              {route === 'setup' && (
                <div className="text-yellow-400 text-xs">⚠️ Email confirmation needed</div>
              )}
              <div>
                User: {user ? '✅' : '❌'} {user?.userId && `(${user.userId.slice(0, 8)}...)`}
              </div>
              <div>Cookies: {cookieStatus ? '✅' : '❌'}</div>
              <div>Username: {user?.username || 'None'}</div>
              {sessionInfo && (
                <div className="mt-2 pt-2 border-t border-gray-600">
                  <div className="font-semibold">Session ({sessionInfo.sessionTime}):</div>
                  <div>Has Tokens: {sessionInfo.hasTokens ? '✅' : '❌'}</div>
                  <div>Access: {sessionInfo.accessToken}</div>
                  <div>ID: {sessionInfo.idToken}</div>
                  <div>Refresh: {sessionInfo.refreshToken}</div>
                  {sessionInfo.tokenExpiry !== 'N/A' && (
                    <div>
                      Expires:{' '}
                      <span className="text-xs">
                        {new Date(sessionInfo.tokenExpiry).toLocaleTimeString()}
                      </span>
                    </div>
                  )}
                  {sessionInfo.error && (
                    <div className="text-red-400">Error: {sessionInfo.error}</div>
                  )}
                </div>
              )}

              {/* Cookie Metadata */}
              {cookieMetadata && (
                <div className="mt-2 pt-2 border-t border-gray-600">
                  <details className="text-xs">
                    <summary className="font-semibold cursor-pointer">Cookie Metadata</summary>
                    <div className="mt-1 space-y-1">
                      <div>Auth Cookies: {Object.keys(cookieMetadata.authCookies).length}</div>
                      {Object.entries(cookieMetadata.authCookies).map(
                        ([name, data]: [string, any]) => (
                          <div key={name} className="ml-2">
                            {name}: {data.present ? '✅' : '❌'}
                          </div>
                        )
                      )}
                    </div>
                  </details>
                </div>
              )}

              {/* Hub Events */}
              {expanded && hubEvents.length > 0 && (
                <div className="mt-2 pt-2 border-t border-gray-600">
                  <details className="text-xs">
                    <summary className="font-semibold cursor-pointer">
                      Recent Hub Events ({hubEvents.length})
                    </summary>
                    <div className="space-y-1 max-h-24 overflow-y-auto mt-1">
                      {hubEvents.slice(-3).map((event, i) => (
                        <div key={i} className="bg-gray-800 p-1 rounded">
                          <div>{event.event}</div>
                          <div className="text-gray-400">
                            {new Date(event.timestamp).toLocaleTimeString()}
                          </div>
                        </div>
                      ))}
                    </div>
                  </details>
                </div>
              )}

              {expanded && authFlowHistory.length > 0 && (
                <div className="mt-2 pt-2 border-t border-gray-600">
                  <details className="text-xs">
                    <summary className="font-semibold cursor-pointer">Auth History</summary>
                    <div className="space-y-1 max-h-32 overflow-y-auto mt-1">
                      {authFlowHistory.slice(-5).map((state, i) => (
                        <div key={i} className="bg-gray-800 p-1 rounded">
                          <div>
                            {state.route} | User: {state.user?.userId ? '✅' : '❌'} | Session:{' '}
                            {state.sessionValid ? '✅' : '❌'}
                          </div>
                          <div className="text-gray-400">
                            {new Date(state.lastChange).toLocaleTimeString()}
                          </div>
                        </div>
                      ))}
                    </div>
                  </details>
                </div>
              )}
            </>
          )}
        </div>

        {/* Onboarding Section */}
        <div className="space-y-1">
          <div
            className="sticky top-0 bg-black/90 font-semibold text-purple-300 flex items-center gap-2 cursor-pointer"
            onClick={() => toggleSection('onboarding')}
          >
            Onboarding Flow ({flowStatus.onboardingTransitions} transitions)
            <span
              className={`w-2 h-2 rounded-full ${
                status === 'loading'
                  ? 'bg-yellow-400 animate-pulse'
                  : error
                    ? 'bg-red-400'
                    : 'bg-green-400'
              }`}
            ></span>
            <span className="text-xs">{collapsedSections.onboarding ? '▶' : '▼'}</span>
          </div>
          {!collapsedSections.onboarding && (
            <>
              <div>
                Current: <span className="text-yellow-400">{currentStep}</span>{' '}
                {status === 'loading' && '🔄'}
              </div>
              <div>
                Completed: <span className="text-green-400">{completedSteps.length}</span> [
                {completedSteps.join(', ')}]
              </div>
              <div>
                Skipped: <span className="text-orange-400">{skippedSteps.length}</span> [
                {skippedSteps.join(', ')}]
              </div>
              <div>
                Profile: {userProfile ? '✅' : '❌'} {userProfile?.email}
              </div>
              <div>
                Org: {organization ? '✅' : '❌'} {organization?.name}
              </div>
              {error && <div className="text-red-400">Error: {error}</div>}

              {expanded && onboardingFlowHistory.length > 0 && (
                <div className="mt-2 pt-2 border-t border-gray-600">
                  <details className="text-xs">
                    <summary className="font-semibold cursor-pointer">Onboarding History</summary>
                    <div className="space-y-1 max-h-32 overflow-y-auto mt-1">
                      {onboardingFlowHistory.slice(-5).map((state, i) => (
                        <div key={i} className="bg-gray-800 p-1 rounded">
                          <div>
                            {state.currentStep} | C:{state.completedSteps.length} S:
                            {state.skippedSteps.length}
                          </div>
                          <div>
                            Profile: {state.userProfile ? '✅' : '❌'} | Org:{' '}
                            {state.organization ? '✅' : '❌'}
                          </div>
                          <div className="text-gray-400">
                            {new Date(state.lastChange).toLocaleTimeString()}
                          </div>
                        </div>
                      ))}
                    </div>
                  </details>
                </div>
              )}
            </>
          )}
        </div>
      </div>
      {/* Controls */}
      <div className="sticky bottom-0 bg-black/90 pt-2 border-t border-gray-600">
        <div className="flex flex-wrap gap-1 mb-2">
          <button
            onClick={runFullAudit}
            className="bg-gradient-to-r from-blue-600 to-purple-600 px-3 py-1 rounded text-xs hover:from-blue-500 hover:to-purple-500 font-semibold"
          >
            🧪 Full Audit
          </button>
          <button
            onClick={downloadDebugJson}
            className="bg-gray-600 px-2 py-1 rounded text-xs hover:bg-gray-500"
          >
            💾 JSON
          </button>
        </div>
        <div className="flex flex-wrap gap-1">
          <button
            onClick={testApiCall}
            className="bg-blue-600 px-2 py-1 rounded text-xs hover:bg-blue-500"
          >
            Test API
          </button>
          <button
            onClick={testProfileApi}
            className="bg-cyan-600 px-2 py-1 rounded text-xs hover:bg-cyan-500"
          >
            Test Profile
          </button>
          <button
            onClick={debugOnboardingHook}
            className="bg-indigo-600 px-2 py-1 rounded text-xs hover:bg-indigo-500"
          >
            Debug Hook
          </button>
          <button
            onClick={testOnboardingHook}
            className="bg-violet-600 px-2 py-1 rounded text-xs hover:bg-violet-500"
          >
            Test Hook
          </button>
          <button
            onClick={forceOnboardingRefresh}
            className="bg-pink-600 px-2 py-1 rounded text-xs hover:bg-pink-500"
          >
            Force Onboard
          </button>
          <button
            onClick={triggerOnboardingHook}
            className="bg-emerald-600 px-2 py-1 rounded text-xs hover:bg-emerald-500"
          >
            Load Profile
          </button>
          {userProfile && (
            <button
              onClick={() => {
                addLog('onboarding', 'Cannot manually set loading state in new provider')
              }}
              className="bg-teal-600 px-2 py-1 rounded text-xs hover:bg-teal-500"
            >
              Stop Loading
            </button>
          )}
          <button
            onClick={forceRefresh}
            className="bg-green-600 px-2 py-1 rounded text-xs hover:bg-green-500"
          >
            Refresh
          </button>
          <button
            onClick={forceAuthCheck}
            className="bg-purple-600 px-2 py-1 rounded text-xs hover:bg-purple-500"
          >
            Force Auth
          </button>
          {(route === 'setup' || !user) && (
            <>
              <button
                onClick={handleEmailVerification}
                className="bg-yellow-600 px-2 py-1 rounded text-xs hover:bg-yellow-500"
              >
                Check User
              </button>
              <button
                onClick={forceAuthState}
                className="bg-amber-600 px-2 py-1 rounded text-xs hover:bg-amber-500"
              >
                Force Auth
              </button>
            </>
          )}
          <button
            onClick={clearLogs}
            className="bg-red-600 px-2 py-1 rounded text-xs hover:bg-red-500"
          >
            Clear Logs
          </button>
        </div>
      </div>

      {/* API Test Results */}
      {apiTestResult && (
        <div className="mt-2 text-xs bg-gray-800 p-2 rounded">
          <div>
            API Test: {apiTestResult.success ? '✅' : '❌'} ({apiTestResult.time})
          </div>
          {apiTestResult.status && <div>Status: {apiTestResult.status}</div>}
          {apiTestResult.error && <div className="text-red-400">{apiTestResult.error}</div>}
          {apiTestResult.data && expanded && (
            <pre className="mt-1 text-xs overflow-x-auto">
              {JSON.stringify(apiTestResult.data, null, 2)}
            </pre>
          )}
        </div>
      )}

      {/* Debug Logs */}
      {expanded && debugLogs.length > 0 && (
        <div className="mt-3 pt-2 border-t border-gray-600">
          <div
            className="sticky top-0 bg-black/90 font-semibold text-xs mb-2 cursor-pointer flex items-center gap-2"
            onClick={() => toggleSection('logs')}
          >
            Debug Logs ({debugLogs.length}/100)
            <span className="text-xs">{collapsedSections.logs ? '▶' : '▼'}</span>
          </div>
          {!collapsedSections.logs && (
            <div
              ref={logContainerRef}
              className="space-y-1 max-h-48 overflow-y-auto bg-gray-900 p-2 rounded"
            >
              {debugLogs.slice(-30).map((log, i) => (
                <div
                  key={i}
                  className={`text-xs flex gap-2 ${
                    log.grouped ? 'bg-gray-800 p-2 rounded border-l-2 border-yellow-400' : ''
                  } ${
                    log.type === 'error'
                      ? 'text-red-400'
                      : log.type === 'auth'
                        ? 'text-blue-400'
                        : log.type === 'onboarding'
                          ? 'text-purple-400'
                          : log.type === 'api'
                            ? 'text-green-400'
                            : log.type === 'hub'
                              ? 'text-cyan-400'
                              : log.type === 'hook'
                                ? 'text-indigo-400'
                                : log.type === 'cookie'
                                  ? 'text-orange-400'
                                  : 'text-gray-400'
                  }`}
                >
                  <span className="text-gray-500 font-mono">{log.timestamp}</span>
                  <span className="font-semibold">[{log.type.toUpperCase()}]</span>
                  <span>{log.event}</span>
                  {log.data && (
                    <details className="inline">
                      <summary className="cursor-pointer text-gray-300">
                        ({Object.keys(log.data).length} fields)
                      </summary>
                      <pre className="mt-1 text-xs overflow-x-auto bg-gray-800 p-1 rounded">
                        {JSON.stringify(log.data, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
